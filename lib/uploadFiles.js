// Client-side checks for the upload page.
// Mirrors the limits /api/extract-pdf enforces, so a bad file is caught before it's uploaded.
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const ACCEPT = '.pdf,.txt,image/jpeg,image/png,image/webp,image/gif';

export function fileKind(file) {
  const name = (file.name || '').toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|gif|webp)$/.test(name)) return 'image';
  if (file.type === 'text/plain' || name.endsWith('.txt')) return 'text';
  return null;
}

/** The same rejections the server makes, checked up front. Returns an error message or ''. */
export function checkFile(file) {
  const kind = fileKind(file);
  if (!kind) {
    return /\.hei[cf]$/i.test(file.name || '') || /hei[cf]/.test(file.type)
      ? 'HEIC photos aren’t supported. Export it as a JPG, or on a phone use “Take a photo”.'
      : 'That file type isn’t supported. Use a PDF, a photo (JPG, PNG, WebP or GIF) or a .txt file.';
  }
  if (kind === 'image' && file.size > MAX_IMAGE_BYTES) return 'That photo is over 5 MB. Try a smaller photo or a screenshot of the page.';
  if (file.size > MAX_FILE_BYTES) return 'That file is over 15 MB. Try uploading just the pages you need.';
  return '';
}

