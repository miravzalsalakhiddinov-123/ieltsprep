import { useEffect, useState } from 'react';
import { api } from '../../api/client';

const TASK_BY_SKILL = { writing: ['task1', 'task2'], speaking: ['part1', 'part2', 'part3'] };
const TASK_LABEL = { task1: 'Task 1', task2: 'Task 2', part1: 'Part 1', part2: 'Part 2', part3: 'Part 3' };

export default function AdminLessons() {
  const [lessons, setLessons] = useState([]);
  const [kind, setKind] = useState('sample');
  const [skill, setSkill] = useState('writing');
  const [taskType, setTaskType] = useState('task1');
  const [title, setTitle] = useState('');
  const [bandLevel, setBandLevel] = useState('');
  const [content, setContent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState('');
  const [image, setImage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function refresh() { api.listLessons().then(setLessons); }
  useEffect(refresh, []);

  const isWritingTask1 = kind === 'sample' && skill === 'writing' && taskType === 'task1';
  const isWritingTask2 = kind === 'sample' && skill === 'writing' && taskType === 'task2';

  function resetForm(formEl) {
    setEditingId(null); setTitle(''); setBandLevel(''); setContent(''); setPrompt(''); setPlan(''); setImage(null);
    setKind('sample'); setSkill('writing'); setTaskType('task1');
    formEl?.reset();
  }

  function edit(l) {
    setEditingId(l.id);
    setKind(l.kind || 'sample');
    setSkill(l.skill || 'writing');
    setTaskType(l.task_type || 'task1');
    setTitle(l.title);
    setBandLevel(l.band_level || '');
    setContent(''); setPrompt(''); setPlan(''); // not in the list payload — fetch full record
    api.getLesson(l.id).then(full => {
      setContent(full.content);
      setPrompt(full.prompt || '');
      setPlan(full.plan || '');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!title || !content) { setError('Title and content are required'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('kind', kind);
      fd.append('title', title);
      fd.append('content', content);
      if (kind === 'sample') {
        fd.append('skill', skill);
        fd.append('task_type', taskType);
        fd.append('band_level', bandLevel);
        fd.append('prompt', prompt);
        if (skill === 'writing' && taskType === 'task2') fd.append('plan', plan);
        if (image) fd.append('image', image);
      }
      if (editingId) await api.updateLesson(editingId, fd);
      else await api.createLesson(fd);
      resetForm(e.target);
      refresh();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function remove(id) {
    if (!confirm('Delete this?')) return;
    await api.deleteLesson(id);
    if (editingId === id) resetForm();
    refresh();
  }

  return (
    <div>
      <div className="topbar-row"><div className="welcome-title">Lessons</div></div>
      <div className="grid grid-2">
        <div className="card">
          <h3>{editingId ? 'Edit' : 'Add new'}</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -6, marginBottom: 14 }}>
            Samples show a question (plus a Task 1 photo or Task 2 plan) beside the model answer. Mini-lessons are simple articles.
          </p>
          {error && <div className="error-text">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field"><label>Type</label>
              <div className="segmented">
                <button type="button" className={kind === 'sample' ? 'active' : ''} onClick={() => setKind('sample')}>Sample</button>
                <button type="button" className={kind === 'mini_lesson' ? 'active' : ''} onClick={() => setKind('mini_lesson')}>Mini-lesson</button>
              </div>
            </div>

            {kind === 'sample' && (
              <>
                <div className="field"><label>Skill</label>
                  <div className="segmented">
                    <button type="button" className={skill === 'writing' ? 'active' : ''}
                      onClick={() => { setSkill('writing'); setTaskType('task1'); }}>Writing</button>
                    <button type="button" className={skill === 'speaking' ? 'active' : ''}
                      onClick={() => { setSkill('speaking'); setTaskType('part1'); }}>Speaking</button>
                  </div>
                </div>
                <div className="field"><label>{skill === 'writing' ? 'Task' : 'Part'}</label>
                  <div className="segmented">
                    {TASK_BY_SKILL[skill].map(t => (
                      <button type="button" key={t} className={taskType === t ? 'active' : ''} onClick={() => setTaskType(t)}>{TASK_LABEL[t]}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="field"><label>Title</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)}
                placeholder={kind === 'sample' ? 'e.g. Model answer — Line graph on internet usage' : 'e.g. 5 ways to boost your Task 2 vocabulary'} /></div>

            {kind === 'sample' && (
              <>
                <div className="field"><label>Question / Prompt</label>
                  <textarea className="input" rows={3} value={prompt} onChange={e => setPrompt(e.target.value)}
                    placeholder="Paste the exact exam question here…" />
                </div>
                <div className="field"><label>Band level (optional)</label>
                  <input className="input" value={bandLevel} onChange={e => setBandLevel(e.target.value)} placeholder="e.g. Band 7-8" /></div>
                {isWritingTask1 && (
                  <div className="field"><label>Chart / diagram image</label>
                    <input className="input" type="file" accept="image/*" onChange={e => setImage(e.target.files[0])} />
                    {editingId && <div className="field-hint">Leave empty to keep the current image.</div>}
                  </div>
                )}
                {isWritingTask2 && (
                  <div className="field"><label>Plan / outline</label>
                    <textarea className="input" rows={5} value={plan} onChange={e => setPlan(e.target.value)}
                      placeholder="e.g. Intro — paraphrase + thesis&#10;Body 1 — ...&#10;Body 2 — ...&#10;Conclusion — ..." />
                  </div>
                )}
                {skill === 'speaking' && (
                  <div className="field"><label>Cover image (optional)</label>
                    <input className="input" type="file" accept="image/*" onChange={e => setImage(e.target.files[0])} />
                    {editingId && <div className="field-hint">Leave empty to keep the current image.</div>}
                  </div>
                )}
              </>
            )}

            <div className="field"><label>{kind === 'sample' ? 'Sample answer' : 'Content'}</label>
              <textarea className="input" rows={10} value={content} onChange={e => setContent(e.target.value)}
                placeholder={kind === 'sample' ? 'Paste or write the full model answer here…' : 'Write the mini-lesson content here…'} />
              <div className="field-hint">Leave a blank line between paragraphs. Start a line with "## " to make it a subheading.</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Add'}</button>
              {editingId && <button type="button" className="btn secondary" onClick={() => resetForm()}>Cancel</button>}
            </div>
          </form>
        </div>

        <div className="card">
          <h3>All ({lessons.length})</h3>
          <table className="simple-table">
            <thead><tr><th>Title</th><th>Type</th><th>Skill / Task</th><th>Band</th><th></th></tr></thead>
            <tbody>
              {lessons.map(l => (
                <tr key={l.id}>
                  <td>{l.title}</td>
                  <td>{l.kind === 'mini_lesson' ? '💡 Mini-lesson' : '📝 Sample'}</td>
                  <td>{l.kind === 'mini_lesson' ? '—' : `${l.skill === 'writing' ? '✍️ Writing' : '🗣️ Speaking'} · ${TASK_LABEL[l.task_type]}`}</td>
                  <td>{l.band_level || '—'}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn secondary" onClick={() => edit(l)}>Edit</button>
                    <button className="btn danger" onClick={() => remove(l.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {lessons.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--text-muted)' }}>Nothing added yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
