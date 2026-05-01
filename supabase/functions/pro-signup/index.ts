import { adminClient, corsHeaders, jsonResponse } from "../_shared/auth.ts";
import { enforceRateLimit, z } from "../_shared/security.ts";

const proSignupSchema = z.object({
  company_name: z.string().min(1),
  category: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  contract_duration: z.any(),
  subscription_type: z.any(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const payload = await req.json();
    console.log("Signup payload received:", payload);

    const parsed = proSignupSchema.safeParse(payload);
    if (!parsed.success) {
      console.error("Validation failed:", parsed.error);
      return jsonResponse(400, { 
        error: "Données invalides", 
        details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ') 
      });
    }

    const { email, password, company_name, category, phone, contract_duration, subscription_type } = parsed.data;

    // Create user with Service Role (bypass RLS/Confirm)
    const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm to avoid 400 on login
      user_metadata: { company_name, role: "vendor" }
    });

    if (createError) {
      console.error("Auth creation error:", createError);
      return jsonResponse(400, { error: createError.message });
    }

    const userId = authUser.user.id;

    // Insert Profile
    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: userId,
      phone,
      role: "vendor",
    });
    if (profileError) console.error("Profile error:", profileError);

    // Insert Vendor
    const startDate = new Date();
    const duration = Number(contract_duration) || 12;
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + duration);

    const { error: vendorError } = await adminClient.from("vendors").insert({
      profile_id: userId,
      company_name,
      name: company_name,
      category,
      phone,
      email,
      status: "pending",
      subscription_type: subscription_type || "free",
      contract_start_date: startDate.toISOString().split("T")[0],
      contract_end_date: endDate.toISOString().split("T")[0],
    });

    if (vendorError) {
      console.error("Vendor table error:", vendorError);
      return jsonResponse(500, { error: vendorError.message });
    }

    return jsonResponse(201, { message: "Inscription réussie", userId });

  } catch (err) {
    console.error("Global signup error:", err);
    return jsonResponse(500, { error: "Erreur interne du serveur" });
  }
});
