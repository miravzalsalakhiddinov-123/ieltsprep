import { useEffect, useState } from 'react';
import { api } from '../../api/client';

const TYPE_META = {
  reading: { label: 'Reading', icon: '📖', blurb: 'Upload the HTML file exactly as-is — scored automatically from its built-in answer key.' },
  listening: { label: 'Listening', icon: '🎧', blurb: 'Upload the HTML file exactly as-is, plus an audio link — scored automatically.' },
  writing: { label: 'Writing', icon: '✍️', blurb: 'No file needed — just add the task prompt(s) below. Students type their response and it goes to your Writing Queue for grading.' }
};

export default function AdminTests() {
  const [tests, setTests] = useState([]);
  const [mocks, setMocks] = useState([]);
  const [type, setType] = useState('reading');
  const [title, setTitle] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [mockId, setMockId] = useState('');
  const [duration, setDuration] = useState('');
  const [file, setFile] = useState(null);
  const [readingVariant, setReadingVariant] = useState('academic');

  // writing-only fields
  const [writingTasks, setWritingTasks] = useState('both');
  const [task1Prompt, setTask1Prompt] = useState('');
  const [task1Image, setTask1Image] = useState(null);
  const [task2Prompt, setTask2Prompt] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function refresh() {
    api.listTests().then(setTests);
    api.listMocks().then(setMocks);
  }
  useEffect(refresh, []);

  function resetForm(formEl) {
    setTitle(''); setAudioUrl(''); setFile(null); setMockId(''); setDuration(''); setReadingVariant('academic');
    setWritingTasks('both'); setTask1Prompt(''); setTask1Image(null); setTask2Prompt('');
    formEl?.reset();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!title) { setError('Title is required'); return; }

    if (type === 'writing') {
      const needsTask1 = writingTasks === 'task1' || writingTasks === 'both';
      const needsTask2 = writingTasks === 'task2' || writingTasks === 'both';
      if (needsTask1 && !task1Prompt) { setError('Task 1 prompt is required'); return; }
      if (needsTask2 && !task2Prompt) { setError('Task 2 question is required'); return; }
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append('title', title);
        fd.append('writing_tasks', writingTasks);
        if (needsTask1) fd.append('task1_prompt', task1Prompt);
        if (needsTask1 && task1Image) fd.append('task1_image', task1Image);
        if (needsTask2) fd.append('task2_prompt', task2Prompt);
        if (duration) fd.append('duration_minutes', duration);
        if (mockId) fd.append('mock_id', mockId);
        await api.createWritingTest(fd);
        resetForm(e.target);
        refresh();
      } catch (err) { setError(err.message); } finally { setBusy(false); }
      return;
    }

    if (!file) { setError('Title and file are required'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('type', type);
      fd.append('title', title);
      fd.append('file', file);
      if (type === 'listening' && audioUrl) fd.append('audio_url', audioUrl);
      if (type === 'reading') fd.append('reading_variant', readingVariant);
      if (duration) fd.append('duration_minutes', duration);
      if (mockId) fd.append('mock_id', mockId);
      await api.uploadTest(fd);
      resetForm(e.target);
      refresh();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function remove(id) {
    if (!confirm('Delete this test? Existing attempts will remain in analytics but the test file will be removed.')) return;
    await api.deleteTest(id);
    refresh();
  }

  async function reassignMock(testId, newMockId) {
    await api.setTestMock(testId, newMockId || null);
    refresh();
  }

  const meta = TYPE_META[type];
  const needsTask1 = writingTasks === 'task1' || writingTasks === 'both';
  const needsTask2 = writingTasks === 'task2' || writingTasks === 'both';

  return (
    <div>
      <div className="topbar-row"><div className="welcome-title">Tests</div></div>

      <div className="grid grid-2">
        <div className="card">
          <div className="type-tabs">
            {Object.keys(TYPE_META).map(t => (
              <button type="button" key={t} className={'type-tab' + (type === t ? ' active' : '')} onClick={() => { setType(t); setError(''); }}>
                <span className="type-tab-icon">{TYPE_META[t].icon}</span>{TYPE_META[t].label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12, marginBottom: 16 }}>{meta.blurb}</p>
          {error && <div className="error-text">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field"><label>Title</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Day 36 — Native Species" /></div>

            {type === 'listening' && (
              <div className="field"><label>Audio URL (Google Drive link or direct file URL)</label>
                <input className="input" value={audioUrl} onChange={e => setAudioUrl(e.target.value)} placeholder="https://drive.google.com/file/d/.../view?usp=sharing" />
                <div className="field-hint">Paste a Google Drive share link (sharing set to "Anyone with the link") or any direct audio file URL.</div>
              </div>
            )}

            {type === 'reading' && (
              <div className="field"><label>Reading type</label>
                <div className="segmented">
                  <button type="button" className={readingVariant === 'academic' ? 'active' : ''} onClick={() => setReadingVariant('academic')}>Academic</button>
                  <button type="button" className={readingVariant === 'general' ? 'active' : ''} onClick={() => setReadingVariant('general')}>General Training</button>
                </div>
                <div className="field-hint">Determines which official band-score conversion table is used — General Training Reading scores more leniently than Academic at the same raw score.</div>
              </div>
            )}

            {type !== 'writing' && (
              <div className="field"><label>Test HTML file</label>
                <input className="input" type="file" accept=".html" onChange={e => setFile(e.target.files[0])} /></div>
            )}

            {type === 'writing' && (
              <>
                <div className="field"><label>Which task(s)?</label>
                  <div className="segmented">
                    <button type="button" className={writingTasks === 'task1' ? 'active' : ''} onClick={() => setWritingTasks('task1')}>Task 1 only</button>
                    <button type="button" className={writingTasks === 'task2' ? 'active' : ''} onClick={() => setWritingTasks('task2')}>Task 2 only</button>
                    <button type="button" className={writingTasks === 'both' ? 'active' : ''} onClick={() => setWritingTasks('both')}>Both</button>
                  </div>
                </div>

                {needsTask1 && (
                  <div className="task-block">
                    <div className="task-block-title">Task 1</div>
                    <div className="field"><label>Task 1 image (chart, graph, diagram, or letter prompt)</label>
                      <input className="input" type="file" accept="image/*" onChange={e => setTask1Image(e.target.files[0])} />
                      <div className="field-hint">Optional — leave empty for a text-only Task 1 (e.g. a letter prompt with no image).</div>
                    </div>
                    <div className="field"><label>Task 1 prompt / instructions</label>
                      <textarea className="input" rows={4} value={task1Prompt} onChange={e => setTask1Prompt(e.target.value)}
                        placeholder="The chart below shows... Summarise the information by selecting and reporting the main features..." /></div>
                  </div>
                )}

                {needsTask2 && (
                  <div className="task-block">
                    <div className="task-block-title">Task 2</div>
                    <div className="field"><label>Task 2 question</label>
                      <textarea className="input" rows={4} value={task2Prompt} onChange={e => setTask2Prompt(e.target.value)}
                        placeholder="Some people believe that... To what extent do you agree or disagree?" /></div>
                  </div>
                )}
              </>
            )}

            <div className="field"><label>Time limit (minutes)</label>
              <input className="input" type="number" min="1" value={duration} onChange={e => setDuration(e.target.value)}
                placeholder={type === 'reading' ? '60' : type === 'listening' ? '30' : '60'} />
              <div className="field-hint">A countdown timer is shown to the student; the test auto-submits when it reaches zero. Leave blank for no limit.</div>
            </div>

            <div className="field"><label>Attach to a mock bundle (optional)</label>
              <select className="input" value={mockId} onChange={e => setMockId(e.target.value)}>
                <option value="">— Standalone test —</option>
                {mocks.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
            <button className="btn" disabled={busy}>{busy ? 'Saving…' : type === 'writing' ? 'Create writing test' : 'Upload test'}</button>
          </form>
        </div>

        <div className="card">
          <h3>All tests ({tests.length})</h3>
          <table className="simple-table">
            <thead><tr><th>Title</th><th>Type</th><th>Timer</th><th>Mock</th><th></th></tr></thead>
            <tbody>
              {tests.map(t => (
                <tr key={t.id}>
                  <td>{t.title}</td>
                  <td>{TYPE_META[t.type]?.icon} {t.type}{t.type === 'reading' && t.reading_variant === 'general' ? ' (GT)' : ''}</td>
                  <td>{t.duration_minutes ? `${t.duration_minutes} min` : '—'}</td>
                  <td>
                    <select
                      className="input"
                      style={{ padding: '4px 6px', fontSize: 12.5 }}
                      value={t.mock_id || ''}
                      onChange={e => reassignMock(t.id, e.target.value)}
                    >
                      <option value="">— Standalone —</option>
                      {mocks.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                    </select>
                  </td>
                  <td><button className="btn danger" onClick={() => remove(t.id)}>Delete</button></td>
                </tr>
              ))}
              {tests.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--text-muted)' }}>No tests uploaded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
