import { adminClient, corsHeaders, jsonResponse, requireSuperAdmin } from "../_shared/auth.ts";
import { enforceRateLimit, logAdminAction } from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const user = await requireSuperAdmin(req.headers.get("authorization"));
    const limiter = await enforceRateLimit({
      key: `admin-stats:${user.id}`,
      maxHits: 90,
      windowSeconds: 60,
    });
    if (!limiter.allowed) {
      return jsonResponse(429, { error: "Too many requests", retry_at: limiter.resetAt });
    }

    const url = new URL(req.url);
    const type = url.searchParams.get("type") ?? "vendors";

    if (type === "vendors") {
      const { data: rows } = await adminClient.from("vendors").select("status, created_at");
      const total = rows?.length ?? 0;
      let active = 0;
      let suspended = 0;
      const since = new Date();
      since.setDate(since.getDate() - 7);
      let newLast7 = 0;
      for (const r of rows ?? []) {
        const s = (r as { status: string }).status;
        if (s === "active") active++;
        if (s === "suspended") suspended++;
        const created = new Date((r as { created_at: string }).created_at);
        if (created >= since) newLast7++;
      }
      await logAdminAction({
        actorId: user.id,
        actorRole: "super_admin",
        action: "admin.stats.vendors",
      });
      return jsonResponse(200, {
        total,
        active,
        suspended,
        new_vendors_last_7_days: newLast7,
      });
    }

    if (type === "leads") {
      const { data: leads } = await adminClient
        .from("leads")
        .select("status, created_at")
        .order("created_at", { ascending: true });
      const total = leads?.length ?? 0;
      let converted = 0;
      const byDay: Record<string, number> = {};
      for (const l of leads ?? []) {
        const st = (l as { status: string }).status;
        if (st === "converted") converted++;
        const d = new Date((l as { created_at: string }).created_at);
        const key = d.toISOString().slice(0, 10);
        byDay[key] = (byDay[key] ?? 0) + 1;
      }
      const leads_per_day = Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }));
      const conversion_rate = total > 0
        ? Math.round((converted / total) * 1000) / 10
        : 0;
      await logAdminAction({
        actorId: user.id,
        actorRole: "super_admin",
        action: "admin.stats.leads",
      });
      return jsonResponse(200, {
        total_leads: total,
        leads_per_day,
        conversion_rate,
      });
    }

    if (type === "products") {
      const { count: total } = await adminClient
        .from("products")
        .select("*", { count: "exact", head: true });
      const { data: recs } = await adminClient
        .from("leads")
        .select("recommended_product_id")
        .not("recommended_product_id", "is", null);
      const popularity: Record<string, number> = {};
      for (const r of recs ?? []) {
        const pid = (r as { recommended_product_id: string }).recommended_product_id;
        popularity[pid] = (popularity[pid] ?? 0) + 1;
      }
      const topIds = Object.entries(popularity)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => id);
      const { data: products } = topIds.length
        ? await adminClient
          .from("products")
          .select("id, name, vendor_id, price")
          .in("id", topIds)
        : { data: [] };
      const most_demanded = (products ?? []).map((p) => ({
        ...(p as Record<string, unknown>),
        lead_mentions: popularity[(p as { id: string }).id] ?? 0,
      }));
      await logAdminAction({
        actorId: user.id,
        actorRole: "super_admin",
        action: "admin.stats.products",
      });
      return jsonResponse(200, {
        total_products: total ?? 0,
        most_demanded,
      });
    }

    return jsonResponse(400, { error: "Invalid type. Use vendors, leads, or products" });
  } catch {
    return jsonResponse(403, { error: "Access denied" });
  }
});
