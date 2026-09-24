import pdfParse from 'pdf-parse';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseFromRequest } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Fail fast instead of hanging past this route's own maxDuration.
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 50_000, maxRetries: 0 });

const MAX_FILE_BYTES = 15 * 1024 * 1024;   // 15MB
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // Anthropic image limit
const MAX_EXTRACTED_CHARS = 24000;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// PDF text layers come out padded with runs of spaces and blank lines. Left as
// is, that padding is sent to the model as tokens you pay for and it makes the
// notes harder to read in the textarea. Collapse it before either happens.
function tidy(raw) {
  return raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// pdf-parse has a reproducible cold-start bug: the very first call in a fresh
// Node process throws "UnknownErrorException" while it lazily requires its
// bundled pdf.js internally; every call after that succeeds, because the
// require is then cached. Retrying once is the direct fix for exactly that
// failure mode, rather than something papering over a real error.
async function parsePdfWithRetry(buffer) {
  try {
    return await pdfParse(buffer);
  } catch (err) {
    console.warn('pdf-parse failed on first attempt (known cold-start issue), retrying once:', err.message);
    return await pdfParse(buffer);
  }
}

/** Photo of notes / whiteboard -> text, via vision. */
async function transcribeImage(buffer, mediaType) {
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } },
        {
          type: 'text',
          text: `Transcribe all the study material in this image into plain text.

Keep the original structure: headings, bullet points, numbered lists, and any
labelled diagram text. Expand common shorthand where the meaning is unambiguous.
If part is genuinely illegible, write [illegible] rather than guessing — a wrong
guess would end up in their flashcards as a fact.

Output only the transcription, no preamble.`,
        },
      ],
    }],
  });
  return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

export async function POST(request) {
  // Reading a photo spends Anthropic vision-API credit per call — same class
  // of cost this app already caps for /api/generate. Require login so this
  // isn't a free, unlimited, unauthenticated way to burn that credit.
  const supabase = supabaseFromRequest(request);
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return Response.json({ error: 'Please log in to upload a file.' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) return Response.json({ error: 'No file provided.' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_FILE_BYTES) {
      return Response.json({ error: 'File is too large (max 15MB).' }, { status: 400 });
    }

    const name = (file.name || '').toLowerCase();
    const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
    const isImage = IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|gif|webp)$/.test(name);

    let text = '';
    let source = 'text';

    if (isPdf) {
      text = tidy((await parsePdfWithRetry(buffer)).text);
      source = 'pdf';
    } else if (isImage) {
      if (buffer.length > MAX_IMAGE_BYTES) {
        return Response.json({ error: 'That image is too large. Please use one under 5MB.' }, { status: 400 });
      }
      const mediaType = IMAGE_TYPES.includes(file.type)
        ? file.type
        : name.endsWith('.png') ? 'image/png'
        : name.endsWith('.webp') ? 'image/webp'
        : name.endsWith('.gif') ? 'image/gif' : 'image/jpeg';
      text = tidy(await transcribeImage(buffer, mediaType));
      source = 'image';
    } else {
      text = tidy(buffer.toString('utf-8'));
    }

    if (!text || text.length < 30) {
      return Response.json({
        error: isPdf
          ? "We couldn't find readable text in that PDF. If it's a scan, try uploading a photo of the pages instead. We can read those."
          : "We couldn't find readable text in that file.",
      }, { status: 400 });
    }

    const truncated = text.length > MAX_EXTRACTED_CHARS;
    if (truncated) text = text.slice(0, MAX_EXTRACTED_CHARS);

    return Response.json({ text, truncated, source });
  } catch (err) {
    console.error('extract error:', err);
    const msg = String(err?.message || '');
    if (msg.includes('credit balance')) {
      return Response.json(
        { error: 'Reading photos needs AI credit, which has run out. PDFs and text files still work.' },
        { status: 502 }
      );
    }
    // "bad XRef" / UnknownErrorException = a structurally malformed PDF, not
    // a transient issue — seen from files put through unusual conversion
    // tools. A different export (or pasting the text directly) fixes it.
    if (msg.includes('XRef') || msg.includes('UnknownErrorException') || msg.includes('Invalid PDF')) {
      return Response.json(
        {
          error:
            "This PDF's internal structure looks corrupted, so we can't read it. Try re-exporting or re-saving it as a PDF, or paste the text in directly.",
        },
        { status: 400 }
      );
    }
    return Response.json({ error: 'Could not read this file.' }, { status: 400 });
  }
}
