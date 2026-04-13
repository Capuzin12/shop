import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, adminOnly = false, managerOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) return <Navigate to="/login" />;

  if (adminOnly && user.role !== 'admin') return <Navigate to="/" />;

  if (managerOnly && user.role !== 'manager' && user.role !== 'admin') return <Navigate to="/" />;

  return children;
}