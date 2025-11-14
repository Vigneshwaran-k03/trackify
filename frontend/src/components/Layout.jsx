import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getToken, getRole, getUserName, clearAuth } from '../utils/authStorage';
import Notification from './Notification';
import male1 from '../assets/profile_image/male1.png';
import male2 from '../assets/profile_image/male2.png';
import male3 from '../assets/profile_image/male3.png';
import male4 from '../assets/profile_image/male4.png';
import male5 from '../assets/profile_image/male5.png';
import female1 from '../assets/profile_image/female1.png';
import female2 from '../assets/profile_image/female2.png';
import female3 from '../assets/profile_image/female3.png';
import female4 from '../assets/profile_image/female4.png';
import female5 from '../assets/profile_image/female5.png';

import { LayoutDashboard, UserPen, UserPlus, Target, BarChart3, ClipboardCheck, NotebookText, Menu as MenuIcon, Home as HomeIcon } from 'lucide-react';

export default function Layout() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [userName, setUserName] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [avatar, setAvatar] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = getToken();
    const role = getRole();
    const name = getUserName();
    setIsAuthenticated(!!token);
    setUserRole(role || '');
    setUserName(name || 'User');
    if (token) {
      fetch('http://localhost:3000/auth/profile', { headers: { Authorization: `Bearer ${token}` }})
        .then(async (r) => {
          if (r.status === 401) {
            clearAuth();
            navigate('/login');
            return null;
          }
          try { return await r.json(); } catch { return null; }
        })
        .then((data)=> { if (data) setAvatar(data?.avatar || 'default:male1'); })
        .catch(()=>{});
    }
    const onAvatarUpdated = (e) => {
      const next = e?.detail?.avatar;
      if (next) setAvatar(next);
    };
    const handleResize = () => {
      const mobile = window.innerWidth < 768; // md breakpoint
      setIsMobile(mobile);
    };
    // initialize once
    handleResize();
    if (window.innerWidth >= 768) setShowSidebar(true);
    window.addEventListener('avatar_updated', onAvatarUpdated);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('avatar_updated', onAvatarUpdated);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleLogout = () => {
    clearAuth();
    try { localStorage.removeItem('notif_popup_shown'); } catch {}
    setIsAuthenticated(false);
    navigate('/login');
  };

  const getPageTitle = () => {
    const path = location.pathname;
    switch (path) {
      case '/dashboard':
      case '/':
        return `${userRole.charAt(0).toUpperCase() + userRole.slice(1)} Dashboard`;
      case '/kracreation':
        return 'Create KRA';
      case '/create_profile':
        return 'Create Profile';
      case '/profile':
        return 'Profile';
      default:
        return 'Dashboard';
    }
  };

  const getNavigationItems = () => {
    const roleLower = (userRole || '').toLowerCase();
    
    // Admin navigation items
    if (roleLower === 'admin') {
      return [
        { path: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
        { path: '/create_profile', label: 'Create Profile', Icon: UserPlus },
        { path: '/profile', label: 'Profile', Icon: UserPen },
        { path: '/kracreation', label: 'Create KRA', Icon: Target },
        { path: '/kpi_log', label: 'KPI Log', Icon: BarChart3 },
        { path: '/kra_log', label: 'KRA Log', Icon: NotebookText },
        { path: '/requests', label: 'Requests & Approvals', Icon: ClipboardCheck }
      ];
    }
    
    // Manager navigation items
    if (roleLower === 'manager') {
      return [
        { path: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
        { path: '/create_profile', label: 'Create Employee', Icon: UserPlus },
        { path: '/profile', label: 'Profile', Icon: UserPen },
        { path: '/kracreation', label: 'Create KRA', Icon: Target },
        { path: '/create_kpi', label: 'Create & My KPI', Icon: BarChart3 },
        { path: '/kpi_log', label: 'KPI Log', Icon: BarChart3 },
        { path: '/kra_log', label: 'KRA Log', Icon: NotebookText },
        { path: '/requests', label: 'Requests & Approvals', Icon: ClipboardCheck }
      ];
    }
    
    // Default/Employee navigation items
    return [
      { path: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
      { path: '/profile', label: 'Profile', Icon: UserPen },
      { path: '/create_kpi', label: 'Create & My KPI', Icon: BarChart3 },
      { path: '/kpi_log', label: 'KPI Log', Icon: BarChart3 },
      { path: '/requests', label: 'Requests & Approvals', Icon: ClipboardCheck }
    ];

    return baseItems;
  };

  const resolveAvatar = (val) => {
    const map = { male1, male2, male3, male4, male5, female1, female2, female3, female4, female5 };
    if (!val || typeof val !== 'string') return male1;
    if (val.startsWith('default:')) {
      const key = val.split(':')[1];
      return map[key] || male1;
    }
    return val; // uploaded absolute URL
  };

  return (
    <div className="flex h-screen w-screen bg-gray-50">
      {/* Sidebar */}
      {/* Mobile overlay */}
      {isMobile && showSidebar && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowSidebar(true)} />
      )}
      {(() => {
        const base = 'w-64 shrink-0 bg-gradient-to-t from-orange-300 via-rose-100 to-amber-100 text-gray-800 flex flex-col';
        const mobile = `fixed z-50 left-0 top-0 h-full transform transition-transform duration-200 ${showSidebar ? 'translate-x-0' : '-translate-x-full'}`;
        const desktop = `${showSidebar ? 'block' : 'hidden'} relative`;
        const cls = `${isMobile ? mobile : desktop} ${base}`;
        return (
          <div className={cls}>
            <div className="p-6">
              <p className="text-4xl font-stretch-50% text-black font-bold"><img src="./src/assets/logo.png" className="w-50 h-20" alt="logo" /></p>
            </div>
            <nav className="flex-1 px-4 overflow-y-auto">
              <ul className="space-y-2">
                {getNavigationItems().map((item) => (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={`flex items-center gap-3 py-2 px-4 rounded hover:bg-blue-100 hover:text-blue-800 transition-colors ${
                        location.pathname === item.path ? 'bg-blue-100 text-blue-800' : ''
                      }`}
                      onClick={() => { if (isMobile) setShowSidebar(false); }}
                    >
                      <span className="text-gray-800"><item.Icon className="w-4 h-4" /></span>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="p-4">
              <button
                onClick={handleLogout}
                className="w-full py-2 px-4 bg-red-600 rounded hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        );
      })()}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <header className="bg-gradient-to-r from-amber-50 via-rose-50 to-orange-50 shadow p-4 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSidebar(prev => !prev)}
                className="inline-flex bg-indigo-600 items-center justify-center w-10 h-10 rounded-md border border-gray-300 hover:bg-gray-100"
                aria-label="Toggle sidebar"
                title="Toggle sidebar"
              >
                <MenuIcon className="w-5 h-5 text-white" />
              </button>
              <h2 className="text-xl text-black font-semibold">{getPageTitle()}</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-600">Welcome, {userName}</span>
              <Link to="/dashboard" title="Home" className="inline-flex items-center justify-center w-10 h-10 rounded-md border border-gray-300 hover:bg-gray-100">
                <HomeIcon className="w-7 h-7" />
              </Link>
              <Notification />
              <Link to="/profile" title="Profile" className="inline-flex items-center justify-center w-10 h-10 rounded-md border hover:bg-gray-100 overflow-hidden">
                <img src={resolveAvatar(avatar)} alt="avatar" className="w-full h-full object-cover" />
              </Link>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
