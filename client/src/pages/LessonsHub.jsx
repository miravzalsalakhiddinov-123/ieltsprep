import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PenSquare, Lightbulb, ArrowRight } from 'lucide-react';
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
        <div className="welcome-sub">Model answers and short strategy lessons.</div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/lessons/samples')}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div className="hub-card-icon" style={{ '--card-accent': 'var(--accent)', width: 48, height: 48, borderRadius: 14 }}>
              <PenSquare size={20} strokeWidth={2} color="var(--accent)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ margin: '0 0 4px' }}>Samples</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Full-band model answers, task by task.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
            <span className="hub-card-badge" style={{ '--card-accent': 'var(--accent)' }}>
              {counts.sample === null ? '…' : `${counts.sample} sample${counts.sample === 1 ? '' : 's'}`}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
              Browse <ArrowRight size={14} strokeWidth={2} />
            </span>
          </div>
        </div>

        <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/lessons/mini-lessons')}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div className="hub-card-icon" style={{ '--card-accent': 'var(--accent-2)', width: 48, height: 48, borderRadius: 14 }}>
              <Lightbulb size={20} strokeWidth={2} color="var(--accent-2)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ margin: '0 0 4px' }}>Mini-Lessons</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Short strategy, grammar and technique tips.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
            <span className="hub-card-badge" style={{ '--card-accent': 'var(--accent-2)' }}>
              {counts.mini_lesson === null ? '…' : `${counts.mini_lesson} lesson${counts.mini_lesson === 1 ? '' : 's'}`}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: 'var(--accent-2)' }}>
              Browse <ArrowRight size={14} strokeWidth={2} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
