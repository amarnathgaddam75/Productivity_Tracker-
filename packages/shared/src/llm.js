// "Brains" the assistant can use. Each provider turns our neutral chat format
// into one HTTP request and parses the answer back. The HTTP call itself is
// done by a `transport` supplied by the app:
//   - desktop: the Electron main process (no CORS, API key never leaves it)
//   - phone:   plain fetch with a key stored only on that phone
//
// Neutral message format:
//   { role: 'user', content }
//   { role: 'assistant', content, toolCalls?: [{ id, name, args }] }
//   { role: 'tool', toolCallId, name, content }

/** Replaced with the stored API key by the desktop main process. */
export const KEY_PLACEHOLDER = '__LT_API_KEY__';

export const PROVIDERS = {
  builtin: { label: 'Built-in (offline, commands only)', kind: 'builtin', needsKey: false },
  ollama: {
    label: 'Ollama — runs on this laptop, free',
    kind: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    model: 'qwen3:8b',
    needsKey: false,
    help: 'Install from ollama.com, then run: ollama pull qwen3:8b',
  },
  gemini: {
    label: 'Google Gemini — free API key',
    kind: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-flash-latest',
    needsKey: true,
    keyUrl: 'https://aistudio.google.com/apikey',
    stt: 'gemini',
    browser: true,
  },
  groq: {
    label: 'Groq — free API key',
    kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    needsKey: true,
    keyUrl: 'https://console.groq.com/keys',
    stt: 'openai',
    sttModel: 'whisper-large-v3-turbo',
    browser: true,
  },
  claude: {
    label: 'Claude (Anthropic API key)',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-5',
    needsKey: true,
    keyUrl: 'https://console.anthropic.com/settings/keys',
    browser: true,
  },
  openai: {
    label: 'OpenAI (API key)',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5-mini',
    needsKey: true,
    keyUrl: 'https://platform.openai.com/api-keys',
    stt: 'openai',
    sttModel: 'whisper-1',
  },
  openrouter: {
    label: 'OpenRouter (API key)',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openrouter/auto',
    needsKey: true,
    keyUrl: 'https://openrouter.ai/keys',
  },
  custom: {
    label: 'Custom OpenAI-compatible (LM Studio, vLLM…)',
    kind: 'openai',
    baseUrl: 'http://127.0.0.1:1234/v1',
    model: '',
    needsKey: false,
  },
};

/** Hosts the desktop main process will attach an API key for. */
export const KEY_HOSTS = ['generativelanguage.googleapis.com', 'api.groq.com', 'api.anthropic.com', 'api.openai.com', 'openrouter.ai'];

const safeJson = (s) => {
  if (s && typeof s === 'object') return s;
  try {
    return JSON.parse(s || '{}');
  } catch {
    return {};
  }
};
const stripThinking = (s) => String(s || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
let callSeq = 0;
const callId = () => `call_${Date.now().toString(36)}_${++callSeq}`;

// ---- request builders -----------------------------------------------------------

function openaiTools(tools) {
  return tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
}

function toOpenAIMessages(system, messages) {
  const out = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (m.role === 'tool') out.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content });
    else if (m.role === 'assistant' && m.toolCalls?.length)
      out.push({
        role: 'assistant',
        content: m.content || '',
        tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args || {}) } })),
      });
    else out.push({ role: m.role, content: m.content || '' });
  }
  return out;
}

function toOllamaMessages(system, messages) {
  const out = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (m.role === 'tool') out.push({ role: 'tool', content: m.content, tool_name: m.name });
    else if (m.role === 'assistant' && m.toolCalls?.length)
      out.push({ role: 'assistant', content: m.content || '', tool_calls: m.toolCalls.map((c) => ({ function: { name: c.name, arguments: c.args || {} } })) });
    else out.push({ role: m.role, content: m.content || '' });
  }
  return out;
}

function toAnthropicMessages(messages) {
  const out = [];
  const push = (role, block) => {
    const last = out[out.length - 1];
    if (last && last.role === role) last.content.push(block);
    else out.push({ role, content: [block] });
  };
  for (const m of messages) {
    if (m.role === 'tool') push('user', { type: 'tool_result', tool_use_id: m.toolCallId, content: m.content });
    else if (m.role === 'assistant') {
      if (m.content) push('assistant', { type: 'text', text: m.content });
      for (const c of m.toolCalls || []) push('assistant', { type: 'tool_use', id: c.id, name: c.name, input: c.args || {} });
    } else push('user', { type: 'text', text: m.content || '' });
  }
  return out;
}

/**
 * Build the HTTP request for one chat turn.
 * @returns {{ url: string, method: 'POST', headers: object, body: object }}
 */
