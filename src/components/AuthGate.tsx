import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getAuthSession,
  loginToAccount,
  loginToDemo,
  logout,
  registerAccount,
  resetDemo,
  type AuthMode,
} from '../lib/auth';
import { AuthContext, type AuthContextValue } from '../lib/auth-context';
import type { Profile } from '../types/app';
import { LoginPage } from '../routes/Login';
import { LoadingState } from './AsyncState';

export function AuthGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<AuthMode | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getAuthSession()
      .then((session) => {
        if (active && session.authenticated) {
          setProfile(session.profile);
          setMode(session.mode);
          setEmail(session.email ?? null);
        }
      })
      .catch(() => {
        if (active) setProfile(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loading) window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [loading, profile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      profile,
      mode,
      email,
      login: async (email, password) => {
        const session = await loginToAccount(email, password);
        if (!session.authenticated) throw new Error('Your account session could not be opened.');
        queryClient.clear();
        setProfile(session.profile);
        setMode(session.mode);
        setEmail(session.email ?? null);
      },
      loginDemo: async (email, password) => {
        const session = await loginToDemo(email, password);
        if (!session.authenticated) throw new Error('The demo session could not be opened.');
        queryClient.clear();
        setProfile(session.profile);
        setMode(session.mode);
        setEmail(null);
      },
      register: async (input) => {
        const session = await registerAccount(input);
        if (!session.authenticated) throw new Error('Your account could not be created.');
        queryClient.clear();
        setProfile(session.profile);
        setMode(session.mode);
        setEmail(session.email ?? null);
      },
      logout: async () => {
        await logout();
        queryClient.clear();
        setProfile(null);
        setMode(null);
        setEmail(null);
      },
      reset: async () => {
        await resetDemo();
        await queryClient.resetQueries();
      },
    }),
    [email, mode, profile, queryClient],
  );

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="auth-loading">
          <LoadingState label="Checking your session…" />
        </div>
      ) : profile ? (
        children
      ) : (
        <LoginPage />
      )}
    </AuthContext.Provider>
  );
}
