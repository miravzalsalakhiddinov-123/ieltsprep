import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import FilterDropdown from '../components/FilterDropdown';

const SKILL_LABEL = { writing: 'Writing', speaking: 'Speaking' };
const TASK_LABEL = { task1: 'Task 1', task2: 'Task 2', part1: 'Part 1', part2: 'Part 2', part3: 'Part 3' };
const TASK_BY_SKILL = { writing: ['task1', 'task2'], speaking: ['part1', 'part2', 'part3'] };

// URL uses friendly slugs; the API uses the underlying `kind` values.
const SECTION_TO_KIND = { samples: 'sample', 'mini-lessons': 'mini_lesson' };
const SECTION_META = {
  samples: { title: 'Samples', sub: 'Sample answers to study before your own attempt.', eyebrow: '✍️ Samples' },
  'mini-lessons': { title: 'Mini-Lessons', sub: 'Short articles on strategy, grammar, and technique.', eyebrow: '💡 Mini-Lessons' }
};

export default function Lessons() {
  const { section } = useParams();
  const kind = SECTION_TO_KIND[section] || 'sample';
  const meta = SECTION_META[section] || SECTION_META.samples;
  const isSamples = kind === 'sample';

  const [lessons, setLessons] = useState([]);
  const [skill, setSkill] = useState('all');
  const [taskType, setTaskType] = useState('all');
  const [sort, setSort] = useState('newest');
  const navigate = useNavigate();

  useEffect(() => {
    setLessons([]);
    setSkill('all'); setTaskType('all');
    api.listLessons({ kind }).then(setLessons);
  }, [kind]);

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
      <div className="topbar-row">
        <button className="btn secondary" onClick={() => navigate('/lessons')}>← Back to Lessons</button>
      </div>

      <div className="lessons-hero">
        <span className="lessons-hero-eyebrow">{meta.eyebrow}</span>
        <div className="welcome-title">{meta.title}</div>
        <div className="welcome-sub">{meta.sub}</div>
      </div>

      <div className="lesson-filters">
        {isSamples && (
          <>
            <FilterDropdown
              icon="🎯"
              value={skill}
              onChange={v => { setSkill(v); setTaskType('all'); }}
              options={[
                { value: 'all', label: 'All Skills' },
                { value: 'writing', label: 'Writing' },
                { value: 'speaking', label: 'Speaking' }
              ]}
            />
            <FilterDropdown
              icon="🧩"
              value={taskType}
              onChange={setTaskType}
              options={[
                { value: 'all', label: 'All Tasks' },
                ...taskOptions.map(t => ({ value: t, label: TASK_LABEL[t] }))
              ]}
            />
          </>
        )}
        <FilterDropdown
          icon="🕐"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'newest', label: 'Newest First' },
            { value: 'oldest', label: 'Oldest First' }
          ]}
        />
        <span className="lesson-count-pill">{filtered.length} {isSamples ? 'sample' : 'lesson'}{filtered.length === 1 ? '' : 's'} found</span>
      </div>

      <div className="lesson-grid">
        {filtered.map(l => (
          <div className="lesson-card" key={l.id} onClick={() => navigate(`/lessons/view/${l.id}`)}>
            <div className="lesson-card-img">
              {l.has_image
                ? <img src={`/api/lessons/${l.id}/image`} alt="" />
                : <div className="lesson-card-img-placeholder">{isSamples ? (l.skill === 'writing' ? '✍️' : '🗣️') : '💡'}</div>}
              {isSamples && <span className="lesson-card-tag">{SKILL_LABEL[l.skill]}</span>}
              {isSamples && <span className="lesson-card-task">{TASK_LABEL[l.task_type]}</span>}
            </div>
            <div className="lesson-card-body">
              <div className="lesson-card-title">{l.title}</div>
              {isSamples && l.band_level && <span className="badge lesson-band-badge">{l.band_level}</span>}
              <button className="btn lesson-card-btn">Start Reading →</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ color: 'var(--text-muted)', gridColumn: '1 / -1' }}>Nothing here yet — ask your teacher.</div>
        )}
      </div>
    </div>
  );
}
