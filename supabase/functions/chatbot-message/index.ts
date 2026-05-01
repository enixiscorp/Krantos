import { adminClient, corsHeaders, jsonResponse } from "../_shared/auth.ts";
import { z } from "../_shared/security.ts";

const bodySchema = z.object({
  message: z.string().min(1).max(1000),
  vendor_id: z.string().uuid(),
  product_id: z.string().uuid().optional().nullable(),
  history: z.array(z.object({ role: z.string(), content: z.string() })).optional(),
});

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return jsonResponse(400, { error: "Invalid payload", details: parsed.error });

    const { message, vendor_id, product_id, history } = parsed.data;

    // 1. Fetch Vendor & Bot Config
    const [vendorRes, configRes] = await Promise.all([
      adminClient.from("vendors").select("id, name, phone, category").eq("id", vendor_id).single(),
      adminClient.from("chatbot_configs").select("*").eq("vendor_id", vendor_id).single(),
    ]);

    const vendor = vendorRes.data;
    const config = configRes.data;

    if (!vendor) return jsonResponse(404, { error: "Vendor not found" });

    // 2. Try static suggestions first (exact match)
    const staticMatch = config?.suggestions?.find((s: any) => 
      s.question.toLowerCase().trim() === message.toLowerCase().trim()
    );

    if (staticMatch) {
      return jsonResponse(200, {
        response: staticMatch.answer,
        suggestions: config.suggestions.map((s: any) => s.question).slice(0, 3),
        source: "static"
      });
    }

    // 3. AI Mode (if enabled and key present)
    if (config?.ai_enabled && GEMINI_API_KEY) {
      // Fetch Product context if exists
      let productContext = "";
      if (product_id) {
        const { data: p } = await adminClient.from("products").select("*").eq("id", product_id).single();
        if (p) {
          productContext = `Tu réponds pour le produit: ${p.name}. Prix: ${p.price} FCFA. Puissance: ${p.power_rating} kVA. Description: ${p.description}.`;
        }
      }

      const systemPrompt = `
        Tu es l'assistant virtuel IA de ${vendor.name}, une entreprise dans le secteur ${vendor.category}.
        Ton but est d'aider le client et de l'orienter vers l'achat ou le contact WhatsApp.
        Contexte du vendeur: ${config.ai_context || "Expert et professionnel"}.
        ${productContext}
        Instructions:
        - Sois concis et amical.
        - Réponds en français.
        - Termine ta réponse par un format JSON contenant ta réponse et 2-3 suggestions de questions courtes pour le client.
        Format attendu: {"answer": "votre texte ici", "next_questions": ["question 1?", "question 2?"]}
      `;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: systemPrompt }] },
            ...(history || []).map(h => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.content }] })),
            { role: "user", parts: [{ text: message }] }
          ],
          generationConfig: { response_mime_type: "application/json" }
        })
      });

      const aiData = await response.json();
      const aiContent = JSON.parse(aiData.candidates[0].content.parts[0].text);

      return jsonResponse(200, {
        response: aiContent.answer,
        suggestions: aiContent.next_questions || [],
        source: "ai"
      });
    }

    // 4. Fallback (Static Welcome or default)
    return jsonResponse(200, {
      response: config?.welcome_message.replace("{vendor_name}", vendor.name) || `Bonjour, bienvenue chez ${vendor.name}. Comment puis-je vous aider ?`,
      suggestions: config?.suggestions?.map((s: any) => s.question).slice(0, 3) || [],
      source: "fallback"
    });

  } catch (err) {
    console.error("Chatbot AI Error:", err);
    return jsonResponse(500, { error: "Erreur lors de la génération de la réponse" });
  }
});
