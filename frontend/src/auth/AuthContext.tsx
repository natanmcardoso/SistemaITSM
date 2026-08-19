import { createContext, useContext, useState, type ReactNode } from "react";
import type { UserOut } from "../types";

interface AuthState {
  token: string;
  user: UserOut;
}

interface AuthContextValue {
  auth: AuthState | null;
  signIn: (state: AuthState) => void;
  signOut: () => void;
}

const STORAGE_KEY = "itsm.auth";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadStoredAuth(): AuthState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(loadStoredAuth);

  const signIn = (state: AuthState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setAuth(state);
  };

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  };

  return <AuthContext.Provider value={{ auth, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
