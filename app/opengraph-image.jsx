import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F4F1EA',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 10,
              background: '#1D1C19',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#F4F1EA" strokeWidth="2.4"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9" /><path d="M21 3v6h-6" />
            </svg>
          </div>
          <div style={{ fontSize: 64, fontWeight: 700, color: '#1D1C19' }}>Reclipse</div>
        </div>
        <div style={{ fontSize: 34, fontWeight: 600, color: '#1D1C19', textAlign: 'center', maxWidth: 880 }}>
          Turn this week&apos;s lecture into flashcards.
        </div>
        <div style={{ fontSize: 24, color: '#625E55', textAlign: 'center', maxWidth: 820, marginTop: 18 }}>
          Upload your notes. Get flashcards, a practice quiz, and reviews on a spaced schedule.
        </div>
      </div>
    ),
    { ...size }
  );
}
