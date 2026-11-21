import Anthropic from '@anthropic-ai/sdk';
import { DISALLOWED_WORDS } from '../data/foods.js';

// Food-photo analysis with Claude vision.
// The API key is stored only on this phone (Settings → AI key).
const MODEL = 'claude-opus-5-5';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['meal_name', 'items', 'health_score', 'verdict', 'tip', 'contains_non_veg', 'contains_alcohol', 'is_food'],
  properties: {
    is_food: { type: 'boolean', description: 'false if the photo does not show food or drink' },
    meal_name: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'emoji', 'portion', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'confidence'],
        properties: {
          name: { type: 'string' },
          emoji: { type: 'string' },
          portion: { type: 'string', description: 'human portion e.g. "2 rotis", "1 katori (150 g)"' },
          grams: { type: 'number' },
          kcal: { type: 'number' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
          fiber_g: { type: 'number' },
          confidence: { type: 'number', description: '0..1' },
        },
      },
    },
    health_score: { type: 'integer', description: '1 (poor) .. 10 (excellent) for this person' },
    verdict: { type: 'string', description: 'one short line, e.g. "Great protein, light on veggies"' },
    tip: { type: 'string', description: 'one actionable tip for the next meal' },
    contains_non_veg: { type: 'boolean' },
    contains_alcohol: { type: 'boolean' },
  },
};

const SYSTEM = `You are a nutrition analyst inside a personal Indian vegetarian health-tracking app.
The user is strictly vegetarian (no meat, fish or eggs), does not smoke and does not drink alcohol.
They follow a ~1650 kcal/day nutritionist plan focused on fat loss: high protein, high fibre, measured oil.

From the photo, identify every distinct food/drink item, estimate the portion actually on the plate
(use plate/katori/roti size cues; typical Indian home portions), and give realistic nutrition per item
for that portion, accounting for visible oil/ghee/butter. Prefer Indian dish names (e.g. "Dal tadka", "Bhindi masala").
If something looks like it could be meat/egg/fish, set contains_non_veg=true and name it honestly.
If the photo shows no food, set is_food=false and return an empty items list.
Keep verdict and tip short, friendly and specific.`;

