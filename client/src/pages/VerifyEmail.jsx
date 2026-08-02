import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState('checking'); // checking | ok | error

  useEffect(() => {
    if (!token) { setStatus('error'); return; }
    api.verifyEmail(token).then(() => setStatus('ok')).catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ textAlign: 'center' }}>
        {status === 'checking' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⏳</div>
            <h1>Verifying…</h1>
            <p>Hang on a moment.</p>
          </>
        )}
        {status === 'ok' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
            <h1>Email verified!</h1>
            <p>Your account is active. You can log in now.</p>
            <Link className="btn" style={{ width: '100%', display: 'block', marginTop: 8, textAlign: 'center' }} to="/login">Continue to log in →</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
            <h1>Link invalid or expired</h1>
            <p>This verification link no longer works. Try logging in — you'll get an option to resend it.</p>
            <Link className="btn secondary" style={{ width: '100%', display: 'block', marginTop: 8, textAlign: 'center' }} to="/login">Back to log in</Link>
          </>
        )}
      </div>
    </div>
  );
}
