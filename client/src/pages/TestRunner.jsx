import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';

// ---- Bridge scripts injected into the same-origin iframe after it loads ----
// These do NOT modify the uploaded test file; they monkey-patch the global
// functions the test file already defines, then postMessage the results
// back to this parent page. Nothing needs to change in the teacher's files.

function readingListeningBridgeScript() {
  return `
(function(){
  function collect(){
    var total=0, correct=0, answered=0, breakdown=[];
    var parts = Object.keys(window.PART_QS || {});
    parts.forEach(function(p){
      window.PART_QS[p].forEach(function(n){
        var ans = window.getUserAnswer(n);
        var hasAns = ans !== null && ans !== '';
        var ok = window.isCorrect(n, ans);
        if (hasAns) answered++;
        if (ok) correct++;
        total++;
        breakdown.push({part:p, q:n, answer:ans, correctAnswer: window.ANSWERS['q'+n], correct: ok});
      });
    });
    var band = null;
    if (typeof window.estimateBand === 'function') {
      var b = parseFloat(window.estimateBand(correct, total));
      band = isNaN(b) ? null : b;
    }
    return { score_raw: correct, score_total: total, band_estimate: band, detail: { answered: answered, breakdown: breakdown } };
  }
  if (typeof window.checkAnswers === 'function' && !window.__ieltsBridged) {
    window.__ieltsBridged = true;
    var original = window.checkAnswers;
    window.checkAnswers = function(){
      var r = original.apply(this, arguments);
      var result = collect();
      window.parent.postMessage({ source: 'ielts-bridge', kind: 'result', result: result }, '*');
      return r;
    };
  }
})();
`;
}

function writingBridgeScript() {
  return `
(function(){
  if (typeof window.displayResults === 'function' && !window.__ieltsBridged) {
    window.__ieltsBridged = true;
    var original = window.displayResults;
    window.displayResults = function(scores1, scores2, overallBand){
      var r = original.apply(this, arguments);
      var detail = {
        part1: { text: (window.partData && window.partData[1] && window.partData[1].content) || '', wordCount: window.partData ? window.partData[1].wordCount : 0, scores: scores1 },
        part2: { text: (window.partData && window.partData[2] && window.partData[2].content) || '', wordCount: window.partData ? window.partData[2].wordCount : 0, scores: scores2 }
      };
      window.parent.postMessage({ source: 'ielts-bridge', kind: 'result', result: { band_estimate: overallBand, detail: detail } }, '*');
      return r;
    };
  }
})();
`;
}

// For "Analyze" review of reading/listening: repopulate the student's saved
// answers into the DOM, then trigger the file's own checkAnswers(), which
// reveals its built-in evidence highlighting for us — for free.
function reviewReplayScript(prevAnswersJson) {
  return `
(function(prev){
  function setAnswer(q, val){
    if (val === null || val === undefined) return;
    var inp = document.getElementById('q'+q);
    if (inp && inp.tagName === 'INPUT') { inp.value = val; return; }
    var radios = document.querySelectorAll('input[name="q'+q+'"]');
    if (radios.length) { radios.forEach(function(r){ r.checked = (r.value === val); }); return; }
    var slot = document.getElementById('slot'+q);
    if (slot) {
      slot.textContent = val;
      slot.classList.add('filled');
      slot.dataset.usedChip = val;
      window.userAnswers = window.userAnswers || {};
      window.userAnswers['q'+q] = val;
    }
  }
  Object.keys(prev).forEach(function(q){ setAnswer(q, prev[q]); });
  if (typeof window.updateAllCounts === 'function') window.updateAllCounts();
  if (typeof window.refreshQNav === 'function') window.refreshQNav();
  setTimeout(function(){ if (typeof window.checkAnswers === 'function') window.checkAnswers(); }, 50);
})(${prevAnswersJson});
`;
}

