import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';

// ---- Bridge scripts injected into the same-origin iframe after it loads ----
// These do NOT modify the uploaded test file; they monkey-patch the global
// functions the test file already defines, then postMessage the results
// back to this parent page. Nothing needs to change in the teacher's files.

function readingListeningBridgeScript(kind) {
  // kind: 'listening' | 'academic' | 'general' — selects which official-style
  // raw-score (out of 40) -> band conversion table to use. IELTS itself
  // equates each individual test administration slightly differently and
  // doesn't publish one single fixed table, but these are the standard
  // conversion scales published by IDP/British Council prep materials and
  // used as the reference "official" scale for practice scoring. Listening
  // uses the same scale for both Academic and General Training; Reading does
  // not — General Training Reading is markedly more lenient than Academic
  // Reading at the same raw score, so it needs its own table.
  return `
(function(){
  var KIND = ${JSON.stringify(kind)};
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
  var BAND_TABLES = {
    listening: [
      [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5],
      [23, 6], [18, 5.5], [16, 5], [13, 4.5], [11, 4], [8, 3.5],
      [6, 3], [4, 2.5]
    ],
    academic: [
      [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5],
      [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5],
      [6, 3], [4, 2.5]
    ],
    general: [
      [40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5],
      [30, 6], [27, 5.5], [23, 5], [19, 4.5], [15, 4], [12, 3.5],
      [9, 3]
    ]
  };
  var BAND_TABLE = BAND_TABLES[KIND] || BAND_TABLES.academic;
  function defaultEstimateBand(correct, total) {
    if (!total) return null;
    var scaled = Math.round((correct / total) * 40);
    for (var i = 0; i < BAND_TABLE.length; i++) {
      if (scaled >= BAND_TABLE[i][0]) return BAND_TABLE[i][1];
    }
    return 1;
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
    // Prefer a test file's own estimateBand() if it defines one; otherwise
    // fall back to the built-in IELTS conversion table so every test always
    // gets a band, even if the uploaded file never implemented this itself.
    var b;
    if (typeof window.estimateBand === 'function') {
      b = parseFloat(window.estimateBand(correct, total));
    }
    if (b === undefined || isNaN(b)) {
      b = defaultEstimateBand(correct, total);
    }
    var band = (b === null || b === undefined || isNaN(b)) ? null : b;
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
  // Exposed so the parent page can force a submit when the countdown timer
  // hits zero, even if the student never clicked the test's own submit button.
  window.__ieltsForceSubmit = function(){
    if (typeof window.checkAnswers === 'function') {
      window.checkAnswers();
    } else {
      var result = collect();
      window.parent.postMessage({ source: 'ielts-bridge', kind: 'result', result: result }, '*');
    }
  };
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
  window.__ieltsForceSubmit = function(){
    if (typeof window.displayResults === 'function') {
      // Legacy writing HTML files own their submit flow; nothing generic we
      // can force here beyond hoping the file exposes its own timeout hook.
      if (typeof window.forceSubmit === 'function') window.forceSubmit();
    }
  };
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

function countWords(s) {
  return ((s || '').trim().match(/\S+/g) || []).length;
}

function formatTime(totalSeconds) {
  if (totalSeconds == null) return '';
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
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
  const [timeLeft, setTimeLeft] = useState(null); // seconds, null = no limit / not started
  const injectedRef = useRef(false);
  const submittedRef = useRef(false);
  const startedAt = useRef(new Date().toISOString());

  // Writing (native, non-HTML) task state
  const [activeTask, setActiveTask] = useState('task1');
  const [task1Text, setTask1Text] = useState('');
  const [task2Text, setTask2Text] = useState('');

  const isNativeWriting = type === 'writing' && !!(meta && meta.writing_tasks);
  const needsTask1 = isNativeWriting && (meta.writing_tasks === 'task1' || meta.writing_tasks === 'both');
  const needsTask2 = isNativeWriting && (meta.writing_tasks === 'task2' || meta.writing_tasks === 'both');
  const contentReady = isNativeWriting ? !!meta : iframeReady;

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
    setTimeLeft(null);
    setActiveTask('task1');
    setTask1Text('');
    setTask2Text('');
    injectedRef.current = false;
    submittedRef.current = false;
    startedAt.current = new Date().toISOString();
  }, [testId]);

  useEffect(() => {
    if (meta && needsTask2 && !needsTask1) setActiveTask('task2');
  }, [meta, needsTask1, needsTask2]);

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
      if (submittedRef.current) return; // guard against a double submit (manual + timeout racing)
      submittedRef.current = true;
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
    if (isNativeWriting) return; // no iframe to inject into
    if (!iframeReady || injectedRef.current) return;
    if (reviewMode && type !== 'writing' && !reviewAttempt) return; // wait for attempt data
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      const script = win.document.createElement('script');
      const bandKind = type === 'listening' ? 'listening' : (meta?.reading_variant === 'general' ? 'general' : 'academic');
      script.textContent = type === 'writing' ? writingBridgeScript() : readingListeningBridgeScript(bandKind);
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
  }, [iframeReady, reviewMode, reviewAttempt, type, isNativeWriting]);

  // ---- Countdown timer (reading, listening, and native writing) ----
  // Starts once the test content is actually ready to interact with, counts
  // down every second, and force-submits whatever the student has done so
  // far the instant it hits zero — visible to the student the whole time.
  useEffect(() => {
    if (reviewMode || !meta || !meta.duration_minutes || !contentReady) return;
    setTimeLeft(prev => (prev === null ? meta.duration_minutes * 60 : prev));
  }, [reviewMode, meta, contentReady]);

  useEffect(() => {
    if (reviewMode || timeLeft === null) return;
    if (timeLeft <= 0) {
      if (!submittedRef.current) forceSubmit();
      return;
    }
    const id = setTimeout(() => setTimeLeft(t => (t === null ? null : t - 1)), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, reviewMode]);

  function forceSubmit() {
    if (submittedRef.current) return;
    if (isNativeWriting) {
      submitWriting();
    } else {
      const win = iframeRef.current?.contentWindow;
      try { win && typeof win.__ieltsForceSubmit === 'function' && win.__ieltsForceSubmit(); } catch (err) { /* noop */ }
    }
  }

  function submitWriting() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const detail = {};
    if (needsTask1) detail.part1 = { text: task1Text, wordCount: countWords(task1Text) };
    if (needsTask2) detail.part2 = { text: task2Text, wordCount: countWords(task2Text) };
    api.submitAttempt({
      test_id: Number(testId),
      test_type: 'writing',
      score_raw: null,
      score_total: null,
      band_estimate: null,
      detail,
      started_at: startedAt.current,
      mock_id: mockId ? Number(mockId) : null
    }).then(saved => {
      if (seq && mockId) {
        advanceMockSequence();
      } else {
        setResult({ band_estimate: null, detail });
        setSavedAttemptId(saved.id);
      }
    });
  }

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

  const timerClass = timeLeft == null ? '' : timeLeft <= 60 ? 'timer-pill danger' : timeLeft <= 300 ? 'timer-pill warn' : 'timer-pill';

  return (
    <div className="fullscreen-runner">
      <div className="runner-topbar">
        <div style={{ fontWeight: 700 }}>{meta?.title || 'Loading test…'}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {timeLeft != null && <div className={timerClass}>⏱ {formatTime(timeLeft)}</div>}
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

      {isNativeWriting ? (
        <WritingWorkspace
          meta={meta}
          testId={testId}
          needsTask1={needsTask1}
          needsTask2={needsTask2}
          activeTask={activeTask}
          setActiveTask={setActiveTask}
          task1Text={task1Text}
          setTask1Text={setTask1Text}
          task2Text={task2Text}
          setTask2Text={setTask2Text}
          onSubmit={submitWriting}
        />
      ) : (
        meta && (
          <iframe
            ref={iframeRef}
            title="test"
            src={`/api/tests/${testId}/file`}
            onLoad={handleIframeLoad}
          />
        )
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

// ---- Native writing split-screen workspace ----
// Left: the prompt (and Task 1 image, if any). Right: the student's response,
// with a live word count. When both tasks are assigned, a tab switcher lets
// the student move between them without losing what they've typed.
function WritingWorkspace({ meta, testId, needsTask1, needsTask2, activeTask, setActiveTask, task1Text, setTask1Text, task2Text, setTask2Text, onSubmit }) {
  const showingTask1 = activeTask === 'task1' && needsTask1;
  const text = showingTask1 ? task1Text : task2Text;
  const setText = showingTask1 ? setTask1Text : setTask2Text;
  const minWords = showingTask1 ? 150 : 250;
  const wordCount = countWords(text);

  return (
    <div className="writing-workspace">
      {needsTask1 && needsTask2 && (
        <div className="writing-tabs">
          <button className={activeTask === 'task1' ? 'active' : ''} onClick={() => setActiveTask('task1')}>
            Task 1 {countWords(task1Text) > 0 && <span className="wc-dot">{countWords(task1Text)}w</span>}
          </button>
          <button className={activeTask === 'task2' ? 'active' : ''} onClick={() => setActiveTask('task2')}>
            Task 2 {countWords(task2Text) > 0 && <span className="wc-dot">{countWords(task2Text)}w</span>}
          </button>
        </div>
      )}
      <div className="writing-split">
        <div className="writing-pane writing-prompt-pane">
          <div className="writing-pane-label">{showingTask1 ? 'Task 1' : 'Task 2'}</div>
          <p className="writing-prompt-text">{showingTask1 ? meta.writing_task1_prompt : meta.writing_task2_prompt}</p>
          {showingTask1 && meta.has_task1_image && (
            <img className="writing-task-image" src={`/api/tests/${testId}/task1-image`} alt="Task 1 visual" />
          )}
        </div>
        <div className="writing-pane writing-answer-pane">
          <div className="writing-pane-label">Your response</div>
          <textarea
            className="writing-textarea"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`Start writing your ${showingTask1 ? 'Task 1' : 'Task 2'} response here…`}
          />
          <div className="writing-footer">
            <span className={wordCount < minWords ? 'wc-low' : 'wc-ok'}>{wordCount} words <span style={{ opacity: 0.6 }}>(min {minWords})</span></span>
            <button className="btn" onClick={onSubmit}>Submit</button>
          </div>
        </div>
      </div>
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
