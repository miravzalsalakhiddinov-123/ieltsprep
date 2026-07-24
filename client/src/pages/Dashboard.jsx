import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Bell, Trophy, Zap, Flame } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { roundBand, displayBand } from '../utils/band';

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
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    api.progress().then(setProgress);
    api.latestResults().then(setLatest);
    api.inbox().then(rows => setInbox(rows.slice(0, 12)));
    api.latestMotivation().then(setMotivation);
    api.leaderboard().then(setLeaderboard);
    api.unreadCount().then(r => setUnreadCount(r?.count ?? 0));
    loadTrend();
  }, []);

  useEffect(() => {
    function onClick(e) { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
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
        reading: reading[i] ? displayBand(reading[i]) : null,
        listening: listening[i] ? displayBand(listening[i]) : null,
        writing: writing[i] ? displayBand(writing[i]) : null
      });
    }
    setTrend(rows);
  }

  async function openMessage(m) {
    if (!m.read_at) await api.markRead(m.id);
    if (m.attempt_mock_id) navigate(`/mock/results/${m.attempt_mock_id}`);
    else if (m.attempt_id) navigate(`/analytics?attempt=${m.attempt_id}`);
    else setInbox(rows => rows.map(r => r.id === m.id ? { ...r, read_at: r.read_at || 'now' } : r));
  }
  function bandDisplay(a) {
    if (!a) return '–';
    const band = displayBand(a);
    if (band != null) return band;
    return a.status === 'pending_review' ? 'Pending' : '–';
  }
  function overall(l) {
    if (!l) return '–';
    const vals = SECTIONS.map(s => l[s] ? displayBand(l[s]) : null).filter(v => v != null);
    if (!vals.length) return '–';
    return roundBand(vals.reduce((a, b) => a + b, 0) / vals.length);
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
          <div className="notif-wrap" ref={notifRef}>
            <button className="icon-circle" title="Inbox" onClick={() => setNotifOpen(o => !o)}>
              <Bell size={18} strokeWidth={2} />
              {unreadCount > 0 && <span className="icon-badge">{unreadCount}</span>}
            </button>
            {notifOpen && (
              <div className="notif-menu">
                <div className="notif-menu-title">Inbox</div>
                <div className="notif-menu-list">
                  {inbox.length === 0 && <div className="notif-menu-empty">No messages yet.</div>}
                  {inbox.map(m => (
                    <div key={m.id} className={'notif-menu-item' + (!m.read_at ? ' unread' : '')}
                      onClick={() => { openMessage(m); setNotifOpen(false); }}>
                      <div className="notif-menu-from">{m.from_name} · {new Date(m.created_at).toLocaleDateString()}</div>
                      <div className="notif-menu-body">{m.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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

      {/* ---- Score trend + completion ring + motivation, compact ---- */}
      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <div className="card compact">
          <h3>Score Mapping</h3>
          <div style={{ height: 130 }}>
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                <YAxis domain={[0, 9]} stroke="var(--text-muted)" fontSize={11} width={22} />
                <Tooltip />
                <Line type="monotone" dataKey="reading" stroke={SECTION_COLORS.reading} connectNulls dot={{ r: 2 }} strokeWidth={2} />
                <Line type="monotone" dataKey="listening" stroke={SECTION_COLORS.listening} connectNulls dot={{ r: 2 }} strokeWidth={2} />
                <Line type="monotone" dataKey="writing" stroke={SECTION_COLORS.writing} connectNulls dot={{ r: 2 }} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {['reading', 'listening', 'writing'].map(s => (
              <button key={s} className="btn secondary" style={{ padding: '5px 10px', fontSize: 12.5, borderColor: SECTION_COLORS[s], color: SECTION_COLORS[s] }}
                onClick={() => navigate(`/analytics?section=${s}`)}>
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="card compact" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h3 style={{ alignSelf: 'flex-start' }}>Completion</h3>
          <div className="ring-wrap compact">
            <div className="ring compact" style={{ background: `conic-gradient(var(--accent) ${pct * 3.6}deg, var(--surface-alt) 0deg)` }}>
              <div className="ring-hole compact">
                <div className="ring-pct">{pct}%</div>
                <div className="ring-label">materials<br />completed</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card motivation-square compact">
          <span className="motivation-eyebrow small"><Zap size={12} strokeWidth={2.5} /> Daily Boost</span>
          <div className="motivation-square-icon"><Flame size={22} strokeWidth={2} /></div>
          <div className="motivation-square-text">
            {motivation ? motivation.message : 'Keep going — every practice test brings you closer to your target band.'}
          </div>
        </div>
      </div>

      {/* ---- Top students (reading & listening) ---- */}
      <div className="card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={18} strokeWidth={2} color="var(--warn)" /> Top Students</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -6, marginBottom: 14 }}>Best correct-answer count, per section.</p>
        <div className="leaderboard-row">
          {['reading', 'listening'].map(s => {
            const rows = leaderboard?.[s] || [];
            return (
              <div className="leaderboard-col" key={s}>
                <div className="leaderboard-col-title">{s[0].toUpperCase() + s.slice(1)}</div>
                {rows.length === 0 && <div className="leaderboard-empty">No results yet.</div>}
                {rows.map((row, i) => (
                  <div className="leaderboard-card" key={i}>
                    <div className="leaderboard-rank">{i + 1}</div>
                    <div className="leaderboard-avatar">{row.name.trim().charAt(0).toUpperCase()}</div>
                    <div>
                      <div className="leaderboard-name">{row.name}</div>
                      <div className="leaderboard-sub">{row.score_raw}/{row.score_total} correct</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
