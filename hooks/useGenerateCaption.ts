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
  image_url: string; // Geriye dönük uyumluluk için (ilk görseli tutar)
  image_urls?: string[]; // Çoklu görseller için yeni dizi
}

export function useGenerateCaption() {
  // 1. Yeni hook fonksiyonunu destructure ediyoruz
  const { uploadImages, uploading } = useUploadImage();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 2. Parametreyi `localUri: string` yerine `localUris: string[]` olarak değiştirdik
  const generate = async (localUris: string[], tone: string): Promise<GenerateCaptionResponse | null> => {
    setGenerating(true);
    setError(null);

    try {
      // 3. Çoklu yükleme fonksiyonunu çağırıyoruz
      const imageUrls = await uploadImages(localUris);
      
      // 4. Hata kontrolünü diziye göre yapıyoruz
      if (!imageUrls || imageUrls.length === 0) {
        throw new Error('Görsel yükleme işlemi başarısız oldu.');
      }

      // 5. Backend'e direkt URL dizisini gönderiyoruz
      const { data, error: functionError } = await supabase.functions.invoke('generate-caption', {
        body: { imageUrls, tone },
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
        // Frontend'in herhangi bir yeri bozulmasın diye ilk URL'i image_url olarak dönüyoruz
        image_url: raw.image_urls?.[0] || raw.image_url || '', 
        image_urls: raw.image_urls,
      };
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
    loading: uploading || generating,
    error,
  };
}