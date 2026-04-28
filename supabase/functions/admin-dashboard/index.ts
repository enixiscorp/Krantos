import { adminClient, corsHeaders, jsonResponse, requireAdminStaff } from "../_shared/auth.ts";
import { enforceRateLimit, logAdminAction } from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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

    const { count: totalVendors } = await adminClient
      .from("vendors")
      .select("*", { count: "exact", head: true });
    const { data: vRows } = await adminClient.from("vendors").select("status");
    const byStatus: Record<string, number> = {};
    for (const r of vRows ?? []) {
      const s = (r as { status: string }).status;
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    }
    const activeVendors = byStatus["active"] ?? 0;
    const pendingVendors = byStatus["pending"] ?? 0;

    const { count: totalProducts } = await adminClient
      .from("products")
      .select("*", { count: "exact", head: true });

    const { count: totalLeadsCount } = await adminClient
      .from("leads")
      .select("*", { count: "exact", head: true });
    const { data: lRows } = await adminClient.from("leads").select("status");
    let converted = 0;
    for (const r of lRows ?? []) {
      if ((r as { status: string }).status === "converted") converted++;
    }
    const leadTotal = totalLeadsCount ?? lRows?.length ?? 0;
    const conversionRate = leadTotal > 0
      ? Math.round((converted / leadTotal) * 1000) / 10
      : 0;

    const { data: allLeads } = await adminClient
      .from("leads")
      .select("vendor_id, status")
      .not("vendor_id", "is", null);
    const vendorLeadCounts: Record<string, { total: number; converted: number }> = {};
    for (const row of allLeads ?? []) {
      const lid = (row as { vendor_id: string; status: string }).vendor_id;
      if (!lid) continue;
      if (!vendorLeadCounts[lid]) vendorLeadCounts[lid] = { total: 0, converted: 0 };
      vendorLeadCounts[lid].total += 1;
      if ((row as { status: string }).status === "converted") {
        vendorLeadCounts[lid].converted += 1;
      }
    }
    const topIds = Object.entries(vendorLeadCounts)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([id]) => id);

    const { data: topVendorRows } = topIds.length
      ? await adminClient.from("vendors").select("id, name, phone, status").in("id", topIds)
      : { data: [] };
    const topVendors = (topVendorRows ?? []).map((v) => {
      const id = (v as { id: string }).id;
      const c = vendorLeadCounts[id] ?? { total: 0, converted: 0 };
      return {
        vendor_id: id,
        name: (v as { name: string }).name,
        company_name: (v as { company_name?: string | null }).company_name ?? null,
        phone: (v as { phone: string }).phone,
        status: (v as { status: string }).status,
        leads_count: c.total,
        conversion_rate: c.total > 0
          ? Math.round((c.converted / c.total) * 1000) / 10
          : 0,
      };
    });

    const { data: recentLeads } = await adminClient
      .from("leads")
      .select("id, user_name, user_phone, status, total_power_needed, vendor_id, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    await logAdminAction({
      actorId: user.id,
      actorRole: adminRole,
      action: "admin.dashboard",
    });

    return jsonResponse(200, {
      total_vendors: totalVendors ?? 0,
      active_vendors: activeVendors,
      pending_vendors: pendingVendors,
      total_products: totalProducts ?? 0,
      total_leads: leadTotal,
      conversion_rate: conversionRate,
      top_vendors: topVendors,
      recent_leads: recentLeads ?? [],
    });
  } catch {
    return jsonResponse(403, { error: "Access denied" });
  }
});
