import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

// Drives the real /upload component with Supabase and the network mocked:
// a selected file can be previewed, replaced and removed, bad files are
// rejected before any upload, and a double submit starts only one generation.

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
const auth = { user: { id: 'u1' }, loading: false }; // stable, like the real hook
vi.mock('@/lib/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/components/Mascot', () => ({ default: () => null }));
vi.mock('@/components/PageHeader', () => ({ default: () => null, ICONS: {} }));
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 't', user: { id: 'u1' } } } }) },
    from: () => ({ select: () => ({ order: async () => ({ data: [] }) }) }),
  },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = false;
const { default: UploadPage } = await import('../../app/upload/page.js');

let root, el, fetchMock;
// Real timers, no async act: let effects and mocked fetches settle between steps.
const tick = () => new Promise((r) => setTimeout(r, 30));
const button = (name) => [...el.querySelectorAll('button')].find((b) => b.textContent.trim() === name);
async function pick(file) {
  const input = el.querySelector('input[type=file]');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  act(() => { input.dispatchEvent(new Event('change', { bubbles: true })); });
  await tick();
}

beforeEach(async () => {
  URL.createObjectURL = vi.fn(() => 'blob:thumb');
  URL.revokeObjectURL = vi.fn();
  fetchMock = vi.fn(async (url) => (url === '/api/extract-pdf'
    ? { ok: true, status: 200, json: async () => ({ text: 'Mitochondria produce most of the cell’s ATP. '.repeat(4), source: 'image' }) }
    : new Promise(() => {}))); // generation never resolves: we only count calls
  globalThis.fetch = fetchMock;
  el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => { root.render(h(UploadPage)); });
  await tick();
});
afterEach(() => { act(() => root.unmount()); el.remove(); });

describe('upload page', () => {
  it('shows the selected photo with a thumbnail, then removes it', async () => {
    await pick(new File(['x'], 'notes.jpg', { type: 'image/jpeg' }));
    expect(el.querySelector('.up-file__thumb').getAttribute('src')).toBe('blob:thumb');
    expect(el.textContent).toContain('notes.jpg');
    expect(el.textContent).toContain('Check the text below');
    expect(button('Replace')).toBeTruthy();
    act(() => { button('Remove').click(); });
    expect(el.querySelector('.up-file')).toBeNull();
    expect(el.querySelector('#notes').value).toBe('');
  });

  it('rejects an oversized photo before uploading anything', async () => {
    await pick(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }));
    expect(el.querySelector('[role=alert]').textContent).toMatch(/over 5 MB/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps a file that failed to read and offers to try again', async () => {
    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 400, json: async () => ({ error: 'We couldn’t find readable text in that PDF.' }) }));
    await pick(new File(['x'], 'scan.pdf', { type: 'application/pdf' }));
    expect(el.querySelector('[role=alert]').textContent).toMatch(/readable text/);
    expect(el.textContent).toContain('scan.pdf');
    act(() => { button('Try again').click(); });
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('Text ready below');
  });

  it('starts only one generation on a double submit', async () => {
    await pick(new File(['x'], 'notes.jpg', { type: 'image/jpeg' }));
    const form = el.querySelector('form');
    act(() => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await tick();
    expect(fetchMock.mock.calls.filter(([u]) => u === '/api/generate')).toHaveLength(1);
    expect(el.textContent).toContain('Creating flashcards and a quiz');
  });
});
