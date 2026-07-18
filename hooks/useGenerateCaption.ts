import * as FileSystem from 'expo-file-system/legacy';
import i18next from 'i18next';
import { useState } from 'react';
import { api } from '../services/api';

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
        return `data:image/jpeg;base64,${base64}`;
      }));

      return await api.generateCaptionJson({
        images: base64Images,
        tone: String(tone || 'neutral'),
        gender: String(gender || 'neutral'),
        ageRange: String(ageRange || ''),
        language: i18next.language,
      });

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