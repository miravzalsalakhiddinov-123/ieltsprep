import { useRef } from 'react';

// A plain textarea with a small formatting toolbar above it. Buttons wrap
// the current selection (or insert a placeholder) with the same lightweight
// markup that ../utils/richtext.jsx renders: **bold**, *italic*,
// __underline__, [text](url). No WYSIWYG, no HTML — just enough to format
// an article safely.
export default function RichTextField({ label, value, onChange, rows = 10, placeholder, hint }) {
  const ref = useRef(null);

  function wrap(before, after, placeholderText) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end, value: v } = el;
    const selected = v.slice(start, end) || placeholderText;
    const next = v.slice(0, start) + before + selected + after + v.slice(end);
    onChange(next);
    const cursorStart = start + before.length;
    const cursorEnd = cursorStart + selected.length;
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(cursorStart, cursorEnd); });
  }

  function insertLink() {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end, value: v } = el;
    const selected = v.slice(start, end) || 'link text';
    const url = window.prompt('Link URL', 'https://');
    if (!url) return;
    const snippet = `[${selected}](${url})`;
    const next = v.slice(0, start) + snippet + v.slice(end);
    onChange(next);
    requestAnimationFrame(() => el.focus());
  }

  return (
    <div className="field">
      {label && <label>{label}</label>}
      <div className="richtext-toolbar">
        <button type="button" title="Bold" onClick={() => wrap('**', '**', 'bold text')}><b>B</b></button>
        <button type="button" title="Italic" onClick={() => wrap('*', '*', 'italic text')}><i>I</i></button>
        <button type="button" title="Underline" onClick={() => wrap('__', '__', 'underlined text')}><u>U</u></button>
        <button type="button" title="Link" onClick={insertLink}>🔗</button>
      </div>
      <textarea ref={ref} className="input" rows={rows} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}
