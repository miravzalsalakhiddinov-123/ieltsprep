import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import AudioPlayer from '../components/AudioPlayer';

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
  // ---- Automatic question-TYPE detection ----
  // Every uploaded test file (reading or listening) groups its questions into
  // ".q-block" sections, each carrying a ".q-block-title" ("Questions 5-10")
  // and a ".q-block-instr" instruction paragraph ("Complete the notes
  // below...", "Choose the correct letter...", etc.) — that's how every file
  // we've seen is generated, so no admin has to tag anything by hand. This
  // reads that structure straight out of the live DOM at grading time and
  // maps each question number to a skill-type label. Files that don't follow
  // this convention just fall back to 'Other' rather than throwing.
  function classifyGroups(section){
    var map = {};
    var blocks = document.querySelectorAll('.q-block');
    blocks.forEach(function(block){
      var titleEl = block.querySelector('.q-block-title');
      var instrEl = block.querySelector('.q-block-instr');
      var title = titleEl ? (titleEl.textContent || '') : '';
      var instr = (instrEl ? (instrEl.textContent || '') : '').toLowerCase();
      var blockText = block.textContent || '';

      var qNums = [];
      block.querySelectorAll('[data-q]').forEach(function(el){
        var n = parseInt(el.getAttribute('data-q'), 10);
        if (!isNaN(n) && qNums.indexOf(n) === -1) qNums.push(n);
      });
      block.querySelectorAll('input[type=radio]').forEach(function(el){
        var m = (el.name || '').match(/^q(\d+)$/);
        if (m) { var n = parseInt(m[1], 10); if (qNums.indexOf(n) === -1) qNums.push(n); }
      });
      if (!qNums.length) {
        var range = title.match(/(\d+)\s*(?:[\u2013-]|and)\s*(\d+)/);
        if (range) {
          for (var i = parseInt(range[1], 10); i <= parseInt(range[2], 10); i++) qNums.push(i);
        } else {
          var single = title.match(/(\d+)/);
          if (single) qNums.push(parseInt(single[1], 10));
        }
      }
      if (!qNums.length) return;

      var hasTable = !!block.querySelector('table');
      var hasMatch = !!block.querySelector('.match-slot, .chip, [data-group]');
      var hasRadio = !!block.querySelector('input[type=radio]');
      var hasFill = !!block.querySelector('input.fill, input[type=text]');
      var hasImg = !!block.querySelector('img, svg');
      var hasNotesBox = !!block.querySelector('.notes-box');
      var hasFlow = !!block.querySelector('.flow-chart') || /flow[\s-]?chart/.test(instr);
      var hasYesNo = /\bYES\b/.test(blockText) && /\bNO\b/.test(blockText);
      var hasTrueFalse = /\bTRUE\b/.test(blockText) && /\bFALSE\b/.test(blockText);

      var type = 'Other';
      if (/table/.test(instr) && hasTable) type = 'Table Completion';
      else if (hasFlow) type = 'Flow-Chart Completion';
      else if (/heading/.test(instr)) type = 'Matching Headings';
      else if (/(diagram|\bplan\b|\bmap\b)/.test(instr) && (hasMatch || hasImg)) {
        type = section === 'listening' ? 'Plan/Map/Diagram Labeling' : 'Diagram Label Completion';
      }
      else if (/paragraph/.test(instr) && /(contain|which paragraph|information)/.test(instr)) type = 'Matching Paragraph Information';
      else if (/sentence ending/.test(instr)) type = 'Matching Sentence Endings';
      else if (hasRadio && (hasYesNo || hasTrueFalse)) type = hasYesNo ? 'Yes/No Questions' : 'Identifying Information';
      else if (hasMatch && /(from the box|next to question|match)/.test(instr)) type = section === 'listening' ? 'Matching' : 'Matching Features';
      else if (/summary/.test(instr)) type = 'Summary Completion';
      else if (/complete the form/.test(instr)) type = 'Form Completion';
      else if (/complete the sentence/.test(instr)) type = 'Sentence Completion';
      else if (hasNotesBox || /complete the notes?/.test(instr)) type = 'Note Completion';
      else if (hasRadio && /(choose the correct letter|correct answer)/.test(instr)) type = 'Multiple Choice';
      else if (hasFill && /(short answer|answer the questions)/.test(instr)) type = 'Short Answer Questions';
      else if (hasRadio) type = 'Multiple Choice';
      else if (hasFill) type = section === 'listening' ? 'Note Completion' : 'Sentence Completion';

      qNums.forEach(function(n){ map[n] = type; });
    });
    return map;
  }
  function collect(){
    var total=0, correct=0, answered=0, breakdown=[];
    var partQs = readGlobal('PART_QS') || {};
    var answerKey = readGlobal('ANSWERS') || {};
    var section = KIND === 'listening' ? 'listening' : 'reading';
    var qTypeMap = {};
    try { qTypeMap = classifyGroups(section); } catch (e) {}
    var parts = Object.keys(partQs);
    parts.forEach(function(p){
      partQs[p].forEach(function(n){
        var ans = window.getUserAnswer(n);
        var hasAns = ans !== null && ans !== '';
        var ok = window.isCorrect(n, ans);
        if (hasAns) answered++;
        if (ok) correct++;
        total++;
        breakdown.push({part:p, q:n, answer:ans, correctAnswer: answerKey['q'+n], correct: ok, qtype: qTypeMap[n] || 'Other'});
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

  // ---- Draft autosave ----
  // Sends the student's current (not-yet-submitted) answers up to the parent
  // page, which stashes them in localStorage. This is what lets a reload or
  // a dropped connection resume mid-test instead of losing everything —
  // fires on every input/change, on any click (covers custom drag/drop or
  // chip-style answer UIs that don't emit input events), and on a slow
  // interval as a backstop.
  function collectDraft(){
    var draft = {};
    try {
      var partQs = readGlobal('PART_QS') || {};
      Object.keys(partQs).forEach(function(p){
        partQs[p].forEach(function(n){
          var ans = window.getUserAnswer ? window.getUserAnswer(n) : null;
          if (ans !== null && ans !== undefined && ans !== '') draft[n] = ans;
        });
      });
    } catch (e) {}
    return draft;
  }
  var autosaveTimer = null;
  function scheduleAutosave(){
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(function(){
      window.parent.postMessage({ source: 'ielts-bridge', kind: 'draft', answers: collectDraft() }, '*');
    }, 600);
  }
  document.addEventListener('input', scheduleAutosave, true);
  document.addEventListener('change', scheduleAutosave, true);
  document.addEventListener('click', scheduleAutosave, true);
  setInterval(scheduleAutosave, 15000);
})();
`;
}

// Injected once, right after the bridge script, ONLY when a saved draft
// exists for this test — repopulates the student's in-progress answers
// (from localStorage, round-tripped through the parent) without touching
// grading in any way: no checkAnswers() call, no correctness reveal, just
// the raw values put back where the student left them.
function draftRestoreScript(prevAnswersJson) {
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
})(${prevAnswersJson});
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

// ---- In-progress answer drafts (survive a reload or a lost connection) ----
// Reading/listening: the student's answers live inside the uploaded test
// file's own DOM/JS, not in React state, so they're mirrored out to
// localStorage via the bridge script's autosave postMessage (see
// readingListeningBridgeScript / draftRestoreScript above) and read back in
// here as a plain q -> answer map, keyed by test id.
// Writing: task text already lives in React state, so it's saved directly.
// Either kind of draft is cleared the moment that attempt is submitted, so a
// later, fresh attempt at the same test never starts pre-filled with old
// answers — this is only for resuming a session that got interrupted.
function draftKey(testId) { return `ielts_draft_${testId}`; }
function readDraft(testId) {
  try { return JSON.parse(localStorage.getItem(draftKey(testId)) || 'null'); } catch { return null; }
}
function writeDraft(testId, answers) {
  try { localStorage.setItem(draftKey(testId), JSON.stringify(answers || {})); } catch {}
}
function clearDraft(testId) {
  try { localStorage.removeItem(draftKey(testId)); } catch {}
}

function writingDraftKey(testId) { return `ielts_draft_writing_${testId}`; }
function readWritingDraft(testId) {
  try { return JSON.parse(localStorage.getItem(writingDraftKey(testId)) || 'null'); } catch { return null; }
}
function writeWritingDraft(testId, data) {
  try { localStorage.setItem(writingDraftKey(testId), JSON.stringify(data)); } catch {}
}
function clearWritingDraft(testId) {
  try { localStorage.removeItem(writingDraftKey(testId)); } catch {}
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
  const [masked, setMasked] = useState(false); // instantly covers the iframe the moment a mock section is submitted
  const injectedRef = useRef(false);
  const submittedRef = useRef(false);
  const startedAt = useRef(new Date().toISOString());

  // Every section shows a "ready?" confirmation before it actually loads —
  // the timer, any audio, and the test content itself only start once the
  // student actively confirms. Applies the same way whether the section is
  // part of a Full Mock or opened directly as standalone practice, and for
  // every type (listening, reading, writing) — nothing starts by accident.
  const gateActive = true;
  const [ready, setReady] = useState(!gateActive);

  // Writing (native, non-HTML) task state
  const [activeTask, setActiveTask] = useState('task1');
  const [task1Text, setTask1Text] = useState('');
  const [task2Text, setTask2Text] = useState('');

  const isNativeWriting = type === 'writing' && !!(meta && meta.writing_tasks);
  const needsTask1 = isNativeWriting && (meta.writing_tasks === 'task1' || meta.writing_tasks === 'both');
  const needsTask2 = isNativeWriting && (meta.writing_tasks === 'task2' || meta.writing_tasks === 'both');
  const contentReady = ready && (isNativeWriting ? !!meta : iframeReady);

  function confirmReady() {
    document.documentElement.requestFullscreen?.().catch(() => {});
    setReady(true);
  }

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
    setReady(false);
    setMasked(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  // Restore any saved writing draft for this test (runs after the reset
  // effect above, since it's declared later — so the blank-slate reset
  // always happens first, then this fills it back in if there's a draft).
  useEffect(() => {
    if (reviewMode || type !== 'writing') return;
    const draft = readWritingDraft(testId);
    if (!draft) return;
    if (draft.task1Text) setTask1Text(draft.task1Text);
    if (draft.task2Text) setTask2Text(draft.task2Text);
    if (draft.activeTask) setActiveTask(draft.activeTask);
  }, [testId, type, reviewMode]);

  // Autosave writing drafts as the student types, debounced so it's not
  // writing to localStorage on every keystroke.
  useEffect(() => {
    if (reviewMode || type !== 'writing') return;
    const id = setTimeout(() => {
      writeWritingDraft(testId, { task1Text, task2Text, activeTask });
    }, 600);
    return () => clearTimeout(id);
  }, [testId, type, reviewMode, task1Text, task2Text, activeTask]);

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
      if (!e.data || e.data.source !== 'ielts-bridge') return;

      // Autosave: the bridge script sends the student's current, not-yet-
      // submitted answers periodically so a reload or dropped connection can
      // pick back up where they left off. Ignored once already submitted, or
      // in review mode where nothing should be written back to the draft.
      if (e.data.kind === 'draft') {
        if (!reviewMode && !submittedRef.current) writeDraft(testId, e.data.answers);
        return;
      }
      if (e.data.kind !== 'result') return;

      if (reviewMode) return; // already-graded attempt, don't resave
      if (submittedRef.current) return; // guard against a double submit (manual + timeout racing)
      submittedRef.current = true;
      clearDraft(testId); // test is being submitted — the draft has served its purpose
      // Some uploaded test files open their own "results" modal and reveal
      // the correct answers the instant checkAnswers() runs — before this
      // handler even fires. For a mock section, that must never be visible,
      // so we hide the iframe FIRST, synchronously, direct on the DOM node
      // (not just via React state, which would wait a render cycle) — then
      // everything else (saving, advancing) happens behind that cover.
      if (mockId && iframeRef.current) {
        iframeRef.current.style.visibility = 'hidden';
      }
      if (mockId) setMasked(true);
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
        if (mockId) {
          // Any attempt tied to a mock — sequenced or opened as a single
          // section from Mock Center — never reveals its score locally.
          // Sequenced runs move straight to the next section; a lone section
          // just goes back to Mock Center, which shows "awaiting review".
          if (seq) advanceMockSequence();
          else navigate('/mock', { replace: true });
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
      } else if (!reviewMode && type !== 'writing') {
        // A fresh (not-yet-submitted) attempt: if this test has an unsaved
        // draft from an earlier session that got interrupted (reload, lost
        // connection, browser closed), silently put those answers back —
        // no correctness reveal, the student just picks up where they left off.
        const draft = readDraft(testId);
        if (draft && Object.keys(draft).length) {
          const restore = win.document.createElement('script');
          restore.textContent = draftRestoreScript(JSON.stringify(draft));
          win.document.body.appendChild(restore);
        }
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
    clearWritingDraft(testId); // test is being submitted — the draft has served its purpose
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
      if (mockId) {
        if (seq) advanceMockSequence();
        else navigate('/mock', { replace: true });
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

  if (!reviewMode && gateActive && !ready) {
    return <ReadyGate type={type} meta={meta} onReady={confirmReady} onExit={exitToPractice} />;
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
          <AudioPlayer
            src={
              isGoogleDriveUrl(meta.audio_url) && extractDriveFileId(meta.audio_url)
                ? `/api/tests/${testId}/audio`
                : meta.audio_url
            }
            label="Recording"
          />
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

      {result && !reviewMode && !seq && !mockId && (
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

      {masked && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'var(--surface, #fff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12
        }}>
          <div style={{ fontSize: 32 }}>✅</div>
          <div style={{ fontWeight: 600 }}>Submitting your answers…</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Moving to the next section</div>
        </div>
      )}
    </div>
  );
}

// ---- "Are you ready?" confirmation shown before each Full Mock section ----
// Nothing about the section — timer, audio, questions, the writing prompt —
// starts until the student actively confirms here. Keeps every section of a
// full mock deliberately started, the same way the real exam is.
const SECTION_LABEL = { listening: 'Listening', reading: 'Reading', writing: 'Writing' };
const SECTION_ICON = { listening: '🎧', reading: '📖', writing: '✍️' };
const SECTION_NOTES = {
  listening: 'The recording will start playing automatically the moment you click Start — there\u2019s no play button, and no pausing, rewinding, or skipping ahead, just like the real exam.',
  reading: 'The passages and questions will load once you start. Manage your own time across the whole section.',
  writing: 'You\u2019ll write your response(s) directly in the box provided. Make sure you\u2019re ready to focus for the full time.'
};

function ReadyGate({ type, meta, onReady, onExit }) {
  const label = SECTION_LABEL[type] || (type ? type[0].toUpperCase() + type.slice(1) : 'Section');
  return (
    <div className="fullscreen-runner">
      <div className="runner-topbar">
        <div style={{ fontWeight: 700 }}>{meta?.title || 'Loading test…'}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn secondary" onClick={onExit}>Exit</button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: '40px 32px' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>{SECTION_ICON[type] || '📝'}</div>
          <h2 style={{ marginBottom: 6 }}>Ready to start {label}?</h2>
          {meta?.duration_minutes && (
            <p style={{ color: 'var(--text-muted)', marginBottom: 10 }}>
              Time limit: <strong>{meta.duration_minutes} minutes</strong>, starting the moment you click Start.
            </p>
          )}
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>{SECTION_NOTES[type] || ''}</p>
          <button className="btn" onClick={onReady}>I'm ready — Start {label}</button>
        </div>
      </div>
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
