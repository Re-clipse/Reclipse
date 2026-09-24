// Accurate to what the codebase actually does as of this writing: zero
// cookies, one localStorage key for the login session, no analytics/ad
// trackers (verified by grepping the whole app for document.cookie and
// third-party script tags). Re-verify this page if that ever changes.

export const metadata = { title: 'Cookie Policy' };

export default function CookiesPage() {
  return (
    <main className="page">
      <div className="page__head">
        <div>
          <h1>Cookie Policy</h1>
          <p>Last updated: September 2026</p>
        </div>
      </div>
      <div className="stack" style={{ gap: 'var(--s-5)' }}>
        <section>
          <h2>The short version</h2>
          <p>Reclipse doesn&apos;t use cookies. There&apos;s no cookie banner asking you to accept
            tracking, because there&apos;s no tracking to accept.</p>
        </section>

        <section>
          <h2>What we do use</h2>
          <p>
            Your browser&apos;s local storage keeps you signed in between visits and remembers your
            light/dark theme preference. This stays on your device, is strictly necessary for the app
            to function, and isn&apos;t used to track you across other sites.
          </p>
        </section>

        <section>
          <h2>Third parties</h2>
          <p>
            We don&apos;t run any analytics, advertising, or tracking scripts. The only third-party
            services involved are our infrastructure providers (Supabase, Anthropic, Stripe, Resend) —
            see our <a href="/privacy">Privacy Policy</a> for what each one does.
          </p>
        </section>
      </div>
    </main>
  );
}
