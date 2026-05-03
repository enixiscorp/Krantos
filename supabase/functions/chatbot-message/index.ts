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

    if (lowerMsg.includes("prix") || lowerMsg.includes("coûte") || lowerMsg.includes("combien")) {
      const { data: p } = product_id ? await adminClient.from("products").select("name, price").eq("id", product_id).single() : { data: null };
      if (p) {
        keywordResponse = `Le prix de ${p.name} est de ${Number(p.price).toLocaleString('fr-FR')} FCFA.`;
      } else {
        keywordResponse = `Le prix dépend du modèle choisi. Quel produit vous intéresse en particulier ?`;
      }
    } else if (lowerMsg.includes("consommation") || lowerMsg.includes("énergie") || lowerMsg.includes("recharge")) {
      keywordResponse = config?.consumption_info || "Ce produit est conçu pour une efficacité énergétique optimale. Souhaitez-vous plus de détails techniques ?";
    } else if (lowerMsg.includes("usage") || lowerMsg.includes("appareil") || lowerMsg.includes("connecter") || lowerMsg.includes("alimenter")) {
      keywordResponse = config?.usage_info || "Cet équipement peut alimenter vos appareils essentiels selon sa puissance. De quels appareils disposez-vous ?";
    } else if (lowerMsg.includes("boutique") || lowerMsg.includes("adresse") || lowerMsg.includes("situé") || lowerMsg.includes("livraison") || lowerMsg.includes("livrer")) {
      const addr = config?.address ? `Notre boutique est située ici : ${config.address}.` : "";
      const deliv = config?.delivery_info ? ` Concernant la livraison : ${config.delivery_info}` : "";
      keywordResponse = `${addr}${deliv}` || `Vous pouvez nous contacter directement au ${vendor.phone} pour connaître notre adresse exacte et nos conditions de livraison.`;
    }

    // If a keyword match is found and AI is NOT mandatory or keyword is enough, return it
    // But better: use it as context for AI if enabled, or return directly if not
    if (keywordResponse && !config?.ai_enabled) {
      return jsonResponse(200, {
        response: keywordResponse,
        suggestions: suggestions,
        source: "static"
      });
    }

    // 3. Try static suggestions first (exact match)
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

    // 4. AI Mode (if enabled and key present)
    if (config?.ai_enabled && GEMINI_API_KEY) {
      // Fetch Product context if exists
      let productContext = "";
      if (product_id) {
        const { data: p } = await adminClient.from("products").select("*").eq("id", product_id).single();
        if (p) {
          productContext = `Produit actuel: ${p.name}. Prix: ${p.price} FCFA. Puissance: ${p.power_rating} kVA. Description: ${p.description}.`;
        }
      }

      const systemPrompt = `
        Tu es l'assistant virtuel IA de ${vendor.name}, une entreprise dans le secteur ${vendor.category}.
        Ton but est d'aider le client et de l'orienter vers l'achat ou le contact WhatsApp.
        
        BASE DE CONNAISSANCE CRITIQUE (Priorité haute):
        - Adresse/Boutique: ${config.address || "Non spécifiée"}
        - Livraison: ${config.delivery_info || "Non spécifiée"}
        - Consommation: ${config.consumption_info || "Non spécifiée"}
        - Usage/Appareils: ${config.usage_info || "Non spécifiée"}
        
        ${productContext}
        Contexte additionnel: ${config.ai_context || "Expert et professionnel"}.

        Instructions:
        - Si l'utilisateur pose une question sur un mot-clé ci-dessus, utilise EXCLUSIVEMENT les informations de la BASE DE CONNAISSANCE CRITIQUE.
        - Sois concis et amical. Réponds en français.
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

    // 5. Fallback (Static Welcome or default)
    return jsonResponse(200, {
      response: keywordResponse || config?.welcome_message.replace("{vendor_name}", vendor.name) || `Bonjour, bienvenue chez ${vendor.name}. Comment puis-je vous aider ?`,
      suggestions: suggestions,
      source: "fallback"
    });

  } catch (err) {
    console.error("Chatbot AI Error:", err);
    return jsonResponse(500, { error: "Erreur lors de la génération de la réponse" });
  }
});
