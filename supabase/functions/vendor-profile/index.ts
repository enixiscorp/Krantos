import { adminClient, corsHeaders, jsonResponse, requireRole } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  try {
    const { user, role } = await requireRole(req.headers.get("authorization"), ["vendor", "admin", "super_admin"]);
    if (role !== "vendor" && role !== "admin" && role !== "super_admin") {
      return jsonResponse(403, { error: "Forbidden" });
    }

    if (req.method === "GET") {
      const { data, error } = await adminClient
        .from("vendors")
        .select("*")
        .eq("profile_id", user.id)
        .single();
      if (error) return jsonResponse(404, { error: error.message });
      return jsonResponse(200, { vendor: data });
    }

    if (req.method === "PATCH") {
      const payload = await req.json();
      const patch = {
        company_name: payload.company_name,
        name: payload.company_name ?? payload.name,
        category: payload.category,
        phone: payload.phone,
        email: payload.email,
      };
      const { data, error } = await adminClient
        .from("vendors")
        .update(patch)
        .eq("profile_id", user.id)
        .select("*")
        .single();
      if (error) return jsonResponse(400, { error: error.message });
      return jsonResponse(200, { vendor: data });
    }

    return jsonResponse(405, { error: "Method not allowed" });
  } catch {
    return jsonResponse(403, { error: "Forbidden" });
  }
});


