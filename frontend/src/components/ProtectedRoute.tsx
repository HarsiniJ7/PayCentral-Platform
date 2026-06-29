import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types";

export function ProtectedRoute({ children, allow }: { children: JSX.Element; allow: Role[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-steel">Loading PayCentral...</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!allow.includes(user.role)) {
    return <Navigate to={user.role === "Administrator" ? "/admin" : "/portal"} replace />;
  }
  return children;
}
