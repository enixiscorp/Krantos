import { adminClient, corsHeaders, jsonResponse, requireAdminStaff } from "../_shared/auth.ts";
import { enforceRateLimit, logAdminAction } from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const { user, adminRole } = await requireAdminStaff(req.headers.get("authorization"));
    const limiter = await enforceRateLimit({
      key: `admin-vendors-list:${user.id}`,
      maxHits: 120,
      windowSeconds: 60,
    });
    if (!limiter.allowed) {
      return jsonResponse(429, { error: "Too many requests", retry_at: limiter.resetAt });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    let q = adminClient
      .from("vendors")
      .select("id, profile_id, company_name, name, category, phone, email, subscription_type, status, created_at")
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      q = q.eq("status", status);
    }
    if (from) {
      q = q.gte("created_at", from);
    }
    if (to) {
      q = q.lte("created_at", to);
    }

    const { data, error } = await q;
    if (error) return jsonResponse(500, { error: error.message });
    await logAdminAction({
      actorId: user.id,
      actorRole: adminRole,
      action: "admin.vendors.list",
      metadata: { status, from, to },
    });
    return jsonResponse(200, { vendors: data ?? [] });
  } catch {
    return jsonResponse(403, { error: "Access denied" });
  }
});


