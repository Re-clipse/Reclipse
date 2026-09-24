const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://reclipse.ca';

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/discover', '/archive', '/archive/', '/demo', '/login', '/privacy', '/terms', '/cookies', '/refund'],
      disallow: [
        '/api/',
        '/decks',
        '/deck/',
        '/settings',
        '/study',
        '/upload',
        '/quiz',
        '/exam',
        '/calendar',
        '/syllabus',
        '/welcome',
        '/reset',
        '/dashboard',
        '/collab/',
        '/shared/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
