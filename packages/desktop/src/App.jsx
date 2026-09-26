import { useTrackerLifecycle } from '@lifetracker/shared';
import { configured, useStore } from './config.js';
import AuthScreen from './components/AuthScreen.jsx';
import Shell from './components/Shell.jsx';
import ConfigMissing from './components/ConfigMissing.jsx';
import { Splash } from './components/ui.jsx';

function TrackedApp() {
  useTrackerLifecycle(useStore);
  const status = useStore((s) => s.status);
  if (status === 'loading') return <Splash />;
  if (status === 'signedOut') return <AuthScreen />;
  return <Shell />;
}

export default function App() {
  if (!configured) return <ConfigMissing />;
  return <TrackedApp />;
}
