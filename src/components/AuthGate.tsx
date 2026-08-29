import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAuthSession, loginToDemo, logoutOfDemo, resetDemo } from '../lib/auth';
import { AuthContext, type AuthContextValue } from '../lib/auth-context';
import type { Profile } from '../types/app';
import { LoginPage } from '../routes/Login';
import { LoadingState } from './AsyncState';

export function AuthGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getAuthSession()
      .then((session) => {
        if (active && session.authenticated) setProfile(session.profile);
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

  const value = useMemo<AuthContextValue>(
    () => ({
      profile,
      login: async (email, password) => {
        const session = await loginToDemo(email, password);
        if (!session.authenticated) throw new Error('The demo session could not be opened.');
        queryClient.clear();
        setProfile(session.profile);
      },
      logout: async () => {
        await logoutOfDemo();
        queryClient.clear();
        setProfile(null);
      },
      reset: async () => {
        await resetDemo();
        await queryClient.resetQueries();
      },
    }),
    [profile, queryClient],
  );

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="auth-loading">
          <LoadingState label="Preparing the demo…" />
        </div>
      ) : profile ? (
        children
      ) : (
        <LoginPage />
      )}
    </AuthContext.Provider>
  );
}
