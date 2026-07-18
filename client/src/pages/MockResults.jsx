import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { roundBand } from '../utils/band';

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
    if (a.score_total != null) {
      const band = a.band_final ?? a.band_estimate;
      return `${a.score_raw}/${a.score_total}${band != null ? ` · Band ${band}` : ''}`;
    }
    if (a.status === 'pending_review') return 'Awaiting teacher review';
    const band = a.band_final ?? a.band_estimate;
    return band != null ? `Band ${band}` : '—';
  }

  const bandValues = results
    ? SECTION_ORDER.map(s => results[s] ? (results[s].band_final ?? results[s].band_estimate) : null).filter(v => v != null)
    : [];
  const overallBand = bandValues.length ? roundBand(bandValues.reduce((a, b) => a + b, 0) / bandValues.length) : null;

  const anyPendingWriting = results?.writing && results.writing.status === 'pending_review';

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
            <div className="lbl">Estimated overall band</div>
          </div>
        </div>
        {anyPendingWriting && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 14, marginBottom: 0 }}>
            Your writing score above is an auto-estimate — your teacher will confirm the final band and leave feedback soon.
          </p>
        )}
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