function client(apiKey) {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

// ---------- Provider switch ----------
// 'gemini'  → Google Gemini free tier (no card needed, aistudio.google.com)
// 'claude'  → Anthropic Claude (paid, most accurate)
// 'offline' → no AI: tap-to-pick from your plan + food chart
export function activeProvider(profile) {
  const p = profile.aiProvider || 'gemini';
  if (p === 'gemini' && (profile.geminiKey || profile.groqKey)) return 'gemini';
  if (p === 'claude' && profile.apiKey) return 'claude';
  return 'offline';
}

export async function analyzeWithProfile(profile, args) {
  const prov = activeProvider(profile);
  if (prov === 'gemini') return analyzeFree(profile, args);
  if (prov === 'claude') return analyzeFoodPhoto({ ...args, apiKey: profile.apiKey });
  throw new Error('NO_KEY');
}

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

// ---------- Google Gemini (free tier) ----------
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
let geminiModels = null; // ranked candidates, best first
let geminiGood = null;   // last model that answered

async function listGeminiModels(apiKey) {
  if (geminiModels) return geminiModels;
  const FALLBACK = ['models/gemini-2.5-flash', 'models/gemini-2.5-flash-lite', 'models/gemini-2.0-flash', 'models/gemini-flash-latest'];
  let r;
  try { r = await fetch(`${GEMINI}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey } }); }
  catch { return FALLBACK; } // offline / flaky network: still try the photo
  if (r.status === 400 || r.status === 401 || r.status === 403) throw new Error('Gemini key invalid (401)');
  if (!r.ok) return FALLBACK; // Google busy listing models: go straight to the well-known ones (not cached)
  const { models = [] } = await r.json();
  const ok = models.filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')
    && /flash/i.test(m.name) && !/(image|tts|audio|live|thinking|embedding|exp)/i.test(m.name));
  // Stable models first (preview models are often overloaded → 503), newest first, "lite" last
  const score = (n) => {
    const v = parseFloat((n.match(/gemini-(\d+(\.\d+)?)/) || [])[1] || 0);
    return (/preview/.test(n) ? 0 : 1000) + v * 10 + (/lite/.test(n) ? -5 : 0) + (/latest/.test(n) ? 1 : 0);
  };
  ok.sort((x, y) => score(y.name) - score(x.name));
  const names = ok.map((m) => m.name);
  for (const d of ['models/gemini-2.5-flash', 'models/gemini-2.5-flash-lite', 'models/gemini-2.0-flash', 'models/gemini-2.0-flash-lite', 'models/gemini-flash-latest', 'models/gemini-flash-lite-latest']) if (!names.includes(d)) names.push(d);
  geminiModels = names.slice(0, 8);
  return geminiModels;
}

const JSON_SHAPE = `Reply ONLY with JSON of this exact shape:
{"is_food":true,"meal_name":"","items":[{"name":"","emoji":"","portion":"","grams":0,"kcal":0,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0,"confidence":0.0}],
"health_score":1-10,"verdict":"one short line","tip":"one actionable tip","contains_non_veg":false,"contains_alcohol":false}`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Tries the best model; on "busy" errors (503/500/429) retries with backoff and then
 * falls back to the next model, so a temporarily overloaded model never blocks you.
 */
export async function analyzeGemini({ base64, mediaType = 'image/jpeg', apiKey, mealLabel, remainingKcal, onStatus }) {
  const list = await listGeminiModels(apiKey);
  const order = geminiGood ? [geminiGood, ...list.filter((m) => m !== geminiGood)] : list;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM + '\n\n' + JSON_SHAPE }] },
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: mediaType, data: base64 } },
        { text: `This is my ${mealLabel || 'meal'}. I have about ${Math.round(remainingKcal ?? 0)} kcal left for today. Analyse it.` },
      ],
    }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
  });
  let lastStatus = 0, lastMsg = '';
  const deadline = Date.now() + 12000; // never keep you waiting more than ~12 s
  for (const model of order) {
    for (let attempt = 0; attempt < 2 && Date.now() < deadline; attempt++) {
      let r;
      try {
        r = await fetch(`${GEMINI}/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body });
      } catch (e) { throw new Error('Failed to fetch'); }
      if (r.ok) {
        const j = await r.json();
        const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
        const clean = text.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
        if (!clean) break; // empty/blocked answer → try next model
        geminiGood = model;
        return normalise(JSON.parse(clean));
      }
      lastStatus = r.status;
      try { const e = await r.json(); lastMsg = e?.error?.message || ''; } catch { lastMsg = ''; }
      if (r.status === 401 || r.status === 403 || (r.status === 400 && /api key/i.test(lastMsg))) throw new Error('Gemini key invalid (401)');
      if (r.status === 404 || r.status === 400) break; // model not usable for this key → next model
      // free tier has no quota at all for this model → skip it straight away
      if (r.status === 429 && /limit: 0|free_tier|quota/i.test(lastMsg) && /limit: 0/.test(lastMsg)) break;
      if ([429, 500, 502, 503, 504].includes(r.status)) {
        onStatus?.(r.status === 429 ? 'Free limit busy, retrying…' : `Google is busy, trying ${model.replace('models/', '')}…`);
        await wait(1500 * (attempt + 1));
        continue;
      }
      break;
    }
    if (Date.now() >= deadline) break;
  }
  const detail = lastMsg ? ` (${lastStatus}: ${lastMsg.slice(0, 120)})` : lastStatus ? ` (${lastStatus})` : '';
  const err = new Error((lastStatus === 429 ? 'Free Gemini limit reached for now.' : 'Google AI is busy right now.') + detail);
  err.busy = true;
  throw err;
}

export async function testGeminiKey(apiKey) {
  geminiModels = null; geminiGood = null;
  const list = await listGeminiModels(apiKey);
  return list[0];
}

// ---------- Anthropic Claude (paid) ----------
export async function analyzeFoodPhoto({ base64, mediaType = 'image/jpeg', apiKey, mealLabel, remainingKcal }) {
  if (!apiKey) throw new Error('NO_KEY');
  const anthropic = client(apiKey);
  const response = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          {
            type: 'text',
            text: `This is my ${mealLabel || 'meal'}. I have about ${Math.round(remainingKcal ?? 0)} kcal left for today. Analyse it.`,
          },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') throw new Error('The photo could not be analysed. Try another angle.');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return normalise(JSON.parse(text));
}

export async function testKey(apiKey) {
  const anthropic = client(apiKey);
  const r = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 64,
    output_config: { effort: 'low' },
    messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
  });
  return r.content.some((b) => b.type === 'text');
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

