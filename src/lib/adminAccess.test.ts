import { describe, it, expect, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {} }));

import { isArchived, isMainAdminEmail, pickFirstName } from './adminAccess';

describe('isMainAdminEmail', () => {
  it('reconnaît l’administrateur principal, sans tenir compte de la casse', () => {
    expect(isMainAdminEmail('contacteccorp@gmail.com')).toBe(true);
    expect(isMainAdminEmail(' ContactECcorp@Gmail.com ')).toBe(true);
    expect(isMainAdminEmail('autre@gmail.com')).toBe(false);
    expect(isMainAdminEmail(null)).toBe(false);
  });
});

describe('pickFirstName', () => {
  it('prend d’abord le prénom du profil', () => {
    expect(pickFirstName({ profileFirstName: 'cyrille', adminUserName: 'Jean Dupont' })).toBe('Cyrille');
  });
  it('sinon le premier mot du nom admin, puis les métadonnées, puis l’email', () => {
    expect(pickFirstName({ adminUserName: 'Ama Kodjo' })).toBe('Ama');
    expect(pickFirstName({ metadataFirstName: 'kofi' })).toBe('Kofi');
    expect(pickFirstName({ email: 'jean.dupont@exemple.com' })).toBe('Jean');
    expect(pickFirstName({})).toBe('Krantos');
  });
});

describe('isArchived', () => {
  it('détecte un profil archivé', () => {
    expect(isArchived({ archived_at: '2026-10-27T10:00:00Z' })).toBe(true);
    expect(isArchived({ archived_at: null })).toBe(false);
    expect(isArchived(null)).toBe(false);
  });
});
