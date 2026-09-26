import { useEffect, useRef, useState } from 'react';
import { LogOut, Download, Monitor, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useStore, desktopDownloadUrl } from '../config';
import Presence from './Presence';

function SyncDot() {
  const sync = useStore((s) => s.sync);
  const online = useStore((s) => s.online);
  if (!online)
    return (
      <span className="caps flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-slate-300">
        <CloudOff className="h-3 w-3" /> Offline{sync.pending ? ` · ${sync.pending}` : ''}
      </span>
    );
  if (sync.status === 'syncing' || sync.status === 'pending')
    return (
      <span className="caps flex items-center gap-1.5 rounded-full border border-brand-300/30 px-2.5 py-1 text-brand-200">
        <RefreshCw className="h-3 w-3 animate-spin" /> Syncing
      </span>
    );
  if (sync.status === 'error')
    return (
      <span className="caps flex items-center gap-1.5 rounded-full border border-rose-300/30 px-2.5 py-1 text-rose-300">
        <AlertTriangle className="h-3 w-3" /> Sync error
      </span>
    );
  return <span className="caps flex items-center gap-1.5 text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px] shadow-emerald-300" /> Synced</span>;
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
    <header className="safe-top sticky top-0 z-30 bg-gradient-to-b from-slate-950/90 to-transparent px-4 pb-3">
      <div className="flex items-center justify-between pt-3">
        <div className="min-w-0">
          <div className="caps text-slate-500"><span className="mr-2 text-[var(--accent)]">{'//LT'}</span>{greeting}</div>
          <div className="font-display mt-1 truncate text-2xl leading-none">{name.split('@')[0]}</div>
          <Presence />
        </div>
        <div className="flex items-center gap-3" ref={ref}>
          <SyncDot />
          <button onClick={() => setOpen((o) => !o)} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 text-xs uppercase text-slate-100" aria-label="Account menu">
            {name.slice(0, 1) || '?'}
          </button>
          {open && (
            <div className="card absolute right-4 top-16 w-64 animate-slide-down p-2 shadow-xl">
              <div className="truncate px-3 py-2 text-xs text-slate-500">{user?.email}</div>
              {installEvt && (
                <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm active:bg-white/5" onClick={() => { installEvt.prompt(); setInstallEvt(null); setOpen(false); }}>
                  <Download className="h-4 w-4" /> Install app
                </button>
              )}
              {!installEvt && isIos && !standalone && (
                <div className="px-3 py-2 text-xs text-slate-500">To install: tap Share → “Add to Home Screen”.</div>
              )}
              {desktopDownloadUrl && (
                <a className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm active:bg-white/5" href={desktopDownloadUrl} target="_blank" rel="noreferrer">
                  <Monitor className="h-4 w-4" /> Get the desktop app
                </a>
              )}
              <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-rose-300 active:bg-white/5" onClick={signOut}>
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
