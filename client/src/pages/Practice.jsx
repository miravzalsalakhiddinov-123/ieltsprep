import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const TYPES = [
  { key: 'reading', label: 'Reading' },
  { key: 'listening', label: 'Listening' },
  { key: 'writing', label: 'Writing' }
];

export default function Practice() {
  const [type, setType] = useState('reading');
  const [tests, setTests] = useState(null); // null = loading
  const navigate = useNavigate();

  useEffect(() => {
    setTests(null);
    // Single request: the list and each test's most-recent-attempt-id come
    // back together, instead of two separate round trips.
    api.testsWithProgress(type).then(setTests);
  }, [type]);

  function openTest(t) {
    // Already completed this one — open the read-only Analyze view instead
    // of starting a brand new attempt over it.
    if (t.attempt_id) navigate(`/practice/${type}/${t.id}/review/${t.attempt_id}`);
    else navigate(`/practice/${type}/${t.id}`);
  }

  return (
    <div>
      <div className="topbar-row">
        <div>
          <div className="welcome-title">Practice</div>
          <div className="welcome-sub">Pick a skill, then choose a test. It will open in full screen.</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {TYPES.map(t => (
          <button key={t.key} className="btn secondary"
            style={{ borderColor: type === t.key ? 'var(--accent)' : 'var(--border)', color: type === t.key ? 'var(--accent)' : 'var(--text)' }}
            onClick={() => setType(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        <h3>{TYPES.find(t => t.key === type).label} tests</h3>
        <div className="test-list">
          {tests === null && (
            <div className="test-list-skeleton">
              {[0, 1, 2].map(i => <div className="test-item-skeleton" key={i} />)}
            </div>
          )}
          {tests !== null && tests.map(t => (
            <div className="test-item" key={t.id} onClick={() => openTest(t)}>
              <div>
                <div style={{ fontWeight: 600 }}>{t.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(t.created_at).toLocaleDateString()}</div>
              </div>
              {t.attempt_id ? <span className="badge reviewed">Completed · Analyze</span> : <span className="btn">Start</span>}
            </div>
          ))}
          {tests !== null && tests.length === 0 && (
            <div style={{ color: 'var(--text-muted)' }}>No {type} tests uploaded yet — ask your teacher.</div>
          )}
        </div>
      </div>
    </div>
  );
}
