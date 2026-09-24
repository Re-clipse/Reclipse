'use client';

import { useEffect, useState } from 'react';
import Mascot from '@/components/Mascot';
import { useCelebrate } from '@/components/Celebrate';
import { play } from '@/lib/sound';

// A no-login, no-AI, no-database demo of the real study + quiz UI, using a
// couple of sample cards so anyone can feel the flow. Mirrors the markup/classes
// of /study and /quiz so it looks identical to the real thing.

const CARD = {
  question: 'Why does active recall beat re-reading for long-term memory?',
  answer:
    'Retrieving information forces your brain to reconstruct it, which strengthens the memory trace far more than passively seeing it again (the "testing effect").',
};

const QUIZ = {
  question: 'Which gas do plants mainly absorb from the air for photosynthesis?',
  options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'],
  correctIndex: 1,
  explanation:
    'Plants pull carbon dioxide in through tiny pores called stomata and combine it with water and sunlight to make glucose, releasing oxygen as a byproduct.',
};

const KEYS = ['A', 'B', 'C', 'D'];

export default function DemoClient() {
  const { burst, cannon } = useCelebrate();
  const [stage, setStage] = useState('card'); // card -> quiz -> done
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    function onKey(e) {
      if (stage === 'card' && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault(); setRevealed((r) => !r);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage]);

  return (
    <main className="page page--narrow">
      <div className="center u-mb-6">
        <span className="badge">Interactive demo</span>
        <h1 style={{ fontSize: 'var(--text-2xl)', marginTop: 'var(--s-3)' }}>
          {stage === 'card' ? 'Try a flashcard' : stage === 'quiz' ? 'Try a quiz question' : 'Nice work'}
        </h1>
        <p className="muted small u-mt-2">
          This is exactly how studying feels in Reclipse. With your own notes, it&apos;s all built from your material.
        </p>
      </div>

      {/* Progress dots */}
      <div className="row" style={{ justifyContent: 'center', gap: 'var(--s-2)', marginBottom: 'var(--s-5)' }}>
        {['card', 'quiz', 'done'].map((s, i) => (
          <span key={s} style={{
            width: stage === s ? 24 : 8, height: 8, borderRadius: 999,
            background: ['card', 'quiz', 'done'].indexOf(stage) >= i ? 'var(--violet-600)' : 'var(--line)',
            transition: 'all var(--t-base) var(--ease-spring)',
          }} />
        ))}
      </div>

      {stage === 'card' && (
        <>
          <div className={`flip${revealed ? ' flip--revealed' : ''}`}>
            <div className="flip__inner" onClick={() => { setRevealed((r) => !r); play('flip'); }} role="button" tabIndex={0}>
              <div className="flip__face">
                <span className="flip__label">Question</span>
                <p className="flip__text">{CARD.question}</p>
                <span className="flip__cue">Answer out loud first, then flip</span>
              </div>
              <div className="flip__face flip__face--back">
                <span className="flip__label">Answer</span>
                <p className="flip__text">{CARD.answer}</p>
              </div>
            </div>
          </div>
          {!revealed ? (
            <button className="btn btn--primary btn--block btn--lg" onClick={() => { setRevealed(true); play('flip'); }}>
              Show answer
            </button>
          ) : (
            <div className="grade animate-in">
              <button className="btn btn--again btn--lg" onClick={() => setStage('quiz')}>Still learning</button>
              <button className="btn btn--got btn--lg" onClick={() => setStage('quiz')}>Got it</button>
            </div>
          )}
        </>
      )}

      {stage === 'quiz' && (
        <div className="card animate-in">
          <p className="q__text">{QUIZ.question}</p>
          <div className="options">
            {QUIZ.options.map((opt, idx) => {
              let cls = 'option';
              if (picked !== null) {
                if (idx === QUIZ.correctIndex) cls += ' option--correct';
                else if (idx === picked) cls += ' option--wrong';
                else cls += ' option--muted';
              }
              return (
                <button key={idx} className={cls} disabled={picked !== null}
                        onClick={(ev) => { setPicked(idx); if (idx === QUIZ.correctIndex) { burst(ev.currentTarget, { count: 22, power: 8 }); play('correct'); } else play('wrong'); }}>
                  <span className="option__key">{KEYS[idx]}</span><span>{opt}</span>
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <>
              <div className="explain">
                <strong>{picked === QUIZ.correctIndex ? 'Correct' : 'Not quite'}</strong>
                {QUIZ.explanation}
              </div>
              <button className="btn btn--primary btn--block btn--lg u-mt-5" 
                      onClick={() => { setStage('done'); play('complete'); setTimeout(() => cannon(), 200); }}>
                Finish demo
              </button>
            </>
          )}
        </div>
      )}

      {stage === 'done' && (
        <div className="card center animate-in u-p-7">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--s-2)' }}>
            <Mascot mood="celebrate" size={120} bounce />
          </div>
          <h2 className="u-text-2xl">That&apos;s the whole loop</h2>
          <p className="u-mt-3 u-accent-text">
            In the real app you&apos;d earn experience points (XP), level up, and unlock achievements for this.
          </p>
          <p className="muted u-mt-2">
            Flip, recall, quiz, repeat — with your flashcards timed by spaced repetition, so you
            review exactly what needs it. Ready to try it for real?
          </p>
          <div className="row actions-sm-stack u-row-center u-mt-6">
            <a href="/login?mode=signup" className="btn btn--primary btn--lg">Get started free</a>
            <button className="btn btn--ghost" onClick={() => { setStage('card'); setRevealed(false); setPicked(null); }}>
              Replay demo
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
