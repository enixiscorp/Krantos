import { adminClient, corsHeaders, jsonResponse, requireRole } from "../_shared/auth.ts";

const ACTION_TO_STATUS: Record<string, string> = {
  approve: "active",
  reject: "terminated",
  suspend: "suspended",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "PATCH") return jsonResponse(405, { error: "Method not allowed" });

  try {
    await requireRole(req.headers.get("authorization"), ["admin", "super_admin"]);
    const { vendor_id, action } = await req.json();
    if (!vendor_id || !action || !ACTION_TO_STATUS[action]) {
      return jsonResponse(400, { error: "Expected vendor_id and action in [approve,reject,suspend]" });
    }

    const { data, error } = await adminClient
      .from("vendors")
      .update({ status: ACTION_TO_STATUS[action] })
      .eq("id", vendor_id)
      .select("id, status")
      .single();

    if (error) return jsonResponse(500, { error: error.message });
    return jsonResponse(200, { message: "Vendor status updated", vendor: data });
  } catch {
    return jsonResponse(403, { error: "Forbidden" });
  }
});

