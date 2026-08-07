import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const MODE = import.meta.env.VITE_APP_MODE || 'full';
const HEADING = MODE === 'admin' ? 'Admin Panel' : MODE === 'student' ? 'IELTS Prep — Student Portal' : 'IELTS Prep Platform';
const SUBTEXT = MODE === 'admin'
  ? 'Log in with your admin username and password.'
  : 'Log in with your username and password.';
const SHOW_SIGNUP_LINK = MODE !== 'admin';
// Google sign-in is for students only — the admin portal stays
// password-only since it's not something you'd want students' Google
// accounts anywhere near.
const SHOW_GOOGLE_BUTTON = MODE !== 'admin';

const GOOGLE_ERROR_MESSAGES = {
  google_access_denied: 'Google sign-in was cancelled.',
  google_no_code: 'Google sign-in didn\u2019t complete. Please try again.',
  google_token_exchange: 'Could not complete Google sign-in. Please try again.',
  google_profile: 'Could not read your Google profile. Please try again.',
  google_incomplete_profile: 'Your Google account is missing an email address, so we can\u2019t sign you in that way.'
};

export default function Login() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const googleErrorParam = searchParams.get('error');
  const [error, setError] = useState(
    googleErrorParam ? (GOOGLE_ERROR_MESSAGES[googleErrorParam] || 'Google sign-in failed. Please try again.') : ''
  );
  const [busy, setBusy] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setUnverified(false);
    setResendDone(false);
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
      if ((err.message || '').toLowerCase().includes('verify your email')) setUnverified(true);
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setBusy(true);
    try {
      await api.resendVerification(username);
      setResendDone(true);
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
        {unverified && !resendDone && (
          <p style={{ fontSize: 13.5, marginTop: -8 }}>
            <button type="button" className="btn secondary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={handleResend} disabled={busy}>
              Resend verification email
            </button>
          </p>
        )}
        {resendDone && <div style={{ fontSize: 13.5, color: 'var(--ok)', marginTop: -8 }}>Verification email sent — check your inbox.</div>}
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
        {SHOW_GOOGLE_BUTTON && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0', color: 'var(--text-muted)', fontSize: 12.5 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              or
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <a
              href="/api/auth/google"
              className="btn secondary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }}
            >
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 3l6-6C34 5.1 29.3 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.4-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.9 1.1 8 3l6-6C34 5.1 29.3 3 24 3c-7.5 0-14 4.2-17.7 10.7z"/>
                <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 36.3 26.7 37 24 37c-5.3 0-9.6-3.1-11.3-7.6l-6.5 5C9.6 40.6 16.2 45 24 45z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 2.9-3 5.4-5.7 7l6.2 5.2C39.7 37.4 45 31.4 45 24c0-1.2-.1-2.4-.4-3.5z"/>
              </svg>
              Sign in with Google
            </a>
          </>
        )}
        {SHOW_SIGNUP_LINK && (
          <p style={{ textAlign: 'center', marginTop: 14, fontSize: 13.5 }}>
            Don't have an account? <Link to="/signup">Sign up</Link>
          </p>
        )}
      </form>
    </div>
  );
}
