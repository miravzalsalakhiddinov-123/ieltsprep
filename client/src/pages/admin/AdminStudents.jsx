import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({ name: '', username: '', password: '' });
  const [error, setError] = useState('');

  function refresh() { api.listStudents().then(setStudents); }
  useEffect(refresh, []);

  async function createStudent(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createStudent(form);
      setForm({ name: '', username: '', password: '' });
      refresh();
    } catch (err) { setError(err.message); }
  }

  async function resetPassword(id) {
    const pw = prompt('New password for this student:');
    if (!pw) return;
    await api.resetStudentPassword(id, pw);
    alert('Password updated.');
  }

  async function remove(id) {
    if (!confirm('Delete this student account? This cannot be undone.')) return;
    await api.deleteStudent(id);
    refresh();
  }

  return (
    <div>
      <div className="topbar-row"><div className="welcome-title">Students</div></div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Add a student</h3>
          {error && <div className="error-text">{error}</div>}
          <form onSubmit={createStudent}>
            <div className="field"><label>Full name</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="field"><label>Username</label>
              <input className="input" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required /></div>
            <div className="field"><label>Password</label>
              <input className="input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></div>
            <button className="btn">Create account</button>
          </form>
        </div>

        <div className="card">
          <h3>All students ({students.length})</h3>
          <table className="simple-table">
            <thead><tr><th>Name</th><th>Username</th><th></th></tr></thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.username}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn secondary" onClick={() => resetPassword(s.id)}>Reset PW</button>
                    <button className="btn danger" onClick={() => remove(s.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {students.length === 0 && <tr><td colSpan={3} style={{ color: 'var(--text-muted)' }}>No students yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
