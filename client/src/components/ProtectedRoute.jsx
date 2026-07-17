import { Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

// 'full' (default, single combined deploy) | 'admin' | 'student' — set via the
// VITE_APP_MODE build-time env var when deploying admin and student panels as
// two separate Vercel projects/links. See DEPLOY.md.
const MODE = import.meta.env.VITE_APP_MODE || 'full';

export default function ProtectedRoute({ role, children }) {
  const { user, loading, logout } = useAuth();
  const wrongPortal = !loading && !!user && !!role && user.role !== role;

  // On a restricted (admin-only or student-only) deployment, an account of
  // the wrong role has nowhere to land — the other portal's routes aren't
  // even mounted. Rather than risk a redirect loop, sign them out cleanly
  // and drop them back on that deployment's own login screen.
  useEffect(() => {
    if (wrongPortal && MODE !== 'full') logout();
  }, [wrongPortal]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (wrongPortal) {
    if (MODE !== 'full') return null; // signing out via the effect above
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }
  return children;
}
