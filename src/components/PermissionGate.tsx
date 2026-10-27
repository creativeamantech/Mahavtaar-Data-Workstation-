import { useAuth } from '../contexts/AuthContext';

interface PermissionGateProps {
  view: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({ view, fallback = null, children }: PermissionGateProps) {
  const { hasPermission } = useAuth();
  return hasPermission(view) ? <>{children}</> : <>{fallback}</>;
}
