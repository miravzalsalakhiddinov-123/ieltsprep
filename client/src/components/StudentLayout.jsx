import { NavLink, Outlet } from 'react-router-dom';
import { Sun, Moon, LogOut, LayoutDashboard, BarChart3, ClipboardList, GraduationCap, FileCheck2, BookMarked } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/practice', label: 'Practice', icon: ClipboardList },
      { to: '/mock', label: 'Full Mock', icon: FileCheck2 }
    ]
  },
  {
    label: 'Learning',
    items: [
      { to: '/lessons', label: 'Lessons', icon: GraduationCap },
      { to: '/vocabulary', label: 'Vocabulary', icon: BookMarked },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 }
    ]
  }
];

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">I</span>IELTS Prep</div>
        <nav>
          {NAV_GROUPS.map(group => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map(item => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => isActive ? 'active' : ''}>
                  <item.icon size={18} strokeWidth={2} />{item.label}
                </NavLink>
              ))}
            </div>
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
