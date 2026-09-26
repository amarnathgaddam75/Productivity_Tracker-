import { describe, it, expect } from 'vitest';
import { parseWhen, describeWhen } from '../src/when.js';
import { learnProfile, suggestRoutines } from '../src/profile.js';
import { buildChatRequest, parseChatResponse, createProvider, buildTranscribeRequest, parseTranscribeResponse, KEY_PLACEHOLDER } from '../src/llm.js';
import { runAgent, runBuiltin, parseIntent, parseReminder, buildSystemPrompt, dueReminders, toUrl, TOOLS } from '../src/agent.js';
import { createTrackerStore } from '../src/store.js';
import { shiftDateKey, MS_HOUR, MS_MINUTE } from '../src/time.js';

const at = (d, h, m = 0) => new Date(2026, 8, d, h, m).getTime();
const NOW = at(26, 15); // Sat 26 Sep 2026, 3:00 PM

function makeStore() {
  const writes = [];
  const useStore = createTrackerStore();
  useStore.getState().startSession({ uid: `g${Math.random()}` }, { adapter: { write: async (path, data) => (writes.push({ path, data }), 'written') }, subscribe: false });
  useStore.setState({ today: '2026-09-26' });
  return { useStore, writes };
}

const ctxFor = (store, extra = {}) => ({ store, now: NOW, name: 'Advith', platform: 'desktop', profile: null, activity: null, ...extra });

describe('parseWhen', () => {
  it('understands relative and absolute times', () => {
    expect(parseWhen('in 20 minutes', NOW)).toBe(NOW + 20 * MS_MINUTE);
    expect(parseWhen('in an hour', NOW)).toBe(NOW + MS_HOUR);
    expect(parseWhen('2h', NOW)).toBe(NOW + 2 * MS_HOUR);
    expect(parseWhen('at 5pm', NOW)).toBe(at(26, 17));
    expect(parseWhen('5', NOW)).toBe(at(26, 17)); // 5 when it's 3 PM means 5 PM
    expect(parseWhen('9am', NOW)).toBe(at(27, 9)); // already past -> tomorrow
    expect(parseWhen('tomorrow at 9:30', NOW)).toBe(at(27, 9, 30));
    expect(parseWhen('tonight', NOW)).toBe(at(26, 20));
    expect(parseWhen('2026-09-28T08:15', NOW)).toBe(at(28, 8, 15));
    expect(parseWhen('someday', NOW)).toBeNull();
    expect(describeWhen(NOW + 25 * MS_MINUTE, NOW)).toBe('in 25 min');
  });
});

describe('learned profile', () => {
  it('finds routines, start time, estimate ratio and streak', () => {
    const tasks = {};
    for (let i = 1; i <= 10; i += 1) {
      const date = shiftDateKey('2026-09-26', -i);
      const d = 26 - i;
      tasks[`g${i}`] = { id: `g${i}`, title: 'Gym', date, estimatedHours: 1, completed: true, sessions: [{ start: at(d, 7), end: at(d, 8) }], createdAt: 1 };
      tasks[`w${i}`] = { id: `w${i}`, title: 'Deep work', date, estimatedHours: 2, completed: true, sessions: [{ start: at(d, 10), end: at(d, 12, 30) }], createdAt: 2 };
    }
    const p = learnProfile(tasks, { now: NOW });
    expect(p.typicalStartHour).toBe(7);
    expect(p.peakHours).toContain(10);
    expect(p.estimateRatio).toBe(1.13); // median of ten 1.0 (gym) and ten 1.25 (deep work)
    expect(p.streak).toBe(10);
    expect(p.routines.map((r) => r.title).sort()).toEqual(['Deep work', 'Gym']);
    expect(p.insights.join(' ')).toMatch(/usually start around 7/);
    const sug = suggestRoutines(tasks, p, NOW);
    expect(sug.length).toBe(2);
  });
});