export default function TestRunner({ reviewMode = false }) {
  const { type, testId, attemptId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mockId = searchParams.get('mock');
  const iframeRef = useRef(null);
  const [meta, setMeta] = useState(null);
  const [reviewAttempt, setReviewAttempt] = useState(null);
  const [result, setResult] = useState(null);
  const [savedAttemptId, setSavedAttemptId] = useState(null);
  const startedAt = useRef(new Date().toISOString());

  useEffect(() => {
    api.testMeta(testId).then(setMeta);
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => { document.fullscreenElement && document.exitFullscreen?.(); };
  }, [testId]);

  useEffect(() => {
    if (reviewMode && attemptId) {
      api.getAttempt(attemptId).then(setReviewAttempt);
    }
  }, [reviewMode, attemptId]);

  useEffect(() => {
    function handleMessage(e) {
      if (!e.data || e.data.source !== 'ielts-bridge' || e.data.kind !== 'result') return;
      if (reviewMode) return; // already-graded attempt, don't resave
      const r = e.data.result;
      setResult(r);
      api.submitAttempt({
        test_id: Number(testId),
        test_type: type,
        score_raw: r.score_raw,
        score_total: r.score_total,
        band_estimate: r.band_estimate,
        detail: r.detail,
        started_at: startedAt.current,
        mock_id: mockId ? Number(mockId) : null
      }).then(saved => setSavedAttemptId(saved.id));
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [type, testId, reviewMode, mockId]);

  function handleIframeLoad() {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      const script = win.document.createElement('script');
      if (type === 'writing') {
        script.textContent = writingBridgeScript();
      } else {
        script.textContent = readingListeningBridgeScript();
      }
      win.document.body.appendChild(script);

      if (reviewMode && reviewAttempt && type !== 'writing') {
        const answersMap = {};
        (reviewAttempt.detail_json ? JSON.parse(reviewAttempt.detail_json) : {}).breakdown?.forEach(row => {
          answersMap[row.q] = row.answer;
        });
        const replay = win.document.createElement('script');
        replay.textContent = reviewReplayScript(JSON.stringify(answersMap));
        win.document.body.appendChild(replay);
      }
    } catch (err) {
      console.error('Could not inject bridge script', err);
    }
  }

  function exitToPractice() {
    document.fullscreenElement && document.exitFullscreen?.();
    navigate(mockId ? '/mock' : '/practice');
  }

  function goAnalyze() {
    const id = savedAttemptId;
    setResult(null);
    if (id) navigate(`/practice/${type}/${testId}/review/${id}`, { replace: true });
  }

  // Writing review is shown as a simple summary card, not by re-running the iframe,
  // since writing needs the teacher's human band score + feedback, not DOM replay.
  if (reviewMode && type === 'writing') {
    return <WritingReview attempt={reviewAttempt} onExit={exitToPractice} />;
  }

  return (
    <div className="fullscreen-runner">
      <div className="runner-topbar">
        <div style={{ fontWeight: 700 }}>{meta?.title || 'Loading test…'}</div>
        <button className="btn secondary" onClick={exitToPractice}>Exit</button>
      </div>
      {meta && (
        <iframe
          ref={iframeRef}
          title="test"
          src={`/api/tests/${testId}/file`}
          onLoad={handleIframeLoad}
        />
      )}

      {result && !reviewMode && (
        <div className="results-overlay">
          <div className="results-modal">
            <h2>Test complete</h2>
            {result.score_total != null ? (
              <p>Score: <strong>{result.score_raw}/{result.score_total}</strong> · Estimated band: <strong>{result.band_estimate ?? '—'}</strong></p>
            ) : (
              <p>Estimated band: <strong>{result.band_estimate ?? '—'}</strong> (your teacher will confirm the final band and leave feedback)</p>
            )}
            <div className="actions">
              <button className="btn" onClick={goAnalyze} disabled={!savedAttemptId}>Analyze</button>
              <button className="btn secondary" onClick={exitToPractice}>Exit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WritingReview({ attempt, onExit }) {
  if (!attempt) return null;
  const detail = attempt.detail_json ? JSON.parse(attempt.detail_json) : {};
  return (
    <div className="main-content" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="topbar-row">
        <div className="welcome-title">Writing review</div>
        <button className="btn secondary" onClick={onExit}>Exit</button>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Scores</h3>
        <p>Auto-estimated band: <strong>{attempt.band_estimate ?? '—'}</strong></p>
        <p>Teacher's final band: <strong>{attempt.band_final ?? 'Awaiting review'}</strong></p>
      </div>
      {['part1', 'part2'].map(p => detail[p] && (
        <div className="card" key={p} style={{ marginBottom: 16 }}>
          <h3>{p === 'part1' ? 'Task 1' : 'Task 2'} ({detail[p].wordCount} words)</h3>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{detail[p].text}</p>
        </div>
      ))}
    </div>
  );
}
