const config = require('./config');

// LLM-assisted bibliographic metadata extraction: given a source's text, pull
// out { title, authors, published(year) }. Tries a cascade of providers and
// returns the first usable answer, or null if none is configured / all fail.
//
// Providers (in order): Gemini → Gemma (Google's free Generative Language API)
// → local Ollama. All are plain HTTP via global fetch — no SDKs to install.

const META = config.metadata;

const buildPrompt = (text) => `Extract bibliographic metadata from the document text below.
Respond with ONLY a JSON object, no commentary, with exactly these keys:
  "title":   the work's title, or "" if not determinable
  "authors": the author full name(s), comma-separated, or ""
  "year":    the 4-digit publication year as a string, or ""

The text may be OCR'd and noisy; infer sensibly and do not invent facts.

Document text:
"""
${text}
"""`;

// Pull the first {...} object out of a model response (handles code fences and
// stray prose around the JSON).
function pickJson(raw) {
  if (!raw) return null;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

const clean = (value) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, 500);

async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Google Generative Language API — serves both Gemini and Gemma models.
async function callGoogle(model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': META.geminiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  }, 20000);
  if (!res.ok) throw new Error(`${model} → HTTP ${res.status}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOllama(model, prompt) {
  const base = META.ollamaBase.replace(/\/$/, '');
  const res = await fetchWithTimeout(`${base}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, prompt, stream: false, format: 'json', options: { temperature: 0 },
    }),
  }, 60000);
  if (!res.ok) throw new Error(`${model} → HTTP ${res.status}`);
  const data = await res.json();
  return data?.response || '';
}

// The publication year is often absent from the text (a scanned chapter rarely
// reprints its own date). When we have a title but no year, ask Gemini with
// Google Search grounding for just the year — a tiny, targeted lookup. Returns
// '' if it can't be determined. Gemini-only (grounding isn't an Ollama thing).
async function lookupYear(title, authors) {
  const who = authors ? ` by ${authors}` : '';
  const prompt = `In what year was the work titled "${title}"${who} first published? `
    + 'Search the web if needed. Reply with ONLY the 4-digit year, or an empty '
    + 'response if you cannot determine it.';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${META.geminiModel}:generateContent`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': META.geminiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0 },
    }),
  }, 20000);
  if (!res.ok) throw new Error(`year lookup → HTTP ${res.status}`);
  const data = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text).join('');
  const match = String(text).match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  return match ? match[1] : '';
}

function providers() {
  const list = [];
  if (META.geminiKey) {
    list.push({ name: META.geminiModel, call: (p) => callGoogle(META.geminiModel, p) });
    list.push({ name: META.gemmaModel, call: (p) => callGoogle(META.gemmaModel, p) });
  }
  if (META.ollamaBase) {
    list.push({ name: META.ollamaModel, call: (p) => callOllama(META.ollamaModel, p) });
  }
  return list;
}

// Is any provider configured? Lets callers skip the whole "processing" detour
// when there's nothing to enrich with (keeps the zero-config default instant).
function enabled() {
  return providers().length > 0;
}

/**
 * Extract { title, authors, published } from text, or null. Never throws.
 */
async function extract(text) {
  const prompt = buildPrompt(String(text || '').slice(0, META.maxChars));
  let result = null;
  for (const provider of providers()) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const json = pickJson(await provider.call(prompt));
      if (json && (json.title || json.authors || json.year)) {
        result = {
          title: clean(json.title),
          authors: clean(json.authors),
          published: clean(json.year),
          provider: provider.name,
        };
        break;
      }
    } catch (err) {
      console.error(`[metadata] ${provider.name} failed:`, err.message);
    }
  }

  // Year missing but we know the work? Look it up via grounded web search.
  if (result && !result.published && result.title && META.geminiKey && META.searchYear) {
    try {
      const year = await lookupYear(result.title, result.authors);
      if (year) {
        result.published = year;
        result.yearVia = 'google_search';
      }
    } catch (err) {
      console.error('[metadata] year lookup failed:', err.message);
    }
  }
  return result;
}

module.exports = { extract, enabled, fields: ['title', 'authors', 'published'] };
