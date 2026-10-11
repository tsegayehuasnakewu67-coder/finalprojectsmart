import { useLayoutEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatEthiopianDate } from '../utils/ethiopianDateTime';

const WORKSPACE_BACKGROUND_IMAGES = [
  'mau7.jfif',
  'mau1.jfif',
  'mau2.jfif',
  'mau3.jfif',
  'mau4.jfif',
  'mau5.jfif',
  'mau6.jfif',
];

const adminNav = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/users', icon: Users, label: 'Employees' },
  { to: '/admin/reports', icon: ClipboardList, label: 'Reports' },
  { to: '/admin/register', icon: UserPlus, label: 'Register Employee' },
  { to: '/admin/settings', icon: Settings, label: 'System Settings' },
  { to: '/admin/notifications', icon: Bell, label: 'Messages & Warnings' },
  { to: '/admin/leaves', icon: CalendarDays, label: 'Leave Management' },
];

const employeeNav = [
  { to: '/me', icon: LayoutDashboard, label: 'My Dashboard' },
  { to: '/me/notifications', icon: Bell, label: 'My Notifications' },
  { to: '/me/leaves', icon: CalendarDays, label: 'My Leave Requests' },
];

const hrNav = [
  { to: '/hr', icon: LayoutDashboard, label: 'HR Dashboard' },
  { to: '/hr/employees', icon: Users, label: 'Employee Directory' },
  { to: '/hr/reports', icon: ClipboardList, label: 'Attendance Reports' },
  { to: '/hr/leaves', icon: CalendarDays, label: 'Leave Reviews' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const contentRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = user?.role === 'admin' ? adminNav : user?.role === 'hr' ? hrNav : employeeNav;

  useLayoutEffect(() => {
    contentRef.current?.scrollTo(0, 0);
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const initials = user?.fullName?.trim()?.charAt(0)?.toUpperCase() || 'U';
  const showWorkspaceBackground = user?.role === 'admin' || user?.role === 'employee';

  return (
    <div className={`app-shell${collapsed ? ' app-shell--collapsed' : ''}${showWorkspaceBackground ? ' app-shell--workspace-background' : ''}`}>
      {showWorkspaceBackground && (
        <div className="app-background" aria-hidden="true">
          {WORKSPACE_BACKGROUND_IMAGES.map((image, index) => (
            <img
              key={image}
              src={`/login-backgrounds/${image}`}
              alt=""
              style={{ animationDelay: `-${index * 6}s` }}
            />
          ))}
        </div>
      )}
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="app-sidebar-scrim"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`app-sidebar${mobileOpen ? ' app-sidebar--open' : ''}`}>
        <div className="app-brand">
          <div className="app-brand-mark" aria-hidden="true">
            <Building2 size={20} />
          </div>
          <div className="app-brand-copy">
            <strong>Smart Attendance</strong>
            <span>Workforce management</span>
          </div>
          <button
            aria-label="Close navigation"
            className="app-icon-button app-mobile-close"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="app-nav-caption">WORKSPACE</div>
        <nav className="app-nav" aria-label="Main navigation">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin' || to === '/hr' || to === '/me'}
              className={({ isActive }) => `app-nav-link${isActive ? ' is-active' : ''}`}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
              <ChevronRight className="app-nav-chevron" size={15} aria-hidden="true" />
            </NavLink>
          ))}
          <div className="app-nav-divider" />
          <NavLink
            to="/kiosk"
            className="app-nav-link"
            title={collapsed ? 'Attendance station' : undefined}
          >
            <Camera size={18} aria-hidden="true" />
            <span>Attendance station</span>
            <ChevronRight className="app-nav-chevron" size={15} aria-hidden="true" />
          </NavLink>
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-user">
            <div className="app-user-avatar" aria-hidden="true">{initials}</div>
            <div className="app-user-copy">
              <strong title={user?.fullName}>{user?.fullName}</strong>
              <span title={user?.department}>{user?.department || user?.role}</span>
            </div>
          </div>
          <button className="app-signout" onClick={handleLogout}>
            <LogOut size={17} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="app-main">
        <header className="app-topbar">
          <div className="app-topbar-start">
            <button
              aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={mobileOpen}
              className="app-icon-button app-menu-button"
              onClick={() => setMobileOpen(value => !value)}
            >
              {mobileOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
            <button
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              className="app-icon-button app-collapse-button"
              onClick={() => setCollapsed(value => !value)}
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            <span className="app-today">{formatEthiopianDate(new Date(), { weekday: 'long' })}</span>
          </div>
          <div className="app-topbar-user">
            <span className="app-role-badge">{user?.role}</span>
            {user?.employeeId && <span className="app-id-badge">{user.employeeId}</span>}
            <div className="app-topbar-avatar" aria-hidden="true">{initials}</div>
          </div>
        </header>

        <div className="app-content" ref={contentRef}>
          <div className="app-page legacy-page">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
