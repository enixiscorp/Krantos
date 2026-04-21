import { corsHeaders, adminClient, jsonResponse, requireSuperAdmin } from "../_shared/auth.ts";
import { enforceRateLimit, logAdminAction, parseOrBadRequest, z } from "../_shared/security.ts";

function randomPassword(length = 20) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

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
      key: `admin-create-user:${actorId}`,
      maxHits: 20,
      windowSeconds: 60,
    });
    if (!limiter.allowed) return jsonResponse(429, { error: "Too many requests", retry_at: limiter.resetAt });

    const bodySchema = z.object({
      first_name: z.string().min(1).max(80),
      last_name: z.string().min(1).max(80),
      email: z.string().email(),
      phone: z.string().min(6).max(30).optional().nullable(),
      role: z.enum(["admin", "vendor"]).optional().default("admin"),
    });
    const parsed = parseOrBadRequest(bodySchema, await req.json());
    if (!parsed.ok) return parsed.response;

    const { first_name, last_name, email, phone, role } = parsed.data;
    const normalizedRole = role === "vendor" ? "vendor" : "admin";

    const temporaryPassword = randomPassword();

    const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { first_name, last_name, phone },
    });

    if (createError || !createdUser.user) {
      return jsonResponse(400, { error: createError?.message ?? "Failed to create auth user" });
    }

    const userId = createdUser.user.id;

    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: userId,
      first_name,
      last_name,
      phone: phone ?? null,
      role: normalizedRole,
    });

    if (profileError) {
      return jsonResponse(500, { error: profileError.message });
    }

    // Force secure password setup flow (no clear password handling in UI).
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    if (linkError) {
      return jsonResponse(500, { error: linkError.message });
    }

    await logAdminAction({
      actorId,
      actorRole: "super_admin",
      action: normalizedRole === "admin" ? "admin.create" : "vendor.create_by_admin",
      targetType: "auth_user",
      targetId: userId,
      metadata: { email, role: normalizedRole },
    });

    return jsonResponse(201, {
      message: `${normalizedRole} created successfully`,
      user_id: userId,
      role: normalizedRole,
      // If your SMTP is configured in Supabase, you can send this securely server-side.
      password_reset_link: linkData?.properties?.action_link ?? null,
    });
  } catch (error) {
    return jsonResponse(403, { error: error instanceof Error ? error.message : "Forbidden" });
  }
});

