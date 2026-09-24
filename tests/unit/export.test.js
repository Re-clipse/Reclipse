import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exportCsv, exportAnki } from '@/lib/export';

const nativeCreateElement = document.createElement.bind(document);

// export.js drives a client-side file download via Blob/URL.createObjectURL
// and a synthetic <a click>. jsdom implements neither Blob text-reading nor
// createObjectURL fully, so we capture what the module *asks the DOM to do*
// rather than trying to read the resulting file back out of a real blob URL.
describe('lib/export', () => {
  let createdUrl;
  let clickedAnchor;

  beforeEach(() => {
    createdUrl = 'blob:mock-url';
    clickedAnchor = null;
    global.URL.createObjectURL = vi.fn(() => createdUrl);
    global.URL.revokeObjectURL = vi.fn();

    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = nativeCreateElement(tag);
      if (tag === 'a') {
        clickedAnchor = el;
        el.click = vi.fn();
      }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exportCsv', () => {
    it('builds a CSV with a header row and one row per card', () => {
      let captured;
      global.Blob = vi.fn(function (parts, opts) {
        captured = { text: parts.join(''), opts };
      });
      exportCsv('My Deck', [
        { question: 'Q1', answer: 'A1' },
        { question: 'Q2', answer: 'A2' },
      ]);
      expect(captured.text).toBe('Question,Answer\nQ1,A1\nQ2,A2');
      expect(captured.opts.type).toContain('text/csv');
    });

    it('quotes and escapes fields containing commas, quotes, or newlines', () => {
      let captured;
      global.Blob = vi.fn(function (parts) { captured = parts.join(''); });
      exportCsv('Deck', [{ question: 'Contains, a comma', answer: 'Has "quotes" and\nnewline' }]);
      expect(captured).toBe('Question,Answer\n"Contains, a comma","Has ""quotes"" and\nnewline"');
    });

    it('handles an empty card list (header only)', () => {
      let captured;
      global.Blob = vi.fn(function (parts) { captured = parts.join(''); });
      exportCsv('Empty Deck', []);
      expect(captured).toBe('Question,Answer');
    });

    it('slugifies the filename from the deck title', () => {
      global.Blob = vi.fn(function () {});
      exportCsv('CS 101: Intro to Programming!!', [{ question: 'q', answer: 'a' }]);
      expect(clickedAnchor.download).toBe('cs-101-intro-to-programming.csv');
    });

    it('falls back to "deck" as the filename when the title is empty/unsafe', () => {
      global.Blob = vi.fn(function () {});
      exportCsv('', [{ question: 'q', answer: 'a' }]);
      expect(clickedAnchor.download).toBe('deck.csv');
      exportCsv('!!!', [{ question: 'q', answer: 'a' }]);
      expect(clickedAnchor.download).toBe('deck.csv');
    });

    it('revokes the object URL after triggering the download', () => {
      global.Blob = vi.fn(function () {});
      exportCsv('Deck', [{ question: 'q', answer: 'a' }]);
      expect(clickedAnchor.click).toHaveBeenCalledTimes(1);
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(createdUrl);
    });
  });

  describe('exportAnki', () => {
    it('builds tab-separated question<TAB>answer lines', () => {
      let captured;
      global.Blob = vi.fn(function (parts, opts) { captured = { text: parts.join(''), opts }; });
      exportAnki('Deck', [
        { question: 'Q1', answer: 'A1' },
        { question: 'Q2', answer: 'A2' },
      ]);
      expect(captured.text).toBe('Q1\tA1\nQ2\tA2');
      expect(captured.opts.type).toContain('text/plain');
    });

    it('replaces literal tabs inside question/answer text so they cannot break the format', () => {
      let captured;
      global.Blob = vi.fn(function (parts) { captured = parts.join(''); });
      exportAnki('Deck', [{ question: 'Q1\twith tab', answer: 'A1\twith tab too' }]);
      expect(captured).toBe('Q1 with tab\tA1 with tab too');
    });

    it('exports to a .txt file', () => {
      global.Blob = vi.fn(function () {});
      exportAnki('Bio Notes', [{ question: 'q', answer: 'a' }]);
      expect(clickedAnchor.download).toBe('bio-notes.txt');
    });

    it('handles an empty card list', () => {
      let captured;
      global.Blob = vi.fn(function (parts) { captured = parts.join(''); });
      exportAnki('Deck', []);
      expect(captured).toBe('');
    });
  });
});
