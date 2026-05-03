import { adminClient, corsHeaders, jsonResponse } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "month";

  try {
    const now = new Date();

    // Helper: compute window start dates for current and previous periods
    function getWindowStart(base: Date, p: string): Date {
      const d = new Date(base);
      switch (p) {
        case "day":       d.setHours(d.getHours() - 24);      break;
        case "week":      d.setDate(d.getDate() - 7);          break;
        case "semester":  d.setMonth(d.getMonth() - 6);        break;
        case "quarter":   d.setMonth(d.getMonth() - 3);        break;
        case "year":      d.setFullYear(d.getFullYear() - 1);  break;
        case "month":
        default:          d.setMonth(d.getMonth() - 1);        break;
      }
      return d;
    }

    const currentStart  = getWindowStart(now, period);
    const previousStart = getWindowStart(currentStart, period);

    const currentIso  = currentStart.toISOString();
    const previousIso = previousStart.toISOString();

    // ── Vendors ──────────────────────────────────────────────────────────
    const [
      { count: totalVendors },
      { count: activeVendors },
      { count: pendingVendors },
      { count: currentVendors },
      { count: previousVendors },
    ] = await Promise.all([
      adminClient.from("vendors").select("id", { count: "exact", head: true }),
      adminClient.from("vendors").select("id", { count: "exact", head: true }).eq("status", "active"),
      adminClient.from("vendors").select("id", { count: "exact", head: true }).eq("status", "pending"),
      adminClient.from("vendors").select("id", { count: "exact", head: true }).gte("created_at", currentIso),
      adminClient.from("vendors").select("id", { count: "exact", head: true }).gte("created_at", previousIso).lt("created_at", currentIso),
    ]);

    // ── Leads ─────────────────────────────────────────────────────────────
    const [
      { count: totalLeads },
      { count: currentLeads },
      { count: previousLeads },
      { count: currentConverted },
      { count: previousConverted },
      { data: recentLeadsRaw },
    ] = await Promise.all([
      adminClient.from("leads").select("id", { count: "exact", head: true }),
      adminClient.from("leads").select("id", { count: "exact", head: true }).gte("created_at", currentIso),
      adminClient.from("leads").select("id", { count: "exact", head: true }).gte("created_at", previousIso).lt("created_at", currentIso),
      adminClient.from("leads").select("id", { count: "exact", head: true }).eq("status", "converted").gte("created_at", currentIso),
      adminClient.from("leads").select("id", { count: "exact", head: true }).eq("status", "converted").gte("created_at", previousIso).lt("created_at", currentIso),
      // Recent leads for the CURRENT PERIOD only (not all-time)
      adminClient.from("leads").select("*").gte("created_at", currentIso).order("created_at", { ascending: false }).limit(8),
    ]);

    // ── Revenue ───────────────────────────────────────────────────────────
    const [
      { data: currentRevenueData },
      { data: previousRevenueData },
    ] = await Promise.all([
      adminClient.from("commission_records").select("amount").eq("status", "confirmed").gte("created_at", currentIso),
      adminClient.from("commission_records").select("amount").eq("status", "confirmed").gte("created_at", previousIso).lt("created_at", currentIso),
    ]);

    const currentRevenue  = currentRevenueData?.reduce((s, r) => s + Number(r.amount || 0), 0) || 0;
    const previousRevenue = previousRevenueData?.reduce((s, r) => s + Number(r.amount || 0), 0) || 0;
    // Total revenue (all time) for display
    const { data: totalRevenueData } = await adminClient.from("commission_records").select("amount").eq("status", "confirmed");
    const totalRevenue = totalRevenueData?.reduce((s, r) => s + Number(r.amount || 0), 0) || 0;

    // ── Trends: variation vs 100 target ─────────────────────────────────
    // Rule: variation = (current / 100) * 100 expressed as a percentage of the goal (100)
    // If previous period = 0 and current > 0: +100%
    // Otherwise: ((current - previous) / Math.max(1, previous)) * 100
    function calculateTrend(curr: number, prev: number): { val: string; up: boolean } {
      if (prev === 0 && curr === 0) return { val: "0%", up: true };
      if (prev === 0) return { val: `+${(curr / 100 * 100).toFixed(2)}%`, up: true };
      const diff = ((curr - prev) / prev) * 100;
      return { val: `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}%`, up: diff >= 0 };
    }

    // Conversion rate per period
    const currConvRate  = (currentLeads || 0) > 0 ? ((currentConverted || 0) / (currentLeads || 1)) * 100 : 0;
    const prevConvRate  = (previousLeads || 0) > 0 ? ((previousConverted || 0) / (previousLeads || 1)) * 100 : 0;

    const vendorTrend     = calculateTrend(currentVendors  || 0, previousVendors   || 0);
    const leadTrend       = calculateTrend(currentLeads    || 0, previousLeads     || 0);
    const conversionTrend = calculateTrend(currConvRate, prevConvRate);
    const revenueTrend    = calculateTrend(currentRevenue, previousRevenue);

    // ── Goals (period-aware) ──────────────────────────────────────────────
    // Acquisition goal: target = 100 vendors per month. Scale by period.
    const GOAL_VENDORS_PER_MONTH = 100;
    const periodMultiplier: Record<string, number> = {
      day: 1/30, week: 1/4, month: 1, quarter: 3, semester: 6, year: 12
    };
    const mult = periodMultiplier[period] ?? 1;
    const acquisitionGoal = GOAL_VENDORS_PER_MONTH * mult;
    const acquisitionProgress = Math.min(100, Math.round(((currentVendors || 0) / acquisitionGoal) * 100));

    // Validation goal: % of vendors validated (active) in current period
    const validationProgress = (currentVendors || 0) > 0
      ? Math.min(100, Math.round(((activeVendors || 0) / (totalVendors || 1)) * 100))
      : 0;

    // Premium goal: % revenue vs a target (e.g., 1M FCFA/month scaled by period)
    const REVENUE_TARGET_PER_MONTH = 1_000_000;
    const revenueTarget = REVENUE_TARGET_PER_MONTH * mult;
    const premiumProgress = Math.min(100, Math.round((currentRevenue / revenueTarget) * 100));

    // ── Top Vendors ───────────────────────────────────────────────────────
    const { data: topVendorsRaw } = await adminClient
      .from("vendors")
      .select("id, name, category, status")
      .limit(6);

    const topVendors = await Promise.all((topVendorsRaw || []).map(async (v) => {
      const { count: lCount } = await adminClient
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("vendor_id", v.id)
        .gte("created_at", currentIso);
      const { count: lConverted } = await adminClient
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("vendor_id", v.id)
        .eq("status", "converted")
        .gte("created_at", currentIso);
      return {
        vendor_id: v.id,
        name: v.name,
        status: v.status,
        category: v.category,
        leads_count: lCount || 0,
        conversion_rate: (lCount || 0) > 0 ? Math.round(((lConverted || 0) / (lCount || 1)) * 100) : 0,
      };
    }));

    return jsonResponse(200, {
      total_vendors:    totalVendors  || 0,
      active_vendors:   activeVendors || 0,
      pending_vendors:  pendingVendors || 0,
      total_products:   0,
      total_leads:      currentLeads  || 0,   // show PERIOD leads, not all-time
      total_leads_all:  totalLeads    || 0,
      conversion_rate:  Math.round(currConvRate * 100) / 100,
      total_revenue:    currentRevenue,
      total_revenue_all: totalRevenue,
      trends: {
        vendors:    vendorTrend,
        leads:      leadTrend,
        conversion: conversionTrend,
        revenue:    revenueTrend,
      },
      goals: {
        acquisition: acquisitionProgress,
        validation:  validationProgress,
        premium:     premiumProgress,
        // raw values for subtitle display
        acquisition_count:  currentVendors || 0,
        acquisition_target: Math.round(acquisitionGoal),
        revenue_current:    currentRevenue,
        revenue_target:     Math.round(revenueTarget),
      },
      top_vendors:   topVendors.sort((a, b) => b.leads_count - a.leads_count),
      recent_leads:  (recentLeadsRaw || []).map((l) => ({
        id:                 l.id,
        user_name:          l.user_name,
        user_phone:         l.user_phone,
        location:           l.location,
        status:             l.status,
        total_power_needed: l.total_power_needed,
        vendor_id:          l.vendor_id,
        created_at:         l.created_at,
      })),
    });

  } catch (err) {
    console.error("[Dashboard Error]:", err);
    return jsonResponse(500, { error: "Internal Server Error" });
  }
});