describe('providers', () => {
  const tools = [{ name: 'add_task', description: 'x', parameters: { type: 'object', properties: {} } }];
  const messages = [
    { role: 'user', content: 'add gym' },
    { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'add_task', args: { title: 'Gym' } }] },
    { role: 'tool', toolCallId: 'c1', name: 'add_task', content: 'Added' },
  ];

  it('builds OpenAI-compatible requests (Gemini) with the key placeholder', () => {
    const req = buildChatRequest({ provider: 'gemini' }, { system: 'sys', messages, tools });
    expect(req.url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect(req.headers.authorization).toBe(`Bearer ${KEY_PLACEHOLDER}`);
    expect(req.body.messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect(req.body.messages[2].tool_calls[0].function.arguments).toBe('{"title":"Gym"}');
    expect(req.body.messages[3]).toEqual({ role: 'tool', tool_call_id: 'c1', content: 'Added' });
    const parsed = parseChatResponse({ provider: 'gemini' }, { choices: [{ message: { content: null, tool_calls: [{ id: 'z', function: { name: 'pause_task', arguments: '{}' } }] } }] });
    expect(parsed.toolCalls).toEqual([{ id: 'z', name: 'pause_task', args: {} }]);
  });

  it('builds Anthropic requests with tool_use / tool_result blocks', () => {
    const req = buildChatRequest({ provider: 'claude', apiKey: 'k' }, { system: 'sys', messages, tools });
    expect(req.headers['x-api-key']).toBe('k');
    expect(req.body.system).toBe('sys');
    expect(req.body.messages[1].content[0]).toEqual({ type: 'tool_use', id: 'c1', name: 'add_task', input: { title: 'Gym' } });
    expect(req.body.messages[2]).toEqual({ role: 'user', content: [{ type: 'tool_result', tool_use_id: 'c1', content: 'Added' }] });
    expect(req.body.tools[0].input_schema).toBeTruthy();
    const parsed = parseChatResponse({ provider: 'claude' }, { content: [{ type: 'text', text: 'Hi' }, { type: 'tool_use', id: 't', name: 'x', input: { a: 1 } }] });
    expect(parsed).toEqual({ text: 'Hi', toolCalls: [{ id: 't', name: 'x', args: { a: 1 } }] });
  });

  it('builds Ollama requests and strips thinking', () => {
    const req = buildChatRequest({ provider: 'ollama', model: 'qwen3:8b' }, { system: 'sys', messages, tools });
    expect(req.url).toBe('http://127.0.0.1:11434/api/chat');
    expect(req.body.stream).toBe(false);
    expect(req.body.messages[2].tool_calls[0].function.arguments).toEqual({ title: 'Gym' });
    expect(req.body.messages[3]).toEqual({ role: 'tool', content: 'Added', tool_name: 'add_task' });
    const parsed = parseChatResponse({ provider: 'ollama' }, { message: { content: '<think>hmm</think>Sure.', tool_calls: [{ function: { name: 'x', arguments: { q: 1 } } }] } });
    expect(parsed.text).toBe('Sure.');
    expect(parsed.toolCalls[0]).toMatchObject({ name: 'x', args: { q: 1 } });
  });

  it('builds speech-to-text requests', () => {
    const g = buildTranscribeRequest({ provider: 'gemini' }, { audioBase64: 'AAA' });
    expect(g.url).toContain(':generateContent');
    expect(g.body.contents[0].parts[0].inline_data).toEqual({ mime_type: 'audio/wav', data: 'AAA' });
    expect(parseTranscribeResponse({ provider: 'gemini' }, { candidates: [{ content: { parts: [{ text: ' add gym ' }] } }] })).toBe('add gym');
    const q = buildTranscribeRequest({ provider: 'groq' }, { audioBase64: 'AAA' });
    expect(q.url).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
    expect(q.multipart.fields.model).toBe('whisper-large-v3-turbo');
    expect(() => buildTranscribeRequest({ provider: 'ollama' }, { audioBase64: 'A' })).toThrow();
  });
});

