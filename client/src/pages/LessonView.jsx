import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { renderInline } from '../utils/richtext';

const SKILL_LABEL = { writing: 'Writing', speaking: 'Speaking' };
const TASK_LABEL = { task1: 'Task 1', task2: 'Task 2', part1: 'Part 1', part2: 'Part 2', part3: 'Part 3' };

// Content is plain text. Blank lines separate paragraphs; a line starting
// with "## " (or "# ") becomes a subheading. Within any line, **bold**,
// *italic*, __underline__, and [text](url) links are supported.
function renderContent(content) {
  return content.split(/\n\s*\n/).map((block, i) => {
    const trimmed = block.trim();
    if (trimmed.startsWith('## ')) return <h2 key={i} className="lesson-view-heading">{renderInline(trimmed.slice(3), `h${i}`)}</h2>;
    if (trimmed.startsWith('# ')) return <h2 key={i} className="lesson-view-heading">{renderInline(trimmed.slice(2), `h${i}`)}</h2>;
    return <p key={i}>{renderInline(trimmed, `p${i}`)}</p>;
  });
}

export default function LessonView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);

  useEffect(() => { setLesson(null); api.getLesson(id).then(setLesson); }, [id]);

  if (!lesson) return null;

  const isMiniLesson = lesson.kind === 'mini_lesson';
  // Writing samples get the two-column layout: question (+photo for Task 1,
  // +plan for Task 2) on the left, the model answer on the right.
  const isWritingSample = !isMiniLesson && lesson.skill === 'writing';

  return (
    <div className="lesson-view-page" style={isWritingSample ? { maxWidth: 1000 } : undefined}>
      <div className="topbar-row">
        <button className="btn secondary" onClick={() => navigate(-1)}>← Back</button>
      </div>

      <div className="lesson-view-article">
        {!isMiniLesson && (
          <div className="lesson-view-tags">
            <span className="badge lesson-view-skill">{SKILL_LABEL[lesson.skill]}</span>
            <span className="badge lesson-view-task">{TASK_LABEL[lesson.task_type]}</span>
            {lesson.band_level && <span className="badge lesson-band-badge">{lesson.band_level}</span>}
          </div>
        )}
        <h1 className="lesson-view-title">{lesson.title}</h1>

        {isWritingSample ? (
          <div className="sample-split">
            <div className="sample-split-col">
              <div className="sample-split-label">{lesson.task_type === 'task1' ? 'Question & Chart' : 'Question & Plan'}</div>
              {lesson.prompt && <div className="sample-prompt-box">{lesson.prompt}</div>}
              {lesson.task_type === 'task1' && lesson.has_image && (
                <img className="sample-task-image" src={`/api/lessons/${lesson.id}/image`} alt="" />
              )}
              {lesson.task_type === 'task2' && lesson.plan && (
                <div className="sample-plan-box">{lesson.plan}</div>
              )}
              {!lesson.prompt && !lesson.has_image && !lesson.plan && (
                <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No question added for this sample.</div>
              )}
            </div>
            <div className="sample-split-col">
              <div className="sample-split-label">Sample Answer</div>
              <div className="sample-answer-box">{renderContent(lesson.content)}</div>
            </div>
          </div>
        ) : (
          <>
            {!isMiniLesson && lesson.prompt && <div className="sample-prompt-box">{lesson.prompt}</div>}
            {!isMiniLesson && lesson.has_image && <img className="lesson-view-image" src={`/api/lessons/${lesson.id}/image`} alt="" />}
            <div className="lesson-view-content">{renderContent(lesson.content)}</div>
          </>
        )}
      </div>
    </div>
  );
}
