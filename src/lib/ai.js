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
  if (p === 'gemini' && profile.geminiKey) return 'gemini';
  if (p === 'claude' && profile.apiKey) return 'claude';
  return 'offline';
}

export async function analyzeWithProfile(profile, args) {
  const prov = activeProvider(profile);
  if (prov === 'gemini') return analyzeGemini({ ...args, apiKey: profile.geminiKey });
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
  const r = await fetch(`${GEMINI}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey } });
  if (!r.ok) throw new Error(r.status === 400 || r.status === 403 ? 'Gemini key invalid (401)' : `Gemini error ${r.status}`);
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
  for (const d of ['models/gemini-2.5-flash', 'models/gemini-2.5-flash-lite', 'models/gemini-2.0-flash']) if (!names.includes(d)) names.push(d);
  geminiModels = names.slice(0, 6);
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
  let lastStatus = 0;
  for (const model of order) {
    for (let attempt = 0; attempt < 2; attempt++) {
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
      if (r.status === 400 || r.status === 401 || r.status === 403) throw new Error('Gemini key invalid (401)');
      if (r.status === 404) break; // model not available for this key → next model
      if ([429, 500, 502, 503, 504].includes(r.status)) {
        onStatus?.(r.status === 429 ? 'Free limit busy, retrying…' : 'Google is busy, retrying…');
        await wait(1200 * (attempt + 1));
        continue;
      }
      break;
    }
  }
  if (lastStatus === 429) throw new Error('Free Gemini limit reached for now — wait a minute and retry, or use Quick-pick.');
  throw new Error('Google AI is very busy right now. Tap Retake in a minute, or use Quick-pick.');
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
