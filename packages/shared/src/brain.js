// One entry point for "ask the assistant", used by the laptop (which can also
// answer for the phone) and by the phone. Writes both sides of the exchange to
// the synced chat so every device shows the same conversation.

import { runAgent, runBuiltin, parseIntent } from './agent.js';
import { createProvider, PROVIDERS } from './llm.js';
import { MS_MINUTE } from './time.js';

export const DEFAULT_BRAIN = { provider: 'builtin', model: '', baseUrl: '' };

/** Chat docs sorted oldest -> newest (tombstones removed). */
export function chatList(chat = {}) {
  return Object.values(chat)
    .filter((m) => m && !m.deleted)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || (a.role === 'user' ? -1 : 1));
}

/** Last turns as model history (excluding `exceptId`). */
export function chatHistory(chat, exceptId, max = 12) {
  return chatList(chat)
    .filter((m) => m.id !== exceptId && m.status !== 'pending' && m.status !== 'working' && m.text && !String(m.text).startsWith('⏰'))
    .slice(-max)
    .map((m) => ({ role: m.role, content: m.text }));
}

export function brainLabel(cfg) {
  const p = PROVIDERS[cfg?.provider] || PROVIDERS.builtin;
  if (!cfg || cfg.provider === 'builtin') return 'Built-in';
  return `${p.label.split(' — ')[0].split(' (')[0]} · ${cfg.model || p.model}`;
}

/**
 * @param {object} o
 * @param {object} o.store         zustand tracker store
 * @param {string} o.input         what the user said
 * @param {'desktop'|'phone'} o.from   where the user said it
 * @param {'desktop'|'phone'} o.platform  where this code runs (decides laptop-only tools)
 * @param {object} o.cfg           { provider, model, baseUrl, apiKey? }
 * @param {(req) => Promise<object>} [o.transport]
 * @param {object} [o.ctx]         extra agent context (profile, activity, system, weather, name)
 * @param {object} [o.userMsg]     an existing pending chat doc (answering for another device)
 */
export async function askAssistant({ store, input, from, platform, cfg = DEFAULT_BRAIN, transport, ctx = {}, userMsg }) {
  const s = store.getState();
  const text = String(input || '').trim();
  const q = userMsg || s.addChat({ role: 'user', text, from, status: 'working' });
  if (userMsg) s.updateChat(userMsg.id, { status: 'working' });
  const agentCtx = { store, now: Date.now(), platform, name: '', profile: null, activity: null, ...ctx };

  let result;
  let error = null;
  const useAI = cfg?.provider && cfg.provider !== 'builtin' && transport;
  if (useAI) {
    try {
      const provider = createProvider(cfg, transport);
      result = await runAgent({ provider, input: text, history: chatHistory(store.getState().chat, q?.id), ctx: agentCtx });
    } catch (e) {
      error = e?.message || String(e);
    }
  }
  if (!result) {
    if (error && !parseIntent(text, agentCtx.now)) {
      result = { reply: `My AI brain isn't reachable right now (${error}). I can still handle tasks, timers and reminders.`, actions: [] };
    } else {
      result = await runBuiltin({ input: text, ctx: agentCtx });
      if (error) result.reply += ' (answered offline — the AI brain is unreachable)';
    }
  }
  const reply = store.getState().addChat({
    role: 'assistant',
    text: result.reply,
    from,
    replyTo: q?.id,
    status: error && !result.actions?.length ? 'error' : 'done',
    actions: (result.actions || []).filter((a) => a.ok).map((a) => a.name),
  });
  if (q) store.getState().updateChat(q.id, { status: 'done' });
  return { ...result, error, reply: result.reply, replyMsg: reply };
}

/** Pending questions from other devices that this host should answer. */
export function pendingForHost(chat, { from = 'phone', now = Date.now() } = {}) {
  return chatList(chat).filter((m) => m.role === 'user' && m.from === from && m.status === 'pending' && now - (m.createdAt || 0) < 10 * MS_MINUTE);
}

/** Is a laptop online to answer the phone? (presence heartbeat is every 2 min) */
export function hostOnline(presence, now = Date.now()) {
  return Boolean(presence?.updatedAt && now - presence.updatedAt < 4 * MS_MINUTE && presence.answers !== false);
}
