import { supabase } from '../lib/supabase';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

export interface UploadResult {
  url?: string;
  path?: string;
  error?: string;
}

export async function uploadBusinessImage(
  file: File,
  bucket: 'logos' | 'signatures' | 'payment_proofs',
  userId: string
): Promise<UploadResult> {
  try {
    if (!file) return { error: 'No file provided' };
    
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return { error: 'File size exceeds 5MB limit. Please upload a smaller image.' };
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

    return { url: publicData.publicUrl, path: filePath };
  } catch (err: any) {
    return { error: err?.message || 'An unexpected error occurred during upload' };
  }
}

/**
 * Securely upload payment screenshot to private payment_proofs bucket
 * Path: {user_id}/{order_id}/{filename}
 */
export async function uploadPaymentProof(
  file: File,
  userId: string,
  orderId: string
): Promise<{ path?: string; signedUrl?: string; error?: string }> {
  try {
    if (!file) return { error: 'No file selected' };

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return { error: 'Payment screenshot must be under 5MB.' };
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return { error: 'Only PNG, JPG, JPEG, and WebP image proofs are supported.' };
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeOrderId = orderId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanFileName = `proof_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${ext}`;
    const filePath = `${userId}/${safeOrderId}/${cleanFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('payment_proofs')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      return { error: uploadError.message };
    }

    // Generate a temporary signed URL for immediate frontend preview (1 hour expiry)
    const { data: signedData, error: signError } = await supabase.storage
      .from('payment_proofs')
      .createSignedUrl(filePath, 3600);

    return {
      path: filePath,
      signedUrl: signedData?.signedUrl || undefined,
      error: signError?.message || undefined
    };
  } catch (err: any) {
    return { error: err?.message || 'Failed to upload payment proof' };
  }
}

/**
 * Get private signed URL for viewing payment proof (accessible only by owner or admin)
 */
export async function getPaymentProofSignedUrl(filePath: string): Promise<string | null> {
  if (!filePath) return null;
  try {
    const { data, error } = await supabase.storage
      .from('payment_proofs')
      .createSignedUrl(filePath, 3600);

    if (error || !data?.signedUrl) {
      return null;
    }
    return data.signedUrl;
  } catch (e) {
    return null;
  }
}

