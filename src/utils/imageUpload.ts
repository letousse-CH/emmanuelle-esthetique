import { supabase } from '../services/supabase';

export async function compressImage(
  file: File,
  maxWidth = 1920,
  quality = 0.82
): Promise<{ file: File; originalSize: number; compressedSize: number }> {
  const originalSize = file.size;

  if (
    file.type === 'image/svg+xml' ||
    file.type === 'image/gif' ||
    originalSize < 150_000
  ) {
    return { file, originalSize, compressedSize: originalSize };
  }

  return new Promise((resolve) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      const outputType = 'image/webp';
      const outputQuality = quality;
      const newName = file.name.replace(/\.[^.]+$/, '.webp');

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < originalSize) {
            resolve({
              file: new File([blob], newName, { type: outputType, lastModified: Date.now() }),
              originalSize,
              compressedSize: blob.size,
            });
          } else {
            resolve({ file, originalSize, compressedSize: originalSize });
          }
        },
        outputType,
        outputQuality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ file, originalSize, compressedSize: originalSize });
    };

    img.src = objectUrl;
  });
}

export async function uploadFileToR2(file: File): Promise<{ url?: string; error?: string }> {
  try {
    const fileBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const uploadRes = await fetch('/api/upload-media', {
      method: 'POST',
      headers,
      body: JSON.stringify({ fileName: file.name, contentType: file.type, fileBase64 }),
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      return { error: uploadData.error || 'Erreur upload R2' };
    }
    return { url: uploadData.url };
  } catch (err: any) {
    return { error: err.message || 'Erreur inconnue' };
  }
}
