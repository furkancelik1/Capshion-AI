import { useState } from 'react';
import { supabase } from '@/services/supabase';

async function fileUriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

export function useUploadImage() {
  const [uploading, setUploading] = useState(false);

  const uploadImage = async (localUri: string): Promise<string | null> => {
    setUploading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.error('Kullanıcı oturumu bulunamadı.');
        return null;
      }

      const blob = await fileUriToBlob(localUri);
      const fileName = `${user.id}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('captions')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('Yükleme hatası:', uploadError.message);
        return null;
      }

      const { data: publicUrlData } = supabase.storage
        .from('captions')
        .getPublicUrl(fileName);

      return publicUrlData.publicUrl;
    } catch (err) {
      console.error('Beklenmeyen hata:', err);
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploadImage, uploading };
}
