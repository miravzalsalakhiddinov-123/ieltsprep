import { useEffect, useState } from 'react';
import { Newspaper, CalendarDays } from 'lucide-react';
import { api } from '../api/client';
import { renderRichText } from '../utils/richtext';

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {posts.map(p => {
            const open = openId === p.id;
            return (
              <div className="card" key={p.id} style={{ cursor: 'pointer' }} onClick={() => setOpenId(open ? null : p.id)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <h3 style={{ margin: 0 }}>{p.title}</h3>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                    <CalendarDays size={12} strokeWidth={2} />{new Date(p.created_at).toLocaleDateString()}
                  </span>
                </div>
                {open && (
                  <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.7 }}>
                    {renderRichText(p.body)}
                  </div>
                )}
                {!open && (
                  <div style={{ marginTop: 6, fontSize: 13.5, color: 'var(--text-muted)' }}>
                    {p.body.replace(/[*_[\]]/g, '').slice(0, 140)}{p.body.length > 140 ? '…' : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
