import { NavLink, Outlet } from 'react-router-dom';
import { Sun, Moon, LogOut } from 'lucide-react';
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
          <NavLink to="/lessons" className={({ isActive }) => isActive ? 'active' : ''}>Lessons</NavLink>
          <NavLink to="/mock" className={({ isActive }) => isActive ? 'active' : ''}>Full Mock</NavLink>
          <a className="navlink" href="https://vocabulary-trainer-smoky.vercel.app/" target="_blank" rel="noopener noreferrer">
            Vocabulary ↗
          </a>
        </nav>
        <div className="bottom-actions">
          <button className="btn secondary" onClick={toggle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {dark ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />} {dark ? 'Light mode' : 'Dark mode'}
          </button>
          <button className="btn secondary" onClick={logout} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <LogOut size={15} strokeWidth={2} /> Log out
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
