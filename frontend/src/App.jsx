import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import AdminCreateProfile from './pages/admin/Create_Profile';
import AdminKracreation from './pages/admin/Kracreation';
import ManagerKracreation from './pages/manager/Kracreation';
import ManagerCreateEmployee from './pages/manager/Create_Employee';
import ManagerCreateKPI from './pages/manager/Create_KPI';
import EmployeeCreateKPI from './pages/employee/Create_KPI';
import EmployeeProfile from './pages/employee/Profile';
import ManagerProfile from './pages/manager/Profile';
import AdminProfile from './pages/admin/Profile';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Layout from './components/Layout';
import { useState, useEffect } from 'react';
import KraDetail from './pages/common/KraDetail';
import { getToken, getRole } from './utils/authStorage';
import KpiLogRouter from './pages/common/KpiLogRouter';
import KraLogRouter from './pages/common/KraLogRouter';
import RequestsRouter from './pages/common/RequestsRouter';

// Import background image
import backgroundImage from './assets/background.png';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());
  const [userRole, setUserRole] = useState(getRole() || '');

  // Listen for authentication state changes
  useEffect(() => {
    const handleStorageChange = () => {
      const token = getToken();
      const role = getRole();
      setIsAuthenticated(!!token);
      setUserRole(role || '');
    };

    // Listen for storage events to handle auth changes across tabs
    window.addEventListener('storage', handleStorageChange);
    
    // Also check auth state on mount
    handleStorageChange();
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const getDashboardElement = () => {
    const role = (userRole || '').toLowerCase();
    
    // If no role, redirect to login
    if (!role) {
      return <Navigate to="/login" replace />;
    }
    
    // Return the appropriate dashboard based on role
    switch (role) {
      case 'admin':
        return <AdminDashboard />;
      case 'manager':
        return <ManagerDashboard />;
      case 'employee':
        return <EmployeeDashboard />;
      default:
        // If role is not recognized, clear auth and redirect to login
        clearAuth();
        return <Navigate to="/login" replace />;
    }
  };

  const ProtectedLayout = () => {
    const [isReady, setIsReady] = useState(false);
    const token = getToken();
    const role = getRole();
    
    useEffect(() => {
      // Add a small delay to ensure auth state is properly set
      const timer = setTimeout(() => {
        setIsReady(true);
      }, 100);
      
      return () => clearTimeout(timer);
    }, []);
    
    // Show loading state while checking auth
    if (!isReady) {
      return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
    }
    
    // If no token, redirect to login
    if (!token) {
      return <Navigate to="/login" replace />;
    }
    
    // If token exists but no role, something's wrong - clear auth and redirect to login
    if (!role) {
      clearAuth();
      return <Navigate to="/login" replace />;
    }
    
    return <Layout />;
  };

  // Helper function to render protected routes based on role
  const renderProtectedRoute = (path, element, allowedRoles = []) => {
    const userRoleLower = userRole.toLowerCase();
    const isAllowed = allowedRoles.length === 0 || allowedRoles.includes(userRoleLower);
    
    if (!isAuthenticated) {
      return <Route key={path} path={path} element={<Navigate to="/login" replace />} />;
    }
    
    if (!isAllowed) {
      return <Route key={path} path={path} element={<Navigate to="/dashboard" replace />} />;
    }
    
    return <Route key={path} path={path} element={element} />;
  };

  // Background style for protected routes
  const protectedRouteStyle = {
    backgroundImage: `url(${backgroundImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
    minHeight: '100vh',
    width: '100%',
    position: 'relative',
    zIndex: 1
  };

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/forgot" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Protected routes */}
        <Route element={
          <div style={protectedRouteStyle}>
            <div style={{
              backdropFilter: 'blur(5px)',
              minHeight: '100vh',
              width: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.8)'
            }}>
              <ProtectedLayout />
            </div>
          </div>
        }>
          <Route index element={getDashboardElement()} />
          <Route path="dashboard" element={getDashboardElement()} />
          
          {/* Role-based routes */}
          {renderProtectedRoute("create_profile", 
            userRole === 'admin' ? <AdminCreateProfile /> : <ManagerCreateEmployee />, 
            ['admin', 'manager']
          )}
          
          {renderProtectedRoute("kracreation",
            userRole === 'admin' ? <AdminKracreation /> : <ManagerKracreation />,
            ['admin', 'manager']
          )}
          
          {renderProtectedRoute("create_kpi",
            userRole === 'manager' ? <ManagerCreateKPI /> : <EmployeeCreateKPI />,
            ['manager', 'employee']
          )}
          
          <Route
            path="profile"
            element={
              userRole === 'employee' ? <EmployeeProfile /> :
              userRole === 'manager' ? <ManagerProfile /> :
              userRole === 'admin' ? <AdminProfile /> :
              <Navigate to="/dashboard" replace />
            }
          />
          
          <Route path="kpi_log" element={<KpiLogRouter />} />
          <Route path="kra_log" element={<KraLogRouter />} />
          <Route path="requests" element={<RequestsRouter />} />
          
          {/* 404 route for protected paths */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
        
        {/* Public 404 route */}
        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </Router>
  );
}

export default App;