// ---------- Free AI chain: Gemini first, Groq as backup ----------
async function analyzeFree(profile, args) {
  const errs = [];
  if (profile.geminiKey) {
    try { return await analyzeGemini({ ...args, apiKey: profile.geminiKey }); } catch (e) { errs.push(e); }
    if (profile.groqKey) args.onStatus?.('Google busy, asking Groq…');
  }
  if (profile.groqKey) {
    try { return await analyzeGroq({ ...args, apiKey: profile.groqKey }); } catch (e) { errs.push(e); }
  }
  // only report "invalid key" when every key we have is invalid; otherwise it is a busy error (photo gets queued)
  const allInvalid = errs.length && errs.every((e) => /invalid/i.test(String(e.message)));
  if (allInvalid) throw errs[0];
  const busy = errs.find((e) => !/invalid/i.test(String(e.message))) || errs[0];
  const err = new Error(errs.map((e) => String(e.message)).join(' · ') || busy?.message || 'AI busy');
  err.busy = true;
  throw err;
}

const GROQ = 'https://api.groq.com/openai/v1';
const GROQ_DEFAULTS = ['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct'];
let groqModels = null, groqGood = null;

async function listGroqModels(apiKey) {
  if (groqModels) return groqModels;
  try {
    const r = await fetch(GROQ + '/models', { headers: { Authorization: 'Bearer ' + apiKey } });
    if (r.status === 401) throw new Error('Groq key invalid (401)');
    if (r.ok) {
      const ids = ((await r.json()).data || []).filter((m) => m.active !== false).map((m) => m.id);
      // vision-capable chat models (Llama 4, anything named vision / vl)
      const vis = ids.filter((id) => /llama-4|vision|-vl|vl-|scout|maverick/i.test(id) && !/guard|whisper|tts/i.test(id));
      vis.sort((a, b) => (/scout/i.test(b) ? 1 : 0) - (/scout/i.test(a) ? 1 : 0));
      groqModels = [...new Set([...vis, ...GROQ_DEFAULTS.filter((d) => !ids.length || ids.includes(d))])];
      if (!groqModels.length) groqModels = GROQ_DEFAULTS;
      return groqModels;
    }
  } catch (e) { if (/invalid/.test(e.message)) throw e; }
  return GROQ_DEFAULTS;
}

export async function analyzeGroq({ base64, mediaType = 'image/jpeg', apiKey, mealLabel, remainingKcal, onStatus }) {
  const list = await listGroqModels(apiKey);
  const order = groqGood ? [groqGood, ...list.filter((m) => m !== groqGood)] : list;
  let lastStatus = 0, lastMsg = '';
  const deadline = Date.now() + 15000;
  for (const model of order) {
    for (let attempt = 0; attempt < 2 && Date.now() < deadline; attempt++) {
      let r;
      try {
        r = await fetch(GROQ + '/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
          body: JSON.stringify({
            model, temperature: 0.2, max_completion_tokens: 1500,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: SYSTEM + '\n\n' + JSON_SHAPE },
              { role: 'user', content: [
                { type: 'text', text: `This is my ${mealLabel || 'meal'}. I have about ${Math.round(remainingKcal ?? 0)} kcal left for today. Analyse it and reply with JSON only.` },
                { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } },
              ] },
            ],
          }),
        });
      } catch { throw new Error('Failed to fetch'); }
      if (r.ok) {
        const j = await r.json();
        const text = j.choices?.[0]?.message?.content || '';
        const clean = text.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
        const m = clean.match(/\{[\s\S]*\}/);
        if (!m) break;
        groqGood = model;
        return normalise(JSON.parse(m[0]));
      }
      lastStatus = r.status;
      try { lastMsg = (await r.json())?.error?.message || ''; } catch { lastMsg = ''; }
      if (r.status === 401 || r.status === 403) throw new Error('Groq key invalid (401)');
      if (r.status === 404 || r.status === 400) break; // model retired / no vision → next one
      if ([429, 500, 502, 503, 504].includes(r.status)) { onStatus?.('Groq busy, retrying…'); await wait(1500 * (attempt + 1)); continue; }
      break;
    }
    if (Date.now() >= deadline) break;
  }
  const err = new Error(`Groq busy${lastStatus ? ` (${lastStatus}${lastMsg ? ': ' + lastMsg.slice(0, 100) : ''})` : ''}`);
  err.busy = true;
  throw err;
}

export async function testGroqKey(apiKey) {
  const r = await fetch(GROQ + '/models', { headers: { Authorization: 'Bearer ' + apiKey } });
  if (r.status === 401 || r.status === 403) throw new Error('Groq key invalid');
  if (!r.ok) throw new Error('Groq error ' + r.status);
  groqModels = null;
  return (await listGroqModels(apiKey))[0];
}
