import { adminClient, corsHeaders, jsonResponse } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  
  // Accept both GET and POST for flexibility
  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "month";
  const vendor_id = url.searchParams.get("vendor_id");

  try {
    console.log(`[Admin Dashboard] Fetching data for period: ${period}`);

    // 1. Fetch real counts
    const { count: totalVendors } = await adminClient.from("vendors").select("id", { count: "exact", head: true });
    const { count: activeVendors } = await adminClient.from("vendors").select("id", { count: "exact", head: true }).eq("status", "active");
    const { count: pendingVendors } = await adminClient.from("vendors").select("id", { count: "exact", head: true }).eq("status", "pending");
    const { count: totalLeads } = await adminClient.from("leads").select("id", { count: "exact", head: true });
    const { count: totalProducts } = await adminClient.from("products").select("id", { count: "exact", head: true });
    
    // 2. Fetch revenue (sum of confirmed commissions)
    const { data: revenueData } = await adminClient.from("commission_records").select("amount").eq("status", "confirmed");
    const totalRevenue = revenueData?.reduce((sum, r) => sum + Number(r.amount || 0), 0) || 0;

    // 3. Fetch recent lists
    const { data: recentLeads } = await adminClient.from("leads").select("*").order("created_at", { ascending: false }).limit(8);
    const { data: topVendors } = await adminClient.from("vendors").select("id, name, category, status").limit(6);

    // 4. Map top vendors to include counts (simulated for now, real query would be joined)
    const mappedTopVendors = topVendors?.map(v => ({
      vendor_id: v.id,
      name: v.name,
      status: v.status,
      category: v.category,
      leads_count: 0,
      conversion_rate: 0
    })) || [];

    // 5. Build response exactly as AdminDashboardPayload
    return jsonResponse(200, {
      total_vendors: totalVendors || 0,
      active_vendors: activeVendors || 0,
      pending_vendors: pendingVendors || 0,
      total_products: totalProducts || 0,
      total_leads: totalLeads || 0,
      total_revenue: totalRevenue,
      conversion_rate: 0, // Real calculation to follow in next update
      trends: {
        vendors: { val: "0%", up: true },
        leads: { val: "0%", up: true }
      },
      top_vendors: mappedTopVendors,
      recent_leads: (recentLeads || []).map(l => ({
        id: l.id,
        user_name: l.user_name,
        status: l.status,
        total_power_needed: l.total_power_needed,
        created_at: l.created_at
      }))
    });

  } catch (err) {
    console.error("[Dashboard Error]:", err);
    return jsonResponse(500, { error: "Internal Server Error" });
  }
});
