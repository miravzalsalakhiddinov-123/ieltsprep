import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function AdminMessages() {
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => { api.listStudents().then(setStudents); }, []);

  async function send(e) {
    e.preventDefault();
    if (!studentId || !body) return;
    await api.sendMessage(Number(studentId), body);
    setBody('');
    setSent(true);
    setTimeout(() => setSent(false), 2000);
  }

  return (
    <div>
      <div className="topbar-row"><div className="welcome-title">Messages</div></div>
      <div className="card" style={{ maxWidth: 480 }}>
        <h3>Send a message</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -6 }}>
          Appears in the student's inbox on their dashboard. Writing feedback is sent automatically from the Writing Queue instead.
        </p>
        {sent && <div style={{ color: 'var(--ok)', fontSize: 13, marginBottom: 10 }}>Message sent.</div>}
        <form onSubmit={send}>
          <div className="field"><label>Student</label>
            <select className="input" value={studentId} onChange={e => setStudentId(e.target.value)}>
              <option value="">Select student…</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Message</label>
            <textarea rows={5} value={body} onChange={e => setBody(e.target.value)} /></div>
          <button className="btn">Send</button>
        </form>
      </div>
    </div>
  );
}
