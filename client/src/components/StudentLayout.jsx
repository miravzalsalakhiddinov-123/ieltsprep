import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Sun, Moon, LogOut, LayoutDashboard, BarChart3, ClipboardList, GraduationCap, FileCheck2, BookMarked, Info, Newspaper } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../api/client';

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
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [latestPost, setLatestPost] = useState(null);

  useEffect(() => {
    api.listBlogPosts(1).then(posts => setLatestPost(posts[0] || null)).catch(() => {});
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">I</span>IELTS Prep</div>
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

          {latestPost && (
            <div className="sidebar-blog-widget" onClick={() => navigate('/blog')}>
              <div className="sidebar-blog-widget-label"><Newspaper size={12} strokeWidth={2.2} /> From the blog</div>
              <div className="sidebar-blog-widget-title">{latestPost.title}</div>
            </div>
          )}
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
