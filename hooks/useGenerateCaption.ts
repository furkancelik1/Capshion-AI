import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useUploadImage } from './useUploadImage';

export interface Caption {
  text: string;
  hashtags: string[];
}

export interface GenerateCaptionResponse {
  captions: Caption[];
  credits_remaining: number;
  post_id: string; // Veritabanına kaydedilen gönderinin ID'si
}

export function useGenerateCaption() {
  const { uploadImage, uploading } = useUploadImage();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (localUri: string, tone: string): Promise<GenerateCaptionResponse | null> => {
    setGenerating(true);
    setError(null);

    try {
      // 1. Önce yerel görseli Supabase Storage'a yükle ve Public URL'ini al
      const imageUrl = await uploadImage(localUri);
      if (!imageUrl) {
        throw new Error('Görsel yükleme işlemi başarısız oldu.');
      }

      // 2. Supabase Edge Function'ı tetikle
      const { data, error: functionError } = await supabase.functions.invoke('generate-caption', {
        body: { imageUrl, tone },
      });

      if (functionError) {
        throw new Error(functionError.message || 'Yapay zeka fonksiyonu çağrılırken bir hata oluştu.');
      }

      return data as GenerateCaptionResponse;
    } catch (err: any) {
      console.error('Açıklama üretme hatası:', err);
      setError(err.message || 'Beklenmedik bir hata oluştu.');
      return null;
    } finally {
      setGenerating(false);
    }
  };

  return {
    generate,
    loading: uploading || generating, // İki işlemden biri aktifse loading true döner
    error,
  };
}