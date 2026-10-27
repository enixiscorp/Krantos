import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({ supabase: {} }));

import { buildKrantosLeadMessage } from './krantosLeadMessages';
import type { LeadStatus } from '../lib/supabase';

const base = {
  clientName: 'Kofi Mensah',
  agentFirstName: 'Cyrille',
  vendorName: 'ZE BE LIGHT',
  productName: 'Groupe 5 kVA',
};

describe('buildKrantosLeadMessage', () => {
  it('Nouveau : prend des nouvelles de la mise en relation et de l’achat', () => {
    const m = buildKrantosLeadMessage({ ...base, status: 'new' });
    expect(m.startsWith('Bonjour Kofi,')).toBe(true);
    expect(m).toContain("Je suis Cyrille, de l'équipe Krantos");
    expect(m).toContain('La mise en relation avec ZE BE LIGHT a-t-elle bien eu lieu ?');
    expect(m).toContain('Votre achat s’est-il bien passé ?');
    expect(m.endsWith('Cyrille, équipe Krantos')).toBe(true);
  });

  it('Contacté : ravi de l’achat via Krantos chez le vendeur', () => {
    const m = buildKrantosLeadMessage({ ...base, status: 'contacted' });
    expect(m).toContain('Nous sommes ravis que vous ayez utilisé Krantos pour votre achat de Groupe 5 kVA chez ZE BE LIGHT.');
  });

  it('Converti : remercie et espère le revoir', () => {
    const m = buildKrantosLeadMessage({ ...base, status: 'converted' });
    expect(m).toContain('grâce à la plateforme Krantos');
    expect(m).toContain('Nous espérons vous revoir très prochainement');
  });

  it('Perdu : rappelle l’énergie de secours en cas de délestage', () => {
    const m = buildKrantosLeadMessage({ ...base, status: 'lost' });
    expect(m).toContain('via Krantos');
    expect(m).toContain('générateur ou d’un groupe électrogène');
    expect(m).toContain('délestage');
  });

  it('reste correct sans vendeur ni produit, sans emoji ni tiret cadratin', () => {
    for (const status of ['new', 'contacted', 'converted', 'lost'] as LeadStatus[]) {
      const m = buildKrantosLeadMessage({ clientName: 'Ama', agentFirstName: 'Cyrille', status });
      expect(m).not.toContain('undefined');
      expect(m).not.toContain('null');
      expect(m).not.toContain('\u2014');
      expect(m).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    }
  });
});
