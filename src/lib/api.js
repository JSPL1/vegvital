// Talks to the VegVital server (healthtest.space). The login token is kept on the device;
// no API keys are stored or entered in the app.
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// In the Android app the server is the live site; on the website it is the same address.
export const API_BASE = import.meta.env.VITE_API_BASE || (Capacitor.isNativePlatform() ? 'https://healthtest.space' : '');

const TOKEN_KEY = 'vegvital-session';
let session = null; // { token, user }
const listeners = new Set();

export async function loadSession() {
  let raw = null;
  try { raw = (await Preferences.get({ key: TOKEN_KEY })).value; } catch { /* web */ }
  if (!raw) { try { raw = localStorage.getItem(TOKEN_KEY); } catch { /* ignore */ } }
  try { session = raw ? JSON.parse(raw) : null; } catch { session = null; }
  return session;
}

async function saveSession(s) {
  session = s;
  const v = s ? JSON.stringify(s) : '';
  try { if (s) await Preferences.set({ key: TOKEN_KEY, value: v }); else await Preferences.remove({ key: TOKEN_KEY }); } catch { /* web */ }
  try { if (s) localStorage.setItem(TOKEN_KEY, v); else localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export const getSession = () => session;
export const loggedIn = () => !!session?.token;
export const onSession = (l) => { listeners.add(l); return () => listeners.delete(l); };

export async function api(path, { method = 'GET', body, timeout = 30000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  let r;
  try {
    r = await fetch(API_BASE + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(session?.token ? { Authorization: 'Bearer ' + session.token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    throw Object.assign(new Error('No internet connection. Try again when online.'), { offline: true });
  } finally { clearTimeout(t); }
  let data = null;
  try { data = await r.json(); } catch { /* empty */ }
  if (r.status === 401 && session && !path.startsWith('/api/auth/')) {
    await saveSession(null); // token expired or account turned off → back to the login screen
  }
  if (!r.ok) throw Object.assign(new Error(data?.error || `Server error (${r.status})`), { status: r.status, busy: !!data?.busy });
  return data;
}

export async function login(email, password) {
  const r = await api('/api/auth/login', { method: 'POST', body: { email, password } });
  await saveSession(r);
  return r.user;
}

export async function register(name, email, password) {
  const r = await api('/api/auth/register', { method: 'POST', body: { name, email, password } });
  await saveSession(r);
  return r.user;
}

export async function logout() { await saveSession(null); }
