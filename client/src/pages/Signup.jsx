import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false); // true once the account has actually been created

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!name.trim() || !username.trim() || !password) {
      setError('Please fill in every field.');
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
      await api.register(name.trim(), username.trim(), password);
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
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <h1>Account created!</h1>
          <p>Your account is ready. Log in with the username and password you just chose to start studying.</p>
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
