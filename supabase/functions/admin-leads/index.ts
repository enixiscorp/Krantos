import { adminClient, corsHeaders, jsonResponse, requireAdminStaff } from "../_shared/auth.ts";
import { enforceRateLimit, logAdminAction } from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const { user, adminRole } = await requireAdminStaff(req.headers.get("authorization"));
    const limiter = await enforceRateLimit({
      key: `admin-leads:${user.id}`,
      maxHits: 120,
      windowSeconds: 60,
    });
    if (!limiter.allowed) {
      return jsonResponse(429, { error: "Too many requests", retry_at: limiter.resetAt });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (id) {
      const { data: lead, error } = await adminClient.from("leads").select("*").eq("id", id).single();
      if (error) return jsonResponse(404, { error: error.message });
      const row = lead as { vendor_id: string | null; recommended_product_id: string | null };
      const { data: vendor } = row.vendor_id
        ? await adminClient.from("vendors").select("*").eq("id", row.vendor_id).single()
        : { data: null };
      const { data: product } = row.recommended_product_id
        ? await adminClient.from("products").select("*").eq("id", row.recommended_product_id).single()
        : { data: null };
      const { data: appliances } = await adminClient
        .from("appliances_input")
        .select("*")
        .eq("lead_id", id);
      await logAdminAction({
        actorId: user.id,
        actorRole: adminRole,
        action: "admin.leads.detail",
        targetId: id,
      });
      return jsonResponse(200, { lead, vendor, product, appliances: appliances ?? [] });
    }

    const vendorId = url.searchParams.get("vendor_id");
    const status = url.searchParams.get("status");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    let q = adminClient
      .from("leads")
      .select("id, user_name, user_phone, location, status, vendor_id, total_power_needed, created_at")
      .order("created_at", { ascending: false });

    if (vendorId) q = q.eq("vendor_id", vendorId);
    if (status) q = q.eq("status", status);
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", to);

    const { data: leads, error } = await q.limit(500);
    if (error) return jsonResponse(500, { error: error.message });

    await logAdminAction({
      actorId: user.id,
      actorRole: adminRole,
      action: "admin.leads.list",
      metadata: { vendorId, status, from, to },
    });

    return jsonResponse(200, { leads: leads ?? [] });
  } catch {
    return jsonResponse(403, { error: "Access denied" });
  }
});

