import * as FileSystem from 'expo-file-system/legacy';
import i18next from 'i18next';
import { useState } from 'react';
import { api, setCachedImageUris } from '../services/api';

function mimeFromUri(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    default: return 'image/jpeg';
  }
}

export function useGenerateCaption() {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (localUris: any[], tone: any, gender?: any, ageRange?: any) => {
    setGenerating(true);
    setError(null);

    try {
      const base64Images = await Promise.all(localUris.map(async (item) => {
        const uri = typeof item === 'string' ? item : item.uri;
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        return `data:${mimeFromUri(uri)};base64,${base64}`;
      }));

      const result = await api.generateCaptionJson({
        images: base64Images,
        tone: String(tone || 'neutral'),
        gender: String(gender || 'neutral'),
        ageRange: String(ageRange || ''),
        language: i18next.language,
      });

      setCachedImageUris(result.post_id, base64Images);

      return result;

    } catch (err: any) {
      console.log('[Generate] Istek durduruldu:', err.message);
      setError('Sunucuya bağlanılamadı.');
      throw err;
    } finally {
      setGenerating(false);
    }
  };

  return { generate, loading: generating, error };
}