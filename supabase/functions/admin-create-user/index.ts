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
      role: z.enum(["admin_principal", "admin_collaborateur", "vendor"]).optional().default("admin_collaborateur"),
    });
    const parsed = parseOrBadRequest(bodySchema, await req.json());
    if (!parsed.ok) return parsed.response;

    const { first_name, last_name, email, phone, role } = parsed.data;
    const normalizedRole = role === "vendor" ? "vendor" : "admin";
    const adminStaffRole = role === "vendor" ? null : role;

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
    // If it's an admin staff account, create the admin_users row (RLS: service_role only)
    if (adminStaffRole) {
      const { data: actorAdmin } = await adminClient
        .from("admin_users")
        .select("id")
        .eq("auth_user_id", actorId)
        .maybeSingle();

      const { error: adminUsersError } = await adminClient.from("admin_users").insert({
        auth_user_id: userId,
        role: adminStaffRole,
        name: `${first_name} ${last_name}`.trim(),
        email,
        created_by: actorAdmin?.id ?? null,
      });

      if (adminUsersError) {
        return jsonResponse(500, { error: adminUsersError.message });
      }
    }


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
      metadata: { email, role: normalizedRole, admin_staff_role: adminStaffRole },
    });

    return jsonResponse(201, {
      message: `${normalizedRole} created successfully`,
      user_id: userId,
      role: normalizedRole,
      admin_staff_role: adminStaffRole,
      // If your SMTP is configured in Supabase, you can send this securely server-side.
      password_reset_link: linkData?.properties?.action_link ?? null,
    });
  } catch (error) {
    return jsonResponse(403, { error: error instanceof Error ? error.message : "Forbidden" });
  }
});

