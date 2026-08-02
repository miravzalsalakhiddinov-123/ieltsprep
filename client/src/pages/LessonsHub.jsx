import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PenSquare, Lightbulb, ArrowRight, Clock3, BookOpenCheck } from 'lucide-react';
import { api } from '../api/client';

export default function LessonsHub() {
  const [counts, setCounts] = useState({ sample: null, mini_lesson: null });
  const [recent, setRecent] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.listLessons().then(rows => {
      setCounts({
        sample: rows.filter(r => r.kind !== 'mini_lesson').length,
        mini_lesson: rows.filter(r => r.kind === 'mini_lesson').length
      });
      const sorted = [...rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setRecent(sorted.slice(0, 6));
    });
  }, []);

  function openLesson(l) {
    navigate(`/lessons/view/${l.id}`);
  }

  return (
    <div>
      <div className="lessons-hero">
        <span className="lessons-hero-eyebrow">📚 Study Library</span>
        <div className="welcome-title">Lessons</div>
        <div className="welcome-sub">Model answers to study, and short lessons on strategy, grammar, and technique.</div>
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
                Full-band model answers for Writing and Speaking, broken down task by task.
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
                Short, focused articles on strategy, grammar, and technique for every skill.
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

      <div className="card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Clock3 size={17} strokeWidth={2} /> Recently updated</h3>
        {recent === null && <div style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Loading…</div>}
        {recent !== null && recent.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon"><BookOpenCheck size={22} strokeWidth={2} /></div>
            <div className="empty-state-title">Nothing here yet</div>
            <div className="empty-state-sub">Your teacher hasn't published any lessons or samples yet.</div>
          </div>
        )}
        {recent !== null && recent.length > 0 && (
          <div className="test-list">
            {recent.map(l => (
              <div className="test-item" key={l.id} onClick={() => openLesson(l)}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{l.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    {l.kind === 'mini_lesson' ? 'Mini-Lesson' : 'Sample'}
                    {l.skill ? ` · ${l.skill[0].toUpperCase() + l.skill.slice(1)}` : ''}
                    {' · '}{new Date(l.created_at).toLocaleDateString()}
                  </div>
                </div>
                <ArrowRight size={16} strokeWidth={2} color="var(--text-muted)" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
