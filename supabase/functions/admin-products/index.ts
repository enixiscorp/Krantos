import { adminClient, corsHeaders, jsonResponse, requireAdminStaff } from "../_shared/auth.ts";
import { enforceRateLimit, logAdminAction } from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const { user, adminRole } = await requireAdminStaff(req.headers.get("authorization"));
    const limiter = await enforceRateLimit({
      key: `admin-products:${user.id}`,
      maxHits: 120,
      windowSeconds: 60,
    });
    if (!limiter.allowed) {
      return jsonResponse(429, { error: "Too many requests", retry_at: limiter.resetAt });
    }

    const url = new URL(req.url);
    const sort = url.searchParams.get("sort") ?? "price";

    let q = adminClient
      .from("products")
      .select("id, name, category, power_rating, price, vendor_id, is_active, created_at");

    if (sort === "price") {
      q = q.order("price", { ascending: true });
    } else if (sort === "vendor") {
      q = q.order("vendor_id", { ascending: true });
    } else {
      q = q.order("created_at", { ascending: false });
    }

    const { data: products, error } = await q.limit(500);
    if (error) return jsonResponse(500, { error: error.message });

    let list = products ?? [];
    if (sort === "popularity") {
      const { data: leads } = await adminClient
        .from("leads")
        .select("recommended_product_id")
        .not("recommended_product_id", "is", null);
      const counts: Record<string, number> = {};
      for (const l of leads ?? []) {
        const id = (l as { recommended_product_id: string }).recommended_product_id;
        counts[id] = (counts[id] ?? 0) + 1;
      }
      list = [...list].sort(
        (a, b) =>
          (counts[(a as { id: string }).id] ?? 0) - (counts[(b as { id: string }).id] ?? 0)
      ).reverse();
    }

    await logAdminAction({
      actorId: user.id,
      actorRole: adminRole,
      action: "admin.products.list",
      metadata: { sort },
    });

    return jsonResponse(200, { products: list, sort });
  } catch {
    return jsonResponse(403, { error: "Access denied" });
  }
});
