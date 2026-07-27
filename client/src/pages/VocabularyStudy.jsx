import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import VocabFlashcard from '../components/VocabFlashcard';
import { downloadWeakWordsPdf } from '../utils/vocabPdf';

const STAGES = ['flashcards', 'texts', 'recall'];
const STAGE_LABEL = { flashcards: '1. Flashcards', texts: '2. Reading', recall: '3. Recall' };

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

export default function VocabularyStudy() {
  const { setId } = useParams();
  const navigate = useNavigate();
  const [set, setSet] = useState(null);
  const [stage, setStage] = useState('flashcards');

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

  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    if (!focusMode) return;
    function onKeyDown(e) { if (e.key === 'Escape') setFocusMode(false); }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusMode]);

  useEffect(() => {
    setSet(null); setStage('flashcards');
    setCardIndex(0); setCardFlipped(false); setStillLearning({});
    setTextIndex(0);
    setRecallIndex(0); setRecallInput(''); setRecallResults({}); setRecallDone(false);
    api.getVocabSet(setId).then(setSet);
  }, [setId]);

  const highlighter = useMemo(() => set ? buildHighlighter(set.words.map(w => w.english)) : null, [set]);

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
    } else {
      goToStage('texts');
    }
  }
  function stepCard(delta) {
    setCardIndex(i => Math.max(0, Math.min(set.words.length - 1, i + delta)));
    setCardFlipped(false);
  }

  // ---- Recall ----
  function checkRecall() {
    const word = set.words[recallIndex];
    const correct = isCorrect(recallInput, word.english);
    setRecallResults(r => ({ ...r, [word.id]: correct }));
    if (!correct) setStillLearning(s => ({ ...s, [word.id]: true }));
  }
  function nextRecall() {
    if (recallIndex < set.words.length - 1) {
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

  const weakWords = set.words.filter(w => stillLearning[w.id]);
  const recallCorrectCount = Object.values(recallResults).filter(Boolean).length;

  const studyBody = (
    <>
      {!focusMode && (
        <div className="lessons-hero">
          <span className="lessons-hero-eyebrow">🗂️ {set.category_name}</span>
          <div className="welcome-title">{set.name}</div>
          <div className="welcome-sub">Flip the flashcards, read the two texts, then type the translations from memory.</div>
        </div>
      )}

      <div className="vocab-stepper">
        {STAGES.map((s, i) => (
          <div key={s} className={`vocab-step${stage === s ? ' active' : ''}${i < stageIndex ? ' done' : ''}`}>
            {STAGE_LABEL[s]}
          </div>
        ))}
      </div>

      {/* ---- STAGE 1: Flashcards, one at a time ---- */}
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
                  russian={set.words[cardIndex].russian}
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
          <div className="vocab-stage-actions">
            <button className="btn" onClick={() => goToStage('texts')}>Skip to reading →</button>
          </div>
        </div>
      )}

      {/* ---- STAGE 2: Reading, one text at a time ---- */}
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

          <div className="vocab-stage-actions">
            <button className="btn secondary" onClick={() => goToStage('flashcards')}>← Back to flashcards</button>
            <button className="btn" onClick={() => goToStage('recall')}>Continue to recall →</button>
          </div>
        </div>
      )}

      {/* ---- STAGE 3: Recall, one at a time ---- */}
      {stage === 'recall' && (
        <div>
          {set.words.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No words to recall yet.</div>
          ) : !recallDone ? (
            <div className="vocab-single-wrap">
              <div className="vocab-progress-row">
                <span>{recallIndex + 1} / {set.words.length}</span>
                <div className="vocab-progress-bar"><div className="vocab-progress-fill" style={{ width: `${((recallIndex + 1) / set.words.length) * 100}%` }} /></div>
              </div>

              <div className="vocab-recall-single">
                <div className="vocab-recall-single-tag">RU</div>
                <div className="vocab-recall-single-word">{set.words[recallIndex].russian}</div>
                <div className="vocab-recall-single-hint">Type the English word</div>
                <input
                  className="input vocab-recall-single-input"
                  autoFocus
                  value={recallInput}
                  disabled={recallResults[set.words[recallIndex].id] !== undefined}
                  onChange={e => setRecallInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key !== 'Enter') return;
                    if (recallResults[set.words[recallIndex].id] === undefined) checkRecall();
                    else nextRecall();
                  }}
                  placeholder="Type in English…"
                />
                {recallResults[set.words[recallIndex].id] !== undefined && (
                  <div className={`vocab-recall-feedback ${recallResults[set.words[recallIndex].id] ? 'correct' : 'incorrect'}`}>
                    {recallResults[set.words[recallIndex].id] ? '✓ Correct!' : `✕ Correct answer: ${set.words[recallIndex].english}`}
                  </div>
                )}
                <div className="vocab-nav-row">
                  {recallResults[set.words[recallIndex].id] === undefined
                    ? <button className="btn" onClick={checkRecall}>Check</button>
                    : <button className="btn" onClick={nextRecall}>{recallIndex === set.words.length - 1 ? 'Finish' : 'Next word →'}</button>}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="vocab-score-banner">Score: {recallCorrectCount} / {set.words.length}</div>

              {weakWords.length > 0 && (
                <div className="vocab-weak-box">
                  <div className="vocab-weak-box-title">📌 Words to review ({weakWords.length})</div>
                  <table className="simple-table">
                    <thead><tr><th>English</th><th>Russian</th></tr></thead>
                    <tbody>
                      {weakWords.map(w => <tr key={w.id}><td>{w.english}</td><td>{w.russian}</td></tr>)}
                    </tbody>
                  </table>
                  <button className="btn secondary" style={{ marginTop: 12 }} onClick={() => downloadWeakWordsPdf(set.name, weakWords)}>
                    ⬇ Download weak words (PDF)
                  </button>
                </div>
              )}

              <div className="vocab-stage-actions">
                <button className="btn secondary" onClick={retryRecall}>Try recall again</button>
                <button className="btn" onClick={() => navigate(`/vocabulary/${set.category_id}`)}>Done — back to sets</button>
              </div>
            </div>
          )}

          {!recallDone && (
            <div className="vocab-stage-actions">
              <button className="btn secondary" onClick={() => goToStage('texts')}>← Back to reading</button>
            </div>
          )}
        </div>
      )}
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
