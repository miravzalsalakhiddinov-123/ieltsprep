import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const SECTION_ORDER = ['listening', 'reading', 'writing'];

function orderedTests(mock) {
  const inOrder = SECTION_ORDER.map(t => mock.tests.find(x => x.type === t)).filter(Boolean);
  const rest = mock.tests.filter(t => !SECTION_ORDER.includes(t.type));
  return [...inOrder, ...rest];
}

export default function MockCenter() {
  const [mocks, setMocks] = useState([]);
  const [attemptsByTest, setAttemptsByTest] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    api.listMocks().then(async (rows) => {
      setMocks(rows);
      const all = await api.myAttempts();
      const map = {};
      all.forEach(a => { if (a.test_id) map[a.test_id] = a; });
      setAttemptsByTest(map);
    });
  }, []);

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
      <div className="topbar-row">
        <div>
          <div className="welcome-title">Full Mock Tests</div>
          <div className="welcome-sub">Take reading, listening, and writing back-to-back under real exam conditions.</div>
        </div>
      </div>

      {mocks.length === 0 && (
        <div className="card">No mock tests have been set up yet — ask your teacher to create one from the admin panel.</div>
      )}

      {mocks.map(mock => (
        <div className="card" key={mock.id} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>{mock.title}</h3>
            {mock.tests.length > 0 && (
              <button className="btn" onClick={() => startFullMock(mock)}>Start Full Mock</button>
            )}
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6, marginBottom: 14 }}>
            Start Full Mock runs listening, reading, and writing back-to-back and only reveals your scores at the very end.
            You can also open a single section below to practice it on its own.
          </p>
          <div className="test-list">
            {orderedTests(mock).map(t => {
              const attempt = attemptsByTest[t.id];
              const pending = attempt && attempt.test_type !== 'writing' && attempt.status === 'pending_review';
              return (
                <div className="test-item" key={t.id} onClick={() => {
                  if (attempt && !pending) navigate(`/practice/${t.type}/${t.id}/review/${attempt.id}`);
                  else if (!attempt) navigate(`/practice/${t.type}/${t.id}?mock=${mock.id}`);
                  // pending: not clickable — nothing to show yet
                }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.type[0].toUpperCase() + t.type.slice(1)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.title}</div>
                  </div>
                  {pending
                    ? <span className="badge pending">Submitted · Awaiting review</span>
                    : attempt ? <span className="badge reviewed">Completed · Analyze</span> : <span className="btn">Start</span>}
                </div>
              );
            })}
            <div className="test-item" style={{ cursor: 'default' }}>
              <div>
                <div style={{ fontWeight: 600 }}>Speaking</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Scored by your teacher after a live session</div>
              </div>
              <span className="badge pending">Manual</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
