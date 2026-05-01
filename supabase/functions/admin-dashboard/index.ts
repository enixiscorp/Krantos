import { adminClient, corsHeaders, jsonResponse } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const { period = 'month', vendor_id } = await req.json();

    // 1. Calculate date ranges
    const now = new Date();
    let startDate = new Date();
    let prevStartDate = new Date();

    if (period === 'day') {
      startDate.setHours(0, 0, 0, 0);
      prevStartDate.setDate(now.getDate() - 1);
      prevStartDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      startDate.setDate(now.getDate() - 7);
      prevStartDate.setDate(now.getDate() - 14);
    } else if (period === 'year') {
      startDate.setFullYear(now.getFullYear() - 1);
      prevStartDate.setFullYear(now.getFullYear() - 2);
    } else { // month
      startDate.setMonth(now.getMonth() - 1);
      prevStartDate.setMonth(now.getMonth() - 2);
    }

    // 2. Base Queries
    let vendorsQuery = adminClient.from("vendors").select("id, status, created_at", { count: "exact" });
    let leadsQuery = adminClient.from("leads").select("id, created_at", { count: "exact" });
    let revenueQuery = adminClient.from("commission_records").select("amount, created_at").eq("status", "confirmed");

    if (vendor_id) {
      vendorsQuery = vendorsQuery.eq("id", vendor_id);
      leadsQuery = leadsQuery.eq("vendor_id", vendor_id);
      revenueQuery = revenueQuery.eq("vendor_id", vendor_id);
    }

    // 3. Current period counts
    const [vendorsNow, leadsNow, revenueNow] = await Promise.all([
      vendorsQuery,
      leadsQuery.gte("created_at", startDate.toISOString()),
      revenueQuery.gte("created_at", startDate.toISOString())
    ]);

    // 4. Previous period counts (for trends)
    const [vendorsPrev, leadsPrev, revenuePrev] = await Promise.all([
      adminClient.from("vendors").select("id", { count: "exact" }).lt("created_at", startDate.toISOString()),
      adminClient.from("leads").select("id", { count: "exact" }).gte("created_at", prevStartDate.toISOString()).lt("created_at", startDate.toISOString()),
      adminClient.from("commission_records").select("amount").eq("status", "confirmed").gte("created_at", prevStartDate.toISOString()).lt("created_at", startDate.toISOString())
    ]);

    const totalVendors = vendorsNow.count || 0;
    const totalLeads = leadsNow.count || 0;
    const currentRevenue = revenueNow.data?.reduce((sum, r) => sum + Number(r.amount || 0), 0) || 0;
    
    const prevVendors = vendorsPrev.count || 0;
    const prevLeads = leadsPrev.count || 0;
    const prevRevenue = revenuePrev.data?.reduce((sum, r) => sum + Number(r.amount || 0), 0) || 0;

    // 5. Calculate trends
    const calculateTrend = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    return jsonResponse(200, {
      stats: {
        vendors: { value: totalVendors, trend: calculateTrend(totalVendors, prevVendors) },
        leads: { value: totalLeads, trend: calculateTrend(totalLeads, prevLeads) },
        revenue: { value: currentRevenue, trend: calculateTrend(currentRevenue, prevRevenue) }
      },
      period
    });

  } catch (err) {
    console.error(err);
    return jsonResponse(500, { error: "Internal Server Error" });
  }
});
