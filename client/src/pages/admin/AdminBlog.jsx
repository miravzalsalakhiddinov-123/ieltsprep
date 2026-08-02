import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import RichTextField from '../../components/RichTextField';

export default function AdminBlog() {
  const [posts, setPosts] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function refresh() { api.listBlogPosts().then(setPosts); }
  useEffect(refresh, []);

  function resetForm() { setEditingId(null); setTitle(''); setBody(''); }

  function edit(p) {
    setEditingId(p.id);
    setTitle(p.title);
    setBody(p.body);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!title.trim() || !body.trim()) { setError('Title and body are required'); return; }
    setBusy(true);
    try {
      if (editingId) await api.updateBlogPost(editingId, title, body);
      else await api.createBlogPost(title, body);
      resetForm();
      refresh();
    } catch (err) {
      setError(err.message || 'Could not save post');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this post?')) return;
    await api.deleteBlogPost(id);
    refresh();
  }

  return (
    <div>
      <div className="topbar-row"><div className="welcome-title">📝 Mini-Blog</div></div>
      <div className="section-head-sub" style={{ marginBottom: 18 }}>
        Posted here shows up in the student sidebar — daily stories, tips, personal experiences, whatever you like.
      </div>

      <div className="card" style={{ maxWidth: 640, marginBottom: 24 }}>
        <h3>{editingId ? 'Edit post' : 'New post'}</h3>
        {error && <div className="error-text">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Title</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. That time my flight got cancelled…" />
          </div>
          <RichTextField label="Body" value={body} onChange={setBody} rows={8} placeholder="Write your story…" />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Publish post'}</button>
            {editingId && <button type="button" className="btn secondary" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      </div>

      <div className="card">
        <h3>All posts</h3>
        {posts.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Nothing posted yet.</div>}
        <div className="test-list">
          {posts.map(p => (
            <div className="test-item" key={p.id} style={{ cursor: 'default' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{p.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(p.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn secondary" style={{ padding: '6px 10px' }} onClick={() => edit(p)}><Pencil size={14} strokeWidth={2} /></button>
                <button className="btn secondary" style={{ padding: '6px 10px' }} onClick={() => remove(p.id)}><Trash2 size={14} strokeWidth={2} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
