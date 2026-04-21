import { supabase } from "../lib/supabase";

export type ChatbotIntent =
  | "price"
  | "specs"
  | "lifetime"
  | "reliability"
  | "warranty"
  | "order"
  | "fallback";

export interface ChatbotApiResponse {
  response: string;
  intent: ChatbotIntent;
  cta: "whatsapp" | "none";
  vendor_phone?: string;
  product_name?: string;
}

export async function sendChatbotMessage(message: string, productId: string): Promise<ChatbotApiResponse> {
  const { data, error } = await supabase.functions.invoke("chatbot-message", {
    body: {
      message,
      product_id: productId,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as ChatbotApiResponse;
}

