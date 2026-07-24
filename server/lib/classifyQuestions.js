// Server-side twin of the classifyGroups() function injected into the
// browser by TestRunner.jsx's readingListeningBridgeScript(). Used only for
// backfilling qtype tags onto attempts submitted before that feature
// existed — new attempts get tagged live in the browser at grading time and
// never touch this file.
//
// IMPORTANT: keep this logic in sync with classifyGroups() in
// client/src/pages/TestRunner.jsx. If one changes, the other should too.

const { JSDOM } = require('jsdom');

function classifyGroups(document, section) {
  const map = {};
  const blocks = document.querySelectorAll('.q-block');
  blocks.forEach(block => {
    const titleEl = block.querySelector('.q-block-title');
    const instrEl = block.querySelector('.q-block-instr');
    const title = titleEl ? (titleEl.textContent || '') : '';
    const instr = (instrEl ? (instrEl.textContent || '') : '').toLowerCase();
    const blockText = block.textContent || '';

    let qNums = [];
    block.querySelectorAll('[data-q]').forEach(el => {
      const n = parseInt(el.getAttribute('data-q'), 10);
      if (!isNaN(n) && !qNums.includes(n)) qNums.push(n);
    });
    block.querySelectorAll('input[type=radio]').forEach(el => {
      const m = (el.name || '').match(/^q(\d+)$/);
      if (m) { const n = parseInt(m[1], 10); if (!qNums.includes(n)) qNums.push(n); }
    });
    if (!qNums.length) {
      const range = title.match(/(\d+)\s*(?:[\u2013-]|and)\s*(\d+)/);
      if (range) {
        for (let i = parseInt(range[1], 10); i <= parseInt(range[2], 10); i++) qNums.push(i);
      } else {
        const single = title.match(/(\d+)/);
        if (single) qNums.push(parseInt(single[1], 10));
      }
    }
    if (!qNums.length) return;

    const hasTable = !!block.querySelector('table');
    const hasMatch = !!block.querySelector('.match-slot, .chip, [data-group]');
    const hasRadio = !!block.querySelector('input[type=radio]');
    const hasFill = !!block.querySelector('input.fill, input[type=text]');
    const hasImg = !!block.querySelector('img, svg');
    const hasNotesBox = !!block.querySelector('.notes-box');
    const hasFlow = !!block.querySelector('.flow-chart') || /flow[\s-]?chart/.test(instr);
    const hasYesNo = /\bYES\b/.test(blockText) && /\bNO\b/.test(blockText);
    const hasTrueFalse = /\bTRUE\b/.test(blockText) && /\bFALSE\b/.test(blockText);

    let type = 'Other';
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

    qNums.forEach(n => { map[n] = type; });
  });
  return map;
}

// Parses a test's raw HTML (as stored in Supabase Storage) and returns a
// { [questionNumber]: qtype } map for the given section ('reading' | 'listening').
function classifyTestHtml(html, section) {
  const dom = new JSDOM(html);
  try {
    return classifyGroups(dom.window.document, section);
  } finally {
    dom.window.close();
  }
}

module.exports = { classifyTestHtml };
