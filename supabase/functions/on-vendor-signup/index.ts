import { corsHeaders, jsonResponse } from "../_shared/auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    console.log("Webhook received:", payload);

    // Payload structure from Supabase Database Webhook:
    // { type: 'INSERT', table: 'vendors', record: { name, email, ... } }
    const { record } = payload;

    if (!record || !record.email) {
      return jsonResponse(400, { error: "No record or email found in payload" });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Krantos <onboarding@resend.dev>", // Utilise l'adresse de test par défaut de Resend
        to: record.email,
        subject: "Bienvenue sur Krantos ! Votre inscription est reçue",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #eab308;">Bienvenue ${record.name} !</h1>
            <p>Merci de vous être inscrit sur <strong>Krantos</strong>.</p>
            <p>Votre compte est actuellement en cours de vérification par notre équipe administrative.</p>
            <p>Dès que votre profil sera validé, vous recevrez un email de confirmation et vous pourrez commencer à vendre vos produits.</p>
            <br>
            <p style="color: #666; font-size: 14px;">Ceci est un message automatique, merci de ne pas y répondre.</p>
          </div>
        `,
      }),
    });

    const data = await res.json();
    return jsonResponse(200, { message: "Welcome email sent", id: data.id });
  } catch (error) {
    console.error("Webhook error:", error);
    return jsonResponse(500, { error: error.message });
  }
});
