import { adminClient, corsHeaders, jsonResponse, requireRole } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse(405, { error: "Method not allowed" });

  try {
    await requireRole(req.headers.get("authorization"), ["admin", "super_admin"]);

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

    return jsonResponse(200, {
      vendor,
      products: products ?? [],
      leads: leads ?? [],
      activity: {
        total_products: products?.length ?? 0,
        total_leads: leads?.length ?? 0,
      },
    });
  } catch {
    return jsonResponse(403, { error: "Forbidden" });
  }
});

