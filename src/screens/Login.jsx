import { useState } from 'react';
import { motion } from 'framer-motion';
import { login, register } from '../lib/api.js';
import { Button, tap } from '../components/ui.jsx';

export default function Login({ onDone }) {
  const [mode, setMode] = useState('login'); // login | signup
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e?.preventDefault();
    tap(); setErr(''); setBusy(true);
    try {
      if (mode === 'signup') await register(name.trim(), email.trim(), pw);
      else await login(email.trim(), pw);
      await onDone();
    } catch (x) { setErr(String(x?.message || x)); }
    setBusy(false);
  }

  return (
    <div className="onboard">
      <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
      <motion.form className="slide" onSubmit={submit} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
        <motion.div className="slide-emoji" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}>🌱</motion.div>
        <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="muted small">{mode === 'login' ? 'Log in to see your meals, photos and reports on any phone.' : 'Your meals, food photos and reports are saved to your own account.'}</p>
        {mode === 'signup' && <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
        <input className="input" type="password" placeholder={mode === 'signup' ? 'Password (6+ characters)' : 'Password'} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
        {err && <div className="tiny warn">⚠️ {err}</div>}
        <Button className="full" disabled={busy || !email || pw.length < (mode === 'signup' ? 6 : 1)} onClick={submit}>
          {busy ? '…' : mode === 'login' ? 'Log in' : 'Sign up'}
        </Button>
        <button type="button" className="restore-link" onClick={() => { tap(); setErr(''); setMode(mode === 'login' ? 'signup' : 'login'); }}>
          {mode === 'login' ? <>New here? <b>Create an account</b></> : <>Already have an account? <b>Log in</b></>}
        </button>
        <a className="tiny muted center-text" href="https://healthtest.space/privacypolicy.html" target="_blank" rel="noreferrer">Privacy policy</a>
      </motion.form>
    </div>
  );
}
