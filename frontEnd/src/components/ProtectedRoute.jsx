import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './Spinner';

const homeForRole = {
  admin: '/admin',
  hr: '/hr',
  employee: '/me',
};

export default function ProtectedRoute({ role, requirePasswordChange = false }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner fullScreen />;
  if (!user)   return <Navigate to="/login" replace />;
  if (user.mustChangePassword && !requirePasswordChange) {
    return <Navigate to="/change-password" replace />;
  }
  if (requirePasswordChange && !user.mustChangePassword) {
    return <Navigate to={homeForRole[user.role] || '/'} replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to={homeForRole[user.role] || '/'} replace />;
  }
  return <Outlet />;
}
