import { supabase } from "../lib/supabase";

export interface ChatbotApiResponse {
  response: string;
  suggestions: string[];
  source: "static" | "ai" | "fallback";
}

export async function sendChatbotMessage(params: {
  message: string;
  vendor_id: string;
  product_id?: string | null;
  history?: { role: string; content: string }[];
}): Promise<ChatbotApiResponse> {
  const { data, error } = await supabase.functions.invoke("chatbot-message", {
    body: params,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as ChatbotApiResponse;
}

export async function getChatbotConfig(vendorId: string) {
  const { data, error } = await supabase
    .from('chatbot_configs')
    .select('*')
    .eq('vendor_id', vendorId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data;
}
