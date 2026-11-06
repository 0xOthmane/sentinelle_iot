import { createContext } from 'react';

export type AuthContextValue = {
  token: string | null;
  isReady: boolean;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
