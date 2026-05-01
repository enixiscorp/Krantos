import { adminClient, corsHeaders, jsonResponse, requireAdminStaff } from "../_shared/auth.ts";
import { enforceRateLimit, logAdminAction } from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const { user, adminRole } = await requireAdminStaff(req.headers.get("authorization"));
    const limiter = await enforceRateLimit({
      key: `admin-dashboard:${user.id}`,
      maxHits: 60,
      windowSeconds: 60,
    });
    if (!limiter.allowed) {
      return jsonResponse(429, { error: "Too many requests", retry_at: limiter.resetAt });
    }

    const url = new URL(req.url);
    const period = url.searchParams.get("period") ?? "day";

    // Basic Counts
    const { count: totalVendors } = await adminClient.from("vendors").select("*", { count: "exact", head: true });
    const { data: vStatusRows } = await adminClient.from("vendors").select("status");
    const activeVendors = (vStatusRows ?? []).filter(v => v.status === "active").length;
    const pendingVendors = (vStatusRows ?? []).filter(v => v.status === "pending").length;

    const { count: totalProducts } = await adminClient.from("products").select("*", { count: "exact", head: true });
    const { count: totalLeads } = await adminClient.from("leads").select("*", { count: "exact", head: true });
    const { data: leadStatusRows } = await adminClient.from("leads").select("status");
    const convertedCount = (leadStatusRows ?? []).filter(v => v.status === "converted").length;
    const conversionRate = totalLeads ? Math.round((convertedCount / totalLeads) * 1000) / 10 : 0;

    // Trend calculation
    // We define "current" and "previous" periods
    const now = new Date();
    let currentStart = new Date();
    let previousStart = new Date();

    if (period === "day") {
      currentStart.setDate(now.getDate() - 1);
      previousStart.setDate(now.getDate() - 2);
    } else if (period === "week") {
      currentStart.setDate(now.getDate() - 7);
      previousStart.setDate(now.getDate() - 14);
    } else if (period === "month") {
      currentStart.setMonth(now.getMonth() - 1);
      previousStart.setMonth(now.getMonth() - 2);
    } else {
      currentStart.setMonth(now.getMonth() - 3);
      previousStart.setMonth(now.getMonth() - 6);
    }

    const [currVendors, prevVendors, currLeads, prevLeads] = await Promise.all([
      adminClient.from("vendors").select("*", { count: "exact", head: true }).gte("created_at", currentStart.toISOString()),
      adminClient.from("vendors").select("*", { count: "exact", head: true }).gte("created_at", previousStart.toISOString()).lt("created_at", currentStart.toISOString()),
      adminClient.from("leads").select("*", { count: "exact", head: true }).gte("created_at", currentStart.toISOString()),
      adminClient.from("leads").select("*", { count: "exact", head: true }).gte("created_at", previousStart.toISOString()).lt("created_at", currentStart.toISOString()),
    ]);

    const calculateTrend = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? { val: `+${curr}`, up: true } : { val: "0%", up: true };
      const diff = ((curr - prev) / prev) * 100;
      return { val: `${diff > 0 ? "+" : ""}${Math.round(diff)}%`, up: diff >= 0 };
    };

    const trends = {
      vendors: calculateTrend(currVendors.count ?? 0, prevVendors.count ?? 0),
      leads: calculateTrend(currLeads.count ?? 0, prevLeads.count ?? 0),
    };

    // Top Vendors
    const { data: topVendorLeads } = await adminClient.from("leads").select("vendor_id, status").not("vendor_id", "is", null);
    const vStats: Record<string, { total: number, conv: number }> = {};
    topVendorLeads?.forEach(l => {
      if (!vStats[l.vendor_id]) vStats[l.vendor_id] = { total: 0, conv: 0 };
      vStats[l.vendor_id].total++;
      if (l.status === "converted") vStats[l.vendor_id].conv++;
    });

    const topIds = Object.entries(vStats).sort((a,b) => b[1].total - a[1].total).slice(0, 6).map(e => e[0]);
    const { data: topVendorsRaw } = topIds.length ? await adminClient.from("vendors").select("id, name, status, category").in("id", topIds) : { data: [] };
    const topVendors = (topVendorsRaw ?? []).map(v => ({
      vendor_id: v.id,
      name: v.name,
      status: v.status,
      category: v.category,
      leads_count: vStats[v.id].total,
      conversion_rate: Math.round((vStats[v.id].conv / vStats[v.id].total) * 100)
    }));

    // Recent Leads
    const { data: recentLeads } = await adminClient.from("leads").select("*").order("created_at", { ascending: false }).limit(8);

    return jsonResponse(200, {
      total_vendors: totalVendors ?? 0,
      active_vendors: activeVendors,
      pending_vendors: pendingVendors,
      total_products: totalProducts ?? 0,
      total_leads: totalLeads ?? 0,
      conversion_rate: conversionRate,
      trends,
      top_vendors: topVendors,
      recent_leads: recentLeads ?? [],
    });

  } catch (err) {
    console.error("Dashboard Error:", err);
    return jsonResponse(500, { error: "Internal Error" });
  }
});
