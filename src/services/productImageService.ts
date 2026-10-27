// ============================================================
// Krantos Platform - Product image upload
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
 * Turns common "page" links into a direct image link:
 * - Google Images result (…/imgres?imgurl=…) or Google redirect (…/url?url=…)
 * - Google Drive share link (…/file/d/<id>/view, …/open?id=<id>)
 * - Dropbox share link (?dl=0 → ?raw=1)
 */
export function normalizeProductImageUrl(url: string): string {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }
  const host = parsed.hostname.replace(/^www\./, '');

  if (/^google\.[a-z.]+$/.test(host)) {
    const direct = parsed.searchParams.get('imgurl') || parsed.searchParams.get('url') || parsed.searchParams.get('q');
    if (direct && /^https?:\/\//.test(direct)) return normalizeProductImageUrl(direct);
  }

  if (host === 'drive.google.com') {
    const id = parsed.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? parsed.searchParams.get('id');
    if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
  }

  if (host === 'dropbox.com' || host.endsWith('.dropbox.com')) {
    parsed.searchParams.delete('dl');
    parsed.searchParams.set('raw', '1');
    return parsed.toString();
  }

  return trimmed;
}

/** Loads the image in the browser: resolves true only if it really displays. */
export function checkImageLoads(url: string, timeoutMs = 10_000): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => { img.src = ''; resolve(false); }, timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve(img.naturalWidth > 0 && img.naturalHeight > 0); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.referrerPolicy = 'no-referrer';
    img.src = url;
  });
}

export const IMAGE_LINK_NOT_AN_IMAGE =
  "Ce lien n'affiche pas d'image. Faites un clic droit sur l'image puis « Copier l'adresse de l'image », ou téléversez le fichier.";

/** Clear French message for a failed product save (missing column, rights…). */
export function describeProductSaveError(err: unknown): string {
  const e = err as { message?: string; code?: string } | null;
  const msg = e?.message ?? '';
  if (e?.code === 'PGRST204' || /image_url.*schema cache|column .*image_url/i.test(msg)) {
    return "La base de données n'a pas encore la colonne des images. Exécutez la migration 20240031_products_image_url.sql dans Supabase, puis réessayez.";
  }
  if (e?.code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return "Vous n'avez pas les droits pour modifier ce produit.";
  }
  return msg || "L'image n'a pas pu être enregistrée.";
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
  return normalizeProductImageUrl(trimmed);
}
