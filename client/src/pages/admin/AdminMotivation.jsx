import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function AdminMotivation() {
  const [current, setCurrent] = useState(null);
  const [message, setMessage] = useState('');

  function refresh() { api.latestMotivation().then(setCurrent); }
  useEffect(refresh, []);

  async function post(e) {
    e.preventDefault();
    if (!message) return;
    await api.postMotivation(message);
    setMessage('');
    refresh();
  }

  return (
    <div>
      <div className="topbar-row"><div className="welcome-title">⚡ Daily Boost</div></div>
      <div className="card" style={{ maxWidth: 480 }}>
        <h3>Current banner</h3>
        <div className="motivation-banner" style={{ marginBottom: 16 }}>
          <span className="motivation-eyebrow small">⚡ Daily Boost</span>
          <div style={{ marginTop: 8 }}>{current ? current.message : 'Nothing posted yet.'}</div>
        </div>
        <h3>Post a new message</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -6 }}>Shown to all students on their dashboard.</p>
        <form onSubmit={post}>
          <div className="field">
            <textarea rows={3} value={message} onChange={e => setMessage(e.target.value)} placeholder="e.g. Great progress this week, everyone — keep it up!" /></div>
          <button className="btn">Post</button>
        </form>
      </div>
    </div>
  );
}
