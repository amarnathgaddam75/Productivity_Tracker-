import { useState } from 'react';
import { signIn, signUp, resetPassword, authErrorMessage } from '@lifetracker/shared';
import { CheckCircle2, BarChart3, Timer, Smartphone, Loader2 } from 'lucide-react';
import { Logo } from './ui.jsx';
import { useStore } from '../config.js';

const FEATURES = [
  { icon: CheckCircle2, text: 'Plan tasks with time estimates' },
  { icon: Timer, text: 'Track real time with one-click timers' },
  { icon: BarChart3, text: 'Daily reports, scores and efficiency' },
  { icon: Smartphone, text: 'Syncs with your phone, works offline' },
];

export default function AuthScreen() {
  const [mode, setMode] = useState('login'); // login | signup | reset
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password, name);
        if (name.trim()) useStore.getState().updateSettings({ displayName: name.trim() });
      }
      else if (mode === 'login') await signIn(email, password);
      else {
        await resetPassword(email);
        setInfo('Password reset email sent. Check your inbox.');
        setMode('login');
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const switchMode = (m) => {
    setMode(m);
    setError('');
    setInfo('');
  };

  return (
    <div className="grid h-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-violet-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-center gap-2 text-lg font-semibold">
          <Timer className="h-6 w-6" /> LifeTracker
        </div>
        <div className="relative">
          <h2 className="text-4xl font-semibold leading-tight">Own your day.<br />One focused hour at a time.</h2>
          <ul className="mt-8 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-brand-50">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                  <Icon className="h-5 w-5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-brand-100">Your data is private to your account and synced securely with Firebase.</p>
      </div>

      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm" noValidate>
          <Logo className="mb-8 lg:hidden" />
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset password' : 'Welcome back'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {mode === 'signup'
              ? 'Start tracking your productivity in seconds.'
              : mode === 'reset'
                ? "We'll email you a link to set a new password."
                : 'Log in to continue where you left off.'}
          </p>

          <div className="mt-8 space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label" htmlFor="name">Name</label>
                <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoComplete="name" />
              </div>
            )}
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" autoFocus />
            </div>
            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="label" htmlFor="password">Password</label>
                  {mode === 'login' && (
                    <button type="button" className="mb-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400" onClick={() => switchMode('reset')}>
                      Forgot password?
                    </button>
                  )}
                </div>
                <input id="password" type="password" required minLength={6} className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
              </div>
            )}
          </div>

          {error && <div role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>}
          {info && <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{info}</div>}

          <button type="submit" className="btn-primary mt-6 w-full py-2.5" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Log in'}
          </button>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {mode === 'signup' ? 'Already have an account?' : mode === 'reset' ? 'Remembered it?' : 'New to LifeTracker?'}{' '}
            <button type="button" className="font-medium text-brand-600 hover:underline dark:text-brand-400" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
              {mode === 'login' ? 'Create an account' : 'Log in'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
