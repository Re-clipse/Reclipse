import { Suspense } from 'react';
import './globals.css';
import Nav from '@/components/Nav';
import AmbientBg from '@/components/AmbientBg';
import { ToastProvider } from '@/components/Toast';
import { CelebrateProvider } from '@/components/Celebrate';
import CommandBar from '@/components/CommandBar';
import ReferralCapture from '@/components/ReferralCapture';

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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <CelebrateProvider>
        <ToastProvider>
          <AmbientBg />
          <Nav />
          <CommandBar />
          <Suspense fallback={null}><ReferralCapture /></Suspense>
          {children}
          <footer className="footer">
            Reclipse, built by students, for students at Wilfrid Laurier.
          </footer>
        </ToastProvider>
        </CelebrateProvider>
      </body>
    </html>
  );
}
