import * as FileSystem from 'expo-file-system/legacy';
import i18next from 'i18next';
import { useState } from 'react';
import { api, setCachedImageUris } from '../services/api';
import { useToast } from '../context/ToastContext';

function mimeFromUri(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    default: return 'image/jpeg';
  }
}

async function safeReadBase64(uri: string, toast: ReturnType<typeof useToast>['showToast']): Promise<string | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    return `data:${mimeFromUri(uri)};base64,${base64}`;
  } catch {
    try {
      const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
      const dest = FileSystem.cacheDirectory + 'capshion_' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
      await FileSystem.copyAsync({ from: uri, to: dest });
      const base64 = await FileSystem.readAsStringAsync(dest, { encoding: 'base64' });
      await FileSystem.deleteAsync(dest);
      return `data:${mimeFromUri(uri)};base64,${base64}`;
    } catch {
      toast?.("Görsel yüklenemedi, lütfen tekrar seçin.", "error");
      return null;
    }
  }
}

export function useGenerateCaption() {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const generate = async (localUris: any[], tone: any, gender?: any, ageRange?: any, settings?: { length: string; useEmojis: boolean; useHashtags: boolean; customPrompt?: string; carouselMode?: boolean }) => {
    setGenerating(true);
    setError(null);

    try {
      const results = await Promise.all(localUris.map(async (item) => {
        const uri = typeof item === 'string' ? item : item.uri;
        return safeReadBase64(uri, showToast);
      }));

      const base64Images = results.filter((r): r is string => r !== null);

      if (base64Images.length === 0) {
        throw new Error("Görsel yüklenemedi, lütfen tekrar seçin.");
      }

      const result = await api.generateCaptionJson({
        images: base64Images,
        tone: String(tone || 'neutral'),
        gender: String(gender || 'kadin'),
        ageRange: String(ageRange || ''),
        language: i18next.language,
        length: settings?.length ?? 'medium',
        useEmojis: settings?.useEmojis ?? true,
        useHashtags: settings?.useHashtags ?? true,
        customPrompt: settings?.customPrompt || undefined,
        carouselMode: settings?.carouselMode ?? false,
      });

      setCachedImageUris(result.post_id, base64Images);

      return result;

    } catch (err: any) {
      const msg = err?.message || 'Sunucuya bağlanılamadı.';
      console.log('[Generate] Istek durduruldu:', msg);
      setError(msg);
      throw err;
    } finally {
      setGenerating(false);
    }
  };

  const generatePerImage = async (localUris: any[], tone: any, gender?: any, ageRange?: any, settings?: { length: string; useEmojis: boolean; useHashtags: boolean; customPrompt?: string; carouselMode?: boolean }) => {
    setGenerating(true);
    setError(null);

    try {
      const results = await Promise.all(localUris.map(async (item) => {
        const uri = typeof item === 'string' ? item : item.uri;
        return safeReadBase64(uri, showToast);
      }));

      const base64Images = results.filter((r): r is string => r !== null);

      if (base64Images.length === 0) {
        throw new Error("Görsel yüklenemedi, lütfen tekrar seçin.");
      }

      const result = await api.generatePerImage({
        images: base64Images,
        tone: String(tone || 'neutral'),
        gender: String(gender || 'kadin'),
        ageRange: String(ageRange || ''),
        language: i18next.language,
        length: settings?.length ?? 'medium',
        useEmojis: settings?.useEmojis ?? true,
        useHashtags: settings?.useHashtags ?? true,
        customPrompt: settings?.customPrompt || undefined,
        carouselMode: settings?.carouselMode ?? false,
      });

      setCachedImageUris(result.post_id, base64Images);

      return result;

    } catch (err: any) {
      const msg = err?.message || 'Sunucuya bağlanılamadı.';
      console.log('[Generate-PerImage] Istek durduruldu:', msg);
      setError(msg);
      throw err;
    } finally {
      setGenerating(false);
    }
  };

  return { generate, generatePerImage, loading: generating, error };
}
