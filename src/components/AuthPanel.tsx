import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';

import { getSupabaseClient, getSupabaseConfig } from '../lib/supabase';

type AuthMode = 'signIn' | 'signUp';

export function AuthPanel() {
  const config = getSupabaseConfig();
  const client = useMemo(() => getSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!client) {
      return;
    }

    let active = true;

    void client.auth.getSession().then(({ data, error }) => {
      if (!active) {
        return;
      }

      if (error) {
        setMessage(error.message);
        return;
      }

      setSession(data.session);
    });

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  if (!config.isConfigured || !client) {
    return (
      <section className="rounded-3xl border border-stone-200 bg-white/90 p-3 shadow-[0_18px_42px_rgba(87,53,13,0.06)] backdrop-blur sm:p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Account</div>
        <h2 className="font-display text-[1.45rem] text-stone-900 sm:text-2xl">Guest mode</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Supabase is not configured, so SubmitSprint is running local-first in this browser.
        </p>
        <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-950">
          Missing {config.missing.join(', ')}. Add these Vite env vars to enable account sign-in.
        </div>
      </section>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!client || busy) {
      return;
    }

    setBusy(true);
    setMessage('');

    const credentials = {
      email: email.trim(),
      password,
    };

    const { data, error } =
      mode === 'signIn'
        ? await client.auth.signInWithPassword(credentials)
        : await client.auth.signUp(credentials);

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSession(data.session);
    setMessage(mode === 'signUp' && !data.session ? 'Check your email to confirm this account.' : 'Account session active.');
    setPassword('');
  }

  async function handleSignOut() {
    if (!client || busy) {
      return;
    }

    setBusy(true);
    const { error } = await client.auth.signOut();
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSession(null);
    setMessage('Signed out. Guest data remains local in this browser.');
  }

  if (session) {
    return (
      <section className="rounded-3xl border border-stone-200 bg-white/90 p-3 shadow-[0_18px_42px_rgba(87,53,13,0.06)] backdrop-blur sm:p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Account</div>
        <h2 className="font-display text-[1.45rem] text-stone-900 sm:text-2xl">Signed in</h2>
        <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-950">
          {session.user.email ?? 'Supabase account'}
        </div>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Auth is ready. This foundation slice still keeps SubmitSprint data local until cloud sync is enabled.
        </p>
        {message ? <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">{message}</div> : null}
        <button
          className="mt-3 w-full rounded-2xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
          disabled={busy}
          onClick={handleSignOut}
          type="button"
        >
          Sign out
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-stone-200 bg-white/90 p-3 shadow-[0_18px_42px_rgba(87,53,13,0.06)] backdrop-blur sm:p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Account</div>
      <h2 className="font-display text-[1.45rem] text-stone-900 sm:text-2xl">Account mode</h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        Sign in with Supabase Auth. Guest progress remains local and exportable.
      </p>

      <div className="mt-3 grid grid-cols-2 rounded-2xl border border-stone-200 bg-stone-50 p-1 text-sm font-semibold">
        <button
          className={`rounded-xl px-3 py-2 transition ${mode === 'signIn' ? 'bg-white text-stone-950 shadow-sm' : 'text-stone-500'}`}
          onClick={() => setMode('signIn')}
          type="button"
        >
          Sign in
        </button>
        <button
          className={`rounded-xl px-3 py-2 transition ${mode === 'signUp' ? 'bg-white text-stone-950 shadow-sm' : 'text-stone-500'}`}
          onClick={() => setMode('signUp')}
          type="button"
        >
          Sign up
        </button>
      </div>

      <form className="mt-3 grid gap-2" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Email</span>
          <input
            autoComplete="email"
            className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Password</span>
          <input
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400"
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        <button
          className="rounded-2xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
          disabled={busy || !email.trim() || password.length < 6}
          type="submit"
        >
          {busy ? 'Working...' : mode === 'signIn' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      {message ? <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">{message}</div> : null}
    </section>
  );
}
