import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const TYPES = [
  { key: 'reading', label: 'Reading', icon: '📖', color: 'var(--accent)' },
  { key: 'listening', label: 'Listening', icon: '🎧', color: 'var(--accent-2)' },
  { key: 'writing', label: 'Writing', icon: '✍️', color: 'var(--warn)' }
];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function Practice() {
  const [type, setType] = useState('reading');
  const [tests, setTests] = useState(null); // null = loading
  const navigate = useNavigate();
  const meta = TYPES.find(t => t.key === type);

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

      <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
        {TYPES.map(t => (
          <button key={t.key} className="btn secondary"
            style={{ borderColor: type === t.key ? t.color : 'var(--border)', color: type === t.key ? t.color : 'var(--text)' }}
            onClick={() => setType(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tests === null && (
        <div className="practice-grid">
          {[0, 1, 2].map(i => <div className="practice-card-skeleton" key={i} />)}
        </div>
      )}

      {tests !== null && tests.length === 0 && (
        <div className="card" style={{ color: 'var(--text-muted)' }}>No {meta.label.toLowerCase()} tests uploaded yet — ask your teacher.</div>
      )}

      {tests !== null && tests.length > 0 && (
        <div className="practice-grid">
          {tests.map(t => {
            const isNew = Date.now() - new Date(t.created_at).getTime() < WEEK_MS;
            const done = !!t.attempt_id;
            return (
              <div className="practice-card" key={t.id} style={{ '--card-accent': meta.color }}>
                <div className="practice-card-topbar" />
                <div className="practice-card-body">
                  <div className="practice-card-head">
                    <div className="practice-card-icon">{meta.icon}</div>
                    {done
                      ? <span className="practice-card-tag done">✓ Completed</span>
                      : isNew ? <span className="practice-card-tag new">New</span> : null}
                  </div>
                  <div className="practice-card-title">{t.title}</div>
                  <div className="practice-card-meta">
                    {t.duration_minutes && <span>🕐 {t.duration_minutes} min</span>}
                    {t.reading_variant && <span>📘 {t.reading_variant}</span>}
                    <span>📅 {new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                  <button className="practice-card-btn" onClick={() => openTest(t)}>
                    {done ? <>📊 Analyze Results</> : <>▶ Start {meta.label} Test</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
