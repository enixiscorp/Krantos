import { adminClient, corsHeaders, jsonResponse, requireAdminStaff } from "../_shared/auth.ts";
import { enforceRateLimit, logAdminAction } from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const { user, adminRole } = await requireAdminStaff(req.headers.get("authorization"));
    const limiter = await enforceRateLimit({
      key: `admin-stats:${user.id}`,
      maxHits: 90,
      windowSeconds: 60,
    });
    if (!limiter.allowed) {
      return jsonResponse(429, { error: "Too many requests", retry_at: limiter.resetAt });
    }

    const url = new URL(req.url);
    const type = url.searchParams.get("type") ?? "vendors";
    const period = url.searchParams.get("period") ?? "day"; // day, week, month, quarter, year
    const vendorId = url.searchParams.get("vendor_id");

    if (type === "vendors") {
      const { data: rows } = await adminClient.from("vendors").select("status, created_at");
      const total = rows?.length ?? 0;
      let active = 0;
      let suspended = 0;
      const since = new Date();
      since.setDate(since.getDate() - 7);
      let newLast7 = 0;
      for (const r of rows ?? []) {
        const s = (r as { status: string }).status;
        if (s === "active") active++;
        if (s === "suspended") suspended++;
        const created = new Date((r as { created_at: string }).created_at);
        if (created >= since) newLast7++;
      }
      await logAdminAction({
        actorId: user.id,
        actorRole: adminRole,
        action: "admin.stats.vendors",
      });
      return jsonResponse(200, {
        total,
        active,
        suspended,
        new_vendors_last_7_days: newLast7,
      });
    }

    if (type === "leads") {
      let query = adminClient
        .from("leads")
        .select("status, created_at, vendor_id")
        .order("created_at", { ascending: true });
      
      if (vendorId) {
        query = query.eq("vendor_id", vendorId);
      }

      const { data: leads } = await query;
      const total = leads?.length ?? 0;
      let converted = 0;
      
      const statsByPeriod: Record<string, number> = {};
      
      for (const l of leads ?? []) {
        const st = (l as { status: string }).status;
        if (st === "converted") converted++;
        
        const d = new Date((l as { created_at: string }).created_at);
        let key = "";
        
        if (period === "day") {
          key = d.toISOString().slice(0, 10);
        } else if (period === "week") {
          // ISO Week key: YYYY-Www
          const tempDate = new Date(d.getTime());
          tempDate.setHours(0, 0, 0, 0);
          tempDate.setDate(tempDate.getDate() + 3 - (tempDate.getDay() + 6) % 7);
          const week1 = new Date(tempDate.getFullYear(), 0, 4);
          const weekNum = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
          key = `${tempDate.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
        } else if (period === "month") {
          key = d.toISOString().slice(0, 7);
        } else if (period === "quarter") {
          const q = Math.floor(d.getMonth() / 3) + 1;
          key = `${d.getFullYear()}-Q${q}`;
        } else if (period === "year") {
          key = `${d.getFullYear()}`;
        }

        statsByPeriod[key] = (statsByPeriod[key] ?? 0) + 1;
      }

      const chart_data = Object.entries(statsByPeriod)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, count]) => ({ label, count }));

      const conversion_rate = total > 0
        ? Math.round((converted / total) * 1000) / 10
        : 0;

      await logAdminAction({
        actorId: user.id,
        actorRole: adminRole,
        action: `admin.stats.leads.${period}`,
      });

      return jsonResponse(200, {
        total_leads: total,
        chart_data,
        conversion_rate,
      });
    }

    if (type === "revenue") {
      let query = adminClient
        .from("commission_records")
        .select("amount, created_at, vendor_id")
        .eq("status", "confirmed")
        .order("created_at", { ascending: true });
      
      if (vendorId) {
        query = query.eq("vendor_id", vendorId);
      }

      const { data: records } = await query;
      const total = records?.reduce((acc, r) => acc + Number(r.amount), 0) || 0;
      
      const statsByPeriod: Record<string, number> = {};
      
      for (const r of records ?? []) {
        const d = new Date((r as { created_at: string }).created_at);
        let key = "";
        
        if (period === "day") {
          key = d.toISOString().slice(0, 10);
        } else if (period === "week") {
          const tempDate = new Date(d.getTime());
          tempDate.setHours(0, 0, 0, 0);
          tempDate.setDate(tempDate.getDate() + 3 - (tempDate.getDay() + 6) % 7);
          const week1 = new Date(tempDate.getFullYear(), 0, 4);
          const weekNum = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
          key = `${tempDate.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
        } else if (period === "month") {
          key = d.toISOString().slice(0, 7);
        } else if (period === "quarter") {
          const q = Math.floor(d.getMonth() / 3) + 1;
          key = `${d.getFullYear()}-Q${q}`;
        } else if (period === "year") {
          key = `${d.getFullYear()}`;
        }

        statsByPeriod[key] = (statsByPeriod[key] ?? 0) + Number((r as { amount: number }).amount);
      }

      const chart_data = Object.entries(statsByPeriod)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, count]) => ({ label, count }));

      await logAdminAction({
        actorId: user.id,
        actorRole: adminRole,
        action: `admin.stats.revenue.${period}`,
      });

      return jsonResponse(200, {
        total_revenue: total,
        chart_data,
      });
    }

    if (type === "products") {
      const { count: total } = await adminClient
        .from("products")
        .select("*", { count: "exact", head: true });
      const { data: recs } = await adminClient
        .from("leads")
        .select("recommended_product_id")
        .not("recommended_product_id", "is", null);
      const popularity: Record<string, number> = {};
      for (const r of recs ?? []) {
        const pid = (r as { recommended_product_id: string }).recommended_product_id;
        popularity[pid] = (popularity[pid] ?? 0) + 1;
      }
      const topIds = Object.entries(popularity)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => id);
      const { data: products } = topIds.length
        ? await adminClient
          .from("products")
          .select("id, name, vendor_id, price")
          .in("id", topIds)
        : { data: [] };
      const most_demanded = (products ?? []).map((p) => ({
        ...(p as Record<string, unknown>),
        lead_mentions: popularity[(p as { id: string }).id] ?? 0,
      }));
      await logAdminAction({
        actorId: user.id,
        actorRole: adminRole,
        action: "admin.stats.products",
      });
      return jsonResponse(200, {
        total_products: total ?? 0,
        most_demanded,
      });
    }

    return jsonResponse(400, { error: "Invalid type. Use vendors, leads, or products" });
  } catch (err) {
    console.error("Admin Stats Error:", err);
    return jsonResponse(403, { error: "Access denied" });
  }
});
