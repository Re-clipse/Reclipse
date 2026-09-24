import { Suspense } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';
import AmbientBg from '@/components/AmbientBg';
import { ToastProvider } from '@/components/Toast';
import { CelebrateProvider } from '@/components/Celebrate';
import CommandBar from '@/components/CommandBar';
import ReferralCapture from '@/components/ReferralCapture';
import ConsentNotice from '@/components/ConsentNotice';

export const metadata = {
  title: { default: 'Reclipse: Stop copying the board. Start remembering it.', template: '%s | Reclipse' },
  description:
    'Upload your lecture notes and slides. Reclipse turns them into flashcards and quizzes built on active recall, so class time is for listening, not transcribing.',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  appleWebApp: { capable: true, title: 'Reclipse', statusBarStyle: 'default' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6D28D9',
};

// Self-hosted at build time via next/font — no runtime request to Google's
// servers (and no visitor IP/user-agent sent there on every page load, which
// the old <link> tags below did). This is also what makes the Privacy and
// Cookie policies' "only four third parties" claim actually true.
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], display: 'swap' });

// Applied before paint so dark-mode users never see a white flash.
const themeScript = `
(function () {
  try {
    var t = localStorage.getItem('reclipse-theme');
    if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
  } catch (e) {}
})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.className}>
        <CelebrateProvider>
        <ToastProvider>
          <AmbientBg />
          <Nav />
          <CommandBar />
          <Suspense fallback={null}><ReferralCapture /></Suspense>
          {children}
          <footer className="footer">
            <p>Reclipse, built by students, for students at Wilfrid Laurier.</p>
            <nav className="footer__links" aria-label="Legal">
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
              <a href="/refund">Refunds</a>
              <a href="/cookies">Cookies</a>
            </nav>
          </footer>
          <ConsentNotice />
        </ToastProvider>
        </CelebrateProvider>
      </body>
    </html>
  );
}
