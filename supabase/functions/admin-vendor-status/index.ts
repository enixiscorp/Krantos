import { adminClient, corsHeaders, jsonResponse, requireRole } from "../_shared/auth.ts";
import { enforceRateLimit, logAdminAction, parseOrBadRequest, z } from "../_shared/security.ts";

const ACTION_TO_STATUS: Record<string, string> = {
  approve: "active",
  reject: "terminated",
  suspend: "suspended",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "PATCH") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const { user } = await requireRole(req.headers.get("authorization"), ["super_admin", "admin"]);

    const limiter = await enforceRateLimit({
      key: `admin-vendor-status:${user.id}`,
      maxHits: 60,
      windowSeconds: 60,
    });
    if (!limiter.allowed) return jsonResponse(429, { error: "Too many requests", retry_at: limiter.resetAt });

    const bodySchema = z.object({
      vendor_id: z.string().uuid(),
      action: z.enum(["approve", "reject", "suspend"]),
    });
    const parsed = parseOrBadRequest(bodySchema, await req.json());
    if (!parsed.ok) return parsed.response;
    const { vendor_id, action } = parsed.data;

    const { data, error } = await adminClient
      .from("vendors")
      .update({ status: ACTION_TO_STATUS[action] })
      .eq("id", vendor_id)
      .select("id, status")
      .single();

    if (error) return jsonResponse(500, { error: error.message });

    await logAdminAction({
      actorId: user.id,
      actorRole: "super_admin",
      action: `vendor.${action}`,
      targetType: "vendor",
      targetId: vendor_id,
      metadata: { new_status: ACTION_TO_STATUS[action] },
    });

    return jsonResponse(200, { message: "Vendor status updated", vendor: data });
  } catch (err: any) {
    return jsonResponse(403, { error: err?.message || "Forbidden" });
  }
});
