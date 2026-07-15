import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function AdminTests() {
  const [tests, setTests] = useState([]);
  const [mocks, setMocks] = useState([]);
  const [type, setType] = useState('reading');
  const [title, setTitle] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [mockId, setMockId] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function refresh() {
    api.listTests().then(setTests);
    api.listMocks().then(setMocks);
  }
  useEffect(refresh, []);

  async function handleUpload(e) {
    e.preventDefault();
    setError('');
    if (!file || !title) { setError('Title and file are required'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('type', type);
      fd.append('title', title);
      fd.append('file', file);
      if (type === 'listening' && audioUrl) fd.append('audio_url', audioUrl);
      if (mockId) fd.append('mock_id', mockId);
      await api.uploadTest(fd);
      setTitle(''); setAudioUrl(''); setFile(null); setMockId('');
      e.target.reset();
      refresh();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function remove(id) {
    if (!confirm('Delete this test? Existing attempts will remain in analytics but the test file will be removed.')) return;
    await api.deleteTest(id);
    refresh();
  }

  return (
    <div>
      <div className="topbar-row"><div className="welcome-title">Tests</div></div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Upload a test</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -6 }}>
            Upload the HTML file exactly as-is — reading and listening tests are scored automatically from their built-in answer key.
            Writing tests are saved with an auto-estimate and go to your Writing Queue for you to confirm a band and leave feedback.
          </p>
          {error && <div className="error-text">{error}</div>}
          <form onSubmit={handleUpload}>
            <div className="field">
              <label>Type</label>
              <select className="input" value={type} onChange={e => setType(e.target.value)}>
                <option value="reading">Reading</option>
                <option value="listening">Listening</option>
                <option value="writing">Writing</option>
              </select>
            </div>
            <div className="field"><label>Title</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Day 36 — Native Species" /></div>
            {type === 'listening' && (
              <div className="field"><label>Audio URL (Google Drive link or direct file URL)</label>
                <input className="input" value={audioUrl} onChange={e => setAudioUrl(e.target.value)} placeholder="https://drive.google.com/file/d/.../view?usp=sharing" />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  You can paste a Google Drive share link — just set the file's sharing to "Anyone with the link" first, then paste the link here as-is. A direct audio file URL (e.g. from your own hosting) works too.
                </div>
              </div>
            )}
            <div className="field"><label>Test HTML file</label>
              <input className="input" type="file" accept=".html" onChange={e => setFile(e.target.files[0])} /></div>
            <div className="field"><label>Attach to a mock bundle (optional)</label>
              <select className="input" value={mockId} onChange={e => setMockId(e.target.value)}>
                <option value="">— Standalone test —</option>
                {mocks.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
            <button className="btn" disabled={busy}>{busy ? 'Uploading…' : 'Upload test'}</button>
          </form>
        </div>

        <div className="card">
          <h3>All tests ({tests.length})</h3>
          <table className="simple-table">
            <thead><tr><th>Title</th><th>Type</th><th>Mock</th><th></th></tr></thead>
            <tbody>
              {tests.map(t => (
                <tr key={t.id}>
                  <td>{t.title}</td>
                  <td>{t.type}</td>
                  <td>{t.mock_id ? mocks.find(m => m.id === t.mock_id)?.title || t.mock_id : '—'}</td>
                  <td><button className="btn danger" onClick={() => remove(t.id)}>Delete</button></td>
                </tr>
              ))}
              {tests.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>No tests uploaded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
