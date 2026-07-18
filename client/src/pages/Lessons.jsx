import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const SKILL_LABEL = { writing: 'Writing', speaking: 'Speaking' };
const TASK_LABEL = { task1: 'Task 1', task2: 'Task 2', part1: 'Part 1', part2: 'Part 2', part3: 'Part 3' };
const TASK_BY_SKILL = { writing: ['task1', 'task2'], speaking: ['part1', 'part2', 'part3'] };

export default function Lessons() {
  const [lessons, setLessons] = useState([]);
  const [skill, setSkill] = useState('all');
  const [taskType, setTaskType] = useState('all');
  const [sort, setSort] = useState('newest');
  const navigate = useNavigate();

  useEffect(() => { api.listLessons().then(setLessons); }, []);

  const taskOptions = useMemo(() => {
    if (skill === 'all') return ['task1', 'task2', 'part1', 'part2', 'part3'];
    return TASK_BY_SKILL[skill];
  }, [skill]);

  const filtered = useMemo(() => {
    let rows = lessons.filter(l => (skill === 'all' || l.skill === skill) && (taskType === 'all' || l.task_type === taskType));
    rows = [...rows].sort((a, b) => sort === 'newest'
      ? new Date(b.created_at) - new Date(a.created_at)
      : new Date(a.created_at) - new Date(b.created_at));
    return rows;
  }, [lessons, skill, taskType, sort]);

  return (
    <div>
      <div className="lessons-hero">
        <span className="lessons-hero-eyebrow">📚 Study Library</span>
        <div className="welcome-title">Lessons</div>
        <div className="welcome-sub">Sample answers to study before your own attempt.</div>
      </div>

      <div className="lesson-filters">
        <label className="filter-pill">
          <span className="filter-pill-icon">🎯</span>
          <select value={skill} onChange={e => { setSkill(e.target.value); setTaskType('all'); }}>
            <option value="all">All Skills</option>
            <option value="writing">Writing</option>
            <option value="speaking">Speaking</option>
          </select>
        </label>
        <label className="filter-pill">
          <span className="filter-pill-icon">🧩</span>
          <select value={taskType} onChange={e => setTaskType(e.target.value)}>
            <option value="all">All Tasks</option>
            {taskOptions.map(t => <option key={t} value={t}>{TASK_LABEL[t]}</option>)}
          </select>
        </label>
        <label className="filter-pill">
          <span className="filter-pill-icon">🕐</span>
          <select value={sort} onChange={e => setSort(e.target.value)}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </label>
        <span className="lesson-count-pill">{filtered.length} sample{filtered.length === 1 ? '' : 's'} found</span>
      </div>

      <div className="lesson-grid">
        {filtered.map(l => (
          <div className="lesson-card" key={l.id} onClick={() => navigate(`/lessons/${l.id}`)}>
            <div className="lesson-card-img">
              {l.has_image
                ? <img src={`/api/lessons/${l.id}/image`} alt="" />
                : <div className="lesson-card-img-placeholder">{l.skill === 'writing' ? '✍️' : '🗣️'}</div>}
              <span className="lesson-card-tag">{SKILL_LABEL[l.skill]}</span>
              <span className="lesson-card-task">{TASK_LABEL[l.task_type]}</span>
            </div>
            <div className="lesson-card-body">
              <div className="lesson-card-title">{l.title}</div>
              {l.band_level && <span className="badge lesson-band-badge">{l.band_level}</span>}
              <button className="btn lesson-card-btn">Start Reading →</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ color: 'var(--text-muted)', gridColumn: '1 / -1' }}>No samples here yet — ask your teacher.</div>
        )}
      </div>
    </div>
  );
}
