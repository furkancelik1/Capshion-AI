import React, { createContext, useContext, useState } from 'react';
import { api, setToken } from '../services/api';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
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
    } catch (err: any) {
      return { error: err.message || 'Giriş işlemi başarısız.' };
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
    } catch (err: any) {
      return { error: err.message || 'Kayıt işlemi başarısız.' };
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
