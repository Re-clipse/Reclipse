import Mascot from '@/components/Mascot';

export default function NotFound() {
  return (
    <main className="page page--narrow">
      <div className="empty">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--s-3)' }}>
          <Mascot mood="thinking" size={110} float />
        </div>
        <h3>This page slipped into shadow</h3>
        <p>That link doesn&apos;t go anywhere — it may have moved, or the deck was deleted.</p>
        <a href="/decks" className="btn btn--primary btn--lg">Back to my decks</a>
      </div>
    </main>
  );
}
