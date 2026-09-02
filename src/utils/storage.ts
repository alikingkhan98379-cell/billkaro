import { supabase } from '../lib/supabase';

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface UploadResult {
  url?: string;
  error?: string;
}

export async function uploadBusinessImage(
  file: File,
  bucket: 'logos' | 'signatures' | 'payment_proofs',
  userId: string
): Promise<UploadResult> {
  try {
    if (!file) return { error: 'No file provided' };
    
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { error: 'File size exceeds 2MB limit. Please upload a smaller image.' };
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return { error: 'Invalid file format. Only JPG, PNG, and WebP images are allowed.' };
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const cleanFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = `${userId}/${cleanFileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      return { error: uploadError.message };
    }

    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return { url: publicData.publicUrl };
  } catch (err: any) {
    return { error: err?.message || 'An unexpected error occurred during upload' };
  }
}
