import { useState } from 'react';
import { signIn, signUp, resetPassword, authErrorMessage } from '@lifetracker/shared';
import { CheckCircle2, BarChart3, Timer, Smartphone, Loader2 } from 'lucide-react';
import { Logo, Orb } from './ui.jsx';
import { useStore } from '../config.js';

const FEATURES = [
  { icon: CheckCircle2, text: 'Tasks with estimates' },
  { icon: Timer, text: 'One-click timers' },
  { icon: BarChart3, text: 'Daily reports' },
  { icon: Smartphone, text: 'Phone sync, offline' },
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
    <div className="grid h-full lg:grid-cols-[1.25fr_1fr]">
      <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Orb state={{ shape: 'sphere', color: '#a78bfa', energy: 0.45 }} count={80000} scale={0.7} className="absolute inset-y-0 right-0 w-[72%]" />
        <Logo className="relative" sub="Productivity tracker / Desktop + mobile" />
        <div className="relative">
          <p className="caps text-slate-400"><span className="mr-2 text-brand-300">{'//00'}</span>Plan / Track / Progress / Sync</p>
          <h2 className="font-display mt-5 text-8xl leading-[0.88]">Own<br />your day</h2>
          <ul className="mt-10 grid max-w-md grid-cols-2 gap-x-8 gap-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-300">
                <Icon className="h-4 w-4 shrink-0 text-brand-300" strokeWidth={1.5} />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="caps relative text-slate-500">Private to your account / Synced with Firebase</p>
      </div>

      <div className="flex items-center justify-center border-l border-white/[0.06] p-8">
        <form onSubmit={submit} className="w-full max-w-sm" noValidate>
          <Logo className="mb-10 lg:hidden" />
          <p className="caps text-slate-500"><span className="mr-2 text-brand-300">{'//'}{mode === 'signup' ? '01' : mode === 'reset' ? '02' : '00'}</span>{mode === 'signup' ? 'New account' : mode === 'reset' ? 'Recovery' : 'Sign in'}</p>
          <h1 className="font-display mt-3 text-4xl leading-none">
            {mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset password' : 'Welcome back'}
          </h1>
          <p className="mt-4 text-sm text-slate-400">
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
                    <button type="button" className="mb-1 text-xs font-medium text-brand-300 hover:underline" onClick={() => switchMode('reset')}>
                      Forgot password?
                    </button>
                  )}
                </div>
                <input id="password" type="password" required minLength={6} className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
              </div>
            )}
          </div>

          {error && <div role="alert" className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}
          {info && <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{info}</div>}

          <button type="submit" className="btn-primary mt-8 w-full py-3" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Log in'}
          </button>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {mode === 'signup' ? 'Already have an account?' : mode === 'reset' ? 'Remembered it?' : 'New to LifeTracker?'}{' '}
            <button type="button" className="font-medium text-brand-300 hover:underline" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
              {mode === 'login' ? 'Create an account' : 'Log in'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
