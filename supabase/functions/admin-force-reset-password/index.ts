import { corsHeaders, adminClient, jsonResponse, requireSuperAdmin } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    await requireSuperAdmin(req.headers.get("authorization"));

    const { user_id, email } = await req.json();
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

    return jsonResponse(200, {
      message: "Password reset generated",
      email: targetEmail,
      password_reset_link: data?.properties?.action_link ?? null,
    });
  } catch (error) {
    return jsonResponse(403, { error: error instanceof Error ? error.message : "Forbidden" });
  }
});

