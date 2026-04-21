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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const { user } = await requireRole(req.headers.get("authorization"), ["vendor"]);
    const vendorId = await getVendorIdByUserId(user.id);
    if (!vendorId) return jsonResponse(404, { error: "Vendor account not found" });

    const { data, error } = await adminClient
      .from("leads")
      .select("*")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false });

    if (error) return jsonResponse(500, { error: error.message });
    return jsonResponse(200, { leads: data ?? [] });
  } catch {
    return jsonResponse(403, { error: "Forbidden" });
  }
});

