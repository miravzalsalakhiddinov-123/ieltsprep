import { useEffect, useState } from 'react';
import { api } from '../../api/client';

const TYPE_ICON = { reading: '📖', listening: '🎧', writing: '✍️' };

export default function AdminGrading() {
  const [queue, setQueue] = useState([]);
  const [open, setOpen] = useState(null);
  const [band, setBand] = useState('');
  const [feedback, setFeedback] = useState('');

  function refresh() { api.pendingQueue().then(setQueue); }
  useEffect(refresh, []);

  function openAttempt(a) {
    setOpen(a);
    // Reading/listening already have a solid auto-estimate from the answer
    // key, so pre-fill it — the teacher just confirms or adjusts it instead
    // of typing from scratch. Writing has no reliable auto-estimate, so it
    // starts blank.
    setBand(a.test_type !== 'writing' && a.band_estimate != null ? String(a.band_estimate) : '');
    setFeedback('');
  }

  async function submitGrade() {
    if (!band) return alert('Enter a band score');
    await api.gradeAttempt(open.id, Number(band), feedback);
    setOpen(null);
    refresh();
  }

  // detail_json comes back from the API already parsed (Postgres JSONB is
  // auto-parsed by the pg driver) — it's an object already, not a string.
  // Calling JSON.parse on it threw and crashed this whole page before.
  const detail = open?.detail_json || null;
  const isWriting = open?.test_type === 'writing';
  const isScored = open?.test_type === 'reading' || open?.test_type === 'listening';

  return (
    <div>
      <div className="topbar-row">
        <div>
          <div className="welcome-title">Review Queue</div>
          <div className="welcome-sub">Approve Reading, Listening, and Writing results before students can see them.</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Pending review ({queue.length})</h3>
          <div className="test-list">
            {queue.map(a => (
              <div className="test-item" key={a.id} onClick={() => openAttempt(a)}>
                <div>
                  <div style={{ fontWeight: 600 }}>{TYPE_ICON[a.test_type] || ''} {a.student_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.test_title} · {new Date(a.finished_at).toLocaleString()}</div>
                </div>
                <span className="badge pending">
                  {a.score_total != null ? `${a.score_raw}/${a.score_total} · ` : ''}Auto-est. {a.band_estimate ?? '—'}
                </span>
              </div>
            ))}
            {queue.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Nothing to review right now.</div>}
          </div>
        </div>

        {open && (
          <div className="card">
            <h3>{TYPE_ICON[open.test_type] || ''} {open.student_name}'s {isWriting ? 'essay' : open.test_type}</h3>

            {isWriting && ['part1', 'part2'].map(p => detail?.[p] && (
              <div key={p} style={{ marginBottom: 14 }}>
                <strong>{p === 'part1' ? 'Task 1' : 'Task 2'} ({detail[p].wordCount} words)</strong>
                <p style={{ whiteSpace: 'pre-wrap', maxHeight: 180, overflowY: 'auto', fontSize: 13.5, lineHeight: 1.6 }}>{detail[p].text}</p>
              </div>
            ))}

            {isScored && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ marginBottom: 4 }}>Raw score: <strong>{open.score_raw}/{open.score_total}</strong></p>
                <p style={{ marginBottom: 10, color: 'var(--text-muted)', fontSize: 13 }}>
                  Auto-estimated band: <strong>{open.band_estimate ?? '—'}</strong> (from the answer key — adjust below if needed)
                </p>
                <details>
                  <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>View question-by-question breakdown</summary>
                  <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 8, fontSize: 12.5 }}>
                    {(detail?.breakdown || []).map(row => (
                      <div key={row.q} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                        <span>Q{row.q} ({row.part})</span>
                        <span>{row.answer || '—'} {row.correct ? '✅' : `❌ (ans: ${row.correctAnswer ?? '—'})`}</span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}

            <div className="field"><label>Final band score</label>
              <input className="input" type="number" step="0.5" min="0" max="9" value={band} onChange={e => setBand(e.target.value)} /></div>
            <div className="field"><label>Feedback (sent to the student's inbox)</label>
              <textarea rows={5} value={feedback} onChange={e => setFeedback(e.target.value)}
                placeholder={isWriting ? "e.g. Strong task response, but watch article usage in paragraph 2..." : "Optional note to the student"} /></div>
            <button className="btn" onClick={submitGrade}>Approve & send to inbox</button>
          </div>
        )}
      </div>
    </div>
  );
}
