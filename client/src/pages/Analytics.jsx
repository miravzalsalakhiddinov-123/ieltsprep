import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../api/client';

const SECTIONS = ['reading', 'listening', 'writing'];
const COLOR = { reading: '#2a6c96', listening: '#3a8a17', writing: '#d97706' };

export default function Analytics() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialSection = params.get('section') || 'reading';
  const attemptParam = params.get('attempt');
  const [section, setSection] = useState(initialSection);
  const [attempts, setAttempts] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (attemptParam) {
      api.getAttempt(attemptParam).then(a => { setSelected(a); setSection(a.test_type); });
    }
  }, [attemptParam]);

  useEffect(() => {
    api.myAttempts(section).then(setAttempts);
  }, [section]);

  const chartData = attempts.map((a, i) => ({
    name: `#${i + 1}`,
    band: a.band_final ?? a.band_estimate,
    date: new Date(a.finished_at).toLocaleDateString()
  }));

  return (
    <div>
      <div className="topbar-row">
        <div>
          <div className="welcome-title">Analytics</div>
          <div className="welcome-sub">Track how your band score has changed over time.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {SECTIONS.map(s => (
            <button key={s} className="btn secondary"
              style={{ borderColor: section === s ? COLOR[s] : 'var(--border)', color: section === s ? COLOR[s] : 'var(--text)' }}
              onClick={() => { setSection(s); setSelected(null); }}>
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3>{section[0].toUpperCase() + section.slice(1)} band history</h3>
        <div style={{ height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
              <YAxis domain={[0, 9]} stroke="var(--text-muted)" fontSize={12} />
              <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.date} />
              <Line type="monotone" dataKey="band" stroke={COLOR[section]} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3>Attempt history</h3>
        <table className="simple-table">
          <thead><tr><th>#</th><th>Date</th><th>Score</th><th>Band</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {attempts.map((a, i) => (
              <tr key={a.id}>
                <td>{i + 1}</td>
                <td>{new Date(a.finished_at).toLocaleString()}</td>
                <td>{a.score_raw != null ? `${a.score_raw}/${a.score_total}` : '—'}</td>
                <td>{a.band_final ?? a.band_estimate ?? '—'}</td>
                <td>{a.status === 'pending_review' ? <span className="badge pending">Awaiting review</span> : <span className="badge reviewed">{a.status}</span>}</td>
                <td><button className="btn secondary" onClick={() => navigate(`/practice/${section}/${a.test_id}/review/${a.id}`)}>Analyze</button></td>
              </tr>
            ))}
            {attempts.length === 0 && <tr><td colSpan={6} style={{ color: 'var(--text-muted)' }}>No attempts yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
