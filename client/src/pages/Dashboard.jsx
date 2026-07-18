import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const SECTION_COLORS = { reading: '#0f9d8f', listening: '#2a6c96', writing: '#d97706' };
const SECTIONS = ['reading', 'listening', 'writing', 'speaking'];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);
  const [latest, setLatest] = useState(null);
  const [inbox, setInbox] = useState([]);
  const [motivation, setMotivation] = useState(null);
  const [trend, setTrend] = useState([]);
  const [leaderboard, setLeaderboard] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api.progress().then(setProgress);
    api.latestResults().then(setLatest);
    api.inbox().then(rows => setInbox(rows.slice(0, 6)));
    api.latestMotivation().then(setMotivation);
    api.leaderboard().then(setLeaderboard);
    api.unreadCount().then(r => setUnreadCount(r?.count ?? 0));
    loadTrend();
  }, []);

  async function loadTrend() {
    const [reading, listening, writing] = await Promise.all([
      api.myAttempts('reading'), api.myAttempts('listening'), api.myAttempts('writing')
    ]);
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

  function bandDisplay(a) {
    if (!a) return '–';
    const band = a.band_final ?? a.band_estimate;
    if (band != null) return band;
    return a.status === 'pending_review' ? 'Pending' : '–';
  }
  function overall(l) {
    if (!l) return '–';
    const vals = SECTIONS.map(s => l[s] ? (l[s].band_final ?? l[s].band_estimate) : null).filter(v => v != null);
    if (!vals.length) return '–';
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  }

  const pct = progress?.overallPercent ?? 0;
  const testsCompleted = progress ? Object.values(progress.byType).reduce((a, t) => a + t.done, 0) : 0;
  const initial = (user?.name || '?').trim().charAt(0).toUpperCase();

  return (
    <div>
      {/* ---- Top bar: take a test, notifications, inbox, user chip ---- */}
      <div className="dash-topbar">
        <button className="pill-btn" onClick={() => navigate('/practice')}>Take a Test</button>
        <div className="dash-icons">
          <button className="icon-circle" title="Notifications">🔔</button>
          <button className="icon-circle" title="Inbox" onClick={() => document.getElementById('inbox-card')?.scrollIntoView({ behavior: 'smooth' })}>
            ✉️
            {unreadCount > 0 && <span className="icon-badge">{unreadCount}</span>}
          </button>
          <div className="user-chip">
            <span className="user-chip-name">{user?.name}</span>
            <div className="avatar-circle">{initial}</div>
          </div>
        </div>
      </div>

      {/* ---- Latest scores + accent cards ---- */}
      <div className="dash-scores-row">
        {SECTIONS.map(s => (
          <div className="score-card" key={s}>
            <div className="score-card-label">{s[0].toUpperCase() + s.slice(1)}</div>
            <div className="score-card-value">{bandDisplay(latest?.[s])}</div>
            <button className="pill-btn secondary" onClick={() => navigate(s === 'speaking' ? '/mock' : `/practice`)}>Take Test</button>
          </div>
        ))}
        <div className="accent-card">
          <div className="accent-card-label">Overall Band</div>
          <div className="accent-card-value">{overall(latest)}</div>
          <button className="pill-btn ghost" onClick={() => navigate('/analytics')}>View History</button>
        </div>
        <div className="accent-card">
          <div className="accent-card-label">Tests Completed</div>
          <div className="accent-card-value">{testsCompleted}</div>
          <button className="pill-btn ghost" onClick={() => navigate('/lessons')}>Study Lessons</button>
        </div>
      </div>

      {/* ---- Score trend + completion ring ---- */}
      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <h3>Score Mapping</h3>
          <div style={{ height: 200 }}>
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

        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h3 style={{ alignSelf: 'flex-start' }}>Completion</h3>
          <div className="ring-wrap">
            <div className="ring" style={{ background: `conic-gradient(var(--accent) ${pct * 3.6}deg, var(--surface-alt) 0deg)` }}>
              <div className="ring-hole">
                <div className="ring-pct">{pct}%</div>
                <div className="ring-label">materials<br />completed</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Top students (reading & listening) ---- */}
      <div className="card" style={{ marginBottom: 18 }}>
        <h3>🏆 Top Students</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -6, marginBottom: 14 }}>Highest band ever recorded, per section.</p>
        <div className="leaderboard-row">
          {['reading', 'listening'].map(s => {
            const top = leaderboard?.[s];
            return (
              <div className="leaderboard-card" key={s}>
                <div className="leaderboard-avatar">{top ? top.name.trim().charAt(0).toUpperCase() : '–'}</div>
                <div>
                  <div className="leaderboard-name">{top ? top.name : 'No results yet'}</div>
                  <div className="leaderboard-sub">{s[0].toUpperCase() + s.slice(1)} · Band {top ? top.band : '–'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Inbox + Motivation ---- */}
      <div className="grid grid-2">
        <div className="card" id="inbox-card">
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

        <div className="card motivation-square">
          <span className="motivation-eyebrow">⚡ Daily Boost</span>
          <div className="motivation-square-icon">🔥</div>
          <div className="motivation-square-text">
            {motivation ? motivation.message : 'Keep going — every practice test brings you closer to your target band.'}
          </div>
        </div>
      </div>
    </div>
  );
}
