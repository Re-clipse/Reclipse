// Shared by /api/extract-pdf and scripts/prepare-examples.mjs, so the homepage
// examples are produced by exactly the same extraction steps as real uploads.

// PDF text layers come out padded with runs of spaces and blank lines. Left as
// is, that padding is sent to the model as tokens you pay for and it makes the
// notes harder to read in the textarea. Collapse it before either happens.
export function tidy(raw) {
  return raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Instructions for turning a photo of notes or a whiteboard into text. */
export const TRANSCRIBE_PROMPT = `Transcribe all the study material in this image into plain text.

Keep the original structure: headings, bullet points, numbered lists, and any
labelled diagram text. Expand common shorthand where the meaning is unambiguous.
If part is genuinely illegible, write [illegible] rather than guessing — a wrong
guess would end up in their flashcards as a fact.

Output only the transcription, no preamble.`;
