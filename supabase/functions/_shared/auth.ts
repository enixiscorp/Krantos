import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

export const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function requireSuperAdmin(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new Error("Missing bearer token");
  }

  const token = authorizationHeader.replace("Bearer ", "");

  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData.user) {
    throw new Error("Invalid token");
  }

  const userId = userData.user.id;
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profileError || !profile || profile.role !== "super_admin") {
    throw new Error("Forbidden: super_admin required");
  }

  return userData.user;
}

export async function requireAdminStaff(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new Error("Missing bearer token");
  }

  const token = authorizationHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData.user) {
    throw new Error("Invalid token");
  }

  const userId = userData.user.id;

  // Allow super_admin via profiles
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profileError && profile?.role === "super_admin") {
    return { user: userData.user, adminRole: "super_admin" as const };
  }

  // Allow staff admins via admin_users
  const { data: adminUser, error: adminError } = await adminClient
    .from("admin_users")
    .select("role")
    .eq("auth_user_id", userId)
    .single();

  if (adminError || !adminUser) {
    throw new Error("Forbidden: admin required");
  }

  return { user: userData.user, adminRole: adminUser.role as "admin_principal" | "admin_collaborateur" };
}

export async function requireAdminPrincipalOrSuper(authorizationHeader: string | null) {
  const { user, adminRole } = await requireAdminStaff(authorizationHeader);
  if (adminRole !== "super_admin" && adminRole !== "admin_principal") {
    throw new Error("Forbidden: admin_principal required");
  }
  return { user, adminRole };
}

export async function requireRole(
  authorizationHeader: string | null,
  allowedRoles: Array<"super_admin" | "admin" | "vendor" | "user">
) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new Error("Missing bearer token");
  }
  const token = authorizationHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData.user) {
    throw new Error("Invalid token");
  }

  const userId = userData.user.id;
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profileError || !profile || !allowedRoles.includes(profile.role)) {
    throw new Error("Forbidden");
  }

  return { user: userData.user, role: profile.role as "super_admin" | "admin" | "vendor" | "user" };
}

export function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

