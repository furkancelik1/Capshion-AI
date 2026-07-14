import { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase'; // Supabase istemcisinin yolu

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Uygulama ilk açıldığında mevcut oturumu kontrol et
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Oturum değişikliklerini (giriş, çıkış, kayıt) dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Kayıt Olma Fonksiyonu
  const signUpWithEmail = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setLoading(false);
        return { error };
      }

      setLoading(false);
      return { data };
    } catch (err: any) {
      setLoading(false);
      return { error: err };
    }
  };

  // Giriş Yapma Fonksiyonu
  const signInWithEmail = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setLoading(false);
        return { error };
      }

      setLoading(false);
      return { data };
    } catch (err: any) {
      setLoading(false);
      return { error: err };
    }
  };

  // Çıkış Yapma Fonksiyonu
  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
  };

  return {
    user,
    loading,
    signUpWithEmail,
    signInWithEmail,
    signOut,
  };
};