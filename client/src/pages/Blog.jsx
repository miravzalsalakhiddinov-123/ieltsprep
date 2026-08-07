import { useEffect, useState } from 'react';
import { Newspaper, CalendarDays, Clock, ChevronDown } from 'lucide-react';
import { api } from '../api/client';
import { renderRichText } from '../utils/richtext';

// Rough reading-time estimate so posts feel like articles, not a wall of text.
function readingTime(body) {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// First real sentence of the post, used as a one-line "lede" under the title
// so a post reads as an invitation rather than a dense preview blob.
function lede(body) {
  const plain = body.replace(/[#*_[\]]/g, '').replace(/\(https?:\/\/[^\s)]+\)/g, '').trim();
  const firstLine = plain.split(/\n/).find(l => l.trim().length > 0) || plain;
  return firstLine.length > 160 ? firstLine.slice(0, 160) + '…' : firstLine;
}

export default function Blog() {
  const [posts, setPosts] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => { api.listBlogPosts().then(setPosts); }, []);

  return (
    <div>
      <div className="section-head">
        <div>
          <div className="section-head-title">Blog</div>
          <div className="section-head-sub">Stories, tips, and updates from your teacher.</div>
        </div>
      </div>

      {posts === null && <div style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Loading…</div>}

      {posts !== null && posts.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><Newspaper size={22} strokeWidth={2} /></div>
            <div className="empty-state-title">Nothing posted yet</div>
            <div className="empty-state-sub">Check back soon.</div>
          </div>
        </div>
      )}

      {posts !== null && posts.length > 0 && (
        <div className="blog-list">
          {posts.map(p => {
            const open = openId === p.id;
            return (
              <article className={`blog-post-card${open ? ' open' : ''}`} key={p.id}>
                <button className="blog-post-header" onClick={() => setOpenId(open ? null : p.id)}>
                  <div className="blog-post-header-text">
                    <h3>{p.title}</h3>
                    <div className="blog-post-meta">
                      <span><CalendarDays size={12} strokeWidth={2} />{new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span><Clock size={12} strokeWidth={2} />{readingTime(p.body)} min read</span>
                    </div>
                    {!open && <p className="blog-post-lede">{lede(p.body)}</p>}
                  </div>
                  <ChevronDown className="blog-post-chevron" size={18} strokeWidth={2.2} />
                </button>
                {open && (
                  <div className="blog-post-body">
                    {renderRichText(p.body)}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
