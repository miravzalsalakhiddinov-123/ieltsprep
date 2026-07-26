import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import VocabFlashcard from '../components/VocabFlashcard';

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
  const [flipped, setFlipped] = useState({});
  const [answers, setAnswers] = useState({});
  const [graded, setGraded] = useState(null); // null = not submitted yet, else { [wordId]: bool }

  useEffect(() => {
    setSet(null); setStage('flashcards'); setFlipped({}); setAnswers({}); setGraded(null);
    api.getVocabSet(setId).then(setSet);
  }, [setId]);

  const highlighter = useMemo(() => set ? buildHighlighter(set.words.map(w => w.english)) : null, [set]);

  if (!set) return null;

  const stageIndex = STAGES.indexOf(stage);
  const hasAnyText = set.text1_body || set.text2_body;

  function goToStage(next) {
    setStage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function submitRecall() {
    const results = {};
    set.words.forEach(w => { results[w.id] = isCorrect(answers[w.id] || '', w.english); });
    setGraded(results);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function retryRecall() {
    setAnswers({});
    setGraded(null);
  }

  const correctCount = graded ? Object.values(graded).filter(Boolean).length : 0;

  return (
    <div>
      <div className="topbar-row">
        <button className="btn secondary" onClick={() => navigate(`/vocabulary/${set.category_id}`)}>← Back to {set.category_name}</button>
      </div>

      <div className="lessons-hero">
        <span className="lessons-hero-eyebrow">🗂️ {set.category_name}</span>
        <div className="welcome-title">{set.name}</div>
        <div className="welcome-sub">Flip the flashcards, read the two texts, then type the translations from memory.</div>
      </div>

      <div className="vocab-stepper">
        {STAGES.map((s, i) => (
          <div key={s} className={`vocab-step${stage === s ? ' active' : ''}${i < stageIndex ? ' done' : ''}`}>
            {STAGE_LABEL[s]}
          </div>
        ))}
      </div>

      {stage === 'flashcards' && (
        <div>
          {set.words.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No words added to this set yet — ask your teacher.</div>
          ) : (
            <div className="vocab-flashcard-grid">
              {set.words.map(w => (
                <VocabFlashcard
                  key={w.id}
                  english={w.english}
                  russian={w.russian}
                  flipped={!!flipped[w.id]}
                  onFlip={() => setFlipped(f => ({ ...f, [w.id]: !f[w.id] }))}
                />
              ))}
            </div>
          )}
          <div className="vocab-stage-actions">
            <button className="btn" onClick={() => goToStage('texts')}>Continue to reading →</button>
          </div>
        </div>
      )}

      {stage === 'texts' && (
        <div>
          {!hasAnyText && <div style={{ color: 'var(--text-muted)', marginBottom: 16 }}>No reading texts added for this set yet.</div>}
          {set.text1_body && (
            <div className="vocab-text-card">
              <div className="vocab-text-title">{set.text1_title || 'Text 1'}</div>
              <div className="vocab-text-body">{renderTextBody(set.text1_body, highlighter)}</div>
            </div>
          )}
          {set.text2_body && (
            <div className="vocab-text-card">
              <div className="vocab-text-title">{set.text2_title || 'Text 2'}</div>
              <div className="vocab-text-body">{renderTextBody(set.text2_body, highlighter)}</div>
            </div>
          )}
          <div className="vocab-stage-actions">
            <button className="btn secondary" onClick={() => goToStage('flashcards')}>← Back to flashcards</button>
            <button className="btn" onClick={() => goToStage('recall')}>Continue to recall →</button>
          </div>
        </div>
      )}

      {stage === 'recall' && (
        <div>
          <div className="vocab-recall-intro">Type the English word for each Russian translation below.</div>

          {graded && (
            <div className="vocab-score-banner">
              Score: {correctCount} / {set.words.length}
            </div>
          )}

          {set.words.map(w => {
            const status = graded ? (graded[w.id] ? 'correct' : 'incorrect') : '';
            return (
              <div className={`vocab-recall-row${status ? ' ' + status : ''}`} key={w.id}>
                <div className="vocab-recall-word">{w.russian}</div>
                <input
                  className="input"
                  placeholder="Type in English…"
                  value={answers[w.id] || ''}
                  disabled={!!graded}
                  onChange={e => setAnswers(a => ({ ...a, [w.id]: e.target.value }))}
                />
                {graded && !graded[w.id] && <div className="vocab-recall-answer">Correct: {w.english}</div>}
                {graded && graded[w.id] && <div className="vocab-recall-answer">✓</div>}
              </div>
            );
          })}

          <div className="vocab-stage-actions">
            <button className="btn secondary" onClick={() => goToStage('texts')}>← Back to reading</button>
            {!graded && <button className="btn" onClick={submitRecall}>Check answers</button>}
            {graded && <button className="btn secondary" onClick={retryRecall}>Try again</button>}
            {graded && <button className="btn" onClick={() => navigate(`/vocabulary/${set.category_id}`)}>Done — back to sets</button>}
          </div>
        </div>
      )}
    </div>
  );
}
