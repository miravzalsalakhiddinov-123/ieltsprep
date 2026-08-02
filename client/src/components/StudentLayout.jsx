import { NavLink, Outlet } from 'react-router-dom';
import { Sun, Moon, LogOut, LayoutDashboard, BarChart3, ClipboardList, GraduationCap, FileCheck2, BookMarked } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/practice', label: 'Practice', icon: ClipboardList },
  { to: '/lessons', label: 'Lessons', icon: GraduationCap },
  { to: '/mock', label: 'Full Mock', icon: FileCheck2 },
  { to: '/vocabulary', label: 'Vocabulary', icon: BookMarked }
];

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">I</span>IELTS Prep</div>
        <nav>
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => isActive ? 'active' : ''}>
              <item.icon size={16} strokeWidth={2} />{item.label}
            </NavLink>
          ))}
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
