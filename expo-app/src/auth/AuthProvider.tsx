import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { API_URL } from '@/constants/config';
import { loginRequest, setUnauthorizedHandler } from '@/api/client';
import { clearToken, getToken, saveToken } from './tokenStore';

type AuthContextValue = {
  token: string | null;
  isReady: boolean;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void getToken().then((stored) => {
      if (mounted) {
        setToken(stored);
        setIsReady(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setToken(null);
  }, []);

  // 401 from any API call (expired/rotated password) → drop the session.
  // The router guard in _layout.tsx redirects to /login when token is null.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const login = useCallback(async (password: string) => {
    const { token: fresh } = await loginRequest(API_URL, password);
    await saveToken(fresh);
    setToken(fresh);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ token, isReady, login, logout }),
    [token, isReady, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
