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
  const [tests, setTests] = useState([]);
  const [doneIds, setDoneIds] = useState(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    api.listTests(type).then(setTests);
    api.myAttempts(type).then(rows => setDoneIds(new Set(rows.map(r => r.test_id))));
  }, [type]);

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
          {tests.map(t => (
            <div className="test-item" key={t.id} onClick={() => navigate(`/practice/${type}/${t.id}`)}>
              <div>
                <div style={{ fontWeight: 600 }}>{t.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(t.created_at).toLocaleDateString()}</div>
              </div>
              {doneIds.has(t.id) ? <span className="badge reviewed">Completed</span> : <span className="btn">Start</span>}
            </div>
          ))}
          {tests.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No {type} tests uploaded yet — ask your teacher.</div>}
        </div>
      </div>
    </div>
  );
}
