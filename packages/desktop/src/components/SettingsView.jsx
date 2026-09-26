import { useEffect, useState } from 'react';
import { Bell, Smartphone, Save, Download } from 'lucide-react';
import { useStore, mobileUrl, isElectron } from '../config.js';

function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6 py-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-sm text-slate-500 dark:text-slate-400">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full border transition ${checked ? 'border-brand-300/60 bg-brand-400/30' : 'border-white/15 bg-transparent'}`}
      >
        <span className={`absolute top-[3px] h-4 w-4 rounded-full transition-all ${checked ? 'left-[23px] bg-brand-200' : 'left-[3px] bg-slate-500'}`} />
      </button>
    </label>
  );
}

export default function SettingsView() {
  const settings = useStore((s) => s.settings);
  const user = useStore((s) => s.user);
  const updateSettings = useStore((s) => s.updateSettings);
  const [name, setName] = useState(settings.displayName || user?.displayName || '');
  const [goal, setGoal] = useState(String(settings.dailyGoalHours));
  const [hour, setHour] = useState(String(settings.summaryHour));
  const [saved, setSaved] = useState(false);
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');

  useEffect(() => {
    setGoal(String(settings.dailyGoalHours));
    setHour(String(settings.summaryHour));
  }, [settings.dailyGoalHours, settings.summaryHour]);

  function save(e) {
    e.preventDefault();
    updateSettings({
      displayName: name.trim(),
      dailyGoalHours: Math.max(0.5, Math.min(24, parseFloat(goal) || 6)),
      summaryHour: Math.max(0, Math.min(23, parseInt(hour, 10) || 18)),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="grid max-w-4xl gap-6">
      <form onSubmit={save} className="card p-6">
        <h2 className="caps text-slate-400"><span className="mr-2 text-brand-300">{'//01'}</span>Profile & goals</h2>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <label className="label" htmlFor="s-name">Display name</label>
            <input id="s-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </div>
          <div>
            <label className="label" htmlFor="s-goal">Daily goal (hours)</label>
            <input id="s-goal" type="number" min="0.5" max="24" step="0.5" className="input tabular" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="s-hour">Daily summary at</label>
            <select id="s-hour" className="input" value={hour} onChange={(e) => setHour(e.target.value)}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' })}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button className="btn-primary" type="submit"><Save className="h-4 w-4" /> Save</button>
          {saved && <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved ✓</span>}
        </div>
      </form>

      <div className="card divide-y divide-slate-100 px-6 py-3 dark:divide-slate-800">
        <Toggle
          label="Carry over unfinished tasks"
          description="At midnight, incomplete tasks move to the new day."
          checked={settings.carryOver}
          onChange={(v) => updateSettings({ carryOver: v })}
        />
        <Toggle
          label="Auto-start next task"
          description="When you complete the running task, the next open task starts automatically."
          checked={settings.autoStartNext}
          onChange={(v) => updateSettings({ autoStartNext: v })}
        />
        <Toggle
          label="System notifications"
          description="Show desktop notifications in addition to in-app alerts."
          checked={settings.systemNotifications}
          onChange={(v) => updateSettings({ systemNotifications: v })}
        />
        {!isElectron && perm !== 'granted' && perm !== 'unsupported' && (
          <div className="flex items-center justify-between py-3">
            <div className="text-sm text-slate-500">Browser notifications are {perm === 'denied' ? 'blocked' : 'not enabled yet'}.</div>
            <button className="btn-outline" disabled={perm === 'denied'} onClick={() => Notification.requestPermission().then(setPerm)}>
              <Bell className="h-4 w-4" /> Enable
            </button>
          </div>
        )}
      </div>

      <div className="card flex items-center justify-between gap-6 p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 text-brand-300"><Smartphone className="h-5 w-5" strokeWidth={1.5} /></span>
          <div>
            <div className="font-medium">Mobile companion</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Open {mobileUrl ? <span className="font-mono text-slate-700 dark:text-slate-300">{mobileUrl}</span> : 'the LifeTracker web app'} on your phone,
              log in with <b>{user?.email}</b> and tap “Add to Home Screen”.
            </div>
          </div>
        </div>
        {mobileUrl && <a className="btn-outline shrink-0" href={mobileUrl} target="_blank" rel="noreferrer"><Download className="h-4 w-4" /> Open</a>}
      </div>
    </div>
  );
}
