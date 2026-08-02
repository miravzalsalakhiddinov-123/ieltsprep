import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Bell, Trophy, Zap, Flame, Target, CheckCircle2, BookOpen, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { roundBand, displayBand } from '../utils/band';

const SECTION_COLORS = { reading: '#5651c9', listening: '#2e9aa6', writing: '#b97a1f' };
const SECTIONS = ['reading', 'listening', 'writing', 'speaking'];
const LISTENING_LINE = '#2fbf88';

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
  const firstName = (user?.name || '').trim().split(/\s+/)[0] || 'there';

  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  // "What should I study next?" — pick the practice-able skill (reading,
  // listening, writing) with the lowest revealed band so far. Speaking is
  // excluded since it's scored manually and isn't something students queue
  // up for themselves from here.
  const focusSection = (() => {
    const scored = ['reading', 'listening', 'writing']
      .map(s => ({ s, band: latest?.[s] ? displayBand(latest[s]) : null }))
      .filter(x => x.band != null);
    if (!scored.length) return null;
    return scored.reduce((min, cur) => (cur.band < min.band ? cur : min));
  })();

  return (
    <div>
      {/* ---- Top bar: greeting, take a test, notifications, inbox, user chip ---- */}
      <div className="dash-topbar">
        <div>
          <div className="welcome-title">{greeting}, {firstName}</div>
          <div className="welcome-sub">{today} · here's where you stand today.</div>
        </div>
        <div className="dash-icons">
          <button className="pill-btn" onClick={() => navigate('/practice')}>Take a Test</button>
          <div className="notif-wrap" ref={notifRef}>
            <button className="icon-circle" title="Inbox" aria-label={`Inbox${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`} aria-haspopup="true" aria-expanded={notifOpen} onClick={() => setNotifOpen(o => !o)}>
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

      {/* ---- "What should I study next?" — surfaces the weakest scored skill ---- */}
      {focusSection && (
        <div className="card" style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div className="hub-card-icon" style={{ '--card-accent': SECTION_COLORS[focusSection.s], width: 44, height: 44, borderRadius: 14, margin: 0, flexShrink: 0 }}>
            <Target size={20} strokeWidth={2} color={SECTION_COLORS[focusSection.s]} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>
              Focus next: {focusSection.s[0].toUpperCase() + focusSection.s.slice(1)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              Your current {focusSection.s} band ({focusSection.band}) is your lowest — a bit more practice here will move your overall band the most.
            </div>
          </div>
          <button className="pill-btn" onClick={() => navigate('/practice')}>Practice {focusSection.s[0].toUpperCase() + focusSection.s.slice(1)}</button>
        </div>
      )}

      {/* ---- Hero row: inline scores + overall band, and a side stack of stats ---- */}
      <div className="dash-hero-row">
        <div className="hero-scores-card">
          <div className="hero-scores-grid">
            {SECTIONS.map(s => (
              <div className="hero-score-pair" key={s} onClick={() => navigate(s === 'speaking' ? '/mock' : '/practice')}>
                {s[0].toUpperCase() + s.slice(1)}: <b>{bandDisplay(latest?.[s])}</b>
              </div>
            ))}
          </div>
          <div className="hero-overall">
            <div className="hero-overall-value">{overall(latest)}</div>
            <button className="pill-btn secondary" onClick={() => navigate('/analytics')}>View History</button>
          </div>
        </div>

        <div className="dash-hero-side">
          <div className="hero-stat-card">
            <div className="hero-stat-icon"><CheckCircle2 size={18} strokeWidth={2.4} /></div>
            <div className="val">{testsCompleted}</div>
            <div className="lbl">Tests completed</div>
          </div>
          <div className="hero-mini-card" onClick={() => navigate('/lessons')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BookOpen size={16} strokeWidth={2.2} color="var(--accent)" />
              <span>Study lessons</span>
            </div>
            <ArrowUpRight size={16} strokeWidth={2.2} color="var(--text-muted)" />
          </div>
        </div>
      </div>

      {/* ---- Listening trend + completion pie + motivation, deliberately uneven sizes ---- */}
      <div className="dash-bento-row">
        <div className="card listening-card">
          <h3>Listening</h3>
          <div style={{ height: 140 }}>
            <ResponsiveContainer>
              <AreaChart data={trend} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="listeningFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={LISTENING_LINE} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={LISTENING_LINE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis domain={[0, 9]} stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="listening" stroke={LISTENING_LINE} strokeWidth={2.5}
                  fill="url(#listeningFill)" connectNulls dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card pie-card">
          <h3 style={{ alignSelf: 'flex-start' }}>Completed</h3>
          <div className="pie-wrap">
            <div className="pie" style={{ background: `conic-gradient(var(--accent) ${pct * 3.6}deg, var(--bad) 0deg)` }} />
            <div className="pie-badge">
              <div className="pct">{pct}%</div>
              <div className="lbl">done</div>
            </div>
          </div>
        </div>

        <div className="card motivation-square motivation-bento">
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
