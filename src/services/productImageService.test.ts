import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({ supabase: { storage: { from: vi.fn() } } }));

import {
  describeProductSaveError,
  normalizeProductImageUrl,
  validateProductImageUrl,
} from './productImageService';

describe('normalizeProductImageUrl', () => {
  it('garde un lien direct tel quel', () => {
    expect(normalizeProductImageUrl(' https://exemple.com/groupe.jpg ')).toBe('https://exemple.com/groupe.jpg');
  });

  it('extrait le lien direct d’un résultat Google Images', () => {
    const url = 'https://www.google.com/imgres?imgurl=https%3A%2F%2Fcdn.exemple.com%2Fpanneau.png&imgrefurl=https%3A%2F%2Fexemple.com';
    expect(normalizeProductImageUrl(url)).toBe('https://cdn.exemple.com/panneau.png');
  });

  it('convertit un lien de partage Google Drive', () => {
    expect(normalizeProductImageUrl('https://drive.google.com/file/d/ABC123/view?usp=sharing'))
      .toBe('https://drive.google.com/thumbnail?id=ABC123&sz=w1200');
    expect(normalizeProductImageUrl('https://drive.google.com/open?id=XYZ'))
      .toBe('https://drive.google.com/thumbnail?id=XYZ&sz=w1200');
  });

  it('convertit un lien Dropbox en lien brut', () => {
    expect(normalizeProductImageUrl('https://www.dropbox.com/s/abc/onduleur.jpg?dl=0'))
      .toBe('https://www.dropbox.com/s/abc/onduleur.jpg?raw=1');
  });
});

describe('validateProductImageUrl', () => {
  it('accepte https et refuse le reste', () => {
    expect(validateProductImageUrl('https://exemple.com/a.png')).toBeNull();
    expect(validateProductImageUrl('')).toBeNull();
    expect(validateProductImageUrl('ftp://exemple.com/a.png')).not.toBeNull();
    expect(validateProductImageUrl('pas un lien')).not.toBeNull();
  });
});

describe('describeProductSaveError', () => {
  it('explique la colonne image_url manquante', () => {
    const msg = describeProductSaveError({
      code: 'PGRST204',
      message: "Could not find the 'image_url' column of 'products' in the schema cache",
    });
    expect(msg).toContain('20240031_products_image_url.sql');
  });

  it('explique un refus de droits', () => {
    expect(describeProductSaveError({ code: '42501', message: 'new row violates row-level security policy' }))
      .toContain('droits');
  });
});
