import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import Purchases from 'react-native-purchases';
import { api, setToken } from '../services/api';
import {
  firebaseSignInWithEmail,
  firebaseSignUpWithEmail,
  firebaseSignInWithGoogle,
  firebaseSignOut,
} from '../services/firebase';

// Oturum (token + kullanıcı) cihazda saklanır; uygulama yeniden açıldığında geri yüklenir.
const TOKEN_KEY = 'capshion_auth_token';
const USER_KEY = 'capshion_auth_user';

async function persistSession(token: string | null, user: AuthUser | null) {
  try {
    if (token && user) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    }
  } catch (err: unknown) {
    console.error('[Auth] Oturum kaydedilemedi:', err instanceof Error ? err.message : String(err));
  }
}

interface AuthUser {
  id: string;
  email: string;
  is_premium: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, ageRange?: string | null) => Promise<{ error: string | null }>;
  signInWithSocial: (provider: 'google' | 'apple', idToken?: string, email?: string) => Promise<{ error: string | null }>;
  signOut: () => void;
  refreshPremiumStatus: () => Promise<void>;
  setPremiumStatus: (isPremium: boolean) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  // Başlangıçta true: kayıtlı oturum geri yüklenene kadar yönlendirme yapılmasın
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const [token, userJson] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);
        if (!token || !userJson) return;

        const savedUser: AuthUser = JSON.parse(userJson);
        setToken(token);

        try {
          const profile: any = await api.getProfile();
          setUser({ ...savedUser, is_premium: !!profile?.is_premium });
        } catch (err: any) {
          if (err?.status === 401 || err?.status === 403) {
            // Token süresi dolmuş/geçersiz — oturumu temizle, giriş ekranına düşsün
            setToken(null);
            await persistSession(null, null);
            return;
          }
          // Ağ hatası vb.: kayıtlı kullanıcıyla devam et
          setUser(savedUser);
        }

        Purchases.logIn(String(savedUser.id)).catch((rcErr: unknown) => {
          console.error(
            '[RevenueCat] logIn hatası:',
            rcErr instanceof Error ? rcErr.message : String(rcErr),
          );
        });
      } catch (err: unknown) {
        console.error('[Auth] Oturum geri yüklenemedi:', err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setLoading(true);
      console.log('[Login] ADIM 1: Firebase Auth ve Backend isteği gönderiliyor →', email);

      try {
        await firebaseSignInWithEmail(email, password);
        console.log('[Login] Firebase Auth girişi ve Firestore profili başarılı');
      } catch (fbErr: any) {
        console.warn('[Login] Firebase Auth uyarısı:', fbErr?.message || fbErr);
      }

      const result: any = await api.login(email, password);

      console.log('[Login] ADIM 2: Backend 200 OK döndü, raw yanıt:', JSON.stringify(result));

      // Backend bazen kullanıcıyı "user" alanı altında nested ({ user: { id, email }, token }),
      // bazen de düz (flat) bir profil objesi olarak ({ id, email, age_range, ... , token })
      // döndürebiliyor. İkisini de kabul et — sadece nested şekli bekleyip flat geldiğinde
      // "kullanıcı bilgisi alınamadı" hatasına düşmeyelim.
      const authUser = result?.user ?? (result?.id ? result : null);
      const token = result?.token ?? result?.accessToken ?? null;

      if (authUser?.id && token) {
        const nextUser: AuthUser = { id: String(authUser.id), email: authUser.email ?? email, is_premium: false };
        setToken(token);
        setUser(nextUser);
        await persistSession(token, nextUser);
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
        refreshPremiumStatus();
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

      try {
        await firebaseSignUpWithEmail(email, password, ageRange);
        console.log('[Register] Firebase Auth kaydı ve Firestore profili oluşturuldu');
      } catch (fbErr: any) {
        console.warn('[Register] Firebase Auth uyarısı:', fbErr?.message || fbErr);
      }

      const result: any = await api.register(email, password, ageRange);
      const authUser = result?.user ?? (result?.id ? result : null);
      const token = result?.token ?? result?.accessToken ?? null;

      if (authUser?.id && token) {
        const nextUser: AuthUser = { id: String(authUser.id), email: authUser.email ?? email, is_premium: false };
        setToken(token);
        setUser(nextUser);
        await persistSession(token, nextUser);
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
        refreshPremiumStatus();
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

  const signInWithSocial = async (provider: 'google' | 'apple', idToken?: string, email?: string) => {
    try {
      setLoading(true);
      console.log('[SocialAuth] Backend ve Firebase isteği gönderiliyor →', { provider, email });

      if (provider === 'google' && idToken) {
        try {
          await firebaseSignInWithGoogle(idToken);
          console.log('[SocialAuth] Firebase Google girişi ve Firestore profili senkronize edildi');
        } catch (fbErr: any) {
          console.warn('[SocialAuth] Firebase Google girişi uyarısı:', fbErr?.message || fbErr);
        }
      }

      const result: any = await api.socialLogin(provider, idToken, email);
      const authUser = result?.user ?? (result?.id ? result : null);
      const token = result?.token ?? result?.accessToken ?? null;

      if (authUser?.id && token) {
        const nextUser: AuthUser = {
          id: String(authUser.id),
          email: authUser.email ?? email ?? '',
          is_premium: false,
        };
        setToken(token);
        setUser(nextUser);
        await persistSession(token, nextUser);

        try {
          console.log('[RevenueCat] logIn öncesi user:', JSON.stringify(authUser));
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

        refreshPremiumStatus();
        return { error: null };
      }

      return { error: 'Token veya kullanıcı bilgisi alınamadı.' };
    } catch (err: unknown) {
      console.error('[SocialAuth] Giriş hatası:', err);
      const msg = err instanceof Error ? err.message : 'Sosyal giriş işlemi başarısız.';
      return { error: msg };
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    setToken(null);
    setUser(null);
    persistSession(null, null);
    firebaseSignOut().catch((fbErr) => {
      console.warn('[Firebase Auth] Çıkış uyarısı:', fbErr);
    });
    Purchases.logOut().catch((rcErr: unknown) => {
      console.error(
        '[RevenueCat] logOut hatası:',
        rcErr instanceof Error ? rcErr.message : String(rcErr),
      );
    });
  };

  const setPremiumStatus = (isPremium: boolean) => {
    // Değer değişmediyse aynı referansı koru — aksi halde her profil
    // fetch'i user objesini yeniler ve buna bağlı useCallback/useEffect'lerde
    // (örn. profile.tsx fetchProfile) sonsuz döngüye yol açar.
    setUser((prev) => (prev && prev.is_premium !== isPremium ? { ...prev, is_premium: isPremium } : prev));
  };

  const refreshPremiumStatus = async () => {
    try {
      const data: any = await api.getProfile();
      setPremiumStatus(!!data?.is_premium);
    } catch (err: unknown) {
      console.error(
        '[Auth] Premium durumu güncellenemedi:',
        err instanceof Error ? err.message : String(err),
      );
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithSocial,
        signOut,
        refreshPremiumStatus,
        setPremiumStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
