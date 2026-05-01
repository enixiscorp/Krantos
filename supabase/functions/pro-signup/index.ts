import { adminClient, corsHeaders, jsonResponse } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const payload = await req.json();
    const { email, password, company_name, category, phone, contract_duration, subscription_type } = payload;

    console.log(`[Signup] Attempt for ${email}`);

    if (!email || !password || !company_name) {
      return jsonResponse(400, { error: "Données manquantes" });
    }

    // 1. Try to create user or get existing
    let userId;
    const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { company_name, role: "vendor" }
    });

    if (createError) {
      if (createError.message.includes("already exists")) {
        console.log(`[Signup] User already exists in Auth, checking for Vendor record...`);
        // Get existing user ID
        const { data: existingUser } = await adminClient.from("profiles").select("id").eq("id", (await adminClient.auth.admin.listUsers()).data.users.find(u => u.email === email)?.id).maybeSingle();
        
        // Alternative: use listUsers and filter (less efficient but works if profiles is empty)
        const allUsers = await adminClient.auth.admin.listUsers();
        const found = allUsers.data.users.find(u => u.email === email);
        if (!found) return jsonResponse(400, { error: "Erreur lors de la récupération de l'utilisateur existant." });
        userId = found.id;
      } else {
        return jsonResponse(400, { error: `Erreur Auth: ${createError.message}` });
      }
    } else {
      userId = authUser.user.id;
    }

    // 2. Ensure Profile exists
    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: userId,
      phone: phone || "",
      role: "vendor",
      full_name: company_name
    });
    if (profileError) console.error(`[Signup Warning] Profile: ${profileError.message}`);

    // 3. Create or Update Vendor Record
    const durationInMonths = Number(contract_duration) || 12;
    const endDate = new Date();
    if (durationInMonths === 0.5) endDate.setDate(endDate.getDate() + 14);
    else endDate.setMonth(endDate.getMonth() + durationInMonths);

    const { error: vendorError } = await adminClient.from("vendors").upsert({
      profile_id: userId,
      name: company_name,
      category: category || "Autres",
      phone: phone || "",
      email: email,
      status: "pending",
      subscription_type: subscription_type || "free",
      contract_start_date: new Date().toISOString().split("T")[0],
      contract_end_date: endDate.toISOString().split("T")[0],
    }, { onConflict: "profile_id" });

    if (vendorError) {
      console.error(`[Signup Error] Vendor: ${vendorError.message}`);
      return jsonResponse(500, { error: `Erreur Database: ${vendorError.message}` });
    }

    console.log(`[Signup Success] Vendor record ready for ${userId}`);
    return jsonResponse(201, { message: "Inscription réussie", userId });

  } catch (err) {
    console.error(`[Signup Critical]`, err);
    return jsonResponse(500, { error: "Erreur interne" });
  }
});
