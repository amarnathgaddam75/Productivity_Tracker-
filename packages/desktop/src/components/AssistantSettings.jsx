import { useEffect, useState } from 'react';
import { Smartphone, Send, Trash2, Save } from 'lucide-react';
import { voiceAvailable, speak, DEFAULT_DISTRACTIONS } from '@lifetracker/shared';
import { useStore } from '../config.js';
import { pushToPhones } from '../assistant/phone.js';

function Row({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div>
        <div className="text-sm text-slate-100">{label}</div>
        {description && <div className="text-sm text-slate-500">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 rounded-full border transition ${checked ? 'border-brand-300/60 bg-brand-400/30' : 'border-white/15'}`}
    >
      <span className={`absolute top-[3px] h-4 w-4 rounded-full transition-all ${checked ? 'left-[23px] bg-brand-200' : 'left-[3px] bg-slate-500'}`} />
    </button>
  );
}

const hourLabel = (h) => new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' });

/** Assistant behaviour + phone notification settings. */
export default function AssistantSettings() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const devices = useStore((s) => s.devices);
  const pushKeys = useStore((s) => s.pushKeys);
  const removeDevice = useStore((s) => s.removeDevice);
  const [form, setForm] = useState({});
  const [saved, setSaved] = useState(false);
  const [test, setTest] = useState('');
  const isDesktop = Boolean(window.desktop);

  useEffect(() => {
    setForm({
      assistantName: settings.assistantName || 'Atlas',
      workStartHour: settings.workStartHour ?? 9,
      workEndHour: settings.workEndHour ?? 18,
      checkinMinutes: settings.checkinMinutes ?? 60,
      nudgeUntrackedMinutes: settings.nudgeUntrackedMinutes ?? 15,
      idlePauseMinutes: settings.idlePauseMinutes ?? 10,
      distractions: settings.distractions ?? DEFAULT_DISTRACTIONS,
    });
  }, [settings.assistantName, settings.workStartHour, settings.workEndHour, settings.checkinMinutes, settings.nudgeUntrackedMinutes, settings.idlePauseMinutes, settings.distractions]);

  const int = (v, lo, hi, d) => Math.max(lo, Math.min(hi, parseInt(v, 10) || d));
  const save = (e) => {
    e.preventDefault();
    update({
      assistantName: String(form.assistantName || 'Atlas').trim().slice(0, 30) || 'Atlas',
      workStartHour: int(form.workStartHour, 0, 23, 9),
      workEndHour: Math.max(int(form.workStartHour, 0, 23, 9) + 1, int(form.workEndHour, 1, 24, 18)),
      checkinMinutes: int(form.checkinMinutes, 0, 600, 60),
      nudgeUntrackedMinutes: int(form.nudgeUntrackedMinutes, 0, 600, 15),
      idlePauseMinutes: int(form.idlePauseMinutes, 0, 600, 10),
      distractions: String(form.distractions || '').slice(0, 1000),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  const field = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) });
  const phones = Object.values(devices || {});

  return (
    <>
      <form onSubmit={save} className="card p-6">
        <h2 className="caps text-slate-400"><span className="mr-2 text-[var(--accent)]">{'//04'}</span>Assistant</h2>
        <div className="mt-5 grid grid-cols-3 gap-4">
          <div>
            <label className="label" htmlFor="a-name">Assistant name</label>
            <input id="a-name" className="input" maxLength={30} {...field('assistantName')} />
          </div>
          <div>
            <label className="label" htmlFor="a-start">Work day starts</label>
            <select id="a-start" className="input" {...field('workStartHour')}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="a-end">Wrap-up at</label>
            <select id="a-end" className="input" {...field('workEndHour')}>
              {Array.from({ length: 24 }, (_, h) => <option key={h + 1} value={h + 1}>{hourLabel((h + 1) % 24)}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="a-checkin">Check in every (min)</label>
            <input id="a-checkin" type="number" min="0" max="600" className="input tabular" {...field('checkinMinutes')} />
          </div>
          <div>
            <label className="label" htmlFor="a-untracked">Nudge if untracked for (min)</label>
            <input id="a-untracked" type="number" min="0" max="600" className="input tabular" {...field('nudgeUntrackedMinutes')} />
          </div>
          <div>
            <label className="label" htmlFor="a-idle">Auto-pause when away (min)</label>
            <input id="a-idle" type="number" min="0" max="600" className="input tabular" {...field('idlePauseMinutes')} />
          </div>
          <div className="col-span-3">
            <label className="label" htmlFor="a-distract">Distractions (comma separated app or site names)</label>
            <input id="a-distract" className="input" {...field('distractions')} />
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">Set any minutes to 0 to turn that nudge off.</p>
        <div className="mt-4 flex items-center gap-3">
          <button className="btn-primary" type="submit"><Save className="h-3.5 w-3.5" /> Save</button>
          {saved && <span className="caps text-emerald-300">Saved</span>}
        </div>
      </form>

      <div className="card divide-y divide-white/[0.06] px-6 py-2">
        <Row label="Speak briefings and nudges" description={voiceAvailable() ? 'Uses your system voice, offline.' : 'No system voice found (on Linux install speech-dispatcher + espeak-ng).'}>
          <div className="flex items-center gap-3">
            <button className="caps text-slate-500 hover:text-slate-200" onClick={() => speak(`Hi, I'm ${settings.assistantName || 'Atlas'}. I'll keep you on track today.`)}>Test</button>
            <Switch label="Voice" checked={settings.voice !== false} onChange={(v) => update({ voice: v })} />
          </div>
        </Row>
        <Row label="UI sounds" description="Soft chimes for start, pause, complete and nudges.">
          <Switch label="Sounds" checked={settings.sounds !== false} onChange={(v) => update({ sounds: v })} />
        </Row>
        {isDesktop && (
          <Row label="Keep running in the tray" description="Closing the window keeps the assistant tracking and reminding you.">
            <Switch label="Run in background" checked={settings.runInBackground !== false} onChange={(v) => update({ runInBackground: v })} />
          </Row>
        )}
        {isDesktop && (
          <Row label="Start with my computer" description="Launches quietly into the tray when you log in.">
            <Switch label="Start at login" checked={Boolean(settings.startAtLogin)} onChange={(v) => update({ startAtLogin: v })} />
          </Row>
        )}
      </div>

      <div className="card p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="caps text-slate-400"><span className="mr-2 text-[var(--accent)]">{'//05'}</span>Phone notifications</h2>
          <Switch label="Send to phone" checked={settings.pushToPhone !== false} onChange={(v) => update({ pushToPhone: v })} />
        </div>
        <p className="mt-3 max-w-2xl text-sm text-slate-400">
          This computer sends reminders, nudges and reports straight to your phone — even when the phone app is closed.
          On the phone open <span className="text-slate-200">lifetracker-90c0b.web.app/app</span>, install it, then tap
          <span className="text-slate-200"> Alerts → Enable notifications</span>.
        </p>
        <ul className="mt-5 divide-y divide-white/[0.06]">
          {phones.length === 0 && <li className="py-3 text-sm text-slate-500">No phones connected yet.</li>}
          {phones.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-3 text-sm">
              <Smartphone className="h-4 w-4 text-slate-400" strokeWidth={1.5} />
              <span className="text-slate-200">{d.platform || 'Phone'}</span>
              <span className="truncate text-slate-500">{(d.userAgent || '').slice(0, 60)}</span>
              <button className="icon-btn ml-auto" title="Disconnect" onClick={() => removeDevice(d.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center gap-3">
          <button
            className="btn-outline"
            disabled={!isDesktop || !phones.length || !pushKeys}
            onClick={async () => {
              setTest('Sending…');
              const r = await pushToPhones({ kind: 'assistant', title: `${settings.assistantName || 'Atlas'} is connected`, body: 'Phone notifications are working. I’ll keep you posted.' });
              setTest(r.length ? `${r.filter((x) => x.ok).length}/${r.length} delivered` : 'Nothing sent — check the switch above');
            }}
          >
            <Send className="h-3.5 w-3.5" /> Send test notification
          </button>
          {test && <span className="caps text-slate-400">{test}</span>}
          {!isDesktop && <span className="text-xs text-slate-500">Phone notifications are sent by the desktop app.</span>}
        </div>
        {isDesktop && (
          <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
            <div>
              <div className="text-sm text-slate-100">Share window titles with my phone</div>
              <div className="text-sm text-slate-500">Off: the phone only sees the app name (e.g. “VS Code”), never titles.</div>
            </div>
            <Switch label="Share titles" checked={Boolean(settings.shareTitles)} onChange={(v) => update({ shareTitles: v })} />
          </div>
        )}
      </div>
    </>
  );
}
