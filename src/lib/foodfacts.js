// Packaged foods from Open Food Facts (via the VegVital server). Works for anything with a barcode
// (biscuits, namkeen, milk, juice…); home-cooked dishes still go to the food AI or quick-pick.
import { api } from './api.js';

/** Finds a barcode in the photo using the phone's built-in detector (Android Chrome / WebView). */
export async function findBarcode(dataUrl) {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return null;
  try {
    const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
    const codes = await det.detect(img);
    return codes[0]?.rawValue || null;
  } catch { return null; }
}

export async function lookupBarcode(code) {
  const r = await api('/api/food/barcode/' + encodeURIComponent(code));
  return r.item || null;
}

export async function searchPackaged(text) {
  return (await api('/api/food/search?q=' + encodeURIComponent(text))).items || [];
}
