/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse ships a pre-bundled copy of pdf.js that webpack mangles, throwing
  // "UnknownErrorException" at import time and breaking every PDF upload.
  // Loading it natively on the server instead of bundling it fixes that.
  //
  // NOTE: this key lives under `experimental` on Next 14. It moves to a
  // top-level `serverExternalPackages` in Next 15 — change it when upgrading,
  // and re-test a PDF upload, because it fails silently at runtime, not build time.
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
};

module.exports = nextConfig;
