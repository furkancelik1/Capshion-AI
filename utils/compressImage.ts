import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

const TARGET_BYTES = 1024 * 1024; // 1 MB
const MAX_WIDTH = 1280;
const MIN_QUALITY = 0.35;
const QUALITY_STEP = 0.15;

async function getFileSize(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  return info.exists ? (info as { size: number }).size : 0;
}

async function renderAtQuality(uri: string, quality: number): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: MAX_WIDTH });
  const imageRef = await context.renderAsync();
  const result = await imageRef.saveAsync({ compress: quality, format: SaveFormat.JPEG });
  return result.uri;
}

/**
 * Görseli backend'e göndermeden önce sıkıştırır (max genişlik 1280px, hedef <1MB).
 * Sıkıştırma başarısız olursa orijinal URI'yi döndürür.
 */
export async function compressImage(uri: string): Promise<string> {
  try {
    let quality = 0.7;
    let outputUri = await renderAtQuality(uri, quality);
    let size = await getFileSize(outputUri);

    while (size > TARGET_BYTES && quality > MIN_QUALITY) {
      quality -= QUALITY_STEP;
      outputUri = await renderAtQuality(uri, quality);
      size = await getFileSize(outputUri);
    }

    return outputUri;
  } catch (err) {
    console.error('[compressImage] Sıkıştırma başarısız, orijinal görsel kullanılacak:', err);
    return uri;
  }
}
