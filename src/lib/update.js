// In-app updates: every push to GitHub builds a new signed APK release. The app checks the
// latest release on start and every few hours; if it is newer it offers a one-tap install.
// Because every release is signed with the same key, Android installs it over the old app
// and all data (profile, meals, photos) stays.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { setState } from './store.js';

const REPO = 'JSPL1/vegvital';
const native = Capacitor.isNativePlatform();

export async function currentBuild() {
  if (!native) return 0;
  try { return parseInt((await App.getInfo()).build, 10) || 0; } catch { return 0; }
}

export async function checkForUpdate() {
  if (!native) return null;
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return null;
    const rel = await r.json();
    const latest = parseInt(String(rel.tag_name || '').split('.').pop(), 10) || 0;
    const asset = (rel.assets || []).find((a) => a.name.endsWith('.apk'));
    const mine = await currentBuild();
    const update = latest > mine && asset ? { version: rel.tag_name, url: asset.browser_download_url, notes: (rel.body || '').slice(0, 300), mine } : null;
    setState({ update });
    return update;
  } catch { return null; }
}

export async function installUpdate(u) {
  // Opens the APK download; Android then shows "Do you want to update this app?" → Update.
  await Browser.open({ url: u.url });
}

export function startUpdateChecks() {
  setTimeout(checkForUpdate, 4000);
  setInterval(checkForUpdate, 6 * 3600e3);
  try { App.addListener('appStateChange', ({ isActive }) => { if (isActive) checkForUpdate(); }); } catch { /* web */ }
}
