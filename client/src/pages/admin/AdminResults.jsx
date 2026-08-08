import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';

const TYPE_META = {
  reading: { label: 'Reading', icon: '📖' },
  listening: { label: 'Listening', icon: '🎧' },
  writing: { label: 'Writing', icon: '✍️' },
  speaking: { label: 'Speaking', icon: '🗣️' }
};

function bandOf(a) {
  return a.band_final ?? a.band_estimate ?? null;
}

function statusBadge(a) {
  if (a.status === 'pending_review') return <span className="badge pending">Pending review</span>;
  if (a.status === 'reviewed') return <span className="badge reviewed">Reviewed</span>;
  return <span className="badge reviewed">Completed</span>;
}

export default function AdminResults() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [resettingId, setResettingId] = useState(null);

  function refresh() {
    setLoading(true);
    api.allResults().then(rows => { setResults(rows); setLoading(false); }).catch(() => setLoading(false));
  }
  useEffect(refresh, []);

  async function resetAttempt(a) {
    const label = `${a.student_name} · ${TYPE_META[a.test_type]?.label || a.test_type} · ${a.test_title || ''}`;
    if (!confirm(`Delete this attempt so the student can retake it?\n\n${label}\n\nThis permanently removes their submitted answers and score for this attempt.`)) return;
    setResettingId(a.id);
    try {
      await api.resetAttempt(a.id);
      refresh();
    } catch (err) {
      alert(err.message || 'Could not reset this attempt.');
    } finally {
      setResettingId(null);
    }
  }

  const filtered = useMemo(() => {
    return results.filter(a => {
      if (type !== 'all' && a.test_type !== type) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${a.student_name} ${a.student_username} ${a.test_title || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [results, type, search]);

  return (
    <div>
      <div className="topbar-row">
        <div>
          <div className="welcome-title">Results</div>
          <div className="welcome-sub">Every attempt a student has submitted, newest first — updates as soon as they hit submit.</div>
        </div>
        <button className="btn secondary" onClick={refresh}>Refresh</button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <div className="type-tabs">
            <button type="button" className={'type-tab' + (type === 'all' ? ' active' : '')} onClick={() => setType('all')}>All</button>
            {Object.keys(TYPE_META).map(t => (
              <button type="button" key={t} className={'type-tab' + (type === t ? ' active' : '')} onClick={() => setType(t)}>
                <span className="type-tab-icon">{TYPE_META[t].icon}</span>{TYPE_META[t].label}
              </button>
            ))}
          </div>
          <input
            className="input"
            style={{ maxWidth: 260, marginLeft: 'auto' }}
            placeholder="Search student or test…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <table className="simple-table">
          <thead>
            <tr><th>Student</th><th>Test</th><th>Type</th><th>Score</th><th>Band</th><th>Status</th><th>Submitted</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id}>
                <td>{a.student_name}</td>
                <td>{a.test_title || '—'}</td>
                <td>{TYPE_META[a.test_type]?.icon} {TYPE_META[a.test_type]?.label || a.test_type}</td>
                <td>{a.score_total != null ? `${a.score_raw}/${a.score_total}` : '—'}</td>
                <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{bandOf(a) ?? '—'}</td>
                <td>{statusBadge(a)}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{new Date(a.finished_at).toLocaleString()}</td>
                <td>
                  <button
                    className="btn secondary"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    disabled={resettingId === a.id}
                    title={a.mock_id ? 'Delete this attempt so the student can retake this mock section' : 'Delete this attempt (standalone practice already allows retakes on its own)'}
                    onClick={() => resetAttempt(a)}
                  >
                    {resettingId === a.id ? 'Resetting…' : 'Allow retake'}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} style={{ color: 'var(--text-muted)' }}>No results yet.</td></tr>
            )}
            {loading && (
              <tr><td colSpan={8} style={{ color: 'var(--text-muted)' }}>Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
