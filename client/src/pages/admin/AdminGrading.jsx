import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function AdminGrading() {
  const [queue, setQueue] = useState([]);
  const [open, setOpen] = useState(null);
  const [band, setBand] = useState('');
  const [feedback, setFeedback] = useState('');

  function refresh() { api.pendingQueue().then(setQueue); }
  useEffect(refresh, []);

  function openAttempt(a) {
    setOpen(a);
    setBand('');
    setFeedback('');
  }

  async function submitGrade() {
    if (!band) return alert('Enter a band score');
    await api.gradeAttempt(open.id, Number(band), feedback);
    setOpen(null);
    refresh();
  }

  const detail = open?.detail_json ? JSON.parse(open.detail_json) : null;

  return (
    <div>
      <div className="topbar-row"><div className="welcome-title">Writing Queue</div></div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Pending review ({queue.length})</h3>
          <div className="test-list">
            {queue.map(a => (
              <div className="test-item" key={a.id} onClick={() => openAttempt(a)}>
                <div>
                  <div style={{ fontWeight: 600 }}>{a.student_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.test_title} · {new Date(a.finished_at).toLocaleString()}</div>
                </div>
                <span className="badge pending">Auto-est. {a.band_estimate ?? '—'}</span>
              </div>
            ))}
            {queue.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Nothing to grade right now.</div>}
          </div>
        </div>

        {open && (
          <div className="card">
            <h3>{open.student_name}'s essay</h3>
            {['part1', 'part2'].map(p => detail?.[p] && (
              <div key={p} style={{ marginBottom: 14 }}>
                <strong>{p === 'part1' ? 'Task 1' : 'Task 2'} ({detail[p].wordCount} words)</strong>
                <p style={{ whiteSpace: 'pre-wrap', maxHeight: 180, overflowY: 'auto', fontSize: 13.5, lineHeight: 1.6 }}>{detail[p].text}</p>
              </div>
            ))}
            <div className="field"><label>Final band score</label>
              <input className="input" type="number" step="0.5" min="0" max="9" value={band} onChange={e => setBand(e.target.value)} /></div>
            <div className="field"><label>Feedback (sent to the student's inbox)</label>
              <textarea rows={5} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="e.g. Strong task response, but watch article usage in paragraph 2..." /></div>
            <button className="btn" onClick={submitGrade}>Save & send feedback</button>
          </div>
        )}
      </div>
    </div>
  );
}
