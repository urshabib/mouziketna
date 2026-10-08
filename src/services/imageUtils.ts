import heic2any from 'heic2any';

/**
 * Normalizes an image file by converting HEIC/HEIF images to JPEG,
 * preventing mobile Safari / iOS photos from getting stuck on 'loading image'.
 */
export async function normalizeImageFile(file: File): Promise<File> {
  const isHeic =
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif') ||
    file.type.toLowerCase().includes('heic') ||
    file.type.toLowerCase().includes('heif');

  if (!isHeic) {
    return file;
  }

  try {
    const conversionResult = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    });

    const blob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
    const newName = file.name
      .replace(/\.heic$/i, '.jpg')
      .replace(/\.heif$/i, '.jpg');

    return new File([blob], newName, { type: 'image/jpeg' });
  } catch (err) {
    console.warn('HEIC conversion warning, attempting to use original file:', err);
    return file;
  }
}

/**
 * Checks if a file or blob is HEIC format.
 */
export function isHeicFile(file: File | Blob): boolean {
  if ('name' in file && typeof file.name === 'string') {
    if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
      return true;
    }
  }
  return file.type.toLowerCase().includes('heic') || file.type.toLowerCase().includes('heif');
}
