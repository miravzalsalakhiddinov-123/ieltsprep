import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const SKILL_LABEL = { writing: 'Writing', speaking: 'Speaking' };
const TASK_LABEL = { task1: 'Task 1', task2: 'Task 2', part1: 'Part 1', part2: 'Part 2', part3: 'Part 3' };

export default function LessonView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);

  useEffect(() => { api.getLesson(id).then(setLesson); }, [id]);

  if (!lesson) return null;

  return (
    <div>
      <div className="topbar-row">
        <button className="btn secondary" onClick={() => navigate('/lessons')}>← Back to Lessons</button>
      </div>

      <div className="card lesson-view-card">
        <div className="lesson-view-tags">
          <span className="badge lesson-view-skill">{SKILL_LABEL[lesson.skill]}</span>
          <span className="badge lesson-view-task">{TASK_LABEL[lesson.task_type]}</span>
          {lesson.band_level && <span className="badge lesson-band-badge">{lesson.band_level}</span>}
        </div>
        <h1 className="lesson-view-title">{lesson.title}</h1>
        {lesson.has_image && <img className="lesson-view-image" src={`/api/lessons/${lesson.id}/image`} alt="" />}
        <div className="lesson-view-content">{lesson.content}</div>
      </div>
    </div>
  );
}
