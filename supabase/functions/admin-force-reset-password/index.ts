import { corsHeaders, adminClient, jsonResponse, requireSuperAdmin } from "../_shared/auth.ts";
import { enforceRateLimit, logAdminAction, parseOrBadRequest, z } from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    await requireSuperAdmin(req.headers.get("authorization"));
    const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
    const { data: actorData } = await adminClient.auth.getUser(token);
    const actorId = actorData.user?.id;
    if (!actorId) return jsonResponse(403, { error: "Forbidden" });

    const limiter = await enforceRateLimit({
      key: `admin-force-reset-password:${actorId}`,
      maxHits: 20,
      windowSeconds: 60,
    });
    if (!limiter.allowed) return jsonResponse(429, { error: "Too many requests", retry_at: limiter.resetAt });

    const bodySchema = z.object({
      user_id: z.string().uuid().optional(),
      email: z.string().email().optional(),
    }).refine((d) => Boolean(d.user_id || d.email), "Provide user_id or email");
    const parsed = parseOrBadRequest(bodySchema, await req.json());
    if (!parsed.ok) return parsed.response;

    const { user_id, email } = parsed.data;
    if (!user_id && !email) {
      return jsonResponse(400, { error: "Provide user_id or email" });
    }

    let targetEmail = email as string | undefined;
    if (!targetEmail && user_id) {
      const { data: targetUser, error: userError } = await adminClient.auth.admin.getUserById(user_id);
      if (userError || !targetUser.user?.email) {
        return jsonResponse(404, { error: "Target user not found" });
      }
      targetEmail = targetUser.user.email;
    }

    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email: targetEmail!,
    });

    if (error) {
      return jsonResponse(400, { error: error.message });
    }

    await logAdminAction({
      actorId,
      actorRole: "super_admin",
      action: "account.force_password_reset",
      targetType: "auth_user",
      targetId: user_id ?? targetEmail,
      metadata: { email: targetEmail },
    });

    return jsonResponse(200, {
      message: "Password reset generated",
      email: targetEmail,
      password_reset_link: data?.properties?.action_link ?? null,
    });
  } catch (error) {
    return jsonResponse(403, { error: error instanceof Error ? error.message : "Forbidden" });
  }
});

