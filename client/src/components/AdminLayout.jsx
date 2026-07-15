import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function AdminLayout() {
  const { logout } = useAuth();
  const { dark, toggle } = useTheme();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Admin Panel</div>
        <nav>
          <NavLink to="/admin/students" className={({ isActive }) => isActive ? 'active' : ''}>Students</NavLink>
          <NavLink to="/admin/tests" className={({ isActive }) => isActive ? 'active' : ''}>Tests</NavLink>
          <NavLink to="/admin/mocks" className={({ isActive }) => isActive ? 'active' : ''}>Mock Bundles</NavLink>
          <NavLink to="/admin/results" className={({ isActive }) => isActive ? 'active' : ''}>Results</NavLink>
          <NavLink to="/admin/grading" className={({ isActive }) => isActive ? 'active' : ''}>Writing Queue</NavLink>
          <NavLink to="/admin/messages" className={({ isActive }) => isActive ? 'active' : ''}>Messages</NavLink>
          <NavLink to="/admin/motivation" className={({ isActive }) => isActive ? 'active' : ''}>Motivation</NavLink>
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
