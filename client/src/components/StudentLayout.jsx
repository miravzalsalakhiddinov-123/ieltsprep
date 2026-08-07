import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Sun, Moon, LogOut, LayoutDashboard, BarChart3, ClipboardList, GraduationCap, FileCheck2, BookMarked, Info, Newspaper, Menu, X } from 'lucide-react';
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
  },
  {
    label: 'More',
    items: [
      { to: '/blog', label: 'Blog', icon: Newspaper },
      { to: '/about', label: 'About', icon: Info }
    ]
  }
];

export default function StudentLayout() {
  const { logout } = useAuth();
  const { dark, toggle } = useTheme();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile drawer whenever the route changes (e.g. after tapping a link).
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <div className="app-shell">
      <header className="mobile-topbar">
        <div className="brand"><span className="brand-mark">I</span>IELTS Prep</div>
        <button className="mobile-menu-btn" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
          <Menu size={22} strokeWidth={2.2} />
        </button>
      </header>

      {menuOpen && <div className="mobile-drawer-backdrop" onClick={() => setMenuOpen(false)} />}

      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="sidebar-top-row">
          <div className="brand"><span className="brand-mark">I</span>IELTS Prep</div>
          <button className="mobile-menu-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
            <X size={20} strokeWidth={2.2} />
          </button>
        </div>
        <nav className="sidebar-nav">
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
