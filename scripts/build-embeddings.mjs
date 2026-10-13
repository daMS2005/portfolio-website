// Embed the content/ markdown files into Upstash Vector for the droid's RAG.
// Run locally (Node 18+):
//   GEMINI_API_KEY=... UPSTASH_VECTOR_REST_URL=... UPSTASH_VECTOR_REST_TOKEN=... \
//     node scripts/build-embeddings.mjs
// Re-run whenever content/ changes. Safe to run repeatedly (ids are stable).
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const GEMINI = process.env.GEMINI_API_KEY;
const URL_ = process.env.UPSTASH_VECTOR_REST_URL;
const TOKEN = process.env.UPSTASH_VECTOR_REST_TOKEN;
if (!GEMINI || !URL_ || !TOKEN) {
  console.error('Set GEMINI_API_KEY, UPSTASH_VECTOR_REST_URL, UPSTASH_VECTOR_REST_TOKEN');
  process.exit(1);
}

function chunk(text) {
  // split on headings/blank-line groups into ~900-char chunks
  const parts = text.split(/\n(?=#)|\n\n(?=[A-Z])/);
  const chunks = [];
  let cur = '';
  for (const p of parts) {
    if ((cur + '\n' + p).length > 900 && cur) { chunks.push(cur.trim()); cur = p; }
    else cur = cur ? cur + '\n' + p : p;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.filter((c) => c.length > 40);
}

async function embed(text) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { parts: [{ text }] }, taskType: 'RETRIEVAL_DOCUMENT', outputDimensionality: 768 }),
    }
  );
  if (!r.ok) throw new Error(`embed failed ${r.status}: ${await r.text()}`);
  return (await r.json()).embedding.values;
}

const files = (await readdir('content')).filter((f) => f.endsWith('.md'));
let total = 0;
for (const f of files) {
  const text = await readFile(`content/${f}`, 'utf8');
  const chunks = chunk(text);
  console.log(`${f}: ${chunks.length} chunks`);
  for (const c of chunks) {
    const id = f + ':' + createHash('sha1').update(c).digest('hex').slice(0, 12);
    const vector = await embed(c);
    const up = await fetch(`${URL_}/upsert`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, vector, metadata: { text: c, source: f } }),
    });
    if (!up.ok) throw new Error(`upsert failed ${up.status}: ${await up.text()}`);
    total += 1;
    process.stdout.write('.');
  }
  console.log();
}
console.log(`done: ${total} chunks embedded (768-dim, cosine). Create the Upstash index with dimension 768.`);
