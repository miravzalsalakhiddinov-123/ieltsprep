import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Headphones, PenLine, Mic, PlayCircle, CheckCircle2, Clock3, FileStack, Eye } from 'lucide-react';
import { api } from '../api/client';

const SECTION_ORDER = ['listening', 'reading', 'writing'];
const SECTION_META = {
  listening: { icon: Headphones, color: '#2e9aa6' },
  reading: { icon: BookOpen, color: 'var(--accent)' },
  writing: { icon: PenLine, color: 'var(--warn)' },
  speaking: { icon: Mic, color: '#a855f7' }
};

function orderedTests(mock) {
  const inOrder = SECTION_ORDER.map(t => mock.tests.find(x => x.type === t)).filter(Boolean);
  const rest = mock.tests.filter(t => !SECTION_ORDER.includes(t.type));
  return [...inOrder, ...rest];
}

export default function MockCenter() {
  const [mocks, setMocks] = useState([]);
  const [attemptsByTest, setAttemptsByTest] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  function refresh() {
    setLoading(true);
    setError(null);
    Promise.all([api.listMocks(), api.myAttempts()])
      .then(([rows, all]) => {
        setMocks(rows);
        const map = {};
        all.forEach(a => { if (a.test_id) map[a.test_id] = a; });
        setAttemptsByTest(map);
        setLoading(false);
      })
      .catch(err => {
        console.error('Could not load Mock Center', err);
        setError(err.message || 'Could not load your mocks. Check your connection and try again.');
        setLoading(false);
      });
  }

  useEffect(refresh, []);

  if (error) {
    return (
      <div className="main-content" style={{ maxWidth: 620, margin: '0 auto' }}>
        <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
          <h3 style={{ marginBottom: 6 }}>Couldn't load Mock Center</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 18 }}>{error}</p>
          <button className="btn" onClick={refresh}>Try again</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="main-content" style={{ maxWidth: 620, margin: '0 auto' }}>
        <div className="card" style={{ textAlign: 'center', padding: '48px 32px', color: 'var(--text-muted)' }}>
          Loading your mocks…
        </div>
      </div>
    );
  }

  function startFullMock(mock) {
    const queue = orderedTests(mock).map(t => ({ id: t.id, type: t.type, title: t.title }));
    if (!queue.length) return;
    // Store the FULL queue, current section included as the head. TestRunner
    // always just drops the head to move on — no guesswork about "which one
    // is current", so a section can never accidentally be skipped.
    try { sessionStorage.setItem(`mockQueue_${mock.id}`, JSON.stringify(queue)); } catch {}
    navigate(`/practice/${queue[0].type}/${queue[0].id}?mock=${mock.id}&seq=1`);
  }

  return (
    <div>
      <div className="section-head">
        <div>
          <div className="section-head-title">Full Mock Tests</div>
          <div className="section-head-sub">Sit a complete test under real exam conditions — listening, reading, and writing back to back, scores revealed at the end.</div>
        </div>
      </div>

      {mocks.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><FileStack size={22} strokeWidth={2} /></div>
            <div className="empty-state-title">No mock tests yet</div>
            <div className="empty-state-sub">Ask your teacher to create one from the admin panel.</div>
          </div>
        </div>
      )}

      {mocks.map(mock => {
        const sections = orderedTests(mock);
        const doneCount = sections.filter(t => !!attemptsByTest[t.id]).length;
        const pct = sections.length ? Math.round((doneCount / sections.length) * 100) : 0;
        return (
          <div className="card" key={mock.id} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 6 }}>
              <div>
                <h3 style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileStack size={18} strokeWidth={2} color="var(--accent)" />{mock.title}
                </h3>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {sections.length} section{sections.length === 1 ? '' : 's'} · {doneCount} of {sections.length} completed
                </div>
              </div>
              {mock.tests.length > 0 && (
                doneCount === sections.length ? (
                  <button className="pill-btn secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => navigate(`/mock/results/${mock.id}`)}>
                    <Eye size={15} strokeWidth={2} /> View Results
                  </button>
                ) : (
                  <button className="pill-btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => startFullMock(mock)}>
                    <PlayCircle size={15} strokeWidth={2} /> Start Full Mock
                  </button>
                )
              )}
            </div>

            <div className="vocab-progress-bar" style={{ marginBottom: 16 }}>
              <div className="vocab-progress-fill" style={{ width: `${pct}%` }} />
            </div>

            <div className="test-list">
              {sections.map(t => {
                const attempt = attemptsByTest[t.id];
                const pending = attempt && attempt.status === 'pending_review';
                // Mock sections are one-shot: once there's any attempt at all,
                // this item is done — no retake, and no click-through to the
                // per-test Analyze view either (that's blocked server-side too;
                // mock results only ever show on the Mock Results page).
                const locked = !!attempt;
                const meta = SECTION_META[t.type] || SECTION_META.reading;
                const Icon = meta.icon;
                return (
                  <div
                    className={`test-item${locked ? ' test-item-locked' : ''}`}
                    key={t.id}
                    style={{ ...(locked ? { cursor: 'default' } : {}), borderLeftColor: locked ? undefined : meta.color }}
                    onClick={() => {
                      if (!attempt) navigate(`/practice/${t.type}/${t.id}?mock=${mock.id}`);
                      // already attempted: nothing to do — not clickable
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="hub-card-icon" style={{ '--card-accent': meta.color, width: 36, height: 36, borderRadius: 10, margin: 0 }}>
                        <Icon size={16} strokeWidth={2} color={meta.color} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{t.type[0].toUpperCase() + t.type.slice(1)}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.title}</div>
                      </div>
                    </div>
                    {pending
                      ? <span className="badge pending">Submitted · Awaiting review</span>
                      : attempt
                        ? <span className="badge reviewed"><CheckCircle2 size={11} strokeWidth={2.5} style={{ verticalAlign: -1.5, marginRight: 3 }} />Completed</span>
                        : <span className="pill-btn secondary">Start</span>}
                  </div>
                );
              })}
              <div className="test-item test-item-locked">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="hub-card-icon" style={{ '--card-accent': SECTION_META.speaking.color, width: 36, height: 36, borderRadius: 10, margin: 0 }}>
                    <Mic size={16} strokeWidth={2} color={SECTION_META.speaking.color} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Speaking</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Scored by your teacher after a live session</div>
                  </div>
                </div>
                <span className="badge pending"><Clock3 size={11} strokeWidth={2.5} style={{ verticalAlign: -1.5, marginRight: 3 }} />Manual</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
