// ============================================================
// Krantos Platform — BillingService
// Requirements: C7.1, C7.2, C7.3, C7.4, C7.5
// ============================================================

import { jsPDF } from 'jspdf';
import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BillingLine {
  date: Date;
  leadId: string;
  rateApplied: number;
  amount: number;
}

export interface VendorInfo {
  id: string;
  name: string;
  email: string | null;
  phone: string;
}

export interface BillingReport {
  vendor: VendorInfo;
  period: { start: Date; end: Date };
  lines: BillingLine[];
  total: number;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Generates a billing report for a vendor over a given period.
 * Only includes commission records with status = 'confirmed' and type = 'conversion'.
 * Requirements: C7.1, C7.2, C7.3
 */
export async function generateReport(
  vendorId: string,
  startDate: Date,
  endDate: Date
): Promise<BillingReport> {
  // Fetch vendor info
  const { data: vendor, error: vendorError } = await supabase
    .from('vendors')
    .select('id, name, email, phone')
    .eq('id', vendorId)
    .single();

  if (vendorError || !vendor) {
    throw new Error(
      `Erreur lors de la récupération du vendeur : ${vendorError?.message ?? 'Vendeur introuvable'}`
    );
  }

  // Fetch confirmed conversion commission records for the period
  const { data: records, error: recordsError } = await supabase
    .from('commission_records')
    .select('lead_id, commission_rate_applied, amount, created_at')
    .eq('vendor_id', vendorId)
    .eq('status', 'confirmed')
    .eq('type', 'conversion')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (recordsError) {
    throw new Error(
      `Erreur lors de la récupération des commissions : ${recordsError.message}`
    );
  }

  const rows = (records ?? []) as {
    lead_id: string | null;
    commission_rate_applied: number;
    amount: number | null;
    created_at: string;
  }[];

  const lines: BillingLine[] = rows.map((r) => ({
    date: new Date(r.created_at),
    leadId: r.lead_id ?? '',
    rateApplied: r.commission_rate_applied,
    amount: r.amount ?? 0,
  }));

  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  const vendorInfo: VendorInfo = {
    id: vendor.id,
    name: vendor.name,
    email: vendor.email ?? null,
    phone: vendor.phone,
  };

  return {
    vendor: vendorInfo,
    period: { start: startDate, end: endDate },
    lines,
    total,
  };
}

/**
 * Exports a billing report to PDF and triggers a browser download.
 * Requirements: C7.4
 */
export function exportToPDF(report: BillingReport): void {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // --- Header ---
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Krantos', pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Rapport de Facturation', pageWidth / 2, y, { align: 'center' });
  y += 12;

  // --- Vendor info ---
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Informations Vendeur', 14, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.text(`Nom : ${report.vendor.name}`, 14, y);
  y += 5;
  doc.text(`Téléphone : ${report.vendor.phone}`, 14, y);
  y += 5;
  if (report.vendor.email) {
    doc.text(`Email : ${report.vendor.email}`, 14, y);
    y += 5;
  }

  // --- Period ---
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.text('Période', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Du ${report.period.start.toLocaleDateString('fr-FR')} au ${report.period.end.toLocaleDateString('fr-FR')}`,
    14,
    y
  );
  y += 10;

  // --- Commission table header ---
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(230, 230, 230);
  doc.rect(14, y - 4, pageWidth - 28, 8, 'F');
  doc.text('Date', 16, y);
  doc.text('Lead ID', 50, y);
  doc.text('Taux (%)', 110, y);
  doc.text('Montant (FCFA)', 150, y);
  y += 8;

  // --- Commission table rows ---
  doc.setFont('helvetica', 'normal');
  for (const line of report.lines) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(line.date.toLocaleDateString('fr-FR'), 16, y);
    doc.text(line.leadId.substring(0, 20), 50, y);
    doc.text(`${line.rateApplied}%`, 110, y);
    doc.text(line.amount.toFixed(2), 150, y);
    y += 6;
  }

  // --- Total ---
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.line(14, y, pageWidth - 14, y);
  y += 6;
  doc.text(`Total : ${report.total.toFixed(2)} FCFA`, pageWidth - 14, y, { align: 'right' });

  // --- Download ---
  const fileName = `facture_${report.vendor.name.replace(/\s+/g, '_')}_${report.period.start.toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

/**
 * Sends an invoice to the vendor by email.
 * In this implementation, we log the action to the console since no real email
 * service is wired up. In production this would call a Supabase Edge Function.
 * Requirements: C7.5
 */
export async function sendInvoice(vendorId: string, report: BillingReport): Promise<void> {
  // Fetch vendor email (may differ from the report if it was updated)
  const { data: vendor, error } = await supabase
    .from('vendors')
    .select('email, name')
    .eq('id', vendorId)
    .single();

  if (error || !vendor) {
    throw new Error(
      `Erreur lors de la récupération de l'email du vendeur : ${error?.message ?? 'Vendeur introuvable'}`
    );
  }

  const recipientEmail = vendor.email ?? report.vendor.email;

  if (!recipientEmail) {
    throw new Error(
      `Impossible d'envoyer la facture : aucune adresse email disponible pour le vendeur ${vendor.name}.`
    );
  }

  // Log the invoice sending (no real email service available)
  // In production: call a Supabase Edge Function to send the PDF by email
  console.log(
    `[BillingService] Envoi de la facture à ${recipientEmail} (vendeur: ${vendor.name})`,
    {
      vendorId,
      period: {
        start: report.period.start.toISOString(),
        end: report.period.end.toISOString(),
      },
      total: report.total,
      lineCount: report.lines.length,
    }
  );

  // Simulate async email dispatch
  await Promise.resolve();
}
