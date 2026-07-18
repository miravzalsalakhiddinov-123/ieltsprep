import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function LessonsHub() {
  const [counts, setCounts] = useState({ sample: null, mini_lesson: null });
  const navigate = useNavigate();

  useEffect(() => {
    api.listLessons().then(rows => {
      setCounts({
        sample: rows.filter(r => r.kind !== 'mini_lesson').length,
        mini_lesson: rows.filter(r => r.kind === 'mini_lesson').length
      });
    });
  }, []);

  return (
    <div>
      <div className="lessons-hero">
        <span className="lessons-hero-eyebrow">📚 Study Library</span>
        <div className="welcome-title">Lessons</div>
        <div className="welcome-sub">Pick what you'd like to study.</div>
      </div>

      <div className="hub-grid">
        <div className="hub-card" style={{ '--card-accent': 'var(--accent)' }} onClick={() => navigate('/lessons/samples')}>
          <div className="hub-card-icon">✍️</div>
          <div className="hub-card-title">Samples</div>
          <span className="hub-card-badge">{counts.sample === null ? '…' : `${counts.sample} sample${counts.sample === 1 ? '' : 's'}`}</span>
        </div>
        <div className="hub-card" style={{ '--card-accent': 'var(--accent-2)' }} onClick={() => navigate('/lessons/mini-lessons')}>
          <div className="hub-card-icon">💡</div>
          <div className="hub-card-title">Mini-Lessons</div>
          <span className="hub-card-badge">{counts.mini_lesson === null ? '…' : `${counts.mini_lesson} lesson${counts.mini_lesson === 1 ? '' : 's'}`}</span>
        </div>
      </div>
    </div>
  );
}
