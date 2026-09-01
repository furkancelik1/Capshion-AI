import React, { createContext, useContext, useState } from 'react';
import Purchases from 'react-native-purchases';
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
      console.log('[Login] ADIM 1: Node.js backend isteği gönderiliyor →', email);
      // NOT: Bu akışta Supabase'e (signInWithPassword/signInWithIdToken) hiç istek atılmıyor.
      // Supabase sadece handleSocialAuth (Apple/Google) akışında kullanılıyor, e-posta/şifre
      // girişinde devreye girmiyor — dolayısıyla burada "Supabase isteği" adımı yok.
      const result: any = await api.login(email, password);

      console.log('[Login] ADIM 2: Backend 200 OK döndü, raw yanıt:', JSON.stringify(result));

      // Backend bazen kullanıcıyı "user" alanı altında nested ({ user: { id, email }, token }),
      // bazen de düz (flat) bir profil objesi olarak ({ id, email, age_range, ... , token })
      // döndürebiliyor. İkisini de kabul et — sadece nested şekli bekleyip flat geldiğinde
      // "kullanıcı bilgisi alınamadı" hatasına düşmeyelim.
      const authUser = result?.user ?? (result?.id ? result : null);
      const token = result?.token ?? result?.accessToken ?? null;

      if (authUser?.id && token) {
        setToken(token);
        setUser({ id: authUser.id, email: authUser.email ?? email });
        try {
          console.log(
            '[RevenueCat] logIn öncesi user:',
            JSON.stringify(authUser),
            'id tipi:',
            typeof authUser.id,
          );
          const { customerInfo } = await Purchases.logIn(String(authUser.id));
          console.log(
            '[RevenueCat] logIn başarılı, aktif appUserID:',
            customerInfo.originalAppUserId,
          );
        } catch (rcErr: unknown) {
          // Bu ikincil işlem (RevenueCat) başarısız olsa bile giriş başarılı sayılır;
          // sadece logla, kullanıcıya hata gösterme.
          console.error(
            '[RevenueCat] logIn hatası:',
            rcErr instanceof Error ? rcErr.message : String(rcErr),
          );
        }
        return { error: null };
      }

      console.log('[Login] ADIM 3: 200 döndü ama user/token eşleşmedi (format sorunu):', JSON.stringify(result));
      return { error: 'Token veya kullanıcı bilgisi alınamadı.' };
    } catch (err: unknown) {
      // Asıl hatayı maskeleme — kullanıcıya gösterilen mesajdan önce konsola yaz.
      console.log(
        '[Login] ADIM 4: CATCH bloğu tetiklendi — backend non-2xx döndürdü veya network/parse hatası oluştu:',
        err instanceof Error ? { name: err.name, message: err.message, status: (err as any).status } : err,
      );
      const msg = err instanceof Error ? err.message : 'Giriş işlemi başarısız.';
      return { error: msg };
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, password: string, ageRange?: string | null) => {
    try {
      setLoading(true);
      const result: any = await api.register(email, password, ageRange);
      const authUser = result?.user ?? (result?.id ? result : null);
      const token = result?.token ?? result?.accessToken ?? null;

      if (authUser?.id && token) {
        setToken(token);
        setUser({ id: authUser.id, email: authUser.email ?? email });
        try {
          console.log(
            '[RevenueCat] logIn öncesi user:',
            JSON.stringify(authUser),
            'id tipi:',
            typeof authUser.id,
          );
          const { customerInfo } = await Purchases.logIn(String(authUser.id));
          console.log(
            '[RevenueCat] logIn başarılı, aktif appUserID:',
            customerInfo.originalAppUserId,
          );
        } catch (rcErr: unknown) {
          console.error(
            '[RevenueCat] logIn hatası:',
            rcErr instanceof Error ? rcErr.message : String(rcErr),
          );
        }
        return { error: null };
      }

      console.error('[Register] Beklenmeyen response formatı:', JSON.stringify(result));
      return { error: 'Kayıt sonrası kullanıcı oluşturulamadı.' };
    } catch (err: unknown) {
      console.error('[Register] Kayıt hatası:', err);
      const msg = err instanceof Error ? err.message : 'Kayıt işlemi başarısız.';
      return { error: msg };
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    setToken(null);
    setUser(null);
    Purchases.logOut().catch((rcErr: unknown) => {
      console.error(
        '[RevenueCat] logOut hatası:',
        rcErr instanceof Error ? rcErr.message : String(rcErr),
      );
    });
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
