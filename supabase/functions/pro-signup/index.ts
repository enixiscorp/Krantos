import { adminClient, corsHeaders, jsonResponse } from "../_shared/auth.ts";
import { enforceRateLimit, parseOrBadRequest, z } from "../_shared/security.ts";

const proSignupSchema = z.object({
  company_name: z.string().min(2).max(120),
  category: z.string().min(2).max(80),
  phone: z.string().min(6).max(30),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  first_name: z.string().min(1).max(80).optional().nullable(),
  last_name: z.string().min(1).max(80).optional().nullable(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = await enforceRateLimit({
    key: `pro-signup:${ip}`,
    maxHits: 8,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return jsonResponse(429, { error: "Too many signup attempts", retry_at: rate.resetAt });
  }

  const payload = await req.json();
  const parsed = parseOrBadRequest(proSignupSchema, payload);
  if (!parsed.ok) return parsed.response;

  const {
    company_name,
    category,
    phone,
    email,
    password,
    first_name = null,
    last_name = null,
  } = parsed.data;

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

