import { useEffect, useRef, useState } from 'react';
import { LogOut, Download, Monitor, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useStore, desktopDownloadUrl } from '../config';

function SyncDot() {
  const sync = useStore((s) => s.sync);
  const online = useStore((s) => s.online);
  if (!online)
    return (
      <span className="flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
        <CloudOff className="h-3 w-3" /> Offline{sync.pending ? ` · ${sync.pending}` : ''}
      </span>
    );
  if (sync.status === 'syncing' || sync.status === 'pending')
    return (
      <span className="flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-600 dark:text-brand-300">
        <RefreshCw className="h-3 w-3 animate-spin" /> Syncing
      </span>
    );
  if (sync.status === 'error')
    return (
      <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-600">
        <AlertTriangle className="h-3 w-3" /> Sync error
      </span>
    );
  return <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Synced</span>;
}

export default function Header() {
  const user = useStore((s) => s.user);
  const name = useStore((s) => s.settings.displayName) || user?.displayName || user?.email || '';
  const signOut = useStore((s) => s.signOut);
  const [open, setOpen] = useState(false);
  const [installEvt, setInstallEvt] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;

  return (
    <header className="safe-top sticky top-0 z-30 bg-slate-50/90 px-4 pb-2 backdrop-blur dark:bg-slate-950/90">
      <div className="flex items-center justify-between pt-3">
        <div className="min-w-0">
          <div className="text-xs text-slate-500">{greeting}</div>
          <div className="truncate text-lg font-semibold">{name.split('@')[0]}</div>
        </div>
        <div className="flex items-center gap-3" ref={ref}>
          <SyncDot />
          <button onClick={() => setOpen((o) => !o)} className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold uppercase text-white" aria-label="Account menu">
            {name.slice(0, 1) || '?'}
          </button>
          {open && (
            <div className="card absolute right-4 top-16 w-64 animate-slide-down p-2 shadow-xl">
              <div className="truncate px-3 py-2 text-xs text-slate-500">{user?.email}</div>
              {installEvt && (
                <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm active:bg-slate-100 dark:active:bg-slate-800" onClick={() => { installEvt.prompt(); setInstallEvt(null); setOpen(false); }}>
                  <Download className="h-4 w-4" /> Install app
                </button>
              )}
              {!installEvt && isIos && !standalone && (
                <div className="px-3 py-2 text-xs text-slate-500">To install: tap Share → “Add to Home Screen”.</div>
              )}
              {desktopDownloadUrl && (
                <a className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm active:bg-slate-100 dark:active:bg-slate-800" href={desktopDownloadUrl} target="_blank" rel="noreferrer">
                  <Monitor className="h-4 w-4" /> Get the desktop app
                </a>
              )}
              <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-rose-600 active:bg-slate-100 dark:active:bg-slate-800" onClick={signOut}>
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
