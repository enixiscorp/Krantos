import { adminClient, corsHeaders, jsonResponse } from "../_shared/auth.ts";
import { z } from "../_shared/security.ts";
import {
  CALCULATION_GUIDE,
  CONTACT_GUIDE,
  answerFromRules,
  chatSuggestions,
} from "../_shared/chatbotBrain.ts";

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

    const config = configRes.data;
    // Unknown id (e.g. the general "Assistant Krantos"): answer as the
    // platform assistant instead of failing with a 404.
    const vendor = vendorRes.data ?? { id: vendor_id, name: "Krantos", phone: null, category: null };
    const contactHint = vendor.phone
      ? `contacter directement ${vendor.name} au ${vendor.phone}`
      : "contacter un vendeur depuis la page Vendeurs";

    // 2. Rules: the company's programmed answers (tolerant matching), the
    //    platform guide (how to calculate / contact) and company info keywords.
    const suggestions = chatSuggestions(config?.suggestions);
    const rule = answerFromRules(message, config ?? {}, vendor.phone);
    if (rule) {
      return jsonResponse(200, { response: rule.response, suggestions, source: "static" });
    }

    // 3. Product context for the AI (price question answered directly)
    const lowerMsg = message.toLowerCase().trim();
    let productContext = "";
    if (product_id) {
      const { data: p } = await adminClient.from("products").select("*").eq("id", product_id).single();
      if (p) {
        productContext = `PRODUIT ACTUEL: ${p.name}. PRIX: ${Number(p.price).toLocaleString('fr-FR')} FCFA. PUISSANCE: ${p.power_rating} kVA. DESCRIPTION: ${p.description || 'N/A'}.`;
        const priceKeywords = ["prix", "coûte", "coute", "combien", "tarif", "valeur", "montant"];
        if (priceKeywords.some(k => lowerMsg.includes(k))) {
          return jsonResponse(200, {
            response: `Le prix de ${p.name} est de ${Number(p.price).toLocaleString('fr-FR')} FCFA.`,
            suggestions,
            source: "static",
          });
        }
      }
    }

    // 4. AI MODE: Gemini (Fallback)
    if (config?.ai_enabled && GEMINI_API_KEY) {
      const programmed = (config?.suggestions ?? [])
        .filter((q: any) => q?.question && q?.answer)
        .map((q: any) => `- Q: ${q.question}\n  R: ${q.answer}`)
        .join("\n");
      const companyInfo = [
        config?.ai_context && `CONTEXTE ENTREPRISE: ${config.ai_context}`,
        config?.address && `ADRESSE: ${config.address}`,
        config?.delivery_info && `LIVRAISON: ${config.delivery_info}`,
        config?.consumption_info && `CONSOMMATION: ${config.consumption_info}`,
        config?.usage_info && `USAGE: ${config.usage_info}`,
      ].filter(Boolean).join("\n");

      const systemPrompt = `
        Tu es l'assistante virtuelle de "${vendor.name}" sur la plateforme Krantos (énergie, Togo).
        ${productContext}
        ${companyInfo}
        RÉPONSES OFFICIELLES DE L'ENTREPRISE (à utiliser en priorité, sans les contredire):
        ${programmed || "Aucune"}
        GUIDE DE LA PLATEFORME (pour expliquer le calcul de puissance):
        ${CALCULATION_GUIDE}
        ${CONTACT_GUIDE}
        RÈGLES:
        - Réponds en français, de manière claire, chaleureuse et concise (5 phrases maximum).
        - N'invente jamais de prix, de délai ou de garantie: si l'information manque, invite à ${contactHint}.
        - N'utilise pas de tiret cadratin.
        - Format JSON STRICT: {"answer": "réponse texte", "next_questions": ["question 1", "question 2"]}
      `;

      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: "Initialise ton système." }] },
              { role: "model", parts: [{ text: "C'est entendu." }] },
              { role: "user", parts: [{ text: systemPrompt }] },
              { role: "model", parts: [{ text: "Instructions reçues." }] },
              ...(history || []).map(h => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.content }] })),
              { role: "user", parts: [{ text: message }] }
            ],
            generationConfig: { response_mime_type: "application/json", temperature: 0.7, max_output_tokens: 500 }
          })
        });

        const aiData = await response.json();
        const aiText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (aiText) {
          const aiContent = JSON.parse(aiText);
          const aiSuggestions = Array.isArray(aiContent.next_questions) 
            ? aiContent.next_questions.map((q: any) => typeof q === 'string' ? q : String(q))
            : suggestions;

          return jsonResponse(200, {
            response: aiContent.answer || "Comment puis-je vous aider ?",
            suggestions: aiSuggestions,
            source: "ai"
          });
        }
      } catch (err) {
        console.error("Gemini AI Error:", err);
      }
    }

    // 5. FINAL FALLBACK: Default response
    const isGreeting = ["bonjour", "salut", "hello", "hi", "hey"].some(k => lowerMsg.includes(k));
    const welcome = config?.welcome_message?.replace("{vendor_name}", vendor.name) || `Bonjour, je suis l'assistant de ${vendor.name}.`;
    
    const finalResponse = isGreeting 
      ? welcome 
      : `Je n'ai pas encore la réponse à cette question. Vous pouvez choisir une des questions proposées ci-dessous, ou ${contactHint}.`;

    return jsonResponse(200, {
      response: finalResponse,
      suggestions: suggestions,
      source: "fallback"
    });

  } catch (err) {
    console.error("Chatbot Global Error:", err);
    return jsonResponse(500, { error: "Désolé, une erreur technique est survenue." });
  }
});
