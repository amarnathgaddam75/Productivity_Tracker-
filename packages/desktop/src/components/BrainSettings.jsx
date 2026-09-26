import { useEffect, useState } from 'react';
import { KeyRound, Zap, ExternalLink, Trash2, Plus, Brain, MapPin } from 'lucide-react';
import { PROVIDERS, createProvider, canTranscribe } from '@lifetracker/shared';
import { useStore } from '../config.js';
import { useAssistant } from '../assistant/state.js';

const Heading = ({ n, children }) => (
  <h2 className="caps text-slate-400">
    <span className="mr-2 text-[var(--accent)]">{`//${n}`}</span>
    {children}
  </h2>
);

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition ${checked ? 'border-brand-300/60 bg-brand-400/30' : 'border-white/15'}`}
    >
      <span className={`absolute top-[3px] h-4 w-4 rounded-full transition-all ${checked ? 'left-[23px] bg-brand-200' : 'left-[3px] bg-slate-500'}`} />
    </button>
  );
}

/** Which AI powers the assistant on this laptop (+ what it remembers about you). */
export default function BrainSettings() {
  const brain = useAssistant((s) => s.brain);
  const setBrain = useAssistant((s) => s.setBrain);
  const keys = useAssistant((s) => s.keys);
  const setKeys = useAssistant((s) => s.setKeys);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const memories = useStore((s) => s.memories);
  const addMemory = useStore((s) => s.addMemory);
  const removeMemory = useStore((s) => s.removeMemory);
  const [key, setKey] = useState('');
  const [test, setTest] = useState(null);
  const [city, setCity] = useState(settings.city || '');
  const [fact, setFact] = useState('');
  const bridge = window.desktop;
  const p = PROVIDERS[brain.provider] || PROVIDERS.builtin;
  const hasKey = Boolean(keys?.[brain.provider]);

  useEffect(() => setCity(settings.city || ''), [settings.city]);
  useEffect(() => {
    setTest(null);
    setKey('');
  }, [brain.provider]);

  const saveKey = async () => {
    if (!bridge?.setBrainKey) return;
    setKeys(await bridge.setBrainKey(brain.provider, key));
    setKey('');
    setTest({ ok: true, text: 'Key saved — encrypted on this laptop.' });
  };

  const runTest = async () => {
    setTest({ ok: null, text: 'Testing…' });
    try {
      const provider = createProvider(brain, (req) => bridge.llm(brain.provider, req));
      const res = await provider.chat({ system: 'You are a connection test. Reply with one short friendly sentence.', messages: [{ role: 'user', content: 'Are you there?' }], tools: [] });
      setTest({ ok: true, text: `Connected ✓ — “${(res.text || '').slice(0, 140)}”` });
    } catch (e) {
      setTest({ ok: false, text: e?.message || String(e) });
    }
  };

  const list = Object.values(memories || {}).filter((m) => !m.deleted).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <>
      <div className="card p-6">
        <Heading n="02">Brain</Heading>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Pick the AI that powers your assistant. It can answer anything, understands normal sentences and acts for you (tasks, timers,
          reminders, apps, websites). The built-in brain works offline but only understands commands.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <label className="block">
            <span className="caps text-slate-500">AI provider</span>
            <select className="input mt-1.5" value={brain.provider} onChange={(e) => setBrain({ provider: e.target.value, model: '', baseUrl: '' })} aria-label="AI provider">
              {Object.entries(PROVIDERS).map(([id, x]) => (
                <option key={id} value={id}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          {brain.provider !== 'builtin' && (
            <label className="block">
              <span className="caps text-slate-500">Model</span>
              <input className="input mt-1.5" value={brain.model || ''} placeholder={p.model || 'model name'} onChange={(e) => setBrain({ model: e.target.value.trim() })} aria-label="Model" />
            </label>
          )}
          {(p.kind === 'ollama' || brain.provider === 'custom') && (
            <label className="col-span-2 block">
              <span className="caps text-slate-500">Server address</span>
              <input className="input mt-1.5" value={brain.baseUrl || ''} placeholder={p.baseUrl} onChange={(e) => setBrain({ baseUrl: e.target.value.trim() })} aria-label="Server address" />
            </label>
          )}
          {p.needsKey && (
            <div className="col-span-2">
              <span className="caps text-slate-500">API key {hasKey && <span className="text-emerald-300">· saved</span>}</span>
              <div className="mt-1.5 flex gap-2">
                <input className="input flex-1" type="password" value={key} placeholder={hasKey ? '•••••••• (saved — paste a new one to replace)' : 'Paste your API key'} onChange={(e) => setKey(e.target.value)} aria-label="API key" autoComplete="off" />
                <button type="button" className="btn-outline" disabled={!key.trim()} onClick={saveKey}>
                  <KeyRound className="h-4 w-4" /> Save key
                </button>
                {p.keyUrl && (
                  <button type="button" className="btn-outline" onClick={() => bridge?.openUrl?.(p.keyUrl)}>
                    <ExternalLink className="h-4 w-4" /> Get a key
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {p.help && <p className="mt-3 text-sm text-slate-500">{p.help}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {brain.provider !== 'builtin' && (
            <button type="button" className="btn-primary" onClick={runTest} disabled={!bridge || (p.needsKey && !hasKey)}>
              <Zap className="h-4 w-4" /> Test connection
            </button>
          )}
          {test && <span className={`text-sm ${test.ok === false ? 'text-amber-300' : test.ok ? 'text-emerald-300' : 'text-slate-400'}`}>{test.text}</span>}
        </div>
        <div className="mt-5 divide-y divide-white/[0.06] border-t border-white/[0.06]">
          <div className="flex items-center justify-between gap-6 py-3">
            <div>
              <div className="text-sm text-slate-100">Answer my phone</div>
              <div className="text-sm text-slate-500">Questions you ask on the phone are answered by this laptop’s brain while it’s running.</div>
            </div>
            <Switch checked={brain.answerPhone !== false} onChange={(v) => setBrain({ answerPhone: v })} label="Answer my phone" />
          </div>
          <div className="flex items-center justify-between gap-6 py-3">
            <div>
              <div className="text-sm text-slate-100">Voice input</div>
              <div className="text-sm text-slate-500">
                {canTranscribe(brain) ? 'Click the mic or press Ctrl+Shift+J anywhere, then just talk.' : 'Needs Gemini, Groq or OpenAI (speech-to-text). On the phone, voice always works.'}
              </div>
            </div>
            <span className={`caps ${canTranscribe(brain) ? 'text-emerald-300' : 'text-slate-500'}`}>{canTranscribe(brain) ? 'Ready' : 'Off'}</span>
          </div>
          <form
            className="flex items-center justify-between gap-6 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              updateSettings({ city: city.trim().slice(0, 80) });
            }}
          >
            <div>
              <div className="text-sm text-slate-100">Your city</div>
              <div className="text-sm text-slate-500">For the weather on your dashboard and in briefings.</div>
            </div>
            <div className="flex gap-2">
              <input className="input w-56" value={city} placeholder="e.g. Hyderabad" onChange={(e) => setCity(e.target.value)} aria-label="City" />
              <button className="btn-outline" type="submit" disabled={city.trim() === (settings.city || '')}>
                <MapPin className="h-4 w-4" /> Save
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card p-6">
        <Heading n="03">Memory</Heading>
        <p className="mt-2 text-sm text-slate-400">What your assistant knows about you. It adds to this when you tell it things (“remember that I gym at 7”); it syncs to your phone.</p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (addMemory(fact)) setFact('');
          }}
        >
          <input className="input flex-1" value={fact} placeholder="e.g. I study best late at night" onChange={(e) => setFact(e.target.value)} aria-label="New memory" />
          <button className="btn-outline" type="submit" disabled={!fact.trim()}>
            <Plus className="h-4 w-4" /> Add
          </button>
        </form>
        {list.length === 0 ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Brain className="h-4 w-4" strokeWidth={1.5} /> Nothing yet.
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/[0.06]">
            {list.map((m) => (
              <li key={m.id} className="group flex items-center justify-between gap-4 py-2.5 text-sm">
                <span className="text-slate-200">{m.text}</span>
                <button onClick={() => removeMemory(m.id)} className="text-slate-600 hover:text-rose-300" aria-label={`Forget ${m.text}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
