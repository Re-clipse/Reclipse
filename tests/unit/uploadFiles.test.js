import { describe, expect, it } from 'vitest';
import { checkFile, fileKind } from '../../lib/uploadFiles.js';

const f = (name, type, size = 1000) => ({ name, type, size });
const MB = 1024 * 1024;

describe('upload file checks (mirror /api/extract-pdf)', () => {
  it('recognises PDFs, photos and text files', () => {
    expect(fileKind(f('notes.pdf', 'application/pdf'))).toBe('pdf');
    expect(fileKind(f('page.JPG', ''))).toBe('image');
    expect(fileKind(f('notes.txt', 'text/plain'))).toBe('text');
    expect(fileKind(f('slides.pptx', 'application/vnd.ms-powerpoint'))).toBe(null);
  });

  it('applies the 5 MB photo and 15 MB file limits', () => {
    expect(checkFile(f('a.png', 'image/png', 5 * MB))).toBe('');
    expect(checkFile(f('a.png', 'image/png', 5 * MB + 1))).toMatch(/over 5 MB/);
    expect(checkFile(f('a.pdf', 'application/pdf', 15 * MB))).toBe('');
    expect(checkFile(f('a.pdf', 'application/pdf', 15 * MB + 1))).toMatch(/over 15 MB/);
  });

  it('explains unsupported types, including iPhone HEIC photos', () => {
    expect(checkFile(f('IMG_1.HEIC', 'image/heic'))).toMatch(/HEIC/);
    expect(checkFile(f('deck.pptx', ''))).toMatch(/isn’t supported/);
  });
});
