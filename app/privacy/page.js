// Drafted from the actual data flows in this codebase (Supabase, Anthropic,
// Stripe, Resend — no ad trackers or analytics exist here). This is a
// starting point, not legal advice: have an actual lawyer review it,
// especially the data-retention and cross-border-transfer sections, before
// relying on it.

export const metadata = {
  title: 'Privacy Policy',
  description: 'How Reclipse collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <main className="page">
      <div className="page__head">
        <div>
          <h1>Privacy Policy</h1>
          <p>Last updated: September 2026</p>
        </div>
      </div>
      <div className="stack" style={{ gap: 'var(--s-5)' }}>
        <section>
          <h2>What this is</h2>
          <p>
            Reclipse (&quot;we&quot;) turns your notes into flashcards and quizzes. This page explains
            what information we collect, why, and who else sees it. It applies to reclipse.ca and
            the Reclipse app.
          </p>
        </section>

        <section>
          <h2>What we collect</h2>
          <ul>
            <li><strong>Account info:</strong> your email address, password (handled entirely by our
              authentication provider, Supabase — we never see it in plain text), and optionally a
              display name and school.</li>
            <li><strong>Content you give us:</strong> notes, PDFs, photos, or pasted text you upload
              to generate flashcards; the flashcards, quizzes, and decks that result; course names
              and dates you add or that we extract from a syllabus you upload.</li>
            <li><strong>Study activity:</strong> which cards you review, quiz answers, streaks, and
              timestamps — used to schedule spaced repetition and show your progress.</li>
            <li><strong>Preferences:</strong> your timezone and which reminder emails you want, so we
              send them at sensible times and only the ones you asked for.</li>
            <li><strong>Payment status:</strong> if you subscribe to Campus Archive (our paid tier that
              unlocks every archived deck), we store whether your subscription is active and when it
              renews. We do not store your card number — Stripe handles that directly.</li>
          </ul>
          <p>We don&apos;t collect anything beyond what the features above need, and we don&apos;t run
            ads, analytics, or tracking scripts of any kind — see our <a href="/cookies">Cookie Policy</a>{' '}
            for the full picture of what runs in your browser.</p>
        </section>

        <section>
          <h2>Who else sees it</h2>
          <p>We share data with a small number of service providers, only for what they each need to do:</p>
          <ul>
            <li><strong>Supabase</strong> — hosts our database and handles login. Sees everything above.</li>
            <li><strong>Anthropic (Claude, the AI that generates your flashcards)</strong> — receives the
              notes/text/images you upload and your syllabus text, to generate flashcards, quizzes, and
              study tips. Does not receive your email, password, or payment information.</li>
            <li><strong>Stripe</strong> — processes payment for the Campus Archive subscription. Receives
              your email and payment details directly; we never see your full card number.</li>
            <li><strong>Resend</strong> — delivers the emails you&apos;ve opted into (exam reminders,
              study-session reminders, weekly digest). Receives your email address and the content of
              those emails.</li>
          </ul>
          <p>We never sell your data, and we don&apos;t share it with anyone else.</p>
        </section>

        <section>
          <h2>Cookies and local storage</h2>
          <p>
            We don&apos;t use cookies; your login session and a few preferences are kept in your
            browser&apos;s local storage instead. See our <a href="/cookies">Cookie Policy</a> for
            exactly what&apos;s stored and why.
          </p>
        </section>

        <section>
          <h2>How long we keep it</h2>
          <p>
            We keep your data for as long as your account exists. You can delete your account and
            everything tied to it at any time from <a href="/settings">Settings</a> — this is permanent
            and cannot be undone.
          </p>
        </section>

        <section>
          <h2>Your rights</h2>
          <p>
            You can access, correct, or delete your data at any time through the app. If you need
            something the app doesn&apos;t offer a self-serve option for, contact us and we&apos;ll help.
          </p>
        </section>

        <section>
          <h2>Age</h2>
          <p>
            Reclipse is built for post-secondary students and intended for users 16 and older. We
            don&apos;t knowingly collect data from children under 16.
          </p>
        </section>

        <section>
          <h2>Changes</h2>
          <p>If this policy changes in a meaningful way, we&apos;ll update the date at the top of this page.</p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>Questions about this policy? Reach us through the contact details on our site.</p>
        </section>
      </div>
    </main>
  );
}
