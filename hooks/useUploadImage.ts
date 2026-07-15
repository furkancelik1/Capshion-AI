import { useState } from 'react';
// IMPORT YOLUNU EXPO 54'E UYGUN OLARAK "legacy" İLE GÜNCELLEDİK
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../services/supabase';

export function useUploadImage() {
  const [uploading, setUploading] = useState(false);

  // 🚀 ARTIK TEK BİR STRİNG YERİNE, STRİNG DİZİSİ KABUL EDİYORUZ
  const uploadImages = async (localUris: string[]): Promise<string[] | null> => {
    if (!localUris || localUris.length === 0) return null;
    
    setUploading(true);
    
    try {
      // Bütün fotoğrafları paralel yüklemek için haritalandırıyoruz (Map)
      const uploadPromises = localUris.map(async (localUri, index) => {
        try {
          // 1. Görseli legacy sistemle Base64 formatında okuyoruz
          const base64 = await FileSystem.readAsStringAsync(localUri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // 2. Yüklenecek dosya için benzersiz bir isim oluşturuyoruz (Çakışmayı önlemek için index ekledik)
          const fileName = `dump-${Date.now()}-${index}-${Math.random().toString(36).substring(7)}.jpg`;

          // 3. Base64 formatını Supabase'in kabul ettiği formata (ArrayBuffer) çevirip yüklüyoruz
          const { data, error } = await supabase.storage
            .from('captions')
            .upload(fileName, decode(base64), {
              contentType: 'image/jpeg',
            });

          if (error) {
            console.error(`Supabase Yükleme Hatası (Görsel ${index}):`, error.message);
            return null; // Bir görsel hata verirse null döner, diğerlerini bozmaz
          }

          // 4. Başarıyla yüklendiyse, dosyanın Public URL'ini alıyoruz
          const { data: urlData } = supabase.storage
            .from('captions')
            .getPublicUrl(fileName);

          return urlData.publicUrl;
        } catch (error) {
          console.error(`Görsel (${index}) okunurken/yüklenirken hata:`, error);
          return null;
        }
      });

      // 5. TÜM PARALEL YÜKLEMELERİN BİTMESİNİ BEKLİYORUZ
      const results = await Promise.all(uploadPromises);
      
      // Hata alıp null dönen görselleri filtreliyoruz (Sadece başarılı yüklenenlerin URL'lerini alıyoruz)
      const successfulUrls = results.filter((url): url is string => url !== null);

      if (successfulUrls.length === 0) {
        return null; // Hiçbir fotoğraf yüklenemediyse işlemi iptal et
      }

      return successfulUrls;

    } catch (error) {
      console.error('Toplu görsel yükleme sırasında genel hata:', error);
      return null;
    } finally {
      setUploading(false);
    }
  };

  // İsim karışıklığını önlemek için uploadImage yerine uploadImages olarak döndürüyoruz
  return { uploadImages, uploading };
}