import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

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
          <h3>{mock.title}</h3>
          <div className="test-list">
            {mock.tests.map(t => (
              <div className="test-item" key={t.id} onClick={() => navigate(`/practice/${t.type}/${t.id}?mock=${mock.id}`)}>
                <div>
                  <div style={{ fontWeight: 600 }}>{t.type[0].toUpperCase() + t.type.slice(1)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.title}</div>
                </div>
                {attemptsByTest[t.id] ? <span className="badge reviewed">Completed</span> : <span className="btn">Start</span>}
              </div>
            ))}
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
