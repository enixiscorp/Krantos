import { adminClient, corsHeaders, jsonResponse } from "../_shared/auth.ts";
import { parseOrBadRequest, z } from "../_shared/security.ts";

type Intent = "price" | "specs" | "lifetime" | "reliability" | "warranty" | "order" | "fallback";

const bodySchema = z.object({
  message: z.string().min(1).max(500),
  product_id: z.string().uuid(),
});

const keywordMap: Array<{ intent: Intent; keywords: string[] }> = [
  { intent: "order", keywords: ["commander", "acheter", "achat"] },
  { intent: "price", keywords: ["prix", "coût", "cout", "tarif"] },
  { intent: "specs", keywords: ["caractéristique", "caracteristique", "spec", "specs", "puissance"] },
  { intent: "lifetime", keywords: ["durée de vie", "duree de vie", "longévité", "longevite"] },
  { intent: "reliability", keywords: ["fiable", "fiabilité", "fiabilite", "qualité", "qualite"] },
  { intent: "warranty", keywords: ["garantie", "sav"] },
];

function detectIntent(message: string): Intent {
  const text = message.toLowerCase();
  for (const rule of keywordMap) {
    if (rule.keywords.some((kw) => text.includes(kw))) return rule.intent;
  }
  return "fallback";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const parsed = parseOrBadRequest(bodySchema, await req.json());
  if (!parsed.ok) return parsed.response;
  const { message, product_id } = parsed.data;

  const { data: settings, error: settingsError } = await adminClient
    .from("chatbot_settings")
    .select("*");

  if (settingsError || !settings) {
    return jsonResponse(500, { error: "Failed to load chatbot settings" });
  }

  // 1. Detect intent
  const text = message.toLowerCase();
  let intent: Intent = "fallback";
  
  // Hardcoded detection logic (can also be externalized but for now we use the map)
  const detectionMap = [
    { intent: "order", keywords: ["commander", "acheter", "achat"] },
    { intent: "price", keywords: ["prix", "coût", "cout", "tarif"] },
    { intent: "specs", keywords: ["caractéristique", "caracteristique", "spec", "specs", "puissance"] },
    { intent: "lifetime", keywords: ["durée de vie", "duree de vie", "longévité", "longevite"] },
    { intent: "reliability", keywords: ["fiable", "fiabilité", "fiabilite", "qualité", "qualite"] },
    { intent: "warranty", keywords: ["garantie", "sav"] },
  ];

  for (const rule of detectionMap) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      intent = rule.intent as Intent;
      break;
    }
  }

  // 2. Get specific settings for this intent
  const setting = settings.find((s) => s.intent === intent) || settings.find((s) => s.intent === "fallback");
  
  const { data: product, error: productError } = await adminClient
    .from("products")
    .select(`
      id, name, price, power_rating, description, keywords,
      vendors:vendor_id (id, name, phone)
    `)
    .eq("id", product_id)
    .single();

  if (productError || !product) {
    return jsonResponse(404, { error: "Product not found" });
  }

  const p = product as any;
  const vendorName = p.vendors?.name ?? "le vendeur";
  const vendorPhone = p.vendors?.phone ?? "";
  const price = Number(p.price).toLocaleString("fr-FR");
  const power = `${p.power_rating} kVA`;
  const description = p.description ?? "";

  // 3. Format response
  let response = setting?.response_template ?? "Je ne sais pas comment répondre à cela.";
  response = response
    .replace("{product_name}", p.name)
    .replace("{price}", price)
    .replace("{vendor_name}", vendorName)
    .replace("{power}", power)
    .replace("{description}", description)
    .replace("{lifetime}", "8 à 12 ans");

  const cta = setting?.use_whatsapp && vendorPhone ? "whatsapp" : "none";

  await adminClient.from("chat_logs").insert({
    message,
    detected_intent: intent,
    product_id,
  });

  return jsonResponse(200, {
    response,
    intent,
    cta,
    vendor_phone: vendorPhone,
    product_name: p.name,
  });
});


