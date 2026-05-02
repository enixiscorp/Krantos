import { adminClient, corsHeaders, jsonResponse } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  
  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "month";

  try {
    console.log(`[Admin Dashboard] Fetching data for period: ${period}`);

    // 1. Calculate time boundaries based on period
    const now = new Date();
    let currentStart = new Date();
    let previousStart = new Date();
    
    switch (period) {
      case 'day': 
        currentStart.setHours(now.getHours() - 24); 
        previousStart.setHours(now.getHours() - 48); 
        break;
      case 'week': 
        currentStart.setDate(now.getDate() - 7); 
        previousStart.setDate(now.getDate() - 14); 
        break;
      case 'year': 
        currentStart.setFullYear(now.getFullYear() - 1); 
        previousStart.setFullYear(now.getFullYear() - 2); 
        break;
      case 'month':
      default: 
        currentStart.setMonth(now.getMonth() - 1); 
        previousStart.setMonth(now.getMonth() - 2); 
        break;
    }

    const currentIso = currentStart.toISOString();
    const previousIso = previousStart.toISOString();

    // 2. Fetch real counts & Trends
    // Vendors
    const { count: totalVendors } = await adminClient.from("vendors").select("id", { count: "exact", head: true });
    const { count: currentVendors } = await adminClient.from("vendors").select("id", { count: "exact", head: true }).gte("created_at", currentIso);
    const { count: previousVendors } = await adminClient.from("vendors").select("id", { count: "exact", head: true }).gte("created_at", previousIso).lt("created_at", currentIso);

    // Leads
    const { count: totalLeads } = await adminClient.from("leads").select("id", { count: "exact", head: true });
    const { count: currentLeads } = await adminClient.from("leads").select("id", { count: "exact", head: true }).gte("created_at", currentIso);
    const { count: previousLeads } = await adminClient.from("leads").select("id", { count: "exact", head: true }).gte("created_at", previousIso).lt("created_at", currentIso);

    // Revenue & Conversion
    const { data: revenueData } = await adminClient.from("commission_records").select("amount").eq("status", "confirmed");
    const totalRevenue = revenueData?.reduce((sum, r) => sum + Number(r.amount || 0), 0) || 0;

    const calculateTrend = (curr: number, prev: number) => {
      if (prev === 0) return { val: curr > 0 ? "100%" : "0%", up: curr > 0 };
      const diff = ((curr - prev) / prev) * 100;
      return { val: `${Math.abs(Math.round(diff))}%`, up: diff >= 0 };
    };

    const vendorTrend = calculateTrend(currentVendors || 0, previousVendors || 0);
    const leadTrend = calculateTrend(currentLeads || 0, previousLeads || 0);
    
    // Top Vendors with real counts
    const { data: topVendorsRaw } = await adminClient.from("vendors").select("id, name, category, status").limit(6);
    const topVendors = await Promise.all((topVendorsRaw || []).map(async v => {
      const { count } = await adminClient.from("leads").select("id", { count: "exact", head: true }).eq("vendor_id", v.id);
      return {
        vendor_id: v.id,
        name: v.name,
        status: v.status,
        category: v.category,
        leads_count: count || 0,
        conversion_rate: Math.round(Math.random() * 20) + 10 // Placeholder for real conversion
      };
    }));

    const { count: activeVendors } = await adminClient.from("vendors").select("id", { count: "exact", head: true }).eq("status", "active");
    const { count: pendingVendors } = await adminClient.from("vendors").select("id", { count: "exact", head: true }).eq("status", "pending");
    const { data: recentLeads } = await adminClient.from("leads").select("*").order("created_at", { ascending: false }).limit(8);

    return jsonResponse(200, {
      total_vendors: totalVendors || 0,
      active_vendors: activeVendors || 0,
      pending_vendors: pendingVendors || 0,
      total_products: 0, // Simplified for now
      total_leads: totalLeads || 0,
      total_revenue: totalRevenue || 0,
      conversion_rate: totalVendors ? Math.round(((activeVendors || 0) / totalVendors) * 100) : 0, 
      trends: {
        vendors: vendorTrend,
        leads: leadTrend,
        conversion: { val: "2%", up: true },
        revenue: { val: "5%", up: true }
      },
      goals: {
        acquisition: Math.min(100, Math.round(((totalVendors || 0) / 50) * 100)),
        validation: Math.min(100, Math.round(((activeVendors || 0) / (totalVendors || 1)) * 100)),
        premium: 15
      },
      top_vendors: topVendors.sort((a,b) => b.leads_count - a.leads_count),
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
