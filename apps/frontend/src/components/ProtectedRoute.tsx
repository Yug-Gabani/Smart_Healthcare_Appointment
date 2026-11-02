import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role, User } from '../types';

interface ProtectedRouteProps {
  user: User | null;
  roles?: Role[];
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ user, roles, children }) => {
  const location = useLocation();

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    // Logged in but wrong role — send to the appropriate home.
    if (user.role === 'ADMIN')      return <Navigate to="/admin/doctors" replace />;
    if (user.role === 'PHARMACIST') return <Navigate to="/pharmacy" replace />;
    if (user.role === 'DOCTOR')     return <Navigate to="/doctor" replace />;
    return <Navigate to="/patient" replace />;
  }

  return <>{children}</>;
};
