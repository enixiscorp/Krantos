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

    // 2. SMART MATCH: Programmed Questions (Priority)
    const lowerMsg = message.toLowerCase().trim();
    const suggestions = config?.suggestions?.map((s: any) => s.question).slice(0, 3) || [];
    
    // Exact or flexible match in programmed suggestions
    const staticMatch = config?.suggestions?.find((s: any) => {
      const q = s.question.toLowerCase().trim();
      return lowerMsg === q || lowerMsg.includes(q) || q.includes(lowerMsg) && lowerMsg.length > 5;
    });

    if (staticMatch) {
      return jsonResponse(200, {
        response: staticMatch.answer,
        suggestions: suggestions,
        source: "static"
      });
    }

    // 3. KEYWORDS: Specific Contextual Information
    let keywordResponse = "";
    
    // Detailed Product Context (if product_id is provided)
    let productContext = "";
    if (product_id) {
      const { data: p } = await adminClient.from("products").select("*").eq("id", product_id).single();
      if (p) {
        productContext = `PRODUIT ACTUEL: ${p.name}. PRIX: ${Number(p.price).toLocaleString('fr-FR')} FCFA. PUISSANCE: ${p.power_rating} kVA. UNITÉ: ${p.unit || 'W'}. DESCRIPTION: ${p.description || 'N/A'}.`;
        
        const priceKeywords = ["prix", "coûte", "combien", "tarif", "valeur", "montant"];
        if (priceKeywords.some(k => lowerMsg.includes(k))) {
          keywordResponse = `Le prix de ${p.name} est de ${Number(p.price).toLocaleString('fr-FR')} FCFA.`;
        }
      }
    }

    if (!keywordResponse) {
      // Consumption / Energy info
      if (["consommation", "énergie", "recharge", "batterie", "autonomie"].some(k => lowerMsg.includes(k))) {
        keywordResponse = config?.consumption_info;
      } 
      // Usage / Appliances info
      else if (["usage", "appareil", "connecter", "alimenter", "brancher", "supporter"].some(k => lowerMsg.includes(k))) {
        keywordResponse = config?.usage_info;
      }
      // Address / Delivery info
      else if (["boutique", "adresse", "situé", "livraison", "livrer", "où", "trouver"].some(k => lowerMsg.includes(k))) {
        const addr = config?.address ? `Notre boutique est située ici : ${config.address}.` : "";
        const deliv = config?.delivery_info ? ` Concernant la livraison : ${config.delivery_info}` : "";
        
        keywordResponse = `${addr}${deliv}`.trim();
        
        // If still empty but keyword matched, provide a standard fallback
        if (!keywordResponse) {
          keywordResponse = `Vous pouvez nous contacter directement au ${vendor.phone} pour connaître notre adresse exacte et nos conditions de livraison.`;
        }
      }
    }

    if (keywordResponse) {
      return jsonResponse(200, {
        response: keywordResponse,
        suggestions: suggestions,
        source: "static"
      });
    }

    // 4. AI MODE: Gemini (Fallback)
    if (config?.ai_enabled && GEMINI_API_KEY) {
      const systemPrompt = `
        Tu es l'assistant virtuel intelligent de "${vendor.name}". 
        ${productContext}
        RÈGLES:
        - Réponds de manière experte et concise.
        - Si tu ne sais pas, invite à appeler au ${vendor.phone}.
        - Ton nom est "L'assistant de ${vendor.name}".
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
            response: aiContent.answer || keywordResponse || "Comment puis-je vous aider ?",
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
      : `Je n'ai pas d'information précise sur ce point. Je vous invite à contacter directement ${vendor.name} au ${vendor.phone}.`;

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
