import { adminClient, corsHeaders, jsonResponse } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const { period = 'month', vendor_id } = await req.json();

    // 1. Fetch real counts
    const { count: totalVendors } = await adminClient.from("vendors").select("id", { count: "exact", head: true });
    const { count: totalLeads } = await adminClient.from("leads").select("id", { count: "exact", head: true });
    const { count: pendingVendors } = await adminClient.from("vendors").select("id", { count: "exact", head: true }).eq("status", "pending");
    
    // 2. Fetch revenue (sum of confirmed commissions)
    const { data: revenueData } = await adminClient.from("commission_records").select("amount").eq("status", "confirmed");
    const totalRevenue = revenueData?.reduce((sum, r) => sum + Number(r.amount || 0), 0) || 0;

    // 3. Fetch recent data for lists
    const { data: recentLeads } = await adminClient.from("leads").select("*").order("created_at", { ascending: false }).limit(8);
    const { data: topVendors } = await adminClient.from("vendors").select("id, name, category, status").limit(6);

    // 4. Return structure expected by Admin.tsx
    return jsonResponse(200, {
      total_vendors: totalVendors || 0,
      total_leads: totalLeads || 0,
      pending_vendors: pendingVendors || 0,
      total_revenue: totalRevenue,
      conversion_rate: totalLeads > 0 ? Math.round((totalRevenue / totalLeads) * 100) / 100 : 0,
      trends: {
        vendors: { val: "0%", up: true },
        leads: { val: "0%", up: true }
      },
      recent_leads: recentLeads || [],
      top_vendors: topVendors || [],
      period
    });

  } catch (err) {
    console.error(err);
    return jsonResponse(500, { error: "Internal Server Error" });
  }
});
