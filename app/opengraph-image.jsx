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
          background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 55%, #5B21B6 100%)',
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
              borderRadius: 20,
              background: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9" /><path d="M21 3v6h-6" />
            </svg>
          </div>
          <div style={{ fontSize: 64, fontWeight: 800, color: '#fff' }}>Reclipse</div>
        </div>
        <div style={{ fontSize: 34, fontWeight: 600, color: '#F4F1FB', textAlign: 'center', maxWidth: 880 }}>
          Study less. Remember more.
        </div>
        <div style={{ fontSize: 24, color: '#E5DEFA', textAlign: 'center', maxWidth: 820, marginTop: 18 }}>
          Turn lecture notes into flashcards and quizzes built on active recall.
        </div>
      </div>
    ),
    { ...size }
  );
}
