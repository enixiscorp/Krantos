import { corsHeaders, adminClient, jsonResponse, requireSuperAdmin } from "../_shared/auth.ts";

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

    const { first_name, last_name, email, phone, role } = await req.json();
    const normalizedRole = role === "vendor" ? "vendor" : "admin";

    if (!first_name || !last_name || !email) {
      return jsonResponse(400, { error: "Missing required fields: first_name, last_name, email" });
    }

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

