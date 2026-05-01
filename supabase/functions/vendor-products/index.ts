import { adminClient, corsHeaders, jsonResponse, requireRole } from "../_shared/auth.ts";

async function getVendorIdByUserId(userId: string): Promise<string | null> {
  const { data, error } = await adminClient
    .from("vendors")
    .select("id")
    .eq("profile_id", userId)
    .single();
  if (error || !data) return null;
  return data.id as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  try {
    const { user } = await requireRole(req.headers.get("authorization"), ["vendor"]);
    const vendorId = await getVendorIdByUserId(user.id);
    if (!vendorId) return jsonResponse(404, { error: "Vendor account not found" });

    if (req.method === "GET") {
      const { data, error } = await adminClient
        .from("products")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false });
      if (error) return jsonResponse(500, { error: error.message });
      return jsonResponse(200, { products: data ?? [] });
    }

    if (req.method === "POST") {
      const payload = await req.json();
      const insertPayload = {
        vendor_id: vendorId,
        name: payload.name,
        category: payload.category,
        power_rating: payload.power_rating,
        price: payload.price,
        description: payload.description ?? null,
        keywords: payload.keywords ?? null,
        is_active: payload.is_active ?? true,
      };
      const { data, error } = await adminClient
        .from("products")
        .insert(insertPayload)
        .select("*")
        .single();
      if (error) return jsonResponse(400, { error: error.message });
      return jsonResponse(201, { product: data });
    }

    if (req.method === "PATCH") {
      const payload = await req.json();
      if (!payload.id) return jsonResponse(400, { error: "Missing product id" });
      const { data, error } = await adminClient
        .from("products")
        .update({
          name: payload.name,
          category: payload.category,
          power_rating: payload.power_rating,
          price: payload.price,
          description: payload.description,
          keywords: payload.keywords,
          is_active: payload.is_active,
        })
        .eq("id", payload.id)
        .eq("vendor_id", vendorId)
        .select("*")
        .single();
      if (error) return jsonResponse(400, { error: error.message });
      return jsonResponse(200, { product: data });
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");
      if (!id) return jsonResponse(400, { error: "Missing product id query param" });
      const { error } = await adminClient
        .from("products")
        .delete()
        .eq("id", id)
        .eq("vendor_id", vendorId);
      if (error) return jsonResponse(400, { error: error.message });
      return jsonResponse(200, { message: "Product deleted" });
    }

    return jsonResponse(405, { error: "Method not allowed" });
  } catch {
    return jsonResponse(403, { error: "Forbidden" });
  }
});


