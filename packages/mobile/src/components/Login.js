import { useState } from 'react';
import { signIn, signUp, resetPassword, authErrorMessage } from '@lifetracker/shared';
import { Loader2 } from 'lucide-react';
import { useStore } from '../config';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'login') await signIn(email, password);
      else if (mode === 'signup') {
        await signUp(email, password, name);
        if (name.trim()) useStore.getState().updateSettings({ displayName: name.trim() });
      } else {
        await resetPassword(email);
        setInfo('Reset link sent — check your email.');
        setMode('login');
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="safe-top flex min-h-full flex-col justify-center bg-gradient-to-b from-brand-600 to-violet-700 px-6 py-10">
      <div className="mb-8 text-center text-white">
        <img src={`${process.env.PUBLIC_URL}/icon-192.png`} alt="" className="mx-auto h-16 w-16 rounded-2xl shadow-lg" />
        <h1 className="mt-4 text-2xl font-semibold">LifeTracker</h1>
        <p className="mt-1 text-sm text-brand-100">Your tasks & timers, in your pocket.</p>
      </div>
      <form onSubmit={submit} className="card mx-auto w-full max-w-sm space-y-4 p-6" noValidate>
        <h2 className="text-lg font-semibold">{mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Log in'}</h2>
        {mode === 'signup' && (
          <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-label="Name" />
        )}
        <input className="input" type="email" inputMode="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-label="Email" />
        {mode !== 'reset' && (
          <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} aria-label="Password" />
        )}
        {error && <div role="alert" className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>}
        {info && <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{info}</div>}
        <button className="btn-primary w-full" disabled={busy} type="submit">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Log in'}
        </button>
        <div className="flex justify-between text-sm">
          <button type="button" className="font-medium text-brand-600 dark:text-brand-400" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
            {mode === 'login' ? 'Create account' : 'Back to login'}
          </button>
          {mode === 'login' && (
            <button type="button" className="text-slate-500" onClick={() => { setMode('reset'); setError(''); }}>
              Forgot password?
            </button>
          )}
        </div>
      </form>
      <p className="mt-6 text-center text-xs text-brand-100">Use the same account as the LifeTracker desktop app.</p>
    </div>
  );
}
