
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkVendor() {
  const email = 'edemcyrille@gmail.com';
  console.log('--- Diagnostic Vendeur ---');
  console.log('Email:', email);
  
  const { data: vendor, error: vError } = await supabase
    .from('vendors')
    .select('*')
    .eq('email', email)
    .maybeSingle();
    
  if (vError) {
    console.error('Erreur table vendors:', vError.message);
  } else {
    console.log('Données Vendor:', vendor || 'Introuvable');
  }
  
  if (vendor) {
    const { data: profile, error: pError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', vendor.profile_id)
      .maybeSingle();
    
    if (pError) {
      console.error('Erreur table profiles:', pError.message);
    } else {
      console.log('Données Profile:', profile || 'Introuvable');
    }
  }
}

checkVendor();
