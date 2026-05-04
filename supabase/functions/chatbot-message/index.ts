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

    // 2. Check for Keywords (Priority)
    const lowerMsg = message.toLowerCase();
    let keywordResponse = "";
    const suggestions = config?.suggestions?.map((s: any) => s.question).slice(0, 3) || [];

    // Detailed Product Context
    let productContext = "";
    if (product_id) {
      const { data: p } = await adminClient.from("products").select("*").eq("id", product_id).single();
      if (p) {
        productContext = `PRODUIT ACTUEL: ${p.name}. PRIX: ${Number(p.price).toLocaleString('fr-FR')} FCFA. PUISSANCE: ${p.power_rating} kVA. UNITÉ: ${p.unit || 'W'}. DESCRIPTION: ${p.description || 'N/A'}.`;
        
        if (lowerMsg.includes("prix") || lowerMsg.includes("coûte") || lowerMsg.includes("combien")) {
          keywordResponse = `Le prix de ${p.name} est de ${Number(p.price).toLocaleString('fr-FR')} FCFA.`;
        }
      }
    }

    if (!keywordResponse) {
      if (lowerMsg.includes("consommation") || lowerMsg.includes("énergie") || lowerMsg.includes("recharge")) {
        keywordResponse = config?.consumption_info || "Ce produit est conçu pour une efficacité énergétique optimale. Souhaitez-vous plus de détails techniques ?";
      } else if (lowerMsg.includes("usage") || lowerMsg.includes("appareil") || lowerMsg.includes("connecter") || lowerMsg.includes("alimenter")) {
        keywordResponse = config?.usage_info || "Cet équipement peut alimenter vos appareils essentiels selon sa puissance. De quels appareils disposez-vous ?";
      } else if (lowerMsg.includes("boutique") || lowerMsg.includes("adresse") || lowerMsg.includes("situé") || lowerMsg.includes("livraison") || lowerMsg.includes("livrer")) {
        const addr = config?.address ? `Notre boutique est située ici : ${config.address}.` : "";
        const deliv = config?.delivery_info ? ` Concernant la livraison : ${config.delivery_info}` : "";
        keywordResponse = `${addr}${deliv}` || `Vous pouvez nous contacter directement au ${vendor.phone} pour connaître notre adresse exacte et nos conditions de livraison.`;
      }
    }

    // 3. AI Mode (if enabled and key present)
    if (config?.ai_enabled && GEMINI_API_KEY) {
      const systemPrompt = `
        Tu es l'assistant virtuel intelligent de "${vendor.name}", une entreprise experte en solutions énergétiques (Secteur: ${vendor.category}).
        Ton objectif est de conseiller le client, répondre à ses questions techniques et commerciales, et l'orienter vers l'achat.

        BASE DE CONNAISSANCES DU VENDEUR (À utiliser en priorité):
        - NOM DU VENDEUR: ${vendor.name}
        - TÉLÉPHONE: ${vendor.phone}
        - ADRESSE/BOUTIQUE: ${config.address || "Non spécifiée (Inviter à appeler)"}
        - LIVRAISON: ${config.delivery_info || "Non spécifiée"}
        - CONSOMMATION/RECHARGE: ${config.consumption_info || "Standard énergétique"}
        - USAGE APPAREILS: ${config.usage_info || "Dépend de la puissance (kVA)"}
        
        ${productContext}
        
        CONTEXTE ADDITIONNEL: ${config.ai_context || "Répondre de manière experte, professionnelle et concise."}

        RÈGLES DE RÉPONSE:
        1. Utilise EXCLUSIVEMENT les informations ci-dessus pour les prix, adresses et caractéristiques.
        2. Si tu ne sais pas, invite poliment à contacter le vendeur par WhatsApp ou téléphone au ${vendor.phone}.
        3. Réponds en Français de manière chaleureuse.
        4. NE JAMAIS mentionner que tu es une IA Gemini ou un programme. Tu es "L'assistant de ${vendor.name}".
        5. TA RÉPONSE DOIT ÊTRE UN OBJET JSON VALIDE UNIQUEMENT.

        FORMAT JSON ATTENDU:
        {
          "answer": "Votre réponse textuelle ici...",
          "next_questions": ["Question suggérée 1?", "Question suggérée 2?"]
        }
      `;

      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: "Initialise ton système avec ces instructions." }] },
              { role: "model", parts: [{ text: "C'est entendu. Je suis prêt à représenter " + vendor.name + "." }] },
              { role: "user", parts: [{ text: systemPrompt }] },
              { role: "model", parts: [{ text: "Instructions reçues. J'appliquerai ces règles pour répondre." }] },
              ...(history || []).map(h => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.content }] })),
              { role: "user", parts: [{ text: message }] }
            ],
            generationConfig: { 
              response_mime_type: "application/json",
              temperature: 0.7,
              max_output_tokens: 500
            }
          })
        });

        const aiData = await response.json();
        const aiText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (aiText) {
          const aiContent = JSON.parse(aiText);
          return jsonResponse(200, {
            response: aiContent.answer,
            suggestions: aiContent.next_questions || [],
            source: "ai"
          });
        }
      } catch (err) {
        console.error("Gemini AI Processing Error:", err);
        // Fallback to keyword if AI fails
      }
    }

    // 4. Try static suggestions as fallback (exact match)
    const staticMatch = config?.suggestions?.find((s: any) => 
      s.question.toLowerCase().trim() === message.toLowerCase().trim()
    );

    if (staticMatch) {
      return jsonResponse(200, {
        response: staticMatch.answer,
        suggestions: suggestions,
        source: "static"
      });
    }

    // 5. Final Fallback (Keyword or Default)
    const finalResponse = keywordResponse || 
                          config?.welcome_message.replace("{vendor_name}", vendor.name) || 
                          `Bonjour, je suis l'assistant de ${vendor.name}. Comment puis-je vous aider ?`;

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
