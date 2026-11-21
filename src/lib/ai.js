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
  const data = JSON.parse(text);
  const flagged = data.items.some((i) => DISALLOWED_WORDS.some((w) => i.name.toLowerCase().includes(w)));
  data.contains_non_veg = data.contains_non_veg || flagged;
  data.items = data.items.map((i) => ({
    id: 'ai_' + Math.random().toString(36).slice(2, 8),
    name: i.name,
    emoji: i.emoji || '🍽️',
    serving: i.portion,
    kcal: i.kcal, p: i.protein_g, c: i.carbs_g, f: i.fat_g, fb: i.fiber_g,
    confidence: i.confidence,
    qty: 1,
  }));
  return data;
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
