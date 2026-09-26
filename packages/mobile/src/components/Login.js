import { useState } from 'react';
import { signIn, signUp, resetPassword, authErrorMessage } from '@lifetracker/shared';
import { Loader2 } from 'lucide-react';
import { useStore } from '../config';
import Orb from './Orb';

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
    <div className="safe-top relative flex min-h-full flex-col justify-end overflow-hidden px-6 pb-10 pt-[42vh]">
      <Orb state={{ shape: 'sphere', color: '#a78bfa', energy: 0.45 }} count={30000} scale={0.72} className="absolute inset-x-0 top-0 h-[55vh]" />
      <div className="absolute left-6 top-6 flex items-center gap-3" style={{ top: 'calc(env(safe-area-inset-top) + 24px)' }}>
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-[9px] tracking-[0.08em]">LT</span>
        <span className="caps text-slate-300">LifeTracker</span>
      </div>
      <div className="relative mb-8">
        <p className="caps text-slate-400"><span className="mr-2 text-brand-300">{'//00'}</span>Companion / Mobile</p>
        <h1 className="font-display mt-4 text-6xl leading-[0.9]">Own<br />your day</h1>
      </div>
      <form onSubmit={submit} className="card relative w-full max-w-sm space-y-4 p-5" noValidate>
        <h2 className="caps text-slate-300">{mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Log in'}</h2>
        {mode === 'signup' && (
          <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-label="Name" />
        )}
        <input className="input" type="email" inputMode="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-label="Email" />
        {mode !== 'reset' && (
          <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} aria-label="Password" />
        )}
        {error && <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}
        {info && <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{info}</div>}
        <button className="btn-primary w-full" disabled={busy} type="submit">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Log in'}
        </button>
        <div className="flex justify-between text-sm">
          <button type="button" className="font-medium text-brand-300" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
            {mode === 'login' ? 'Create account' : 'Back to login'}
          </button>
          {mode === 'login' && (
            <button type="button" className="text-slate-500" onClick={() => { setMode('reset'); setError(''); }}>
              Forgot password?
            </button>
          )}
        </div>
      </form>
      <p className="caps relative mt-6 text-slate-500">Same account as the desktop app</p>
    </div>
  );
}
