import { useEffect, useState } from 'react';
import { useTrackerLifecycle } from '@lifetracker/shared';
import { configured, useStore } from './config';
import Login from './components/Login';
import Header from './components/Header';
import NowTab from './components/NowTab';
import SummaryTab from './components/SummaryTab';
import AlertsTab from './components/AlertsTab';
import AssistantTab from './components/AssistantTab';
import { phoneTick } from './phoneBrain';
import BottomNav from './components/BottomNav';
import Toasts from './components/Toasts';
import Scene from './components/Scene';
import { applyUpdate } from './serviceWorkerRegistration';

function Splash() {
  return (
    <div className="flex h-full items-center justify-center">
      <img src={`${process.env.PUBLIC_URL}/icon-192.png`} alt="" className="h-16 w-16 animate-pulse rounded-2xl" />
    </div>
  );
}

function UpdateBanner() {
  const [reg, setReg] = useState(null);
  useEffect(() => {
    const onReady = (e) => setReg(e.detail);
    window.addEventListener('lt:update-ready', onReady);
    return () => window.removeEventListener('lt:update-ready', onReady);
  }, []);
  if (!reg) return null;
  return (
    <button onClick={() => applyUpdate(reg)} className="mx-4 mt-2 w-[calc(100%-2rem)] rounded-2xl bg-brand-600 px-4 py-2 text-sm font-medium text-white">
      A new version is available — tap to update
    </button>
  );
}

function TrackedApp() {
  useTrackerLifecycle(useStore);
  const status = useStore((s) => s.status);
  const [tab, setTab] = useState('assistant');

  useEffect(() => {
    if (status !== 'ready') return undefined;
    phoneTick();
    const id = setInterval(() => phoneTick(), 5000);
    return () => clearInterval(id);
  }, [status]);

  if (status === 'loading') return <Splash />;
  if (status === 'signedOut') return <Login />;

  return (
    <div className="relative mx-auto flex h-full max-w-lg flex-col">
      <Scene tab={tab} />
      <Header />
      <UpdateBanner />
      <main className="relative z-10 flex-1 overflow-y-auto px-4 pb-28 pt-2">
        {tab === 'assistant' && <AssistantTab />}
        {tab === 'now' && <NowTab />}
        {tab === 'summary' && <SummaryTab />}
        {tab === 'alerts' && <AlertsTab />}
      </main>
      <BottomNav tab={tab} onChange={setTab} />
      <Toasts />
    </div>
  );
}

export default function App() {
  if (!configured) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-600 dark:text-slate-400">
        <div>
          <img src={`${process.env.PUBLIC_URL}/icon-192.png`} alt="" className="mx-auto mb-4 h-14 w-14 rounded-2xl" />
          <p className="font-semibold text-slate-900 dark:text-white">Firebase is not configured</p>
          <p className="mt-2">Add your Firebase web config to <code>packages/mobile/.env.local</code> (see <code>.env.example</code>) and rebuild.</p>
        </div>
      </div>
    );
  }
  return <TrackedApp />;
}
