import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">IELTS Prep</div>
        <nav>
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>Dashboard</NavLink>
          <NavLink to="/analytics" className={({ isActive }) => isActive ? 'active' : ''}>Analytics</NavLink>
          <NavLink to="/practice" className={({ isActive }) => isActive ? 'active' : ''}>Practice</NavLink>
          <NavLink to="/mock" className={({ isActive }) => isActive ? 'active' : ''}>Full Mock</NavLink>
          <a className="navlink" href="https://vocabulary-trainer-smoky.vercel.app/" target="_blank" rel="noopener noreferrer">
            Vocabulary ↗
          </a>
        </nav>
        <div className="bottom-actions">
          <button className="btn secondary" onClick={toggle}>{dark ? '☀️ Light mode' : '🌙 Dark mode'}</button>
          <button className="btn secondary" onClick={logout}>Log out</button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
