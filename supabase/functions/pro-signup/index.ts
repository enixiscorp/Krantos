import { adminClient, corsHeaders, jsonResponse } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const payload = await req.json();
    const { email, password, company_name, category, phone, contract_duration, subscription_type } = payload;

    console.log(`[Signup] Attempt for ${email} (${company_name})`);

    if (!email || !password || !company_name) {
      return jsonResponse(400, { error: "Données manquantes : Email, mot de passe et nom d'entreprise sont requis." });
    }

    // 1. Create Auth User
    const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { company_name, role: "vendor" }
    });

    if (createError) {
      console.error(`[Signup Error] Auth: ${createError.message}`);
      return jsonResponse(400, { error: `Erreur d'authentification : ${createError.message}` });
    }

    const userId = authUser.user.id;

    // 2. Create Profile
    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: userId,
      phone: phone || "",
      role: "vendor",
      full_name: company_name
    });
    if (profileError) console.error(`[Signup Warning] Profile: ${profileError.message}`);

    // 3. Create Vendor Record
    // Handling 0.5 months (14 days) or full months
    const durationInMonths = Number(contract_duration) || 12;
    const startDate = new Date();
    const endDate = new Date();
    
    if (durationInMonths === 0.5) {
      endDate.setDate(endDate.getDate() + 14); // 14 days
    } else {
      endDate.setMonth(endDate.getMonth() + durationInMonths);
    }

    const { error: vendorError } = await adminClient.from("vendors").insert({
      profile_id: userId,
      company_name: company_name,
      name: company_name,
      category: category || "Autres",
      phone: phone || "",
      email: email,
      status: "pending",
      subscription_type: subscription_type || "free",
      contract_start_date: startDate.toISOString().split("T")[0],
      contract_end_date: endDate.toISOString().split("T")[0],
    });

    if (vendorError) {
      console.error(`[Signup Error] Table Vendors: ${vendorError.message}`);
      // If vendor table fails, we still have the user, but we should inform the admin
      return jsonResponse(500, { error: `Erreur base de données : ${vendorError.message}` });
    }

    console.log(`[Signup Success] Created vendor ${userId}`);
    return jsonResponse(201, { message: "Inscription réussie", userId });

  } catch (err) {
    console.error(`[Signup Critical] Crash:`, err);
    return jsonResponse(500, { error: "Une erreur interne est survenue. Veuillez réessayer." });
  }
});
