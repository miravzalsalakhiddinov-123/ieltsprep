import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BookOpen, Headphones, PenLine, TrendingUp, Award, ListChecks, Target, Inbox, ChevronDown } from 'lucide-react';
import { api } from '../api/client';
import { displayBand, isRevealed, roundBand } from '../utils/band';

const SECTIONS = ['reading', 'listening', 'writing'];
const SECTION_ICON = { reading: BookOpen, listening: Headphones, writing: PenLine };
const COLOR = { reading: '#2a6c96', listening: '#3a8a17', writing: '#d97706' };
const COLOR_SOFT = {
  reading: 'color-mix(in srgb, #2a6c96 15%, transparent)',
  listening: 'color-mix(in srgb, #3a8a17 15%, transparent)',
  writing: 'color-mix(in srgb, #d97706 15%, transparent)'
};

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
  const [historyOpen, setHistoryOpen] = useState(false);

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

  const summary = useMemo(() => {
    const values = chartData.map(d => d.value).filter(v => v != null);
    if (values.length === 0) return { avg: null, best: null, latest: null, count: fullAttempts.length };
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return {
      avg: isScored ? Math.round(avg * 10) / 10 : roundBand(avg),
      best: Math.max(...values),
      latest: values[values.length - 1],
      count: fullAttempts.length
    };
  }, [chartData, fullAttempts.length, isScored]);

  const SectionIcon = SECTION_ICON[section];

  return (
    <div>
      <div className="section-head">
        <div>
          <div className="section-head-title">Analytics</div>
          <div className="section-head-sub">Track how your band score has changed over time, and see exactly which skills need the most work.</div>
        </div>
        <div className="seg-tabs" style={{ '--seg-accent': COLOR[section] }}>
          {SECTIONS.map(s => {
            const Icon = SECTION_ICON[s];
            return (
              <button key={s} className={'seg-tab' + (section === s ? ' active' : '')}
                style={section === s ? { color: COLOR[s] } : undefined}
                onClick={() => { setSection(s); setSelected(null); }}>
                <Icon size={15} strokeWidth={2} />{s[0].toUpperCase() + s.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-tile" style={{ '--tile-accent': COLOR[section], '--tile-accent-soft': COLOR_SOFT[section] }}>
          <div className="metric-tile-icon"><Target size={18} strokeWidth={2} /></div>
          <div>
            <div className="metric-tile-value">{summary.avg ?? '—'}</div>
            <div className="metric-tile-label">Average {isScored ? 'score' : 'band'}</div>
          </div>
        </div>
        <div className="metric-tile" style={{ '--tile-accent': COLOR[section], '--tile-accent-soft': COLOR_SOFT[section] }}>
          <div className="metric-tile-icon"><Award size={18} strokeWidth={2} /></div>
          <div>
            <div className="metric-tile-value">{summary.best ?? '—'}</div>
            <div className="metric-tile-label">Highest {isScored ? 'score' : 'band'}</div>
          </div>
        </div>
        <div className="metric-tile" style={{ '--tile-accent': COLOR[section], '--tile-accent-soft': COLOR_SOFT[section] }}>
          <div className="metric-tile-icon"><TrendingUp size={18} strokeWidth={2} /></div>
          <div>
            <div className="metric-tile-value">{summary.latest ?? '—'}</div>
            <div className="metric-tile-label">Most recent</div>
          </div>
        </div>
        <div className="metric-tile" style={{ '--tile-accent': COLOR[section], '--tile-accent-soft': COLOR_SOFT[section] }}>
          <div className="metric-tile-icon"><ListChecks size={18} strokeWidth={2} /></div>
          <div>
            <div className="metric-tile-value">{summary.count}</div>
            <div className="metric-tile-label">Full tests taken</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SectionIcon size={17} strokeWidth={2} color={COLOR[section]} />
          {section[0].toUpperCase() + section.slice(1)} {isScored ? 'score' : 'band'} history
        </h3>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>
          Full-test attempts only — single passage/part practice isn't plotted here.
        </div>
        {chartData.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><TrendingUp size={22} strokeWidth={2} /></div>
            <div className="empty-state-title">No full tests yet</div>
            <div className="empty-state-sub">Complete a full {section} test and your score history will show up here.</div>
          </div>
        ) : (
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
        )}
      </div>

      {(section === 'reading' || section === 'listening') && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>Areas that need the most work</h3>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>
            Question types are detected automatically from every test you take — no tagging needed. Based on all your {section} attempts so far.
          </div>
          {weakAreas.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><ListChecks size={22} strokeWidth={2} /></div>
              <div className="empty-state-title">No skill data yet</div>
              <div className="empty-state-sub">Complete a {section} test to see your skill breakdown here.</div>
            </div>
          ) : (
            <div style={{ marginTop: 6 }}>
              {weakAreas.map(w => (
                <div className="weak-row" key={w.qtype}>
                  <div className="weak-row-label">{w.qtype}</div>
                  <div className="weak-row-track">
                    <div className="weak-row-fill" style={{
                      width: `${w.rate == null ? 0 : Math.round(w.rate * 100)}%`,
                      background: rateColor(w.rate)
                    }} />
                  </div>
                  <div className="weak-row-pct" style={{ color: rateColor(w.rate), background: rateSoft(w.rate) }}>
                    {w.rate == null ? '—' : `${Math.round(w.rate * 100)}%`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <button type="button" className="dropdown-toggle" style={{ marginBottom: historyOpen ? 14 : 0 }} onClick={() => setHistoryOpen(o => !o)}>
          <h3 style={{ margin: 0 }}>Attempt history <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>({attempts.length})</span></h3>
          <ChevronDown size={18} strokeWidth={2.2} className={historyOpen ? 'dropdown-chevron open' : 'dropdown-chevron'} />
        </button>
        {historyOpen && (attempts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Inbox size={22} strokeWidth={2} /></div>
            <div className="empty-state-title">No attempts yet</div>
            <div className="empty-state-sub">Every {section} attempt you complete will show up in this table.</div>
          </div>
        ) : (
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
                    {a.status === 'pending_review' ? (
                      <button className="btn secondary" disabled title="Available once your teacher approves this result">Analyze</button>
                    ) : (
                      <button className="btn secondary" onClick={() => navigate(`/practice/${section}/${a.test_id}/review/${a.id}`)}>Analyze</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  );
}
