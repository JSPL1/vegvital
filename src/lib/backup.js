// Backup & restore so your history survives uninstalling, reinstalling or a new phone.
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { getState, setState } from './store.js';

const native = Capacitor.isNativePlatform();

function snapshot() {
  const s = structuredClone(getState());
  // API keys are never put in a backup file (it may travel through WhatsApp/Drive)
  s.profile = { ...s.profile, apiKey: '', geminiKey: '', groqKey: '', neonUrl: '' };
  delete s.pending; delete s.update; delete s.pendingDone;
  return { app: 'VegVital', version: 1, createdAt: new Date().toISOString(), state: s };
}

/** Save a backup file and open the share sheet (Google Drive, WhatsApp "Message yourself", Gmail…) */
export async function backupNow() {
  const data = JSON.stringify(snapshot());
  const name = `VegVital-backup-${new Date().toISOString().slice(0, 10)}.json`;
  if (native) {
    const res = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: 'VegVital backup', text: 'My VegVital health data backup', files: [res.uri], dialogTitle: 'Save backup to…' });
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = name; a.click();
  }
  setState({ lastBackup: new Date().toISOString() });
  return name;
}

/** Let the user pick a backup file and merge it into the app */
export function pickAndRestore() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json,text/plain,*/*';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      try { resolve(restoreFromText(await f.text())); } catch (e) { reject(e); }
    };
    input.click();
  });
}

export function restoreFromText(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('That file is not a VegVital backup.'); }
  const b = parsed.state || parsed; // also accepts the older "Export backup" format
  if (!b.profile || !b.days) throw new Error('That file is not a VegVital backup.');
  const cur = getState();
  // merge days: keep whichever version of a day has more logged
  const score = (d) => (d ? Object.keys(d.meals || {}).length * 10 + (d.water || 0) + (d.workouts?.length || 0) * 5 + (d.sleep ? 3 : 0) : -1);
  const days = { ...b.days };
  for (const [k, d] of Object.entries(cur.days || {})) if (score(d) > score(days[k])) days[k] = d;
  const weights = [...(b.weights || []), ...(cur.weights || [])]
    .filter((w, i, arr) => arr.findIndex((x) => x.date === w.date) === i);
  setState({
    onboarded: true,
    profile: { ...cur.profile, ...b.profile, apiKey: cur.profile.apiKey || '', geminiKey: cur.profile.geminiKey || '', groqKey: cur.profile.groqKey || '', neonUrl: cur.profile.neonUrl || '' },
    days, weights,
    lastBackup: b.lastBackup || cur.lastBackup,
  });
  return { days: Object.keys(b.days).length, name: b.profile.name };
}

export function backupAgeDays() {
  const lb = getState().lastBackup;
  return lb ? Math.floor((Date.now() - new Date(lb)) / 86400e3) : null;
}

/** Silent daily copy in the phone's public Documents/VegVital folder. After a reinstall,
 *  "Restore from backup" can pick this file, so profile details never need typing again. */
export async function autoBackup() {
  if (!native) return;
  const s = getState();
  if (!s.onboarded) return;
  const last = s.lastAutoBackup ? new Date(s.lastAutoBackup) : null;
  if (last && Date.now() - last < 20 * 3600e3) return;
  try {
    await Filesystem.writeFile({ path: 'VegVital/VegVital-autobackup.json', data: JSON.stringify(snapshot()), directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
    setState({ lastAutoBackup: new Date().toISOString() });
  } catch { /* storage not available: the manual backup still works */ }
}
