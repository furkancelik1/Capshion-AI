import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useUploadImage } from './useUploadImage';

export interface CaptionItem {
  text: string;
  hashtags: string[];
}

export interface GenerateCaptionResponse {
  captions: CaptionItem[];
  credits_remaining: number;
  post_id: string;
  image_url: string;
  image_urls?: string[];
}

export function useGenerateCaption() {
  const { uploadImages, uploading } = useUploadImage();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOutOfCredits, setIsOutOfCredits] = useState(false);

  const generate = async (localUris: string[], tone: string, gender?: string, ageRange?: string): Promise<GenerateCaptionResponse> => {
    setGenerating(true);
    setError(null);
    setIsOutOfCredits(false);

    try {
      const imageUrls = await uploadImages(localUris);

      if (!imageUrls || imageUrls.length === 0) {
        throw new Error('Görsel yükleme işlemi başarısız oldu.');
      }

      const { data, error: functionError } = await supabase.functions.invoke('generate-caption', {
        body: { imageUrls, tone, gender: gender || "neutral", ageRange: ageRange || null },
      });

      if (functionError) {
        let errorMessage = functionError.message;

        if (functionError.context) {
          try {
            const errorBody = await functionError.context.json();
            errorMessage = errorBody.error || JSON.stringify(errorBody);
          } catch {
            // ignore parse failure
          }
        }

        throw new Error(`Sunucu Hatası: ${errorMessage}`);
      }

      const raw = data as {
        success: boolean;
        captions: string[];
        hashtags: string[];
        post_id: string;
        image_url?: string;
        image_urls?: string[];
        remainingCredits: number;
      };

      const captions: CaptionItem[] = raw.captions.map((text) => ({
        text,
        hashtags: raw.hashtags,
      }));

      return {
        captions,
        credits_remaining: raw.remainingCredits,
        post_id: raw.post_id,
        image_url: raw.image_urls?.[0] || raw.image_url || '',
        image_urls: raw.image_urls,
      };
    } catch (err: any) {
      const msg = err.message || 'Beklenmedik bir hata oluştu.';
      console.error('Açıklama üretme hatası:', err);
      setError(msg);
      if (msg.toLowerCase().includes('yetersiz kredi') || msg.toLowerCase().includes('403')) {
        setIsOutOfCredits(true);
      }
      throw err;
    } finally {
      setGenerating(false);
    }
  };

  return {
    generate,
    loading: uploading || generating,
    error,
    isOutOfCredits,
  };
}
