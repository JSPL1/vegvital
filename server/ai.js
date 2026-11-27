// Food-photo AI, run on the server so no key ever reaches a phone.
// Order: Google Gemini (free) → Groq (free backup) → Anthropic Claude (paid, only if a key is set).
// Keys come from the admin page (Neon) or the host's environment: GEMINI_API_KEY, GROQ_API_KEY, ANTHROPIC_API_KEY.
import Anthropic from '@anthropic-ai/sdk';
import { DISALLOWED_WORDS } from '../src/data/foods.js';
import { setting } from './settings.js';

const key = { gemini: () => setting('GEMINI_API_KEY'), groq: () => setting('GROQ_API_KEY'), claude: () => setting('ANTHROPIC_API_KEY'), caloriemama: () => setting('CALORIEMAMA_API_KEY') };
let lastKeys = '';
function resetIfKeysChanged() {
  const k = key.gemini() + '|' + key.groq() + '|' + setting('GEMINI_MODEL') + '|' + setting('GROQ_MODEL');
  if (k !== lastKeys) { lastKeys = k; geminiModels = null; geminiGood = null; groqModels = null; groqGood = null; }
}

export const aiConfigured = () => !!(key.gemini() || key.groq() || key.claude());

const SYSTEM = `You are a nutrition analyst inside a personal Indian vegetarian health-tracking app.
The user is strictly vegetarian (no meat, fish or eggs), does not smoke and does not drink alcohol.
They follow a calorie-controlled plan focused on fat loss: high protein, high fibre, measured oil.

From the photo, identify every distinct food/drink item, estimate the portion actually on the plate
(use plate/katori/roti size cues; typical Indian home portions), and give realistic nutrition per item
for that portion, accounting for visible oil/ghee/butter. Prefer Indian dish names (e.g. "Dal tadka", "Bhindi masala"), including regional ones: Odia (Dahibara aludam, Gupchup, Pakhala bhata, Dalma, Chhena poda, Bara ghuguni, Pitha), South Indian (Idli, Dosa, Pesarattu, Pongal, Bisi bele bath, Avial) and street chaat (Golgappa, Papdi chaat, Samosa, Dabeli, Misal pav).
If something looks like it could be meat/egg/fish, set contains_non_veg=true and name it honestly.
If the photo shows no food, set is_food=false and return an empty items list.
Keep verdict and tip short, friendly and specific.`;

const JSON_SHAPE = `Reply ONLY with JSON of this exact shape:
{"is_food":true,"meal_name":"","items":[{"name":"","emoji":"","portion":"","grams":0,"kcal":0,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0,"confidence":0.0}],
"health_score":1-10,"verdict":"one short line","tip":"one actionable tip","contains_non_veg":false,"contains_alcohol":false}`;

const ask = (mealLabel, remainingKcal) => `This is my ${mealLabel || 'meal'}. I have about ${Math.round(remainingKcal ?? 0)} kcal left for today. Analyse it and reply with JSON only.`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const LIMIT = 20000; // one AI request may take at most 20 s, then the next AI is tried
const tfetch = (url, opts = {}) => fetch(url, { ...opts, signal: AbortSignal.timeout(opts.ms || LIMIT) });

function normalise(data) {
  const flagged = (data.items || []).some((i) => DISALLOWED_WORDS.some((w) => String(i.name).toLowerCase().includes(w)));
  data.contains_non_veg = !!data.contains_non_veg || flagged;
  data.items = (data.items || []).map((i) => ({
    id: 'ai_' + Math.random().toString(36).slice(2, 8),
    name: i.name,
    emoji: i.emoji || '🍽️',
    serving: i.portion,
    kcal: +i.kcal || 0, p: +i.protein_g || 0, c: +i.carbs_g || 0, f: +i.fat_g || 0, fb: +i.fiber_g || 0,
    confidence: i.confidence ?? 0.7,
    qty: 1,
  }));
  data.health_score = Math.max(1, Math.min(10, Math.round(+data.health_score || 5)));
  return data;
}

const parseJson = (text) => {
  const clean = String(text || '').replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const m = clean.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : null;
};

// ---------- Google Gemini ----------
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
var geminiModels = null, geminiModelsAt = 0, geminiGood = null;

