'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import { useToast } from '@/components/Toast';
import { exportCsv, exportAnki } from '@/lib/export';
import Modal from '@/components/Modal';
import LoadError from '@/components/LoadError';
import { withTimeout } from '@/lib/net';

// share_id/collab_id are bearer tokens — the entire authorization boundary
// for a shared or collaborative deck link — so they need a CSPRNG, not
// Math.random() (which is also variable-length: e.g. (0.5).toString(36)
// yields a much shorter string than intended).
function nanoid() {
  return crypto.randomUUID().replace(/-/g, '');
}

export default function DeckPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState('cards');
  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [quizCount, setQuizCount] = useState(0);
  const [courses, setCourses] = useState([]);
  const [status, setStatus] = useState('loading');
  const [editing, setEditing] = useState(null); // card being edited
  const [adding, setAdding] = useState(false);
  const [collabCount, setCollabCount] = useState(0);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizLoaded, setQuizLoaded] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState(null); // quiz question being edited
  const [addingQuiz, setAddingQuiz] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [d, c, q, co] = await withTimeout(Promise.all([
        supabase.from('decks').select('*').eq('id', id).maybeSingle(),
        supabase.from('flashcards').select('*').eq('deck_id', id).order('created_at'),
        supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('deck_id', id),
        supabase.from('courses').select('*').order('name'),
      ]), 12000, 'deck');
      if (!d.data) { setStatus('missing'); return; }
      setDeck(d.data); setCards(c.data || []); setQuizCount(q.count || 0);
      setCourses(co.data || []); setStatus('ready');
    } catch {
      setStatus('failed');
      return;
    }

    const { count } = await supabase.from('deck_collaborators')
      .select('user_id', { count: 'exact', head: true }).eq('deck_id', id);
    setCollabCount(count || 0);
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  // Both tabs' content is lazy-loaded on first visit rather than on every
  // deck page load, since most visits never open them.
  const loadQuiz = useCallback(async () => {
    const { data } = await supabase.from('quiz_questions').select('*').eq('deck_id', id).order('created_at');
    setQuizQuestions(data || []);
    setQuizCount(data?.length || 0);
    setQuizLoaded(true);
  }, [id]);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase.from('study_sessions')
      .select('id, kind, reviewed, correct, duration_seconds, created_at')
      .eq('deck_id', id).order('created_at', { ascending: false }).limit(50);
    setSessions(data || []);
    setHistoryLoaded(true);
  }, [id]);

  useEffect(() => {
    if (tab === 'quiz' && !quizLoaded) loadQuiz();
    if (tab === 'history' && !historyLoaded) loadHistory();
  }, [tab, quizLoaded, historyLoaded, loadQuiz, loadHistory]);

  async function saveQuiz(qq) {
    if (qq.id) {
      await supabase.from('quiz_questions')
        .update({ question: qq.question, options: qq.options, correct_index: qq.correct_index, explanation: qq.explanation })
        .eq('id', qq.id);
    } else {
      await supabase.from('quiz_questions')
        .insert({ deck_id: id, question: qq.question, options: qq.options, correct_index: qq.correct_index, explanation: qq.explanation });
    }
    setEditingQuiz(null); setAddingQuiz(false); loadQuiz();
  }

  async function deleteQuiz(quizId) {
    if (!confirm('Delete this question?')) return;
    setQuizQuestions((qs) => qs.filter((x) => x.id !== quizId));
    setQuizCount((n) => Math.max(0, n - 1));
    await supabase.from('quiz_questions').delete().eq('id', quizId);
  }

  async function saveCard(card) {
    if (card.id) {
      await supabase.from('flashcards')
        .update({ question: card.question, answer: card.answer }).eq('id', card.id);
    } else {
      await supabase.from('flashcards')
        .insert({ deck_id: id, question: card.question, answer: card.answer, card_type: 'basic' });
    }
    setEditing(null); setAdding(false); load();
  }

  async function deleteCard(cardId) {
    if (!confirm('Delete this card?')) return;
    setCards((c) => c.filter((x) => x.id !== cardId));
    await supabase.from('flashcards').delete().eq('id', cardId);
  }

  async function setCourse(courseId) {
    await supabase.from('decks').update({ course_id: courseId || null }).eq('id', id);
    setDeck((d) => ({ ...d, course_id: courseId || null }));
  }

  async function toggleShare() {
    const makePublic = !deck.is_public;
    const share_id = deck.share_id || nanoid();
    const course_label = courses.find((c) => c.id === deck.course_id)?.name || deck.course_label || null;
    await supabase.from('decks').update({ is_public: makePublic, share_id, course_label }).eq('id', id);
    setDeck((d) => ({ ...d, is_public: makePublic, share_id, course_label }));
    toast(makePublic ? 'Deck is now shareable' : 'Sharing turned off');
  }

  async function toggleCollab() {
    const enabled = !deck.collab_enabled;
    const collab_id = deck.collab_id || nanoid();
    await supabase.from('decks').update({ collab_enabled: enabled, collab_id }).eq('id', id);
    setDeck((d) => ({ ...d, collab_enabled: enabled, collab_id }));
    toast(enabled ? 'Collaboration turned on' : 'Collaboration turned off');
  }

  async function toggleArchive() {
    const listing = !deck.is_archived;
    // Listing implies sharing the course label, so the archive can group by course.
    const course_label = courses.find((c) => c.id === deck.course_id)?.name || deck.course_label || null;
    await supabase.from('decks')
      .update({ is_archived: listing, archive_price_cents: null, course_label })
      .eq('id', id);
    setDeck((d) => ({ ...d, is_archived: listing, archive_price_cents: null, course_label }));
    toast(listing ? 'Deck shared to the archive' : 'Deck removed from the archive');
  }

  async function duplicate() {
    const { data: copy } = await supabase.from('decks').insert({
      user_id: user.id, title: `${deck.title} (copy)`, source_text: deck.source_text,
      summary: deck.summary, course_id: deck.course_id, copied_from: deck.id,
    }).select().single();
    if (!copy) return;
    if (cards.length) {
      await supabase.from('flashcards').insert(
        cards.map((c) => ({ deck_id: copy.id, question: c.question, answer: c.answer, card_type: c.card_type }))
      );
    }
    const { data: qs } = await supabase.from('quiz_questions').select('*').eq('deck_id', id);
    if (qs?.length) {
      await supabase.from('quiz_questions').insert(
        qs.map((q) => ({ deck_id: copy.id, question: q.question, options: q.options,
                         correct_index: q.correct_index, explanation: q.explanation }))
      );
    }
    router.push(`/deck/${copy.id}`);
  }

  async function renameDeck(title) {
    await supabase.from('decks').update({ title }).eq('id', id);
    setDeck((d) => ({ ...d, title }));
  }

  if (authLoading || status === 'loading') {
    return <main className="page"><div className="skeleton" style={{ height: 400 }} /></main>;
  }
  if (status === 'failed') {
    return <main className="page"><LoadError onRetry={() => { setStatus('loading'); load(); }} /></main>;
  }
  if (status === 'missing') {
    return (
      <main className="page"><div className="empty">
        <h3>Deck not found</h3><p>It may have been deleted.</p>
        <a href="/decks" className="btn btn--primary">Back to my decks</a>
      </div></main>
    );
  }

  const shareUrl = deck.share_id ? `${typeof window !== 'undefined' ? window.location.origin : ''}/shared/${deck.share_id}` : '';

  return (
    <main className="page">
      <div className="page__head">
        <div style={{ minWidth: 0 }}>
          <h1 contentEditable suppressContentEditableWarning
              onBlur={(e) => renameDeck(e.target.textContent.trim() || deck.title)}
              style={{ outline: 'none' }} title="Click to rename">{deck.title}</h1>
          <p>{cards.length} cards · {quizCount} quiz questions</p>
        </div>
        <div className="row">
          <a href={`/study?deck=${id}`} className="btn btn--primary">Study</a>
          {quizCount > 0 && <a href={`/quiz?deck=${id}`} className="btn btn--ghost">Quiz</a>}
        </div>
      </div>

      <div className="tabs">
        {[['cards', 'Cards'], ['quiz', 'Quiz'], ['summary', 'Summary'], ['history', 'History'], ['settings', 'Settings']].map(([k, l]) => (
          <button key={k} className={`tab${tab === k ? ' tab--on' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>


      {tab === 'cards' && (
        <div className="stack">
          <button className="btn btn--ghost" onClick={() => setAdding(true)}>+ Add a card</button>
          {cards.map((c) => (
            <div key={c.id} className="card crow">
              <div className="crow__body">
                <div className="crow__q">
                  {c.card_type === 'cloze' && <span className="badge" style={{ marginRight: 8 }}>Fill blank</span>}
                  {c.question}
                </div>
                <div className="crow__a">{c.answer}</div>
              </div>
              <div className="crow__tools">
                <button className="icon-btn" onClick={() => setEditing(c)} aria-label={`Edit "${c.question}"`}>✎</button>
                <button className="icon-btn icon-btn--danger" onClick={() => deleteCard(c.id)} aria-label={`Delete "${c.question}"`}>×</button>
              </div>
            </div>
          ))}
          {cards.length === 0 && <div className="empty"><h3>No cards yet</h3><p>Add one manually above.</p></div>}
        </div>
      )}

      {tab === 'quiz' && (
        <div className="stack">
          <button className="btn btn--ghost" onClick={() => setAddingQuiz(true)}>+ Add a question</button>
          {!quizLoaded ? (
            <div className="skeleton" style={{ height: 120 }} />
          ) : (
            <>
              {quizQuestions.map((qq) => (
                <div key={qq.id} className="card crow">
                  <div className="crow__body">
                    <div className="crow__q">{qq.question}</div>
                    <div className="crow__a">
                      {(Array.isArray(qq.options) ? qq.options : []).map((opt, i) => (
                        <div key={i} style={i === qq.correct_index ? { fontWeight: 650, color: 'var(--success)' } : undefined}>
                          {i === qq.correct_index ? '✓ ' : ''}{opt}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="crow__tools">
                    <button className="icon-btn" onClick={() => setEditingQuiz(qq)} aria-label={`Edit "${qq.question}"`}>✎</button>
                    <button className="icon-btn icon-btn--danger" onClick={() => deleteQuiz(qq.id)} aria-label={`Delete "${qq.question}"`}>×</button>
                  </div>
                </div>
              ))}
              {quizQuestions.length === 0 && (
                <div className="empty"><h3>No quiz questions yet</h3><p>Add one manually above.</p></div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'summary' && (
        deck.summary
          ? <div className="summary-box animate-in">{deck.summary}</div>
          : <div className="empty">
              <h3>No summary for this deck</h3>
              <p>Summaries are generated with newer study sets. Regenerate this deck to get one.</p>
            </div>
      )}

      {tab === 'history' && (
        <div className="stack">
          {!historyLoaded ? (
            <div className="skeleton" style={{ height: 120 }} />
          ) : sessions.length === 0 ? (
            <div className="empty">
              <h3>No study sessions yet</h3>
              <p>Study or quiz this deck and your sessions will show up here.</p>
            </div>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="card row row--between">
                <div>
                  <div style={{ fontWeight: 600 }}>{s.kind === 'quiz' ? 'Quiz' : 'Flashcards'}</div>
                  <div className="small muted">
                    {new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <div className="small muted" style={{ textAlign: 'right' }}>
                  <div>{s.reviewed} reviewed{s.kind === 'quiz' ? ` · ${s.correct}/${s.reviewed} correct` : ''}</div>
                  <div>{Math.max(1, Math.round((s.duration_seconds || 0) / 60))} min</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="stack">
          <div className="card stack">
            <label className="label" htmlFor="deck-course">Course</label>
            <select id="deck-course" className="input" value={deck.course_id || ''} onChange={(e) => setCourse(e.target.value)}>
              <option value="">Uncategorised</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="card">
            <div className="switch">
              <div>
                <div className="u-fw-650">Share this deck</div>
                <p className="small muted">
                  Anyone with the link can view and copy it, no login needed — and it&apos;ll show up in
                  {' '}<a href="/discover">Campus popular</a> once someone studies it.
                </p>
              </div>
              <button className={deck.is_public ? 'btn btn--primary' : 'btn btn--ghost'} onClick={toggleShare}>
                {deck.is_public ? 'Sharing on' : 'Turn on'}
              </button>
            </div>
            {deck.is_public && shareUrl && (
              <div className="row u-mt-4">
                <input className="input" readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
                <button className="btn btn--ghost" onClick={() => {
                  navigator.clipboard?.writeText(shareUrl); toast('Share link copied', 'success');
                }}>Copy</button>
              </div>
            )}
          </div>

          <div className="card">
            <div className="switch">
              <div>
                <div className="u-fw-650">Collaborative editing</div>
                <p className="small muted">
                  Anyone with this link can join and add or edit flashcards in this deck, once they
                  sign in (a free account). Good for a study group building a deck together.
                </p>
              </div>
              <button className={deck.collab_enabled ? 'btn btn--primary' : 'btn btn--ghost'} onClick={toggleCollab}>
                {deck.collab_enabled ? 'On' : 'Turn on'}
              </button>
            </div>
            {deck.collab_enabled && deck.collab_id && (
              <>
                <div className="row u-mt-4">
                  <input className="input" readOnly
                         value={`${typeof window !== 'undefined' ? window.location.origin : ''}/collab/${deck.collab_id}`}
                         onFocus={(e) => e.target.select()} />
                  <button className="btn btn--ghost" onClick={() => {
                    navigator.clipboard?.writeText(`${window.location.origin}/collab/${deck.collab_id}`);
                    toast('Collaboration link copied', 'success');
                  }}>Copy</button>
                </div>
                <p className="small muted u-mt-3">
                  {collabCount} {collabCount === 1 ? 'person has' : 'people have'} joined so far.
                </p>
              </>
            )}
          </div>

          <div className="card">
            <div className="switch">
              <div>
                <div className="u-fw-650">Share in the Campus Archive</div>
                <p className="small muted">
                  Different from Campus popular above — this lists your deck for paying Campus Archive
                  members to study. You don&apos;t set a price and don&apos;t get paid for it.
                </p>
              </div>
              <button className={deck.is_archived ? 'btn btn--primary' : 'btn btn--ghost'} onClick={toggleArchive}>
                {deck.is_archived ? 'Shared' : 'Share it'}
              </button>
            </div>

            {deck.is_archived && (
              <>
                <div className="row u-mt-4">
                  <input className="input" readOnly
                         value={`${typeof window !== 'undefined' ? window.location.origin : ''}/archive/${id}`}
                         onFocus={(e) => e.target.select()} />
                  <button className="btn btn--ghost" onClick={() => {
                    navigator.clipboard?.writeText(`${window.location.origin}/archive/${id}`);
                    toast('Listing link copied', 'success');
                  }}>Copy</button>
                </div>
              </>
            )}
          </div>

          <div className="card">
            <div style={{ fontWeight: 650, marginBottom: 'var(--s-1)' }}>Export cards</div>
            <p className="small muted u-mb-4">
              Download your cards to use elsewhere: CSV for spreadsheets, or a tab-separated
              file that imports straight into Anki or Quizlet.
            </p>
            <div className="row">
              <button className="btn btn--ghost" onClick={() => { exportCsv(deck.title, cards); toast('CSV downloaded', 'success'); }}>
                Export CSV
              </button>
              <button className="btn btn--ghost" onClick={() => { exportAnki(deck.title, cards); toast('File downloaded', 'success'); }}>
                Anki / Quizlet
              </button>
            </div>
          </div>

          <div className="card switch">
            <div>
              <div className="u-fw-650">Duplicate deck</div>
              <p className="small muted">Make an editable copy, leaving this one untouched.</p>
            </div>
            <button className="btn btn--ghost" onClick={duplicate}>Duplicate</button>
          </div>
        </div>
      )}

      {(editing || adding) && (
        <CardModal
          card={editing || { question: '', answer: '' }}
          onCancel={() => { setEditing(null); setAdding(false); }}
          onSave={saveCard}
        />
      )}

      {(editingQuiz || addingQuiz) && (
        <QuizModal
          question={editingQuiz || { question: '', options: [], correct_index: 0, explanation: '' }}
          onCancel={() => { setEditingQuiz(null); setAddingQuiz(false); }}
          onSave={saveQuiz}
        />
      )}
    </main>
  );
}

function CardModal({ card, onCancel, onSave }) {
  const [q, setQ] = useState(card.question);
  const [a, setA] = useState(card.answer);
  return (
    <Modal title={card.id ? 'Edit card' : 'New card'} onClose={onCancel}>
        <div className="stack">
          <div className="field">
            <label className="label" htmlFor="card-q">Question</label>
            <textarea id="card-q" className="textarea" style={{ minHeight: 90 }} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label className="label" htmlFor="card-a">Answer</label>
            <textarea id="card-a" className="textarea" style={{ minHeight: 90 }} value={a} onChange={(e) => setA(e.target.value)} />
          </div>
          <div className="row">
            <button className="btn btn--primary" disabled={!q.trim() || !a.trim()}
                    onClick={() => onSave({ ...card, question: q.trim(), answer: a.trim() })}>Save</button>
            <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          </div>
        </div>
    </Modal>
  );
}

function QuizModal({ question, onCancel, onSave }) {
  const [q, setQ] = useState(question.question);
  const [options, setOptions] = useState(
    Array.isArray(question.options) && question.options.length ? [...question.options] : ['', '', '', '']
  );
  const [correctIndex, setCorrectIndex] = useState(question.correct_index ?? 0);
  const [explanation, setExplanation] = useState(question.explanation || '');

  function setOption(i, val) {
    setOptions((opts) => opts.map((o, idx) => (idx === i ? val : o)));
  }

  const valid = q.trim().length > 0 && options.every((o) => o.trim().length > 0) && correctIndex < options.length;

  return (
    <Modal title={question.id ? 'Edit question' : 'New question'} onClose={onCancel}>
      <div className="stack">
        <div className="field">
          <label className="label" htmlFor="quiz-q">Question</label>
          <textarea id="quiz-q" className="textarea" style={{ minHeight: 70 }} value={q}
                    onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label className="label" id="quiz-options-label">Options — select the correct one</label>
          <div className="stack" style={{ gap: 'var(--s-2)' }} role="radiogroup" aria-labelledby="quiz-options-label">
            {options.map((opt, i) => (
              <div key={i} className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
                <input type="radio" name="quiz-correct" checked={correctIndex === i}
                       onChange={() => setCorrectIndex(i)} aria-label={`Option ${i + 1} is correct`} />
                <input className="input" value={opt} onChange={(e) => setOption(i, e.target.value)}
                       placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1} text`} />
              </div>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="quiz-explain">Explanation (optional)</label>
          <textarea id="quiz-explain" className="textarea" style={{ minHeight: 60 }} value={explanation}
                    onChange={(e) => setExplanation(e.target.value)} />
        </div>
        <div className="row">
          <button className="btn btn--primary" disabled={!valid} onClick={() => onSave({
            ...question, question: q.trim(), options: options.map((o) => o.trim()),
            correct_index: correctIndex, explanation: explanation.trim() || null,
          })}>Save</button>
          <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
