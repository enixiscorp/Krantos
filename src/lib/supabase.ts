// ============================================================
// Krantos Platform — Supabase Client
// Requirements: 14.3
// ============================================================
// Security: Only VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
// are used here. The service key is NEVER exposed on the client.
// ============================================================

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Environment variables (public, safe to expose in the browser bundle)
// ---------------------------------------------------------------------------
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[SupabaseClient] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be defined in your .env.local file.'
  );
}

// ---------------------------------------------------------------------------
// Typed Supabase client
// ---------------------------------------------------------------------------
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ---------------------------------------------------------------------------
// Shared TypeScript types — mirror the database schema exactly
// ---------------------------------------------------------------------------

/** Enum types */
export type SubscriptionType = 'free' | 'basic' | 'premium';
export type VendorStatus = 'pending' | 'active' | 'suspended' | 'expired' | 'terminated';
export type LeadStatus = 'new' | 'contacted' | 'converted' | 'lost';
export type PowerUnit = 'W' | 'A' | 'V';

// ---------------------------------------------------------------------------
// Domain types (used by PowerCalculator, RecommendationEngine, etc.)
// ---------------------------------------------------------------------------

/**
 * An appliance entered by the user in the power calculator.
 * Used as input to PowerCalculator.calculateTotalPower().
 */
export interface ApplianceInput {
  name: string;
  quantity: number;
  power: number;
  unit: PowerUnit;
}

/**
 * The per-appliance breakdown produced by PowerCalculator.
 */
export interface ApplianceBreakdown {
  name: string;
  powerInWatts: number;
  totalWatts: number;
}

// ---------------------------------------------------------------------------
// Database row types — match the Supabase schema 1-to-1
// ---------------------------------------------------------------------------

/**
 * Row type for the `vendors` table.
 */
export interface Vendor {
  id: string;
  name: string;
  category: string;
  phone: string;
  email: string | null;
  subscription_type: SubscriptionType;
  status: VendorStatus;
  contract_end_date: string | null;
  created_at: string;
}

/**
 * Row type for the `products` table.
 */
export interface Product {
  id: string;
  vendor_id: string;
  name: string;
  category: string;
  power_rating: number;
  price: number;
  description: string | null;
  keywords: string | null;
  is_active: boolean;
  created_at: string;
}

/**
 * Row type for the `leads` table.
 */
export interface Lead {
  id: string;
  user_id: string | null;
  user_name: string;
  user_phone: string;
  location: string;
  total_power_needed: number;
  recommended_product_id: string | null;
  vendor_id: string | null;
  status: LeadStatus;
  created_at: string;
}

/**
 * Row type for the `appliances_input` table.
 */
export interface AppliancesInputRecord {
  id: string;
  lead_id: string;
  appliance_name: string;
  quantity: number;
  power: number;
  unit: PowerUnit;
  power_in_watts: number;
}