async function listGeminiModels() {
  const forced = setting('GEMINI_MODEL');
  if (forced) return [forced.startsWith('models/') ? forced : 'models/' + forced];
  if (geminiModels && Date.now() - geminiModelsAt < 6 * 3600e3) return geminiModels;
  const FALLBACK = ['models/gemini-3.5-flash-lite', 'models/gemini-2.5-flash', 'models/gemini-2.5-flash-lite', 'models/gemini-2.0-flash', 'models/gemini-flash-latest'];
  let r;
  try { r = await tfetch(`${GEMINI}/models?pageSize=200`, { ms: 8000, headers: { 'x-goog-api-key': key.gemini() } }); } catch { return FALLBACK; }
  if (!r.ok) return FALLBACK;
  const { models = [] } = await r.json();
  const ok = models.filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')
    && /flash/i.test(m.name) && !/(image|tts|audio|live|thinking|embedding|exp)/i.test(m.name));
  const score = (n) => {
    const v = parseFloat((n.match(/gemini-(\d+(\.\d+)?)/) || [])[1] || 0);
    return (/preview/.test(n) ? 0 : 1000) + v * 10 + (/lite/.test(n) ? 5 : 0) + (/latest/.test(n) ? 1 : 0); // lite = much faster per photo
  };
  ok.sort((x, y) => score(y.name) - score(x.name));
  // the fast, proven models first (newest previews can take 40 s+ per photo), then the rest
  const avail = new Set(ok.map((m) => m.name));
  const names = [...FALLBACK.filter((d) => !ok.length || avail.has(d)), ...ok.map((m) => m.name).filter((n) => !FALLBACK.includes(n))];
  geminiModels = names.slice(0, 8); geminiModelsAt = Date.now();
  return geminiModels;
}

