// A tiny, safe subset of markdown-style inline formatting used across
// lesson content (mini-lessons and sample answers):
//   **bold text**
//   *italic text*
//   __underlined text__
//   [link text](https://example.com)
// Deliberately NOT full markdown (no nesting, no raw HTML) — just enough
// for admins to format an article without a heavyweight editor library.

const INLINE_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*/g;

export function renderInline(text, keyPrefix = '') {
  if (!text) return text;
  const nodes = [];
  let lastIndex = 0;
  let match;
  let i = 0;
  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      nodes.push(
        <a key={`${keyPrefix}-${i}`} href={match[2]} target="_blank" rel="noopener noreferrer">{match[1]}</a>
      );
    } else if (match[3] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-${i}`}>{match[3]}</strong>);
    } else if (match[4] !== undefined) {
      nodes.push(<u key={`${keyPrefix}-${i}`}>{match[4]}</u>);
    } else if (match[5] !== undefined) {
      nodes.push(<em key={`${keyPrefix}-${i}`}>{match[5]}</em>);
    }
    i++;
    lastIndex = INLINE_PATTERN.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

// Block-level renderer shared by lesson content and blog posts. Blank lines
// separate paragraphs; a line starting with "## " (or "# ") becomes a
// subheading. Same inline formatting as renderInline within each block.
export function renderRichText(content) {
  if (!content) return null;
  return content.split(/\n\s*\n/).map((block, i) => {
    const trimmed = block.trim();
    if (trimmed.startsWith('## ')) return <h2 key={i} className="lesson-view-heading">{renderInline(trimmed.slice(3), `h${i}`)}</h2>;
    if (trimmed.startsWith('# ')) return <h2 key={i} className="lesson-view-heading">{renderInline(trimmed.slice(2), `h${i}`)}</h2>;
    return <p key={i}>{renderInline(trimmed, `p${i}`)}</p>;
  });
}
