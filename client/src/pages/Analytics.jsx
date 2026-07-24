import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../api/client';
import { displayBand, isRevealed } from '../utils/band';

const SECTIONS = ['reading', 'listening', 'writing'];
const COLOR = { reading: '#2a6c96', listening: '#3a8a17', writing: '#d97706' };

// Colour thresholds for the weak-areas breakdown: green when a skill is
// solidly in hand, yellow when it needs attention, red when it's the
// priority to work on next.
function rateColor(rate) {
  if (rate == null) return 'var(--text-muted)';
  if (rate >= 0.75) return 'var(--ok)';
  if (rate >= 0.5) return 'var(--warn)';
  return 'var(--bad)';
}
function rateSoft(rate) {
  if (rate == null) return 'var(--surface)';
  if (rate >= 0.75) return 'var(--ok-soft)';
  if (rate >= 0.5) return 'var(--warn-soft)';
  return 'var(--bad-soft)';
}

export default function Analytics() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialSection = params.get('section') || 'reading';
  const attemptParam = params.get('attempt');
  const [section, setSection] = useState(initialSection);
  const [attempts, setAttempts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [weakAreas, setWeakAreas] = useState([]);

  useEffect(() => {
    if (attemptParam) {
      api.getAttempt(attemptParam).then(a => { setSelected(a); setSection(a.test_type); });
    }
  }, [attemptParam]);

  useEffect(() => {
    api.myAttempts(section).then(setAttempts);
  }, [section]);

  // Skill-type breakdown — only meaningful for reading/listening, since
  // question types (Note Completion, Matching Headings, etc.) are detected
  // from those tests' own HTML structure. Writing has no equivalent.
  useEffect(() => {
    if (section !== 'reading' && section !== 'listening') { setWeakAreas([]); return; }
    api.weakAreas(section).then(setWeakAreas).catch(() => setWeakAreas([]));
  }, [section]);

  // Reading/listening are marked out of 40 raw questions — charting the raw
  // score is far more meaningful than the 0-9 band, which some test files
  // don't even estimate. Writing (and speaking) stay on the 0-9 band scale.
  const isScored = section === 'reading' || section === 'listening';
  const yDomain = isScored ? [0, 40] : [0, 9];

  // Single-passage (reading) / single-part (listening) practice attempts are
  // not comparable to a full test's score, so they're kept out of the score
  // history graph entirely — only full-test attempts get plotted. Attempts
  // with no linked test row (part_scope null — writing/speaking, or a test
  // that's since been deleted) are treated as full, not partial.
  const isFullAttempt = a => a.part_scope !== 'part';
  const fullAttempts = attempts.filter(isFullAttempt);
  const chartData = fullAttempts.map((a, i) => ({
    name: `#${i + 1}`,
    value: isScored ? (isRevealed(a) ? a.score_raw : null) : displayBand(a),
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
        <h3>{section[0].toUpperCase() + section.slice(1)} {isScored ? 'score' : 'band'} history</h3>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>
          Full-test attempts only — single passage/part practice isn't plotted here.
        </div>
        <div style={{ height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
              <YAxis domain={yDomain} stroke="var(--text-muted)" fontSize={12} allowDecimals={!isScored} />
              <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.date} />
              <Line type="monotone" dataKey="value" stroke={COLOR[section]} strokeWidth={2} dot={{ r: 4 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {(section === 'reading' || section === 'listening') && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>Areas that need the most work</h3>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
            Question types are detected automatically from every test you take — no tagging needed. Based on all your {section} attempts so far.
          </div>
          {weakAreas.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>Complete a {section} test to see your skill breakdown here.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {weakAreas.map(w => (
                <div key={w.qtype} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 200, fontSize: 14 }}>{w.qtype}</div>
                  <div style={{ flex: 1, height: 10, borderRadius: 6, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${w.rate == null ? 0 : Math.round(w.rate * 100)}%`,
                      height: '100%',
                      background: rateColor(w.rate),
                      borderRadius: 6
                    }} />
                  </div>
                  <div style={{
                    minWidth: 92, textAlign: 'right', fontSize: 13, fontWeight: 700,
                    color: rateColor(w.rate), background: rateSoft(w.rate),
                    padding: '2px 8px', borderRadius: 20
                  }}>
                    {w.rate == null ? '—' : `${Math.round(w.rate * 100)}%`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h3>Attempt history</h3>
        <table className="simple-table">
          <thead><tr><th>#</th><th>Date</th><th>Scope</th><th>Score</th><th>Band</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {attempts.map((a, i) => (
              <tr key={a.id}>
                <td>{i + 1}</td>
                <td>{new Date(a.finished_at).toLocaleString()}</td>
                <td>
                  {a.part_scope === 'part'
                    ? <span className="badge pending">{section === 'reading' ? `Passage ${a.part_number ?? ''}` : `Part ${a.part_number ?? ''}`}</span>
                    : <span className="badge reviewed">Full test</span>}
                </td>
                <td>{isRevealed(a) && a.score_raw != null ? `${a.score_raw}/${a.score_total}` : '—'}</td>
                <td>{displayBand(a) ?? '—'}</td>
                <td>{a.status === 'pending_review' ? <span className="badge pending">Awaiting review</span> : <span className="badge reviewed">{a.status}</span>}</td>
                <td>
                  {a.mock_id ? (
                    <button className="btn secondary" disabled title="Mock section — see Mock Results for your score">Analyze</button>
                  ) : a.test_type !== 'writing' && a.status === 'pending_review' ? (
                    <button className="btn secondary" disabled title="Available once your teacher approves this result">Analyze</button>
                  ) : (
                    <button className="btn secondary" onClick={() => navigate(`/practice/${section}/${a.test_id}/review/${a.id}`)}>Analyze</button>
                  )}
                </td>
              </tr>
            ))}
            {attempts.length === 0 && <tr><td colSpan={7} style={{ color: 'var(--text-muted)' }}>No attempts yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
