import { adminClient, corsHeaders, jsonResponse, requireRole } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse(405, { error: "Method not allowed" });

  try {
    await requireRole(req.headers.get("authorization"), ["admin", "super_admin"]);
    const { data, error } = await adminClient
      .from("vendors")
      .select("id, profile_id, company_name, name, category, phone, email, subscription_type, status, created_at")
      .order("created_at", { ascending: false });
    if (error) return jsonResponse(500, { error: error.message });
    return jsonResponse(200, { vendors: data ?? [] });
  } catch {
    return jsonResponse(403, { error: "Forbidden" });
  }
});

