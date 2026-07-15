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
  // Test files may declare PART_QS / ANSWERS with 'const' or 'let' at the top
  // level. Those do NOT attach to window (only 'var' and function declarations
  // do) — but since this script is injected as a real <script> tag into the
  // SAME document, it shares the page's top-level lexical scope, so the bare
  // identifiers ARE reachable directly. We try bare-identifier access first
  // and fall back to window.X for older files that used 'var'.
  function readGlobal(name) {
    try {
      // eslint-disable-next-line no-eval
      var v = eval('typeof ' + name + " !== 'undefined' ? " + name + ' : undefined');
      if (v !== undefined) return v;
    } catch (e) {}
    return window[name];
  }
  function collect(){
    var total=0, correct=0, answered=0, breakdown=[];
    var partQs = readGlobal('PART_QS') || {};
    var answerKey = readGlobal('ANSWERS') || {};
    var parts = Object.keys(partQs);
    parts.forEach(function(p){
      partQs[p].forEach(function(n){
        var ans = window.getUserAnswer(n);
        var hasAns = ans !== null && ans !== '';
        var ok = window.isCorrect(n, ans);
        if (hasAns) answered++;
        if (ok) correct++;
        total++;
        breakdown.push({part:p, q:n, answer:ans, correctAnswer: answerKey['q'+n], correct: ok});
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
  function readGlobal(name) {
    try {
      var v = eval('typeof ' + name + " !== 'undefined' ? " + name + ' : undefined');
      if (v !== undefined) return v;
    } catch (e) {}
    return window[name];
  }
  if (typeof window.displayResults === 'function' && !window.__ieltsBridged) {
    window.__ieltsBridged = true;
    var original = window.displayResults;
    window.displayResults = function(scores1, scores2, overallBand){
      var r = original.apply(this, arguments);
      var partData = readGlobal('partData');
      var detail = {
        part1: { text: (partData && partData[1] && partData[1].content) || '', wordCount: partData && partData[1] ? partData[1].wordCount : 0, scores: scores1 },
        part2: { text: (partData && partData[2] && partData[2].content) || '', wordCount: partData && partData[2] ? partData[2].wordCount : 0, scores: scores2 }
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
    }
  }
  Object.keys(prev).forEach(function(q){ setAnswer(q, prev[q]); });
  if (typeof window.updateAllCounts === 'function') window.updateAllCounts();
  if (typeof window.refreshQNav === 'function') window.refreshQNav();
  setTimeout(function(){ if (typeof window.checkAnswers === 'function') window.checkAnswers(); }, 50);
})(${prevAnswersJson});
`;
}

// ---- Mock-sequence queue helpers ----
// When a student starts a "Full Mock" from Mock Center, we stash the ordered
// list of {id, type, title} sections in sessionStorage. Each time a section
// is submitted, we pop it off the queue and jump straight to the next one —
// no results shown in between, since the whole point of a mock is that the
// student finds out their score at the very end.
function queueKey(mockId) { return `mockQueue_${mockId}`; }
function readQueue(mockId) {
  try { return JSON.parse(sessionStorage.getItem(queueKey(mockId)) || 'null'); } catch { return null; }
}
function writeQueue(mockId, queue) {
  try { sessionStorage.setItem(queueKey(mockId), JSON.stringify(queue)); } catch {}
}
function clearQueue(mockId) {
  try { sessionStorage.removeItem(queueKey(mockId)); } catch {}
}

// ---- Google Drive audio link support ----
// A Drive "share" link (e.g. https://drive.google.com/file/d/FILE_ID/view)
// isn't a playable media URL — the file bytes live behind Drive's UI, not a
// direct stream. Drive's own /preview embed *does* know how to stream it
// (including permission checks), so for Drive links we embed that instead of
// using a plain <audio> tag. Any other hosting (S3, direct .mp3 link, etc.)
// keeps working exactly as before via a normal <audio> element.
function extractDriveFileId(url) {
  if (!url) return null;
  let m = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
  if (m) return m[1];
  m = url.match(/[?&]id=([^&#]+)/);
  if (m) return m[1];
  return null;
}
function isGoogleDriveUrl(url) {
  return !!url && /drive\.google\.com|docs\.google\.com/.test(url);
}

export default function TestRunner({ reviewMode = false }) {
  const { type, testId, attemptId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mockId = searchParams.get('mock');
  const seq = searchParams.get('seq') === '1'; // part of an auto-advancing full-mock run
  const iframeRef = useRef(null);
  const [meta, setMeta] = useState(null);
  const [reviewAttempt, setReviewAttempt] = useState(null);
  const [result, setResult] = useState(null);
  const [savedAttemptId, setSavedAttemptId] = useState(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const injectedRef = useRef(false);
  const startedAt = useRef(new Date().toISOString());

  // Fullscreen is requested once, when the runner first mounts — not on every
  // section change. Re-requesting fullscreen on each auto-advance inside a
  // mock (no fresh user click/gesture) can be silently rejected by the
  // browser, so we only exit it when the runner truly unmounts. A manual
  // toggle button below lets the student re-enter fullscreen any time
  // (e.g. if the browser blocked the automatic request, or they backed out).
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => { document.fullscreenElement && document.exitFullscreen?.(); };
  }, []);

  useEffect(() => {
    function onFsChange() { setIsFullscreen(!!document.fullscreenElement); }
    document.addEventListener('fullscreenchange', onFsChange);
    onFsChange();
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }

  // Per-section state resets whenever we move to a new test (either the
  // student navigated manually, or a mock auto-advanced to the next section).
  useEffect(() => {
    api.testMeta(testId).then(setMeta);
    setResult(null);
    setSavedAttemptId(null);
    setReviewAttempt(null);
    setIframeReady(false);
    injectedRef.current = false;
    startedAt.current = new Date().toISOString();
  }, [testId]);

  useEffect(() => {
    if (reviewMode && attemptId) {
      api.getAttempt(attemptId).then(setReviewAttempt).catch(err => console.error('Could not load attempt', err));
    }
  }, [reviewMode, attemptId]);

  function advanceMockSequence() {
    // The stored queue's head is always the section just submitted.
    const queue = readQueue(mockId) || [];
    const rest = queue.slice(1);
    if (rest.length > 0) {
      writeQueue(mockId, rest);
      navigate(`/practice/${rest[0].type}/${rest[0].id}?mock=${mockId}&seq=1`, { replace: true });
    } else {
      clearQueue(mockId);
      navigate(`/mock/results/${mockId}`, { replace: true });
    }
  }

  useEffect(() => {
    function handleMessage(e) {
      if (!e.data || e.data.source !== 'ielts-bridge' || e.data.kind !== 'result') return;
      if (reviewMode) return; // already-graded attempt, don't resave
      const r = e.data.result;
      api.submitAttempt({
        test_id: Number(testId),
        test_type: type,
        score_raw: r.score_raw,
        score_total: r.score_total,
        band_estimate: r.band_estimate,
        detail: r.detail,
        started_at: startedAt.current,
        mock_id: mockId ? Number(mockId) : null
      }).then(saved => {
        if (seq && mockId) {
          // Full-mock run: never show this section's result — go straight
          // to the next section (or the final combined results page).
          advanceMockSequence();
        } else {
          setResult(r);
          setSavedAttemptId(saved.id);
        }
      });
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [type, testId, reviewMode, mockId, seq]);

  function handleIframeLoad() {
    injectedRef.current = false;
    setIframeReady(true);
  }

  // Injection is driven by an effect (not solely the iframe's onLoad) so it
  // reliably fires once BOTH the iframe has loaded AND (in review mode) the
  // saved attempt has been fetched — whichever finishes last. Previously this
  // only ran from onLoad, so if the attempt fetch was still in flight when
  // the iframe finished loading, the answer-replay silently never happened.
  useEffect(() => {
    if (!iframeReady || injectedRef.current) return;
    if (reviewMode && type !== 'writing' && !reviewAttempt) return; // wait for attempt data
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      const script = win.document.createElement('script');
      script.textContent = type === 'writing' ? writingBridgeScript() : readingListeningBridgeScript();
      win.document.body.appendChild(script);

      if (reviewMode && reviewAttempt && type !== 'writing') {
        // detail_json comes back from the API already parsed (Postgres JSONB
        // is auto-parsed by the pg driver) — it's an object, not a string.
        // JSON.parse-ing it here used to throw and silently kill the replay.
        const answersMap = {};
        (reviewAttempt.detail_json || {}).breakdown?.forEach(row => {
          answersMap[row.q] = row.answer;
        });
        const replay = win.document.createElement('script');
        replay.textContent = reviewReplayScript(JSON.stringify(answersMap));
        win.document.body.appendChild(replay);
      }
      injectedRef.current = true;
    } catch (err) {
      console.error('Could not inject bridge script', err);
    }
  }, [iframeReady, reviewMode, reviewAttempt, type]);

  function exitToPractice() {
    document.fullscreenElement && document.exitFullscreen?.();
    if (mockId) clearQueue(mockId);
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={toggleFullscreen}>
            {isFullscreen ? '⤢ Exit fullscreen' : '⛶ Fullscreen'}
          </button>
          <button className="btn secondary" onClick={exitToPractice}>Exit</button>
        </div>
      </div>

      {type === 'listening' && meta?.audio_url && (
        <div className="audio-bar">
          <span className="audio-label">🎧 Recording</span>
          {isGoogleDriveUrl(meta.audio_url) && extractDriveFileId(meta.audio_url) ? (
            <iframe
              className="audio-drive-frame"
              src={`https://drive.google.com/file/d/${extractDriveFileId(meta.audio_url)}/preview`}
              allow="autoplay"
              title="Recording player"
            />
          ) : (
            <audio className="audio-player" controls preload="auto" src={meta.audio_url}>
              Your browser does not support the audio element.
            </audio>
          )}
        </div>
      )}

      {meta && (
        <iframe
          ref={iframeRef}
          title="test"
          src={`/api/tests/${testId}/file`}
          onLoad={handleIframeLoad}
        />
      )}

      {result && !reviewMode && !seq && (
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
  // detail_json is already a parsed object (Postgres JSONB is auto-parsed by
  // the pg driver) — JSON.parse-ing it here used to throw and crash this
  // whole review screen, which is why students couldn't see their band.
  const detail = attempt.detail_json || {};
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
