import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
  console.log('--- VENDORS ---')
  const { data: vendors } = await supabase.from('vendors').select('*').ilike('name', '%ZE%')
  console.log(vendors)

  if (vendors && vendors.length > 0) {
    const vId = vendors[0].id
    console.log(`\n--- LEADS for ${vendors[0].name} (${vId}) ---`)
    const { data: leads } = await supabase.from('leads').select('*').eq('vendor_id', vId)
    console.log(leads)

    console.log(`\n--- COMMISSIONS for ${vendors[0].name} ---`)
    const { data: commissions } = await supabase.from('commission_records').select('*').eq('vendor_id', vId)
    console.log(commissions)
    
    if (leads && leads.length > 0) {
        console.log(`\n--- PRODUCTS for these leads ---`)
        const pIds = leads.map(l => l.recommended_product_id).filter(Boolean)
        if (pIds.length > 0) {
            const { data: products } = await supabase.from('products').select('*').in('id', pIds)
            console.log(products)
        } else {
            console.log("No products associated with these leads.")
        }
    }
  }
}

debug()
