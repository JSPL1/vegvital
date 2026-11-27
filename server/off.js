// Open Food Facts (world.openfoodfacts.org): free, open database of packaged foods.
// It cannot recognise a cooked dish from a photo; it finds packaged products by barcode or name.
// Their rules: identify the app in the User-Agent, 1 API call per real user scan, and credit them in the UI.
const UA = 'VegVital/1.0 (https://healthtest.space)';
const OFF = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_en,brands,serving_size,serving_quantity,nutriments,image_front_small_url,labels_tags,ingredients_analysis_tags';

const num = (v) => (Number.isFinite(+v) ? +v : 0);

/** Turn an Open Food Facts product into the app's food item (per serving when known, else per 100 g). */
export function toItem(p) {
  const n = p.nutriments || {};
  const g = num(p.serving_quantity);
  const per = g > 0 && n['energy-kcal_serving'] != null ? 'serving' : '100g';
  const val = (k) => num(n[`${k}_${per}`]);
  const kcal = val('energy-kcal') || Math.round(val('energy') / 4.184);
  const tags = [...(p.labels_tags || []), ...(p.ingredients_analysis_tags || [])];
  return {
    id: 'off_' + p.code,
    name: [p.product_name_en || p.product_name || 'Packaged food', p.brands?.split(',')[0]].filter(Boolean).join(' · ').slice(0, 80),
    emoji: '🛒',
    serving: per === 'serving' ? (p.serving_size || `${g} g`) : '100 g',
    kcal: Math.round(kcal), p: +val('proteins').toFixed(1), c: +val('carbohydrates').toFixed(1), f: +val('fat').toFixed(1), fb: +val('fiber').toFixed(1),
    confidence: 1, qty: 1, barcode: p.code, image: p.image_front_small_url || null,
    vegetarian: tags.includes('en:vegetarian') ? true : tags.includes('en:non-vegetarian') ? false : null,
    source: 'Open Food Facts',
  };
}

async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctrl.signal });
    if (r.status === 429) throw Object.assign(new Error('Open Food Facts is busy, try again in a minute.'), { status: 503 });
    if (r.status === 404) return { status: 0 }; // product not in the database
    if (!r.ok) throw Object.assign(new Error(`Open Food Facts error ${r.status}`), { status: 503 });
    return await r.json();
  } finally { clearTimeout(t); }
}

export async function byBarcode(code) {
  const c = String(code || '').replace(/\D/g, '');
  if (c.length < 6 || c.length > 14) throw Object.assign(new Error('That is not a barcode number.'), { status: 400 });
  const j = await get(`${OFF}/api/v2/product/${c}.json?fields=${FIELDS}`);
  if (j.status !== 1 || !j.product) return null;
  return toItem({ ...j.product, code: c });
}

export async function search(text) {
  const t = String(text || '').trim().slice(0, 60);
  if (t.length < 3) return [];
  const j = await get(`${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(t)}&search_simple=1&action=process&json=1&page_size=12&fields=${FIELDS}`);
  return (j.products || []).filter((p) => p.nutriments && (p.product_name || p.product_name_en)).map(toItem).filter((i) => i.kcal > 0);
}
