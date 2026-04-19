import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getRoleLandingPath } from '../utils/roles';

export default function ProtectedRoute({
  children,
  allowedRoles = null,
  redirectTo = null,
}) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const fallbackPath = redirectTo || (user ? getRoleLandingPath(user.role) : '/login');

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-10 text-center text-slate-500">Завантаження...</div>;

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return children;
}
