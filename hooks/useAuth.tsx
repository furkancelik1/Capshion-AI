import React, { createContext, useContext, useState } from 'react';
import { api, setToken } from '../services/api';

interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, ageRange?: string | null) => Promise<{ error: string | null }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setLoading(true);
      const result = await api.login(email, password);

      if (result && result.user && result.token) {
        setToken(result.token);
        setUser(result.user);
        return { error: null };
      }
      return { error: 'Token veya kullanıcı bilgisi alınamadı.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Giriş işlemi başarısız.';
      return { error: msg };
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, password: string, ageRange?: string | null) => {
    try {
      setLoading(true);
      const result = await api.register(email, password, ageRange);
      if (result && result.user && result.token) {
        setToken(result.token);
        setUser(result.user);
        return { error: null };
      }
      return { error: 'Kayıt sonrası kullanıcı oluşturulamadı.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kayıt işlemi başarısız.';
      return { error: msg };
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
