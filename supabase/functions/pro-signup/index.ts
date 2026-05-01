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
  contract_duration: z.number().min(0.4).max(120).default(12),
  subscription_type: z.enum(['free', 'basic', 'premium']).default('free'),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
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
  const parsed = proSignupSchema.safeParse(payload);
  
  if (!parsed.success) {
    console.error("Validation error:", parsed.error);
    return jsonResponse(400, { 
      error: "Validation failed", 
      details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ') 
    });
  }
  
  const {
    company_name,
    category,
    phone,
    email,
    password,
    first_name = null,
    last_name = null,
    contract_duration,
    subscription_type,
  } = parsed.data;

  const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  });

  if (createError || !authUser.user) {
    const isDuplicate = createError?.message?.includes("already registered");
    return jsonResponse(400, { 
      error: isDuplicate ? "Cet email est déjà utilisé." : (createError?.message ?? "Erreur Auth"),
      details: isDuplicate ? "Veuillez supprimer l'utilisateur dans l'onglet Authentication de Supabase pour recommencer." : undefined
    });
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

  // Contract calculation (approximate 30 days per month)
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + (contract_duration * 30 * 24 * 60 * 60 * 1000));

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
      subscription_type,
      contract_start_date: startDate.toISOString().split("T")[0],
      contract_end_date: endDate.toISOString().split("T")[0],
    })
    .select("id, profile_id, company_name, status, created_at")
    .single();

  if (vendorError) return jsonResponse(500, { error: vendorError.message });

  return jsonResponse(201, { message: "Vendor signup submitted", vendor });
});

