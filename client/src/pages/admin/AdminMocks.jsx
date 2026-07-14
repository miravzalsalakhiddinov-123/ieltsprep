import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function AdminMocks() {
  const [mocks, setMocks] = useState([]);
  const [title, setTitle] = useState('');
  const [students, setStudents] = useState([]);
  const [speakingForm, setSpeakingForm] = useState({ student_id: '', band_final: '', mock_id: '' });

  function refresh() {
    api.listMocks().then(setMocks);
    api.listStudents().then(setStudents);
  }
  useEffect(refresh, []);

  async function createMock(e) {
    e.preventDefault();
    if (!title) return;
    await api.createMock(title);
    setTitle('');
    refresh();
  }

  async function submitSpeaking(e) {
    e.preventDefault();
    const { student_id, band_final, mock_id } = speakingForm;
    if (!student_id || !band_final) return;
    await api.postSpeakingScore(Number(student_id), Number(band_final), mock_id ? Number(mock_id) : null);
    setSpeakingForm({ student_id: '', band_final: '', mock_id: '' });
    alert('Speaking score saved.');
  }

  return (
    <div>
      <div className="topbar-row"><div className="welcome-title">Mock Bundles</div></div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Create a mock bundle</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -6 }}>
            Create the bundle first, then go to Tests and upload reading/listening/writing files, attaching each to this bundle.
          </p>
          <form onSubmit={createMock}>
            <div className="field"><label>Title</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Full Mock Test 1" /></div>
            <button className="btn">Create</button>
          </form>

          <h3 style={{ marginTop: 22 }}>Existing bundles</h3>
          {mocks.map(m => (
            <div key={m.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
              <strong>{m.title}</strong>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {m.tests.length ? m.tests.map(t => t.type).join(', ') : 'No tests attached yet'}
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Enter a speaking score</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -6 }}>
            Speaking has no test file — enter the band directly after a live session.
          </p>
          <form onSubmit={submitSpeaking}>
            <div className="field"><label>Student</label>
              <select className="input" value={speakingForm.student_id} onChange={e => setSpeakingForm({ ...speakingForm, student_id: e.target.value })}>
                <option value="">Select student…</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Band score</label>
              <input className="input" type="number" step="0.5" min="0" max="9" value={speakingForm.band_final}
                onChange={e => setSpeakingForm({ ...speakingForm, band_final: e.target.value })} /></div>
            <div className="field"><label>Part of a mock bundle? (optional)</label>
              <select className="input" value={speakingForm.mock_id} onChange={e => setSpeakingForm({ ...speakingForm, mock_id: e.target.value })}>
                <option value="">— Standalone —</option>
                {mocks.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
            <button className="btn">Save score</button>
          </form>
        </div>
      </div>
    </div>
  );
}