describe('agent loop', () => {
  it('calls tools until the model answers', async () => {
    const { useStore } = makeStore();
    const script = [
      { text: '', toolCalls: [{ id: '1', name: 'add_task', args: { title: 'Write report', minutes: 90 } }, { id: '2', name: 'start_task', args: { task: 'report' } }] },
      { text: '', toolCalls: [{ id: '3', name: 'set_reminder', args: { text: 'stretch', when: 'in 45 minutes' } }] },
      { text: 'Report started, and I will remind you to stretch.', toolCalls: [] },
    ];
    const seen = [];
    const provider = { chat: async (req) => (seen.push({ ...req, messages: [...req.messages] }), script.shift()) };
    const res = await runAgent({ provider, input: 'start my report and remind me to stretch', ctx: ctxFor(useStore) });
    expect(res.reply).toBe('Report started, and I will remind you to stretch.');
    expect(res.actions.map((a) => a.name)).toEqual(['add_task', 'start_task', 'set_reminder']);
    expect(res.actions.every((a) => a.ok)).toBe(true);
    const s = useStore.getState();
    const t = Object.values(s.tasks)[0];
    expect(t.title).toBe('Write report');
    expect(t.runningSince).toBeTruthy();
    const r = Object.values(s.reminders)[0];
    expect(r.at).toBe(NOW + 45 * MS_MINUTE);
    // tool results are fed back to the model
    expect(seen[1].messages.at(-1)).toMatchObject({ role: 'tool', name: 'start_task' });
    expect(seen[0].system).toContain('You are Atlas');
    expect(seen[0].tools.some((x) => x.name === 'open_app')).toBe(true);
  });

  it('hides laptop-only tools on the phone and refuses them', async () => {
    const { useStore } = makeStore();
    let tools;
    const provider = { chat: async (req) => ((tools = req.tools), { text: '', toolCalls: [{ id: '1', name: 'open_app', args: { name: 'Spotify' } }] }) };
    const res = await runAgent({ provider, input: 'open spotify', ctx: ctxFor(useStore, { platform: 'phone' }), maxSteps: 1 });
    expect(tools.some((x) => x.name === 'open_app')).toBe(false);
    expect(res.actions[0].ok).toBe(false);
  });

  it('puts memories, reminders and habits into the system prompt', () => {
    const { useStore } = makeStore();
    useStore.getState().addMemory('Goes to the gym at 7am');
    useStore.getState().addReminder({ text: 'Call mom', at: NOW + 30 * MS_MINUTE });
    const prompt = buildSystemPrompt(ctxFor(useStore, { profile: { insights: ['You usually start around 9 AM.'], routines: [] } }));
    expect(prompt).toContain('- Goes to the gym at 7am');
    expect(prompt).toContain('in 30 min: Call mom');
    expect(prompt).toContain('Learned habits: You usually start around 9 AM.');
  });
});

describe('built-in brain', () => {
  it('parses reminders in both orders', () => {
    expect(parseReminder('remind me in 20 min to stretch', NOW)).toEqual({ text: 'stretch', at: NOW + 20 * MS_MINUTE });
    expect(parseReminder('remind me to call mom at 5pm', NOW)).toEqual({ text: 'call mom', at: at(26, 17) });
    expect(parseReminder('remind me tomorrow at 9 to pay rent', NOW)).toEqual({ text: 'pay rent', at: at(27, 9) });
  });

  it('maps phrases to tools', () => {
    expect(parseIntent('remember that I hate meetings before 10')).toEqual({ tool: 'remember', args: { fact: 'I hate meetings before 10' } });
    expect(parseIntent('open youtube').tool).toBe('open_website');
    expect(parseIntent('open vs code')).toEqual({ tool: 'open_app', args: { name: 'vs code' } });
    expect(parseIntent('move report to tomorrow')).toEqual({ tool: 'update_task', args: { task: 'report', day: 'tomorrow' } });
    expect(parseIntent('add gym 45 min tomorrow')).toEqual({ tool: 'add_task', args: { title: 'gym', minutes: 45, day: 'tomorrow' } });
    expect(parseIntent('how was my week').args.period).toBe('week');
    expect(parseIntent('plan my day').tool).toBe('suggest_plan');
    expect(parseIntent('what is the meaning of life')).toBeNull();
    expect(toUrl('youtube')).toBe('https://youtube.com');
    expect(toUrl('best pomodoro apps')).toBe('https://www.google.com/search?q=best%20pomodoro%20apps');
  });

  it('runs tools and explains itself for open questions', async () => {
    const { useStore } = makeStore();
    const ctx = ctxFor(useStore);
    expect((await runBuiltin({ input: 'add gym 45 min', ctx })).reply).toBe('Added “gym” (45m) for today.');
    expect((await runBuiltin({ input: 'remind me in 10 minutes to drink water', ctx })).reply).toBe('Reminder set in 10 min: drink water.');
    expect(dueReminders(useStore.getState().reminders, NOW + 11 * MS_MINUTE).map((r) => r.text)).toEqual(['drink water']);
    const opened = [];
    const r = await runBuiltin({ input: 'open github', ctx: { ...ctx, system: { openUrl: async (u) => opened.push(u) } } });
    expect(opened).toEqual(['https://github.com']);
    expect(r.reply).toBe('Opened github.com.');
    const q = await runBuiltin({ input: 'who won the world cup in 2022?', ctx });
    expect(q.understood).toBe(false);
    expect(q.reply).toMatch(/connect a brain/);
  });

  it('every tool has a JSON schema', () => {
    for (const t of TOOLS) {
      expect(t.parameters.type).toBe('object');
      expect(t.description.length).toBeGreaterThan(10);
    }
  });
});

