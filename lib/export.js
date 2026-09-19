// Client-side deck export helpers. No server needed — builds a file in the
// browser and triggers a download.

function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCsv(deckTitle, cards) {
  const rows = [['Question', 'Answer'], ...cards.map((c) => [c.question, c.answer])];
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
  download(`${safe(deckTitle)}.csv`, csv, 'text/csv;charset=utf-8');
}

// Anki / Quizlet both import tab-separated "question<TAB>answer" pairs.
export function exportAnki(deckTitle, cards) {
  const tsv = cards.map((c) => `${c.question.replace(/\t/g, ' ')}\t${c.answer.replace(/\t/g, ' ')}`).join('\n');
  download(`${safe(deckTitle)}.txt`, tsv, 'text/plain;charset=utf-8');
}

function safe(name) {
  return (name || 'deck').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'deck';
}
