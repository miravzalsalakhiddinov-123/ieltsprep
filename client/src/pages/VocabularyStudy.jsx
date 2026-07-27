import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import VocabFlashcard from '../components/VocabFlashcard';
import { downloadWeakWordsPdf } from '../utils/vocabPdf';

const STAGES = ['flashcards', 'texts', 'recall', 'quiz'];
const STAGE_LABEL = { flashcards: 'Flashcards', texts: 'Reading', recall: 'Recall', quiz: 'Quiz' };
const STAGE_ICON = { flashcards: '🗂️', texts: '📖', recall: '✏️', quiz: '❓' };
const LANG_LABEL = { russian: 'Russian', uzbek: 'Uzbek' };

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function buildHighlighter(words) {
  const cleaned = words.map(w => w.trim()).filter(Boolean).sort((a, b) => b.length - a.length).map(escapeRegex);
  if (!cleaned.length) return null;
  return new RegExp(`\\b(${cleaned.join('|')})\\b`, 'gi');
}

function renderHighlighted(text, regex, keyPrefix) {
  if (!regex) return text;
  const re = new RegExp(regex.source, regex.flags);
  const nodes = [];
  let lastIndex = 0, match, i = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    nodes.push(<mark className="vocab-highlight" key={`${keyPrefix}-${i++}`}>{match[0]}</mark>);
    lastIndex = re.lastIndex;
    if (match[0].length === 0) re.lastIndex += 1;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function renderTextBody(body, regex) {
  return body.split(/\n\s*\n/).map((block, i) => (
    <p key={i}>{renderHighlighted(block.trim(), regex, `t${i}`)}</p>
  ));
}

function normalize(s) { return s.trim().toLowerCase().replace(/\s+/g, ' '); }
function isCorrect(userInput, correctEnglish) {
  const given = normalize(userInput);
  if (!given) return false;
  return correctEnglish.split('/').map(normalize).includes(given);
}

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function VocabularyStudy() {
  const { setId } = useParams();
  const navigate = useNavigate();
  const [set, setSet] = useState(null);
  const [stage, setStage] = useState('flashcards');
  const [translationLang, setTranslationLang] = useState('russian');

  // flashcards: one at a time + know/still-learning tracking
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [stillLearning, setStillLearning] = useState({}); // { [wordId]: true }

  // texts: shown one at a time
  const [textIndex, setTextIndex] = useState(0);

  // recall: one at a time
  const [recallIndex, setRecallIndex] = useState(0);
  const [recallInput, setRecallInput] = useState('');
  const [recallResults, setRecallResults] = useState({}); // { [wordId]: bool }, only for graded words
  const [recallDone, setRecallDone] = useState(false);

  // quiz: multiple choice, one at a time, built from every word in the set
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({}); // { [wordId]: chosen option string }
  const [quizDone, setQuizDone] = useState(false);
  const [quizAttempt, setQuizAttempt] = useState(0); // bump to reshuffle on retry

  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    if (!focusMode) return;
    function onKeyDown(e) { if (e.key === 'Escape') setFocusMode(false); }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusMode]);

  useEffect(() => {
    setSet(null); setStage('flashcards'); setTranslationLang('russian');
    setCardIndex(0); setCardFlipped(false); setStillLearning({});
    setTextIndex(0);
    setRecallIndex(0); setRecallInput(''); setRecallResults({}); setRecallDone(false);
    setQuizIndex(0); setQuizAnswers({}); setQuizDone(false); setQuizAttempt(0);
    api.getVocabSet(setId).then(setSet);
  }, [setId]);

  const highlighter = useMemo(() => set ? buildHighlighter(set.words.map(w => w.english)) : null, [set]);

  // words that actually have a translation in the currently chosen language —
  // for Russian this is every word (the column is required); for Uzbek it's
  // only the ones a teacher has filled in so far.
  const wordsForLang = useMemo(
    () => set ? set.words.filter(w => (w[translationLang] || '').trim()) : [],
    [set, translationLang]
  );

  const quizQuestions = useMemo(() => {
    if (wordsForLang.length < 2) return [];
    return shuffled(wordsForLang).map(word => {
      const correct = word[translationLang].trim();
      const distractorPool = [...new Set(
        wordsForLang.filter(w => w.id !== word.id && w[translationLang].trim() !== correct)
          .map(w => w[translationLang].trim())
      )];
      const distractors = shuffled(distractorPool).slice(0, 3);
      const options = shuffled([correct, ...distractors]);
      return { word, correct, options };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordsForLang, translationLang, quizAttempt]);

  if (!set) return null;

  const stageIndex = STAGES.indexOf(stage);
  const texts = [
    set.text1_body ? { title: set.text1_title || 'Text 1', body: set.text1_body } : null,
    set.text2_body ? { title: set.text2_title || 'Text 2', body: set.text2_body } : null
  ].filter(Boolean);

  function goToStage(next) {
    setStage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---- Flashcards ----
  function markCard(status) {
    const word = set.words[cardIndex];
    setStillLearning(s => ({ ...s, [word.id]: status === 'learning' }));
    if (cardIndex < set.words.length - 1) {
      setCardIndex(i => i + 1);
      setCardFlipped(false);
    }
  }
  function stepCard(delta) {
    setCardIndex(i => Math.max(0, Math.min(set.words.length - 1, i + delta)));
    setCardFlipped(false);
  }

  // ---- Recall ----
  function checkRecall() {
    const word = wordsForLang[recallIndex];
    const correct = isCorrect(recallInput, word.english);
    setRecallResults(r => ({ ...r, [word.id]: correct }));
    if (!correct) setStillLearning(s => ({ ...s, [word.id]: true }));
  }
  function nextRecall() {
    if (recallIndex < wordsForLang.length - 1) {
      setRecallIndex(i => i + 1);
      setRecallInput('');
    } else {
      setRecallDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
  function retryRecall() {
    setRecallIndex(0); setRecallInput(''); setRecallResults({}); setRecallDone(false);
  }

  // ---- Quiz ----
  function answerQuiz(option) {
    const q = quizQuestions[quizIndex];
    if (quizAnswers[q.word.id] !== undefined) return;
    setQuizAnswers(a => ({ ...a, [q.word.id]: option }));
    if (option !== q.correct) setStillLearning(s => ({ ...s, [q.word.id]: true }));
  }
  function nextQuiz() {
    if (quizIndex < quizQuestions.length - 1) {
      setQuizIndex(i => i + 1);
    } else {
      setQuizDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
  function retryQuiz() {
    setQuizIndex(0); setQuizAnswers({}); setQuizDone(false); setQuizAttempt(a => a + 1);
  }

  const weakWords = set.words.filter(w => stillLearning[w.id]);
  const recallCorrectCount = Object.values(recallResults).filter(Boolean).length;
  const quizCorrectCount = quizQuestions.filter(q => quizAnswers[q.word.id] === q.correct).length;

  const studyBody = (
    <>
      {!focusMode && (
        <div className="lessons-hero">
          <span className="lessons-hero-eyebrow">🗂️ {set.category_name}</span>
          <div className="welcome-title">{set.name}</div>
          <div className="welcome-sub">Study however you like — flashcards, reading, typed recall, or a quiz — in any order you want.</div>
        </div>
      )}

      <div className="vocab-lang-toggle">
        <button type="button" className={`vocab-lang-btn${translationLang === 'russian' ? ' active' : ''}`} onClick={() => setTranslationLang('russian')}>Russian</button>
        <button type="button" className={`vocab-lang-btn${translationLang === 'uzbek' ? ' active' : ''}`} onClick={() => setTranslationLang('uzbek')}>Uzbek</button>
      </div>

      <div className="vocab-stepper">
        {STAGES.map((s, i) => (
          <button
            type="button"
            key={s}
            className={`vocab-step${stage === s ? ' active' : ''}${i < stageIndex ? ' done' : ''}`}
            onClick={() => goToStage(s)}
          >
            <span className={`vocab-step-icon icon-${s}`}>{STAGE_ICON[s]}</span>
            {STAGE_LABEL[s]}
          </button>
        ))}
      </div>

      {/* ---- STAGE: Flashcards, one at a time ---- */}
      {stage === 'flashcards' && (
        <div>
          {set.words.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No words added to this set yet — ask your teacher.</div>
          ) : (
            <div className="vocab-single-wrap">
              <div className="vocab-progress-row">
                <span>{cardIndex + 1} / {set.words.length}</span>
                <div className="vocab-progress-bar"><div className="vocab-progress-fill" style={{ width: `${((cardIndex + 1) / set.words.length) * 100}%` }} /></div>
                <span className="vocab-weak-pill">✕ Weak: {Object.values(stillLearning).filter(Boolean).length}</span>
              </div>

              <div className="vocab-flashcard-stage">
                <VocabFlashcard
                  english={set.words[cardIndex].english}
                  translation={set.words[cardIndex][translationLang] || null}
                  translationLabel={LANG_LABEL[translationLang]}
                  flipped={cardFlipped}
                  onFlip={() => setCardFlipped(f => !f)}
                />
              </div>

              <div className="vocab-nav-row">
                <button className="btn secondary" disabled={cardIndex === 0} onClick={() => stepCard(-1)}>← Prev</button>
                <button className="btn danger" onClick={() => markCard('learning')}>✕ Still learning</button>
                <button className="btn ok" onClick={() => markCard('known')}>✓ Know it</button>
                <button className="btn secondary" disabled={cardIndex === set.words.length - 1} onClick={() => stepCard(1)}>Next →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- STAGE: Reading, one text at a time ---- */}
      {stage === 'texts' && (
        <div>
          {texts.length === 0 && <div style={{ color: 'var(--text-muted)', marginBottom: 16 }}>No reading texts added for this set yet.</div>}

          {texts.length > 0 && (
            <div className="vocab-single-wrap vocab-reading-wrap">
              {texts.length > 1 && (
                <div className="vocab-progress-row">
                  <span>Text {textIndex + 1} / {texts.length}</span>
                  <div className="vocab-progress-bar"><div className="vocab-progress-fill" style={{ width: `${((textIndex + 1) / texts.length) * 100}%` }} /></div>
                </div>
              )}
              <div className="vocab-text-card">
                <div className="vocab-text-title">{texts[textIndex].title}</div>
                <div className="vocab-text-body">{renderTextBody(texts[textIndex].body, highlighter)}</div>
              </div>
              {texts.length > 1 && (
                <div className="vocab-nav-row">
                  <button className="btn secondary" disabled={textIndex === 0} onClick={() => setTextIndex(i => i - 1)}>← Previous text</button>
                  <button className="btn secondary" disabled={textIndex === texts.length - 1} onClick={() => setTextIndex(i => i + 1)}>Next text →</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---- STAGE: Recall, one at a time ---- */}
      {stage === 'recall' && (
        <div>
          {wordsForLang.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>
              No {LANG_LABEL[translationLang]} translations yet for this set — ask your teacher, or switch languages above.
            </div>
          ) : !recallDone ? (
            <div className="vocab-single-wrap">
              <div className="vocab-progress-row">
                <span>{recallIndex + 1} / {wordsForLang.length}</span>
                <div className="vocab-progress-bar"><div className="vocab-progress-fill" style={{ width: `${((recallIndex + 1) / wordsForLang.length) * 100}%` }} /></div>
              </div>

              <div className="vocab-recall-single">
                <div className="vocab-recall-single-tag">{LANG_LABEL[translationLang]}</div>
                <div className="vocab-recall-single-word">{wordsForLang[recallIndex][translationLang]}</div>
                <div className="vocab-recall-single-hint">Type the English word</div>
                <input
                  className="input vocab-recall-single-input"
                  autoFocus
                  value={recallInput}
                  disabled={recallResults[wordsForLang[recallIndex].id] !== undefined}
                  onChange={e => setRecallInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key !== 'Enter') return;
                    if (recallResults[wordsForLang[recallIndex].id] === undefined) checkRecall();
                    else nextRecall();
                  }}
                  placeholder="Type in English…"
                />
                {recallResults[wordsForLang[recallIndex].id] !== undefined && (
                  <div className={`vocab-recall-feedback ${recallResults[wordsForLang[recallIndex].id] ? 'correct' : 'incorrect'}`}>
                    {recallResults[wordsForLang[recallIndex].id] ? '✓ Correct!' : `✕ Correct answer: ${wordsForLang[recallIndex].english}`}
                  </div>
                )}
                <div className="vocab-nav-row">
                  {recallResults[wordsForLang[recallIndex].id] === undefined
                    ? <button className="btn" onClick={checkRecall}>Check</button>
                    : <button className="btn" onClick={nextRecall}>{recallIndex === wordsForLang.length - 1 ? 'Finish' : 'Next word →'}</button>}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="vocab-score-banner">Score: {recallCorrectCount} / {wordsForLang.length}</div>
              <div className="vocab-stage-actions">
                <button className="btn secondary" onClick={retryRecall}>Try recall again</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- STAGE: Quiz — multiple choice, built from every word ---- */}
      {stage === 'quiz' && (
        <div>
          {quizQuestions.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>
              Not enough {LANG_LABEL[translationLang]} translations yet to build a quiz — ask your teacher, or switch languages above.
            </div>
          ) : !quizDone ? (
            <div className="vocab-single-wrap">
              <div className="vocab-progress-row">
                <span>{quizIndex + 1} / {quizQuestions.length}</span>
                <div className="vocab-progress-bar"><div className="vocab-progress-fill" style={{ width: `${((quizIndex + 1) / quizQuestions.length) * 100}%` }} /></div>
              </div>

              <div className="vocab-recall-single">
                <div className="vocab-recall-single-tag">English</div>
                <div className="vocab-recall-single-word">{quizQuestions[quizIndex].word.english}</div>
                <div className="vocab-recall-single-hint">Choose the correct {LANG_LABEL[translationLang]} translation</div>

                <div className="vocab-quiz-options">
                  {quizQuestions[quizIndex].options.map((opt, i) => {
                    const answered = quizAnswers[quizQuestions[quizIndex].word.id];
                    const isChosen = answered === opt;
                    const isRight = opt === quizQuestions[quizIndex].correct;
                    let cls = 'vocab-quiz-option';
                    if (answered !== undefined) {
                      cls += ' disabled';
                      if (isRight) cls += ' correct';
                      else if (isChosen) cls += ' incorrect';
                    }
                    return (
                      <button type="button" key={i} className={cls} disabled={answered !== undefined} onClick={() => answerQuiz(opt)}>
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {quizAnswers[quizQuestions[quizIndex].word.id] !== undefined && (
                  <div className="vocab-nav-row">
                    <button className="btn" onClick={nextQuiz}>{quizIndex === quizQuestions.length - 1 ? 'Finish' : 'Next question →'}</button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="vocab-score-banner">Score: {quizCorrectCount} / {quizQuestions.length}</div>
              <div className="vocab-stage-actions">
                <button className="btn secondary" onClick={retryQuiz}>Try quiz again</button>
              </div>
            </div>
          )}
        </div>
      )}

      {weakWords.length > 0 && (stage === 'recall' || stage === 'quiz') && (recallDone || quizDone) && (
        <div className="vocab-weak-box" style={{ marginTop: 18 }}>
          <div className="vocab-weak-box-title">📌 Words to review ({weakWords.length})</div>
          <table className="simple-table">
            <thead><tr><th>English</th><th>{LANG_LABEL[translationLang]}</th></tr></thead>
            <tbody>
              {weakWords.map(w => <tr key={w.id}><td>{w.english}</td><td>{w[translationLang] || '—'}</td></tr>)}
            </tbody>
          </table>
          <button className="btn secondary" style={{ marginTop: 12 }} onClick={() => downloadWeakWordsPdf(set.name, weakWords)}>
            ⬇ Download weak words (PDF)
          </button>
        </div>
      )}

      <div className="vocab-stage-actions">
        <button className="btn" onClick={() => navigate(`/vocabulary/${set.category_id}`)}>Done — back to sets</button>
      </div>
    </>
  );

  if (focusMode) {
    return (
      <div className="vocab-focus-overlay">
        <div className="vocab-focus-topbar">
          <div className="vocab-focus-brand">
            <span className="vocab-focus-brand-badge">🗂️</span>
            {set.name}
          </div>
          <button className="btn vocab-focus-exit" onClick={() => setFocusMode(false)}>✕ Exit focus mode</button>
        </div>
        <div className="vocab-focus-panel">{studyBody}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="topbar-row">
        <button className="btn secondary" onClick={() => navigate(`/vocabulary/${set.category_id}`)}>← Back to {set.category_name}</button>
        <button className="btn secondary" onClick={() => setFocusMode(true)}>⛶ Focus mode</button>
      </div>

      {studyBody}
    </div>
  );
}
