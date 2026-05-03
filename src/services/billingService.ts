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
  userName: string; // New
  rateApplied: number;
  amount: number;
}

export interface VendorInfo {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  payment_notifications_count: number;
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
    .select('id, name, email, phone, payment_notifications_count')
    .eq('id', vendorId)
    .single();

  if (vendorError || !vendor) {
    throw new Error(
      `Erreur lors de la récupération du vendeur : ${vendorError?.message ?? 'Vendeur introuvable'}`
    );
  }

  // Set end date to end of day
  const eDate = new Date(endDate);
  eDate.setHours(23, 59, 59, 999);

  // Fetch confirmed conversion commission records for the period, joining with leads
  const { data: records, error: recordsError } = await supabase
    .from('commission_records')
    .select('lead_id, commission_rate_applied, amount, created_at, leads!lead_id(user_name)')
    .eq('vendor_id', vendorId)
    .eq('status', 'confirmed')
    .eq('type', 'conversion')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', eDate.toISOString());

  if (recordsError) {
    throw new Error(
      `Erreur lors de la récupération des commissions : ${recordsError.message}`
    );
  }

  // Handle Supabase returning joined records as an object or array
  const rows = (records ?? []) as any[];

  const lines: BillingLine[] = rows.map((r) => {
    // Supabase join can return an object or a single-element array
    const lead = Array.isArray(r.leads) ? r.leads[0] : r.leads;
    
    return {
      date: new Date(r.created_at),
      leadId: r.lead_id ?? 'N/A',
      userName: lead?.user_name ?? 'Client Inconnu',
      rateApplied: r.commission_rate_applied,
      amount: r.amount ?? 0,
    };
  });

  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  const vendorInfo: VendorInfo = {
    id: vendor.id,
    name: vendor.name,
    email: vendor.email ?? null,
    phone: vendor.phone,
    payment_notifications_count: vendor.payment_notifications_count || 0
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
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Colors
  const darkBg = [18, 18, 20];
  const yellowAccent = [254, 208, 30];
  const textGray = [150, 150, 150];

  // --- Background ---
  doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  let y = 30;

  // --- Header / Logo ---
  doc.setTextColor(yellowAccent[0], yellowAccent[1], yellowAccent[2]);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('KRANTOS', 14, y);
  
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('PLATEFORME DE GESTION ÉNERGÉTIQUE', 14, y + 6);
  
  doc.setTextColor(yellowAccent[0], yellowAccent[1], yellowAccent[2]);
  doc.setFontSize(14);
  doc.text('FACTURE DE COMMISSIONS', pageWidth - 14, y, { align: 'right' });
  y += 25;

  // --- Vendor info ---
  doc.setDrawColor(255, 255, 255, 0.1);
  doc.line(14, y, pageWidth - 14, y);
  y += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(' DESTINATAIRE', 14, y);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y += 8;
  doc.text(report.vendor.name.toUpperCase(), 14, y);
  y += 5;
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.text(`Tél: ${report.vendor.phone}`, 14, y);
  if (report.vendor.email) {
    y += 5;
    doc.text(`Email: ${report.vendor.email}`, 14, y);
  }

  // --- Invoice info ---
  const invoiceY = y - 13;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('DÉTAILS', pageWidth - 14, invoiceY, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - 14, invoiceY + 5, { align: 'right' });
  doc.text(`Période: ${report.period.start.toLocaleDateString('fr-FR')} - ${report.period.end.toLocaleDateString('fr-FR')}`, pageWidth - 14, invoiceY + 10, { align: 'right' });

  y += 20;

  // --- Table Header ---
  doc.setFillColor(30, 30, 35);
  doc.rect(14, y, pageWidth - 28, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DATE', 20, y + 8);
  doc.text('ID LEAD', 45, y + 8);
  doc.text('DESCRIPTION / CLIENT', 75, y + 8);
  doc.text('TAUX (%)', 140, y + 8);
  doc.text('MONTANT', pageWidth - 20, y + 8, { align: 'right' });
  y += 12;

  // --- Table Rows ---
  doc.setFont('helvetica', 'normal');
  const formatAmount = (amt: number) => {
    return amt.toLocaleString('fr-FR').replace(/[\s\u00A0]/g, '.');
  };

  for (const line of report.lines) {
    if (y > 250) {
      doc.addPage();
      doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      y = 30;
    }
    
    y += 10;
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFontSize(8);
    doc.text(line.date.toLocaleDateString('fr-FR'), 20, y);
    doc.setTextColor(255, 255, 255);
    doc.text(`#${line.leadId.slice(0, 8)}`, 45, y);
    doc.text(`Vente Lead - ${line.userName}`, 75, y);
    doc.text(`${line.rateApplied}%`, 140, y);
    doc.text(`${formatAmount(line.amount)} FCFA`, pageWidth - 20, y, { align: 'right' });
    
    doc.setDrawColor(255, 255, 255, 0.05);
    doc.line(14, y + 4, pageWidth - 14, y + 4);
  }

  // --- Totals ---
  y += 20;
  doc.setFillColor(yellowAccent[0], yellowAccent[1], yellowAccent[2]);
  doc.rect(pageWidth - 85, y, 71, 20, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.text('TOTAL À PAYER', pageWidth - 79, y + 7);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${formatAmount(report.total)} FCFA`, pageWidth - 79, y + 15);

  // --- Footer ---
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.text('* Les commissions sont calculées selon le taux en vigueur au moment de la conversion du lead.', 14, pageHeight - 30);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Merci de régler cette facture sous 7 jours pour éviter toute suspension de service.', pageWidth / 2, pageHeight - 20, { align: 'center' });
  doc.text('Krantos Pro - Système de Gestion Centrale v2.4', pageWidth / 2, pageHeight - 15, { align: 'center' });

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
