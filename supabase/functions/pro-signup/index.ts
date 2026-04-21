import { adminClient, corsHeaders, jsonResponse } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const body = await req.json();
  const company_name = body.company_name as string;
  const category = body.category as string;
  const phone = body.phone as string;
  const email = body.email as string;
  const password = body.password as string;
  const first_name = (body.first_name as string) ?? null;
  const last_name = (body.last_name as string) ?? null;

  if (!company_name || !category || !phone || !email || !password) {
    return jsonResponse(400, { error: "Missing required fields" });
  }

  const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  });

  if (createError || !authUser.user) {
    return jsonResponse(400, { error: createError?.message ?? "Failed to create auth user" });
  }

  const userId = authUser.user.id;
  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: userId,
    first_name,
    last_name,
    phone,
    role: "vendor",
  });
  if (profileError) return jsonResponse(500, { error: profileError.message });

  const { data: vendor, error: vendorError } = await adminClient
    .from("vendors")
    .insert({
      profile_id: userId,
      company_name,
      name: company_name,
      category,
      phone,
      email,
      status: "pending",
    })
    .select("id, profile_id, company_name, status, created_at")
    .single();

  if (vendorError) return jsonResponse(500, { error: vendorError.message });

  return jsonResponse(201, { message: "Vendor signup submitted", vendor });
});

