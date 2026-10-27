// ============================================================
// Krantos Platform — Product image upload
// ============================================================

import { supabase } from '../lib/supabase';

export const ACCEPTED_PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PRODUCT_IMAGE_MB = 5;

/** Returns an error message, or null when the file can be uploaded. */
export function validateProductImageFile(file: File): string | null {
  if (!ACCEPTED_PRODUCT_IMAGE_TYPES.includes(file.type)) return 'Format non supporté (JPEG, PNG, WebP).';
  if (file.size > MAX_PRODUCT_IMAGE_MB * 1024 * 1024) return `Image trop lourde (max ${MAX_PRODUCT_IMAGE_MB} Mo).`;
  return null;
}

/** Returns an error message, or null when the pasted link looks like a usable image URL. */
export function validateProductImageUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return 'Le lien doit commencer par https://';
    return null;
  } catch {
    return 'Lien invalide. Collez l’adresse complète de l’image (https://…).';
  }
}

/**
 * Uploads a product image and returns its public URL.
 *
 * Each upload gets a unique file name: the storage policies allow vendors to
 * create files but not to overwrite them, so re-using the same name on edit
 * (upsert) was silently rejected.
 */
export async function uploadProductImage(file: File, folder: string, productId: string): Promise<string> {
  const error = validateProductImageFile(file);
  if (error) throw new Error(error);

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${folder}/${productId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(path, file, { upsert: false, cacheControl: '3600', contentType: file.type });
  if (uploadError) throw new Error(`Envoi de l’image impossible : ${uploadError.message}`);

  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}

/**
 * Final image_url to save: the uploaded file wins, otherwise the pasted link
 * (empty → null, which removes the image).
 */
export async function resolveProductImageUrl(opts: {
  file: File | null;
  url: string;
  folder: string;
  productId: string;
}): Promise<string | null> {
  if (opts.file) return uploadProductImage(opts.file, opts.folder, opts.productId);
  const trimmed = opts.url.trim();
  if (!trimmed) return null;
  const error = validateProductImageUrl(trimmed);
  if (error) throw new Error(error);
  return trimmed;
}
