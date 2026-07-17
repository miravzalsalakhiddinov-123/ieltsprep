import { useEffect, useState } from 'react';
import { api } from '../../api/client';

const TASK_BY_SKILL = { writing: ['task1', 'task2'], speaking: ['part1', 'part2', 'part3'] };
const TASK_LABEL = { task1: 'Task 1', task2: 'Task 2', part1: 'Part 1', part2: 'Part 2', part3: 'Part 3' };

export default function AdminLessons() {
  const [lessons, setLessons] = useState([]);
  const [skill, setSkill] = useState('writing');
  const [taskType, setTaskType] = useState('task1');
  const [title, setTitle] = useState('');
  const [bandLevel, setBandLevel] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function refresh() { api.listLessons().then(setLessons); }
  useEffect(refresh, []);

  function resetForm(formEl) {
    setEditingId(null); setTitle(''); setBandLevel(''); setContent(''); setImage(null);
    setSkill('writing'); setTaskType('task1');
    formEl?.reset();
  }

  function edit(l) {
    setEditingId(l.id);
    setSkill(l.skill);
    setTaskType(l.task_type);
    setTitle(l.title);
    setBandLevel(l.band_level || '');
    setContent(''); // content isn't in the list payload — fetch full record
    api.getLesson(l.id).then(full => setContent(full.content));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!title || !content) { setError('Title and content are required'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('skill', skill);
      fd.append('task_type', taskType);
      fd.append('title', title);
      fd.append('band_level', bandLevel);
      fd.append('content', content);
      if (image) fd.append('image', image);
      if (editingId) await api.updateLesson(editingId, fd);
      else await api.createLesson(fd);
      resetForm(e.target);
      refresh();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function remove(id) {
    if (!confirm('Delete this sample?')) return;
    await api.deleteLesson(id);
    if (editingId === id) resetForm();
    refresh();
  }

  return (
    <div>
      <div className="topbar-row"><div className="welcome-title">Lessons</div></div>
      <div className="grid grid-2">
        <div className="card">
          <h3>{editingId ? 'Edit sample' : 'Add a sample'}</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -6, marginBottom: 14 }}>
            Students see the skill, task, band level, and a small cover image on the card before opening it.
          </p>
          {error && <div className="error-text">{error}</div>}
          <form onSubmit={handleSubmit}>
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
            <div className="field"><label>Title</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Model answer — Describe a memorable trip" /></div>
            <div className="field"><label>Band level (optional)</label>
              <input className="input" value={bandLevel} onChange={e => setBandLevel(e.target.value)} placeholder="e.g. Band 7-8" /></div>
            <div className="field"><label>Cover image (optional, kept small on the card)</label>
              <input className="input" type="file" accept="image/*" onChange={e => setImage(e.target.files[0])} />
              {editingId && <div className="field-hint">Leave empty to keep the current image.</div>}
            </div>
            <div className="field"><label>Sample content</label>
              <textarea className="input" rows={10} value={content} onChange={e => setContent(e.target.value)}
                placeholder="Paste or write the full model answer here…" /></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Add sample'}</button>
              {editingId && <button type="button" className="btn secondary" onClick={() => resetForm()}>Cancel</button>}
            </div>
          </form>
        </div>

        <div className="card">
          <h3>All samples ({lessons.length})</h3>
          <table className="simple-table">
            <thead><tr><th>Title</th><th>Skill</th><th>Task</th><th>Band</th><th></th></tr></thead>
            <tbody>
              {lessons.map(l => (
                <tr key={l.id}>
                  <td>{l.title}</td>
                  <td>{l.skill === 'writing' ? '✍️ Writing' : '🗣️ Speaking'}</td>
                  <td>{TASK_LABEL[l.task_type]}</td>
                  <td>{l.band_level || '—'}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn secondary" onClick={() => edit(l)}>Edit</button>
                    <button className="btn danger" onClick={() => remove(l.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {lessons.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--text-muted)' }}>No samples added yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
