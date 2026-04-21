import { adminClient, corsHeaders, jsonResponse, requireSuperAdmin } from "../_shared/auth.ts";
import { enforceRateLimit, logAdminAction } from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const user = await requireSuperAdmin(req.headers.get("authorization"));
    const limiter = await enforceRateLimit({
      key: `admin-vendor-detail:${user.id}`,
      maxHits: 90,
      windowSeconds: 60,
    });
    if (!limiter.allowed) {
      return jsonResponse(429, { error: "Too many requests", retry_at: limiter.resetAt });
    }

    const url = new URL(req.url);
    const vendorId = url.searchParams.get("vendor_id");
    if (!vendorId) return jsonResponse(400, { error: "Missing vendor_id query param" });

    const { data: vendor, error: vendorError } = await adminClient
      .from("vendors")
      .select("*")
      .eq("id", vendorId)
      .single();
    if (vendorError) return jsonResponse(404, { error: vendorError.message });

    const { data: products, error: productsError } = await adminClient
      .from("products")
      .select("*")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false });
    if (productsError) return jsonResponse(500, { error: productsError.message });

    const { data: leads, error: leadsError } = await adminClient
      .from("leads")
      .select("*")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (leadsError) return jsonResponse(500, { error: leadsError.message });

    const leadList = leads ?? [];
    const converted = leadList.filter((l) => (l as { status: string }).status === "converted").length;
    const performance = {
      total_leads: leadList.length,
      converted,
      conversion_rate: leadList.length > 0
        ? Math.round((converted / leadList.length) * 1000) / 10
        : 0,
    };

    await logAdminAction({
      actorId: user.id,
      actorRole: "super_admin",
      action: "admin.vendors.detail",
      targetType: "vendor",
      targetId: vendorId,
    });

    return jsonResponse(200, {
      vendor,
      products: products ?? [],
      leads: leadList,
      activity: {
        total_products: products?.length ?? 0,
        total_leads: leadList.length,
      },
      performance,
    });
  } catch {
    return jsonResponse(403, { error: "Access denied" });
  }
});

