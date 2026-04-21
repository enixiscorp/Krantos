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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const parsed = parseOrBadRequest(bodySchema, await req.json());
  if (!parsed.ok) return parsed.response;
  const { message, product_id } = parsed.data;

  const intent = detectIntent(message);

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

  const p = product as {
    id: string;
    name: string;
    price: number;
    power_rating: number;
    description: string | null;
    keywords: string | null;
    vendors: { id: string; name: string; phone: string | null } | null;
  };

  const vendorName = p.vendors?.name ?? "le vendeur";
  const vendorPhone = p.vendors?.phone ?? "";
  const price = Number(p.price).toLocaleString("fr-FR");
  const power = `${p.power_rating} kVA`;
  const fallbackLifetime = "8 à 12 ans";

  let response = "";
  let cta: "whatsapp" | "none" = "none";

  switch (intent) {
    case "price":
      response = `Le prix de ${p.name} est de ${price} FCFA. Voulez-vous contacter ${vendorName} directement sur WhatsApp ?`;
      cta = "whatsapp";
      break;
    case "specs":
      response = `Ce produit a une capacité de ${power} et convient bien à votre besoin. ${p.description ? `Détail: ${p.description}` : ""}`.trim();
      break;
    case "lifetime":
      response = `La durée de vie moyenne de ce type d'équipement est d'environ ${fallbackLifetime} selon l'utilisation et la maintenance.`;
      break;
    case "reliability":
      response = "Ce produit est reconnu pour sa fiabilité et son usage régulier en environnement professionnel.";
      break;
    case "warranty":
      response = "Pour la garantie et le SAV, je vous recommande de confirmer directement les conditions avec le vendeur.";
      cta = vendorPhone ? "whatsapp" : "none";
      break;
    case "order":
      response = `Excellente décision. Je peux vous mettre en relation immédiate avec ${vendorName} sur WhatsApp pour finaliser la commande.`;
      cta = vendorPhone ? "whatsapp" : "none";
      break;
    case "fallback":
    default:
      response =
        "Je peux vous aider sur le prix, les caractéristiques ou la fiabilité du produit. Que souhaitez-vous savoir ?";
      break;
  }

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

