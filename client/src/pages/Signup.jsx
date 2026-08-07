import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false); // true once the account has actually been created

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!name.trim() || !username.trim() || !email.trim() || !password) {
      setError('Please fill in every field.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await api.register(name.trim(), username.trim(), password, email.trim());
      // Deliberately not logging the user in here — they see the
      // confirmation below, then go to the login page and sign in with the
      // credentials they just chose.
      setDone(true);
    } catch (err) {
      setError(err.message || 'Could not create account');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="login-wrap">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📧</div>
          <h1>Check your email</h1>
          <p>We've sent a verification link to <b>{email.trim()}</b>. Click it to activate your account, then log in with the username and password you just chose.</p>
          <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={() => navigate('/login')}>
            Continue to log in →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Create your account</h1>
        <p>Sign up to start studying — you'll log in separately once your account is created.</p>
        <a
          href="/api/auth/google"
          className="btn secondary"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', marginBottom: 4 }}
        >
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 3l6-6C34 5.1 29.3 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.4-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.9 1.1 8 3l6-6C34 5.1 29.3 3 24 3c-7.5 0-14 4.2-17.7 10.7z"/>
            <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 36.3 26.7 37 24 37c-5.3 0-9.6-3.1-11.3-7.6l-6.5 5C9.6 40.6 16.2 45 24 45z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 2.9-3 5.4-5.7 7l6.2 5.2C39.7 37.4 45 31.4 45 24c0-1.2-.1-2.4-.4-3.5z"/>
          </svg>
          Sign up with Google
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 16px', color: 'var(--text-muted)', fontSize: 12.5 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          or sign up with a username and password
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        {error && <div className="error-text">{error}</div>}
        <div className="field">
          <label>Full name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Username</label>
          <input className="input" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" />
        </div>
        <div className="field">
          <label>Email</label>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="field">
          <label>Password</label>
          <div className="password-field">
            <input
              className="input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
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
        <div className="field">
          <label>Confirm password</label>
          <input
            className="input"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        <p style={{ textAlign: 'center', marginTop: 14, fontSize: 13.5 }}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
