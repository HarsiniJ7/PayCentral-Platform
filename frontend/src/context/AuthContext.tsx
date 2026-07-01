import { createContext, useContext, useState, ReactNode } from "react";
import { api, setToken, getRefreshToken, setRefreshToken } from "../api/client";
import type { AuthUser } from "../types";

interface LoginResponse {
  token: string;
  refreshToken: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "pc_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  });
  const [loading] = useState(false);

  async function login(email: string, password: string) {
    const res = await api.post<LoginResponse>("/auth/login", { email, password });
    setToken(res.token);
    setRefreshToken(res.refreshToken);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(res.user));
    setUser(res.user);
  }

  function logout() {
    // Best-effort server-side revocation so the refresh token can't be reused
    // even if it was captured earlier - doesn't block the local logout if it fails.
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      api.post("/auth/logout", { refreshToken }).catch(() => undefined);
    }
    setToken(null);
    setRefreshToken(null);
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
