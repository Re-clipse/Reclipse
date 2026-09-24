const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://reclipse.ca';

export default function sitemap() {
  const staticRoutes = ['', '/discover', '/archive', '/demo', '/login', '/privacy', '/terms', '/cookies', '/refund'];
  return staticRoutes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
  }));
}
