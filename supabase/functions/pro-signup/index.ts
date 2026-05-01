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
      const isExisting = createError.message.toLowerCase().includes("already");
      if (isExisting) {
        const { data: users } = await adminClient.auth.admin.listUsers();
        const found = users?.users.find(u => u.email === email);
        if (!found) return jsonResponse(400, { error: "Utilisateur introuvable." });
        userId = found.id;
      } else {
        return jsonResponse(400, { error: `Erreur Auth: ${createError.message}` });
      }
    } else {
      userId = authUser.user.id;
    }

    // 2. Ensure Profile exists
    await adminClient.from("profiles").upsert({
      id: userId,
      phone: phone || "",
      role: "vendor",
      full_name: company_name
    });

    // 3. Create or Update Vendor Record (MANUAL FIND TO AVOID ON CONFLICT ERRORS)
    const durationInMonths = Number(contract_duration) || 12;
    const endDate = new Date();
    if (durationInMonths === 0.5) endDate.setDate(endDate.getDate() + 14);
    else endDate.setMonth(endDate.getMonth() + durationInMonths);

    const vendorData = {
      profile_id: userId,
      name: company_name,
      category: category || "Autres",
      phone: phone || "",
      email: email,
      status: "pending",
      subscription_type: subscription_type || "free",
      contract_start_date: new Date().toISOString().split("T")[0],
      contract_end_date: endDate.toISOString().split("T")[0],
    };

    // Check if vendor already exists
    const { data: existingVendor } = await adminClient
      .from("vendors")
      .select("id")
      .eq("profile_id", userId)
      .maybeSingle();

    let vendorError;
    if (existingVendor) {
      // Update
      const { error } = await adminClient
        .from("vendors")
        .update(vendorData)
        .eq("id", existingVendor.id);
      vendorError = error;
    } else {
      // Insert
      const { error } = await adminClient
        .from("vendors")
        .insert(vendorData);
      vendorError = error;
    }

    if (vendorError) {
      console.error(`[Signup Error] Vendor: ${vendorError.message}`);
      return jsonResponse(500, { error: `Erreur Database: ${vendorError.message}` });
    }

    // 4. Create Admin Notification
    await adminClient.from("admin_notifications").insert({
      type: "vendor_signup",
      title: "Nouvelle inscription",
      message: `Vendeur : ${company_name} (${email}). En attente de validation.`,
      metadata: { vendor_id: userId }
    });

    console.log(`[Signup Success] Vendor ready and notified: ${userId}`);
    return jsonResponse(201, { message: "Inscription réussie", userId });

  } catch (err) {
    console.error(`[Signup Critical]`, err);
    return jsonResponse(500, { error: "Erreur interne" });
  }
});