describe('chat sync', () => {
  it('writes chat, reminder and memory docs to the sync queue', async () => {
    const { useStore, writes } = makeStore();
    const m = useStore.getState().addChat({ role: 'user', text: 'hello', from: 'phone', status: 'pending', actions: [{ name: 'x' }] });
    useStore.getState().updateChat(m.id, { status: 'done' });
    useStore.getState().addMemory('Likes tea.');
    await useStore.getState().syncNow();
    const paths = writes.map((w) => w.path);
    expect(paths).toContain(`chat/${m.id}`);
    expect(paths.some((p) => p.startsWith('memories/'))).toBe(true);
    const chatDoc = writes.filter((w) => w.path === `chat/${m.id}`).at(-1).data;
    expect(chatDoc.status).toBe('done');
    expect(chatDoc.actions).toEqual(['x']);
    expect(Object.values(useStore.getState().memories)[0].text).toBe('Likes tea');
  });
});

describe('askAssistant', async () => {
  const { askAssistant, pendingForHost, hostOnline, chatList } = await import('../src/brain.js');

  it('answers with the AI and records both sides of the chat', async () => {
    const { useStore } = makeStore();
    const transport = async (req) => ({ choices: [{ message: { content: `echo ${req.body.messages.at(-1).content}` } }] });
    const res = await askAssistant({ store: useStore, input: 'hello', from: 'desktop', platform: 'desktop', cfg: { provider: 'custom', baseUrl: 'http://x/v1' }, transport });
    expect(res.reply).toBe('echo hello');
    const list = chatList(useStore.getState().chat);
    expect(list.map((m) => [m.role, m.status])).toEqual([['user', 'done'], ['assistant', 'done']]);
    expect(list[1].replyTo).toBe(list[0].id);
  });

  it('falls back to the built-in brain when the AI is unreachable', async () => {
    const { useStore } = makeStore();
    const transport = async () => {
      throw new Error('offline');
    };
    const cfg = { provider: 'gemini' };
    const a = await askAssistant({ store: useStore, input: 'add gym 30m', from: 'desktop', platform: 'desktop', cfg, transport });
    expect(a.reply).toMatch(/^Added “gym”.*answered offline/);
    const b = await askAssistant({ store: useStore, input: 'why is the sky blue', from: 'desktop', platform: 'desktop', cfg, transport });
    expect(b.reply).toMatch(/isn't reachable right now \(offline\)/);
  });

  it('lets a laptop answer questions asked on the phone', async () => {
    const { useStore } = makeStore();
    const q = useStore.getState().addChat({ role: 'user', text: 'pause', from: 'phone', status: 'pending' });
    expect(pendingForHost(useStore.getState().chat).map((m) => m.id)).toEqual([q.id]);
    await askAssistant({ store: useStore, input: q.text, from: 'phone', platform: 'desktop', cfg: { provider: 'builtin' }, userMsg: q });
    expect(pendingForHost(useStore.getState().chat)).toEqual([]);
    const reply = chatList(useStore.getState().chat).find((m) => m.role === 'assistant');
    expect(reply).toMatchObject({ replyTo: q.id, from: 'phone', text: 'No timer is running.' });
    expect(hostOnline({ updatedAt: Date.now() - 60000, answers: true })).toBe(true);
    expect(hostOnline({ updatedAt: Date.now() - 600000 })).toBe(false);
  });
});
