import { NavLink, Outlet } from 'react-router-dom';
import {
  Users, ClipboardList, GraduationCap, BookMarked, FileCheck2,
  BarChart3, PenSquare, MessageSquare, Zap, Sun, Moon, LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const NAV_GROUPS = [
  {
    label: 'Content',
    items: [
      { to: '/admin/tests', label: 'Tests', icon: ClipboardList },
      { to: '/admin/lessons', label: 'Lessons', icon: GraduationCap },
      { to: '/admin/vocabulary', label: 'Vocabulary', icon: BookMarked },
      { to: '/admin/mocks', label: 'Mock Bundles', icon: FileCheck2 }
    ]
  },
  {
    label: 'Operations',
    items: [
      { to: '/admin/students', label: 'Students', icon: Users },
      { to: '/admin/results', label: 'Results', icon: BarChart3 },
      { to: '/admin/grading', label: 'Writing Queue', icon: PenSquare },
      { to: '/admin/messages', label: 'Messages', icon: MessageSquare },
      { to: '/admin/motivation', label: 'Daily Boost', icon: Zap }
    ]
  }
];

export default function AdminLayout() {
  const { logout } = useAuth();
  const { dark, toggle } = useTheme();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">A</span>Admin Panel</div>
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
