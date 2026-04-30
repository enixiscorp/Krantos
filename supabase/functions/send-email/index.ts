import { corsHeaders, jsonResponse } from "../_shared/auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      return jsonResponse(500, { error: "RESEND_API_KEY is not set in Supabase Secrets" });
    }

    const { to, subject, html } = await req.json();

    if (!to || !subject || !html) {
      return jsonResponse(400, { error: "Missing required fields: to, subject, html" });
    }

    console.log(`Sending email to ${to} with subject: ${subject}`);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Krantos <notifications@krantos.vercel.app>", // Update this with your verified domain
        to,
        subject,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", data);
      return jsonResponse(res.status, { error: data.message || "Failed to send email" });
    }

    return jsonResponse(200, { message: "Email sent successfully", id: data.id });
  } catch (error) {
    console.error("Error in send-email function:", error);
    return jsonResponse(500, { error: error.message });
  }
});
