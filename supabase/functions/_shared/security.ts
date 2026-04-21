import { z } from "https://esm.sh/zod@3.23.8";
import { adminClient, jsonResponse } from "./auth.ts";

export { z };

export function parseOrBadRequest<T>(
  schema: z.ZodType<T>,
  input: unknown
): { ok: true; data: T } | { ok: false; response: Response } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonResponse(400, {
        error: "Validation failed",
        details: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      }),
    };
  }
  return { ok: true, data: parsed.data };
}

export async function enforceRateLimit(params: {
  key: string;
  maxHits: number;
  windowSeconds: number;
}) {
  const { data, error } = await adminClient.rpc("check_and_increment_rate_limit", {
    p_key: params.key,
    p_max_hits: params.maxHits,
    p_window_seconds: params.windowSeconds,
  });

  if (error || !data || data.length === 0) {
    return { allowed: true, hits: 0, resetAt: null as string | null };
  }

  const row = data[0] as { allowed: boolean; hits: number; reset_at: string };
  return { allowed: row.allowed, hits: row.hits, resetAt: row.reset_at };
}

export async function logAdminAction(args: {
  actorId: string;
  actorRole: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  await adminClient.from("admin_action_logs").insert({
    actor_id: args.actorId,
    actor_role: args.actorRole,
    action: args.action,
    target_type: args.targetType ?? null,
    target_id: args.targetId ?? null,
    metadata: args.metadata ?? {},
  });
}

