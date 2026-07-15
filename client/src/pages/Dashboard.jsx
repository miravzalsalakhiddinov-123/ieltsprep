import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const COLORS = ['#2a6c96', '#e1e3e8'];
const SECTION_COLORS = { reading: '#2a6c96', listening: '#3a8a17', writing: '#d97706' };

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);
  const [latest, setLatest] = useState(null);
  const [inbox, setInbox] = useState([]);
  const [motivation, setMotivation] = useState(null);
  const [trend, setTrend] = useState([]);

  useEffect(() => {
    api.progress().then(setProgress);
    api.latestResults().then(setLatest);
    api.inbox().then(rows => setInbox(rows.slice(0, 6)));
    api.latestMotivation().then(setMotivation);
    loadTrend();
  }, []);

  async function loadTrend() {
    const [reading, listening, writing] = await Promise.all([
      api.myAttempts('reading'), api.myAttempts('listening'), api.myAttempts('writing')
    ]);
    // merge into a single series indexed by attempt order, keyed by section
    const maxLen = Math.max(reading.length, listening.length, writing.length);
    const rows = [];
    for (let i = 0; i < maxLen; i++) {
      rows.push({
        name: `#${i + 1}`,
        reading: reading[i] ? reading[i].band_final ?? reading[i].band_estimate : null,
        listening: listening[i] ? listening[i].band_final ?? listening[i].band_estimate : null,
        writing: writing[i] ? writing[i].band_final ?? writing[i].band_estimate : null
      });
    }
    setTrend(rows);
  }

  async function openMessage(m) {
    if (!m.read_at) await api.markRead(m.id);
    if (m.attempt_id) navigate(`/analytics?attempt=${m.attempt_id}`);
    else setInbox(rows => rows.map(r => r.id === m.id ? { ...r, read_at: r.read_at || 'now' } : r));
  }

  const pieData = progress ? [
    { name: 'Completed', value: progress.overallPercent },
    { name: 'Remaining', value: 100 - progress.overallPercent }
  ] : [];

  function fmt(v) { return v === null || v === undefined ? '–' : v; }
  // Reading/listening are marked out of ~40 raw questions, which is always
  // available right after submission — the band estimate depends on the
  // test file defining estimateBand() and can be null. Showing the raw
  // score means this card doesn't look empty just because a band wasn't
  // computed.
  function scoreDisplay(a) {
    if (!a) return '–';
    if (a.score_total != null) return `${a.score_raw ?? 0}/${a.score_total}`;
    const band = a.band_final ?? a.band_estimate;
    return band != null ? band : '–';
  }
  function bandDisplay(a) {
    if (!a) return '–';
    const band = a.band_final ?? a.band_estimate;
    if (band != null) return band;
    return a.status === 'pending_review' ? 'Pending' : '–';
  }
  function overall(l) {
    if (!l) return '–';
    const vals = ['reading', 'listening', 'writing', 'speaking']
      .map(s => l[s] ? (l[s].band_final ?? l[s].band_estimate) : null)
      .filter(v => v !== null && v !== undefined);
    if (!vals.length) return '–';
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  }

  return (
    <div>
      <div className="topbar-row">
        <div>
          <div className="welcome-title">Welcome back, {user?.name}!</div>
          <div className="welcome-sub">Here's how your preparation is going.</div>
        </div>
      </div>

      {motivation && <div className="motivation-banner">💬 {motivation.message}</div>}

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <h3>Overall completion</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 160, height: 160 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={45} outerRadius={70} startAngle={90} endAngle={-270}>
                    {pieData.map((entry, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent)' }}>{progress?.overallPercent ?? 0}%</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>of all materials completed</div>
              {progress && (
                <div style={{ marginTop: 10, fontSize: 13 }}>
                  {['reading', 'listening', 'writing'].map(t => (
                    <div key={t}>{t[0].toUpperCase() + t.slice(1)}: {progress.byType[t].done}/{progress.byType[t].total}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Score trend — click a section below to open full analytics</h3>
          <div style={{ height: 160 }}>
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                <YAxis domain={[0, 9]} stroke="var(--text-muted)" fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="reading" stroke={SECTION_COLORS.reading} connectNulls dot={{ r: 3 }} />
                <Line type="monotone" dataKey="listening" stroke={SECTION_COLORS.listening} connectNulls dot={{ r: 3 }} />
                <Line type="monotone" dataKey="writing" stroke={SECTION_COLORS.writing} connectNulls dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {['reading', 'listening', 'writing'].map(s => (
              <button key={s} className="btn secondary" style={{ borderColor: SECTION_COLORS[s], color: SECTION_COLORS[s] }}
                onClick={() => navigate(`/analytics?section=${s}`)}>
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Latest results</h3>
          <div className="stat-row">
            <div className="stat-chip"><div className="val" style={{ fontSize: 18 }}>{scoreDisplay(latest?.reading)}</div><div className="lbl">Reading</div></div>
            <div className="stat-chip"><div className="val" style={{ fontSize: 18 }}>{scoreDisplay(latest?.listening)}</div><div className="lbl">Listening</div></div>
            <div className="stat-chip"><div className="val" style={{ fontSize: 18 }}>{bandDisplay(latest?.writing)}</div><div className="lbl">Writing</div></div>
            <div className="stat-chip"><div className="val" style={{ fontSize: 18 }}>{fmt(latest?.speaking ? latest.speaking.band_final : null)}</div><div className="lbl">Speaking</div></div>
            <div className="stat-chip"><div className="val" style={{ color: 'var(--ok)' }}>{overall(latest)}</div><div className="lbl">Overall</div></div>
          </div>
        </div>

        <div className="card">
          <h3>Inbox</h3>
          <div className="inbox-list">
            {inbox.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No messages yet.</div>}
            {inbox.map(m => (
              <div key={m.id} className={'inbox-item' + (!m.read_at ? ' unread' : '')} onClick={() => openMessage(m)}>
                <div className="from">{m.from_name} · {new Date(m.created_at).toLocaleDateString()}</div>
                <div>{m.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
