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

  function refresh() {
    setLoading(true);
    api.allResults().then(rows => { setResults(rows); setLoading(false); }).catch(() => setLoading(false));
  }
  useEffect(refresh, []);

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
            <tr><th>Student</th><th>Test</th><th>Type</th><th>Score</th><th>Band</th><th>Status</th><th>Submitted</th></tr>
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
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} style={{ color: 'var(--text-muted)' }}>No results yet.</td></tr>
            )}
            {loading && (
              <tr><td colSpan={7} style={{ color: 'var(--text-muted)' }}>Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
