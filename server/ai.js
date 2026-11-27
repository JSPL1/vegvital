// Food-photo AI, run on the server so no key ever reaches a phone.
// Order: Google Gemini (free) → Groq (free backup) → Anthropic Claude (paid, only if a key is set).
// Keys come from the server settings: GEMINI_API_KEY, GROQ_API_KEY, ANTHROPIC_API_KEY.
import Anthropic from '@anthropic-ai/sdk';
import { DISALLOWED_WORDS } from '../src/data/foods.js';

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GROQ_KEY = process.env.GROQ_API_KEY || '';
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY || '';

export const aiConfigured = () => !!(GEMINI_KEY || GROQ_KEY || CLAUDE_KEY);

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
let geminiModels = null, geminiModelsAt = 0, geminiGood = null;

async function listGeminiModels() {
  if (geminiModels && Date.now() - geminiModelsAt < 6 * 3600e3) return geminiModels;
  const FALLBACK = ['models/gemini-2.5-flash', 'models/gemini-2.5-flash-lite', 'models/gemini-2.0-flash', 'models/gemini-flash-latest'];
  let r;
  try { r = await fetch(`${GEMINI}/models?pageSize=200`, { headers: { 'x-goog-api-key': GEMINI_KEY } }); } catch { return FALLBACK; }
  if (!r.ok) return FALLBACK;
  const { models = [] } = await r.json();
  const ok = models.filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')
    && /flash/i.test(m.name) && !/(image|tts|audio|live|thinking|embedding|exp)/i.test(m.name));
  const score = (n) => {
    const v = parseFloat((n.match(/gemini-(\d+(\.\d+)?)/) || [])[1] || 0);
    return (/preview/.test(n) ? 0 : 1000) + v * 10 + (/lite/.test(n) ? -5 : 0) + (/latest/.test(n) ? 1 : 0);
  };
  ok.sort((x, y) => score(y.name) - score(x.name));
  const names = ok.map((m) => m.name);
  for (const d of FALLBACK) if (!names.includes(d)) names.push(d);
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
  const deadline = Date.now() + 15000;
  for (const model of order) {
    for (let attempt = 0; attempt < 2 && Date.now() < deadline; attempt++) {
      const r = await fetch(`${GEMINI}/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY }, body });
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
      if (r.status === 404 || r.status === 400) break;
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
let groqModels = null, groqGood = null;

async function listGroqModels() {
  if (groqModels) return groqModels;
  try {
    const r = await fetch(GROQ + '/models', { headers: { Authorization: 'Bearer ' + GROQ_KEY } });
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
  let last = '';
  const deadline = Date.now() + 15000;
  for (const model of order) {
    for (let attempt = 0; attempt < 2 && Date.now() < deadline; attempt++) {
      const r = await fetch(GROQ + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + GROQ_KEY },
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
      last = `Groq ${r.status}${msg ? ': ' + msg.slice(0, 100) : ''}`;
      if (r.status === 401 || r.status === 403) throw new Error(last);
      if (r.status === 404 || r.status === 400) break;
      if ([429, 500, 502, 503, 504].includes(r.status)) { await wait(1500 * (attempt + 1)); continue; }
      break;
    }
    if (Date.now() >= deadline) break;
  }
  throw new Error(last || 'Groq busy');
}

// ---------- Anthropic Claude (optional, paid) ----------
async function analyzeClaude({ base64, mediaType, mealLabel, remainingKcal }) {
  const anthropic = new Anthropic({ apiKey: CLAUDE_KEY });
  const r = await anthropic.messages.create({
    model: process.env.CLAUDE_MODEL || 'claude-haiku-5-5',
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

/** Returns the analysis, or throws an error with .busy = true when every AI is busy right now. */
export async function analyzePhoto(args) {
  const a = { mediaType: 'image/jpeg', ...args };
  const errs = [];
  if (GEMINI_KEY) { try { return await analyzeGemini(a); } catch (e) { errs.push(e.message); } }
  if (GROQ_KEY) { try { return await analyzeGroq(a); } catch (e) { errs.push(e.message); } }
  if (CLAUDE_KEY) { try { return await analyzeClaude(a); } catch (e) { errs.push(e.message); } }
  console.warn('[ai] all providers failed:', errs.join(' · '));
  const err = new Error(errs.length ? 'The food AI is busy right now. Your photo is saved and will be read automatically soon.' : 'Photo reading is not set up on the server yet.');
  err.busy = true;
  throw err;
}
