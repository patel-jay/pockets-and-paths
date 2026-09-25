import { createContext, useContext } from 'react';
import type { AuthMode, RegistrationInput } from './auth';
import type { Profile } from '../types/app';

export type AuthContextValue = {
  profile: Profile | null;
  mode: AuthMode | null;
  email: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: (email: string, password: string) => Promise<void>;
  register: (input: RegistrationInput) => Promise<void>;
  logout: () => Promise<void>;
  reset: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('Authentication context is unavailable.');
  return context;
}
