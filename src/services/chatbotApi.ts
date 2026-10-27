import { supabase } from "../lib/supabase";
// Same rules as the `chatbot-message` Edge Function (shared file)
import {
  answerFromRules,
  chatSuggestions,
  type ChatbotKnowledge,
} from "../../supabase/functions/_shared/chatbotBrain.ts";

export interface ChatbotApiResponse {
  response: string;
  suggestions: string[];
  source: "static" | "ai" | "fallback";
}

const knowledgeCache = new Map<string, Promise<ChatbotKnowledge>>();

/** Company chatbot settings (programmed answers, address...), cached per vendor. */
function loadKnowledge(vendorId: string): Promise<ChatbotKnowledge> {
  let cached = knowledgeCache.get(vendorId);
  if (!cached) {
    cached = getChatbotConfig(vendorId)
      .then((c) => (c ?? {}) as ChatbotKnowledge)
      .catch(() => {
        knowledgeCache.delete(vendorId);
        return {};
      });
    knowledgeCache.set(vendorId, cached);
  }
  return cached;
}

/**
 * Local answer when the server is unreachable: the company's programmed
 * answers and the platform guide still work.
 */
export async function localChatbotAnswer(message: string, vendorId: string): Promise<ChatbotApiResponse> {
  const knowledge = await loadKnowledge(vendorId);
  const rule = answerFromRules(message, knowledge);
  return {
    response: rule?.response
      ?? "Je n'arrive pas à joindre l'assistant pour le moment. Choisissez une des questions proposées ou réessayez dans un instant.",
    suggestions: chatSuggestions(knowledge.suggestions),
    source: rule ? "static" : "fallback",
  };
}

export async function sendChatbotMessage(params: {
  message: string;
  vendor_id: string;
  product_id?: string | null;
  history?: { role: string; content: string }[];
}): Promise<ChatbotApiResponse> {
  try {
    const { data, error } = await supabase.functions.invoke("chatbot-message", {
      body: params,
    });
    if (error || !data?.response) throw error ?? new Error("Réponse vide");
    return data as ChatbotApiResponse;
  } catch (err) {
    console.warn("[Chatbot] Server unavailable, answering locally:", err);
    return localChatbotAnswer(params.message, params.vendor_id);
  }
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
