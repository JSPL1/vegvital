// Food-photo reading. The photo is sent to the VegVital server, which asks the food AI;
// no AI key is stored or entered in the app.
import { api, loggedIn } from './api.js';

// 'auto'    → the server reads the photo (needs internet)
// 'offline' → no AI: tap-to-pick from your plan + food chart
export function activeProvider(profile) {
  return profile?.aiProvider === 'offline' || !loggedIn() ? 'offline' : 'auto';
}

export async function analyzeWithProfile(profile, { base64, mediaType = 'image/jpeg', mealLabel, remainingKcal, onStatus }) {
  if (activeProvider(profile) === 'offline') throw new Error('NO_KEY');
  onStatus?.('Reading your plate…');
  try {
    return await api('/api/scan', { method: 'POST', timeout: 60000, body: { base64, mediaType, mealLabel, remainingKcal } });
  } catch (e) {
    // busy AI or no internet: the caller saves the photo and it is read automatically later
    if (e.busy || e.offline || e.status >= 500 || e.status === 429) e.busy = true;
    throw e;
  }
}

/** Resize a data-URL / base64 image to max 1280px JPEG to keep uploads fast. */
export function shrinkImage(dataUrl, max = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const out = c.toDataURL('image/jpeg', 0.82);
      resolve({ dataUrl: out, base64: out.split(',')[1] });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
