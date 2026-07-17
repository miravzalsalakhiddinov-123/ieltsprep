import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MODE = import.meta.env.VITE_APP_MODE || 'full';
const HEADING = MODE === 'admin' ? 'Admin Panel' : MODE === 'student' ? 'IELTS Prep — Student Portal' : 'IELTS Prep Platform';
const SUBTEXT = MODE === 'admin'
  ? 'Log in with your admin username and password.'
  : 'Accounts are created by your teacher. Log in with the username and password you were given.';

export default function Login() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(username, password);
      if (MODE === 'admin' && user.role !== 'admin') {
        await logout();
        setError('This is the admin portal. Please use the student site to log in.');
        return;
      }
      if (MODE === 'student' && user.role !== 'student') {
        await logout();
        setError('This is the student portal. Please use the admin site to log in.');
        return;
      }
      navigate(user.role === 'admin' ? '/admin/students' : '/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>{HEADING}</h1>
        <p>{SUBTEXT}</p>
        {error && <div className="error-text">{error}</div>}
        <div className="field">
          <label>Username</label>
          <input className="input" value={username} onChange={e => setUsername(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Password</label>
          <div className="password-field">
            <input
              className="input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(s => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>
        <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
    </div>
  );
}
