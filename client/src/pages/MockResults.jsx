import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { roundBand, displayBand, isRevealed } from '../utils/band';

const SECTION_ORDER = ['listening', 'reading', 'writing', 'speaking'];
const LABEL = { listening: 'Listening', reading: 'Reading', writing: 'Writing', speaking: 'Speaking' };

export default function MockResults() {
  const { mockId } = useParams();
  const navigate = useNavigate();
  const [mock, setMock] = useState(null);
  const [results, setResults] = useState(null); // { listening: attempt|null, reading: ..., writing: ..., speaking: ... }

  useEffect(() => {
    Promise.all([api.listMocks(), api.myAttempts()]).then(([mocks, attempts]) => {
      const m = mocks.find(x => String(x.id) === String(mockId));
      setMock(m || null);

      // Most recent attempt per section that belongs to this mock.
      const bySection = {};
      attempts
        .filter(a => String(a.mock_id) === String(mockId))
        .forEach(a => {
          const existing = bySection[a.test_type];
          if (!existing || new Date(a.finished_at) > new Date(existing.finished_at)) {
            bySection[a.test_type] = a;
          }
        });
      setResults(bySection);
    });
  }, [mockId]);

  function scoreLine(a) {
    if (!a) return 'Not attempted';
    if (a.status === 'pending_review') return 'Submitted · awaiting review';
    if (a.score_total != null) {
      const band = displayBand(a);
      return `${a.score_raw}/${a.score_total}${band != null ? ` · Band ${band}` : ''}`;
    }
    const band = displayBand(a);
    return band != null ? `Band ${band}` : '—';
  }

  const sectionsTaken = results ? SECTION_ORDER.filter(s => results[s]) : [];
  const anyPending = sectionsTaken.some(s => results[s].status === 'pending_review');
  const allRevealed = sectionsTaken.length > 0 && sectionsTaken.every(s => isRevealed(results[s]));

  const bandValues = results
    ? SECTION_ORDER.map(s => results[s] ? displayBand(results[s]) : null).filter(v => v != null)
    : [];
  const overallBand = allRevealed && bandValues.length ? roundBand(bandValues.reduce((a, b) => a + b, 0) / bandValues.length) : null;

  // While anything is still pending, this page is a submission confirmation
  // only — no scores, no breakdown, nothing that could leak an answer key or
  // an auto-estimate before a teacher has actually looked at it.
  if (results && anyPending) {
    return (
      <div className="main-content" style={{ maxWidth: 620, margin: '0 auto' }}>
        <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <h2 style={{ marginBottom: 6 }}>Thank you!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 22 }}>
            You've submitted every section of <strong>{mock?.title || 'this mock'}</strong>.
            Your teacher will review your Listening, Reading, and Writing answers and release your
            results together — you'll get a notification in your Inbox for each one as soon as it's approved.
          </p>
          <div className="stat-row" style={{ justifyContent: 'center', marginBottom: 22 }}>
            {SECTION_ORDER.filter(s => s !== 'speaking').map(s => (
              <div className="stat-chip" key={s}>
                <div className="val" style={{ fontSize: 14 }}>{scoreLine(results[s])}</div>
                <div className="lbl">{LABEL[s]}</div>
              </div>
            ))}
          </div>
          <button className="btn" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="topbar-row">
        <div>
          <div className="welcome-title">{mock?.title || 'Full mock'} — results</div>
          <div className="welcome-sub">Here's how you did across the whole mock.</div>
        </div>
        <button className="btn secondary" onClick={() => navigate('/mock')}>Back to Mock Center</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Overall</h3>
        <div className="stat-row">
          {SECTION_ORDER.map(s => (
            <div className="stat-chip" key={s}>
              <div className="val" style={{ fontSize: 16 }}>{results ? scoreLine(results[s]) : '…'}</div>
              <div className="lbl">{LABEL[s]}</div>
            </div>
          ))}
          <div className="stat-chip">
            <div className="val" style={{ color: 'var(--ok)' }}>{overallBand ?? '–'}</div>
            <div className="lbl">Overall band</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Review a section</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -6 }}>
          Open the analytics page to see detail and evidence for each part of the mock.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['listening', 'reading', 'writing'].map(s => (
            <button key={s} className="btn secondary" onClick={() => navigate(`/analytics?section=${s}`)}>
              {LABEL[s]} analytics
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
