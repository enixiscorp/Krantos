import { adminClient, corsHeaders, jsonResponse } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const payload = await req.json();
    console.log("Signup attempt for:", payload.email);

    const { email, password, company_name, category, phone, contract_duration, subscription_type } = payload;

    if (!email || !password) {
      return jsonResponse(400, { error: "Email et mot de passe requis" });
    }

    // 1. Create Auth User
    const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { company_name, role: "vendor" }
    });

    if (createError) {
      console.error("Auth creation failed:", createError.message);
      // If user already exists, we might want to link them or return specific error
      return jsonResponse(400, { error: `Erreur d'authentification: ${createError.message}` });
    }

    const userId = authUser.user.id;

    // 2. Create Profile (with error suppression to continue)
    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: userId,
      phone: phone || "",
      role: "vendor",
      full_name: company_name || "Vendeur Krantos"
    });
    if (profileError) console.error("Profile creation warning:", profileError.message);

    // 3. Create Vendor Record
    const duration = Number(contract_duration) || 12;
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + duration);

    const { error: vendorError } = await adminClient.from("vendors").insert({
      profile_id: userId,
      company_name: company_name || "Entreprise en attente",
      name: company_name || "Entreprise en attente",
      category: category || "Autre",
      phone: phone || "",
      email: email,
      status: "pending",
      subscription_type: subscription_type || "free",
      contract_start_date: new Date().toISOString().split("T")[0],
      contract_end_date: endDate.toISOString().split("T")[0],
    });

    if (vendorError) {
      console.error("Vendor record creation failed:", vendorError.message);
      return jsonResponse(500, { error: `Erreur base de données: ${vendorError.message}` });
    }

    console.log("Signup successful for:", userId);
    return jsonResponse(201, { message: "Inscription réussie", userId });

  } catch (err) {
    console.error("Global signup crash:", err);
    return jsonResponse(500, { error: "Le serveur a rencontré une erreur inattendue." });
  }
});