async function analyzeGemini({ base64, mediaType, mealLabel, remainingKcal }) {
  const list = await listGeminiModels();
  const order = geminiGood ? [geminiGood, ...list.filter((m) => m !== geminiGood)] : list;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM + '\n\n' + JSON_SHAPE }] },
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: mediaType, data: base64 } }, { text: ask(mealLabel, remainingKcal) }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
  });
  let last = '';
  const deadline = Date.now() + 25000;
  for (const model of order) {
    for (let attempt = 0; attempt < 2 && Date.now() < deadline; attempt++) {
      const r = await tfetch(`${GEMINI}/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key.gemini() }, body });
      if (r.ok) {
        const j = await r.json();
        const data = parseJson((j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join(''));
        if (!data) break;
        geminiGood = model;
        return normalise(data);
      }
      let msg = ''; try { msg = (await r.json())?.error?.message || ''; } catch { /* ignore */ }
      last = `Gemini ${r.status}${msg ? ': ' + msg.slice(0, 120) : ''}`;
      if (r.status === 401 || r.status === 403) throw new Error(last);
      if (r.status === 404) { if (geminiModels) geminiModels = geminiModels.filter((x) => x !== model); break; } // retired model
      if (r.status === 400) break;
      if (r.status === 429 && /limit: 0/.test(msg)) break;
      if ([429, 500, 502, 503, 504].includes(r.status)) { await wait(1500 * (attempt + 1)); continue; }
      break;
    }
    if (Date.now() >= deadline) break;
  }
  throw new Error(last || 'Gemini busy');
}

// ---------- Groq ----------
const GROQ = 'https://api.groq.com/openai/v1';
const GROQ_DEFAULTS = ['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct'];
var groqModels = null, groqGood = null;

async function listGroqModels() {
  if (setting('GROQ_MODEL')) return [setting('GROQ_MODEL')];
  if (groqModels) return groqModels;
  try {
    const r = await tfetch(GROQ + '/models', { ms: 8000, headers: { Authorization: 'Bearer ' + key.groq() } });
    if (r.ok) {
      const ids = ((await r.json()).data || []).filter((m) => m.active !== false).map((m) => m.id);
      const vis = ids.filter((id) => /llama-4|vision|-vl|vl-|scout|maverick/i.test(id) && !/guard|whisper|tts/i.test(id));
      vis.sort((a, b) => (/scout/i.test(b) ? 1 : 0) - (/scout/i.test(a) ? 1 : 0));
      groqModels = [...new Set([...vis, ...GROQ_DEFAULTS.filter((d) => !ids.length || ids.includes(d))])];
      if (!groqModels.length) groqModels = GROQ_DEFAULTS;
      return groqModels;
    }
  } catch { /* fall through */ }
  return GROQ_DEFAULTS;
}

async function analyzeGroq({ base64, mediaType, mealLabel, remainingKcal }) {
  const list = await listGroqModels();
  const order = groqGood ? [groqGood, ...list.filter((m) => m !== groqGood)] : list;
  let last = ''; const all = [];
  const deadline = Date.now() + 15000;
  for (const model of order) {
    for (let attempt = 0; attempt < 2 && Date.now() < deadline; attempt++) {
      const r = await tfetch(GROQ + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key.groq() },
        body: JSON.stringify({
          model, temperature: 0.2, max_completion_tokens: 1500, response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM + '\n\n' + JSON_SHAPE },
            { role: 'user', content: [{ type: 'text', text: ask(mealLabel, remainingKcal) }, { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } }] },
          ],
        }),
      });
      if (r.ok) {
        const data = parseJson((await r.json()).choices?.[0]?.message?.content);
        if (!data) break;
        groqGood = model;
        return normalise(data);
      }
      let msg = ''; try { msg = (await r.json())?.error?.message || ''; } catch { /* ignore */ }
      last = `Groq ${r.status}${msg ? ': ' + msg.slice(0, 100) : ''}`; all.push(model.split('/').pop() + ' ' + r.status + (msg ? ' ' + msg.slice(0, 80) : ''));
      if (r.status === 401 || r.status === 403) throw new Error(last);
      if (r.status === 404 || r.status === 400) break;
      if ([429, 500, 502, 503, 504].includes(r.status)) { await wait(1500 * (attempt + 1)); continue; }
      break;
    }
    if (Date.now() >= deadline) break;
  }
  throw new Error(all.length > 1 ? 'Groq: ' + all.join(' | ') : (last || 'Groq busy'));
}

// ---------- Anthropic Claude (optional, paid) ----------
async function analyzeClaude({ base64, mediaType, mealLabel, remainingKcal }) {
  const anthropic = new Anthropic({ apiKey: key.claude() });
  const r = await anthropic.messages.create({
    model: setting('CLAUDE_MODEL', 'claude-haiku-5-5'),
    max_tokens: 2000,
    system: SYSTEM + '\n\n' + JSON_SHAPE,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
      { type: 'text', text: ask(mealLabel, remainingKcal) },
    ] }],
  });
  const data = parseJson(r.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
  if (!data) throw new Error('Claude gave no answer');
  return normalise(data);
}

// ---------- Calorie Mama (caloriemama.ai food recognition) ----------
// Needs a JPEG of at most 544 px (the app sends one as "small"). Nutrition comes per kg; we scale to one serving.
const CM_URL = 'https://api-2445582032290.production.gw.apicast.io/v1/foodrecognition';
async function analyzeCalorieMama({ small }) {
  if (!small) throw new Error('needs the small (544 px) photo — update the app');
  const form = new FormData();
  form.append('media', new Blob([Buffer.from(small, 'base64')], { type: 'image/jpeg' }), 'plate.jpg');
  const r = await tfetch(CM_URL + '?user_key=' + encodeURIComponent(key.caloriemama()), { method: 'POST', body: form });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Calorie Mama ${r.status}: ${j?.error?.errorDetail || 'key missing, wrong or over plan'}`.slice(0, 200));
  if (!j.is_food) return normalise({ is_food: false, items: [], meal_name: '', health_score: 5, verdict: '', tip: '' });
  const best = j.results?.[0]?.items?.[0];
  if (!best) throw new Error('Calorie Mama found no dish');
  const sv = (best.servingSizes || []).find((s) => !/^(100 g|1 oz)$/i.test(s.unit)) || best.servingSizes?.[0] || { unit: '100 g', servingWeight: 0.1 };
  const kg = +sv.servingWeight || 0.1, n = best.nutrition || {};
  return normalise({
    is_food: true, meal_name: best.name,
    items: [{ name: best.name, emoji: '🍽️', portion: sv.unit, grams: Math.round(kg * 1000), kcal: Math.round((n.calories || 0) * kg), protein_g: +((n.protein || 0) * kg * 1000).toFixed(1), carbs_g: +((n.totalCarbs || 0) * kg * 1000).toFixed(1), fat_g: +((n.totalFat || 0) * kg * 1000).toFixed(1), fiber_g: +((n.dietaryFiber || 0) * kg * 1000).toFixed(1), confidence: 0.6 }],
    health_score: 6, verdict: 'Recognised by Calorie Mama — check the portion', tip: 'Adjust the quantity if your portion was bigger or smaller.',
  });
}

const RUN = { gemini: analyzeGemini, groq: analyzeGroq, claude: analyzeClaude, caloriemama: analyzeCalorieMama };
const order = () => setting('AI_ORDER', 'groq,gemini,caloriemama,claude').split(',').map((x) => x.trim().toLowerCase()).filter((x) => RUN[x]);

/** Returns the analysis, or throws an error with .busy = true and .details (one line per AI) when every AI failed. */
export async function analyzePhoto(args) {
  resetIfKeysChanged();
  const a = { mediaType: 'image/jpeg', ...args };
  const errs = [];
  for (const p of order()) {
    if (!key[p]()) continue;
    try { const r = await RUN[p](a); r.provider = p; return r; } catch (e) { errs.push(`${p}: ${e.name === 'TimeoutError' || e.name === 'AbortError' ? 'no answer within 20 s' : e.message}`); }
  }
  console.warn('[ai] all providers failed:', errs.join(' · ') || 'no keys set');
  const err = new Error(errs.length ? 'The food AI is busy right now. Your photo is saved and will be read automatically soon.' : 'Photo reading is not set up on the server yet.');
  err.busy = true; err.details = errs;
  throw err;
}

/** Admin "Test" button: checks one AI with a real request. Optional base64 photo, else a text-only ping. */
export async function testProvider(p, base64, small) {
  resetIfKeysChanged();
  if (!RUN[p]) throw new Error('Unknown AI');
  if (!key[p]()) throw new Error('No key saved');
  const t0 = Date.now();
  if (base64) { const r = await RUN[p]({ base64, small, mediaType: 'image/jpeg', mealLabel: 'meal', remainingKcal: 800 }); return { ok: true, ms: Date.now() - t0, result: r }; }
  if (p === 'gemini') {
    // same model order as photo reading; retired models (404) are skipped
    const tried = [];
    for (const m of (await listGeminiModels()).slice(0, 5)) {
      const t1 = Date.now();
      const r = await tfetch(`${GEMINI}/${m}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key.gemini() }, body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with the single word ok' }] }] }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return { ok: true, ms: Date.now() - t0, model: m.replace('models/', ''), modelMs: Date.now() - t1, skipped: tried };
      if (r.status === 401 || r.status === 403) throw new Error(`Gemini ${r.status}: ${j?.error?.message || 'key rejected'}`.slice(0, 300));
      tried.push(`${m.replace('models/', '')}: ${r.status}`);
    }
    throw new Error('Gemini: no usable model — ' + tried.join(', '));
  }
  if (p === 'caloriemama') throw new Error('Calorie Mama can only be tested with a photo: use "Only caloriemama" below.');
  if (p === 'groq') {
    const r = await tfetch(GROQ + '/models', { ms: 8000, headers: { Authorization: 'Bearer ' + key.groq() } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Groq ${r.status}: ${j?.error?.message || 'error'}`.slice(0, 300));
    groqModels = null;
    return { ok: true, ms: Date.now() - t0, model: (await listGroqModels())[0] };
  }
  const anthropic = new Anthropic({ apiKey: key.claude() });
  await anthropic.messages.create({ model: setting('CLAUDE_MODEL', 'claude-haiku-5-5'), max_tokens: 16, messages: [{ role: 'user', content: 'Reply with ok' }] });
  return { ok: true, ms: Date.now() - t0, model: setting('CLAUDE_MODEL', 'claude-haiku-5-5') };
}
