// Builds the homepage's prepared examples by running the two bundled sample
// files through the same extraction and generation steps a real upload uses.
// The homepage then shows the saved result, so visiting it never calls the AI.
//
//   node scripts/prepare-examples.mjs
//
// Needs ANTHROPIC_API_KEY (read from .env.local). Costs one vision call and
// two generation calls. Review the output before using it on the homepage.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import Anthropic from '@anthropic-ai/sdk';
import { tidy, TRANSCRIBE_PROMPT } from '../lib/extraction.js';
import { buildSystemPrompt } from '../lib/generationPrompt.js';
import { parseGeneration, MAX_FLASHCARDS, MAX_QUIZ_QUESTIONS } from '../lib/generation.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse/lib/pdf-parse.js'); // the package index runs a self-test when not required by a parent

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90_000 });
// Same model choice as app/api/generate/route.js.
const MODEL = process.env.GENERATION_MODEL || 'claude-haiku-4-5-20251001';

async function generate(text) {
  const system = buildSystemPrompt({ maxCards: MAX_FLASHCARDS, maxQuiz: MAX_QUIZ_QUESTIONS });
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await anthropic.messages.create({ model: MODEL, max_tokens: 9000, system, messages: [{ role: 'user', content: text }] });
    try { return parseGeneration(res.content.find((c) => c.type === 'text')?.text); } catch (e) { console.warn('unusable reply, retrying:', e.message); }
  }
  throw new Error('generation failed twice');
}

const pdfFile = 'public/examples/economics-choices-and-tradeoffs.pdf';
const photoFile = 'public/examples/biology-module1-notes.jpg';

const pdfText = tidy((await pdfParse(readFileSync(pdfFile))).text);
const pdfSet = await generate(pdfText);
console.log(`PDF: ${pdfText.length} chars -> ${pdfSet.flashcards.length} cards`);

const photo = await anthropic.messages.create({
  model: 'claude-sonnet-5', // same as app/api/extract-pdf/route.js
  max_tokens: 4000,
  messages: [{ role: 'user', content: [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: readFileSync(photoFile).toString('base64') } },
    { type: 'text', text: TRANSCRIBE_PROMPT },
  ] }],
});
const photoText = tidy(photo.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n'));
const photoSet = await generate(photoText);
console.log(`Photo: ${photoText.length} chars -> ${photoSet.flashcards.length} cards`);

// Written next to the curated file, so the homepage's subject labels and highlight
// keys are kept; copy the cards you want into lib/homeExamples.json after reviewing.
writeFileSync('lib/homeExamples.generated.json', JSON.stringify({
  generatedAt: new Date().toISOString().slice(0, 10),
  model: MODEL,
  pdf: { file: '/' + pdfFile.replace('public/', ''), text: pdfText, flashcards: pdfSet.flashcards },
  photo: { file: '/' + photoFile.replace('public/', ''), text: photoText, flashcards: photoSet.flashcards },
}, null, 2) + '\n');
console.log('Wrote lib/homeExamples.generated.json');
