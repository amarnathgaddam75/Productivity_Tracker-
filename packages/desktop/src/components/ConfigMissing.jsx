import { Logo } from './ui.jsx';

export default function ConfigMissing() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="card max-w-xl p-8">
        <Logo />
        <h1 className="mt-6 text-xl font-semibold">Firebase is not configured</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Create <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">packages/desktop/.env.local</code> with your
          Firebase web config (see <code>.env.example</code>), then restart the app. To try it locally without a Firebase
          project, run <code>npm run emulators</code> and set <code>VITE_FIREBASE_EMULATOR_HOST=127.0.0.1</code>.
        </p>
      </div>
    </div>
  );
}