export function buildChatRequest(cfg, { system, messages, tools }) {
  const p = { ...PROVIDERS[cfg.provider], ...cfg };
  const key = cfg.apiKey || KEY_PLACEHOLDER;
  const base = String(p.baseUrl || '').replace(/\/+$/, '');
  if (p.kind === 'ollama') {
    return {
      url: `${base}/api/chat`,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { model: p.model, messages: toOllamaMessages(system, messages), ...(tools.length ? { tools: openaiTools(tools) } : {}), stream: false, options: { temperature: 0.4 } },
    };
  }
  if (p.kind === 'anthropic') {
    return {
      url: `${base}/v1/messages`,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: {
        model: p.model,
        max_tokens: 1024,
        system,
        messages: toAnthropicMessages(messages),
        ...(tools.length ? { tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) } : {}),
      },
    };
  }
  const headers = { 'content-type': 'application/json' };
  if (p.needsKey || cfg.apiKey) headers.authorization = `Bearer ${key}`;
  return {
    url: `${base}/chat/completions`,
    method: 'POST',
    headers,
    body: { model: p.model, messages: toOpenAIMessages(system, messages), ...(tools.length ? { tools: openaiTools(tools) } : {}) },
  };
}

/** Parse a provider response into `{ text, toolCalls }`. */
export function parseChatResponse(cfg, json) {
  const kind = PROVIDERS[cfg.provider]?.kind;
  if (json?.error) throw new Error(typeof json.error === 'string' ? json.error : json.error.message || 'The AI service returned an error.');
  if (kind === 'ollama') {
    const m = json?.message || {};
    return {
      text: stripThinking(m.content),
      toolCalls: (m.tool_calls || []).map((c) => ({ id: callId(), name: c.function?.name, args: safeJson(c.function?.arguments) })),
    };
  }
  if (kind === 'anthropic') {
    const blocks = json?.content || [];
    return {
      text: blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim(),
      toolCalls: blocks.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, args: b.input || {} })),
    };
  }
  const m = json?.choices?.[0]?.message || {};
  return {
    text: stripThinking(m.content),
    toolCalls: (m.tool_calls || []).map((c) => ({ id: c.id || callId(), name: c.function?.name, args: safeJson(c.function?.arguments) })),
  };
}

/**
 * A chat function for the agent loop.
 * @param {object} cfg { provider, model?, baseUrl?, apiKey? }
 * @param {(req) => Promise<object>} transport performs the HTTP request, resolves with parsed JSON
 */
export function createProvider(cfg, transport) {
  return {
    cfg,
    async chat({ system, messages, tools }) {
      const req = buildChatRequest(cfg, { system, messages, tools });
      const json = await transport(req);
      return parseChatResponse(cfg, json);
    },
  };
}

// ---- speech to text ---------------------------------------------------------------

export function canTranscribe(cfg) {
  return Boolean(PROVIDERS[cfg?.provider]?.stt);
}

/** Request to transcribe a WAV recording (base64) with the chosen provider. */
export function buildTranscribeRequest(cfg, { audioBase64, mime = 'audio/wav' }) {
  const p = { ...PROVIDERS[cfg.provider], ...cfg };
  const key = cfg.apiKey || KEY_PLACEHOLDER;
  if (p.stt === 'gemini') {
    const model = /^gemini/.test(p.model || '') ? p.model : 'gemini-flash-latest';
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: {
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mime, data: audioBase64 } },
              { text: 'Transcribe this voice command exactly as spoken. Reply with only the transcript, nothing else.' },
            ],
          },
        ],
      },
    };
  }
  if (p.stt === 'openai') {
    return {
      url: `${String(p.baseUrl).replace(/\/+$/, '')}/audio/transcriptions`,
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
      multipart: { fields: { model: p.sttModel || 'whisper-1', response_format: 'json' }, file: { field: 'file', name: 'speech.wav', mime, base64: audioBase64 } },
    };
  }
  throw new Error('This brain has no speech-to-text. Choose Gemini or Groq for voice input.');
}

export function parseTranscribeResponse(cfg, json) {
  if (json?.error) throw new Error(json.error.message || String(json.error));
  if (PROVIDERS[cfg.provider]?.stt === 'gemini')
    return (json?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join(' ').trim();
  return String(json?.text || '').trim();
}

/** Browser/phone transport: plain fetch (JSON or multipart). */
export async function fetchTransport(req, { timeoutMs = 60000 } = {}) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl && setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let body;
    const headers = { ...req.headers };
    if (req.multipart) {
      body = new FormData();
      for (const [k, v] of Object.entries(req.multipart.fields || {})) body.append(k, v);
      const f = req.multipart.file;
      const bytes = Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0));
      body.append(f.field, new Blob([bytes], { type: f.mime }), f.name);
    } else body = JSON.stringify(req.body);
    const res = await fetch(req.url, { method: req.method || 'POST', headers, body, signal: ctrl?.signal });
    const text = await res.text();
    const json = safeJson(text);
    if (!res.ok) throw new Error(json?.error?.message || json?.error || `${res.status} ${res.statusText}`);
    return json;
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('The AI took too long to answer.');
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
