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

    if (type === "leads" || type === "revenue") {
      const now = new Date();
      let startDate = new Date();
      let step: "day" | "week" | "month" | "quarter" | "year" = "day";

      if (period === "day") {
        startDate.setDate(now.getDate() - 29);
        step = "day";
      } else if (period === "week") {
        startDate.setDate(now.getDate() - (7 * 11));
        step = "week";
      } else if (period === "month") {
        startDate.setMonth(now.getMonth() - 11);
        step = "month";
      } else if (period === "quarter") {
        startDate.setMonth(now.getMonth() - 23); // 2 years
        step = "quarter";
      } else if (period === "semester") {
        startDate.setMonth(now.getMonth() - 23); // 2 years
        step = "quarter";
      } else if (period === "year") {
        startDate.setFullYear(now.getFullYear() - 4);
        step = "year";
      }

      // Initialize timeline FIRST to ensure all points exist
      const statsByPeriod: Record<string, number> = {};
      const current = new Date(startDate);
      current.setHours(0, 0, 0, 0); // Normalize to start of day
      
      while (current <= now) {
        let key = "";
        if (step === "day") key = current.toISOString().slice(0, 10);
        else if (step === "week") {
          const d = new Date(current);
          d.setHours(0,0,0,0);
          d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
          const week1 = new Date(d.getFullYear(), 0, 4);
          const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
          key = `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
        }
        else if (step === "month") key = current.toISOString().slice(0, 7);
        else if (step === "quarter") key = `${current.getFullYear()}-Q${Math.floor(current.getMonth() / 3) + 1}`;
        else if (step === "year") key = `${current.getFullYear()}`;
        
        if (key) statsByPeriod[key] = 0;
        
        if (step === "day") current.setDate(current.getDate() + 1);
        else if (step === "week") current.setDate(current.getDate() + 7);
        else if (step === "month") current.setMonth(current.getMonth() + 1);
        else if (step === "quarter") current.setMonth(current.getMonth() + 3);
        else if (step === "year") current.setFullYear(current.getFullYear() + 1);
        
        // Safety break to prevent infinite loops
        if (Object.keys(statsByPeriod).length > 100) break;
      }

      const table = type === "leads" ? "leads" : "commission_records";
      let query = adminClient
        .from(table)
        .select(type === "leads" ? "status, created_at, vendor_id" : "amount, created_at, vendor_id")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });
      
      if (type === "revenue") {
        query = query.eq("status", "confirmed");
      }
      
      if (vendorId && vendorId !== "all") {
        query = query.eq("vendor_id", vendorId);
      }

      const { data: rows, error: queryError } = await query;
      if (queryError) {
        console.error(`Stats Query Error (${type}):`, queryError);
      }

      // Populate data
      let totalValue = 0;
      let convertedCount = 0;

      for (const r of rows ?? []) {
        const d = new Date((r as { created_at: string }).created_at);
        let key = "";
        if (step === "day") key = d.toISOString().slice(0, 10);
        else if (step === "week") {
          const temp = new Date(d);
          temp.setHours(0,0,0,0);
          temp.setDate(temp.getDate() + 3 - (temp.getDay() + 6) % 7);
          const week1 = new Date(temp.getFullYear(), 0, 4);
          const weekNum = 1 + Math.round(((temp.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
          key = `${temp.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
        }
        else if (step === "month") key = d.toISOString().slice(0, 7);
        else if (step === "quarter") key = `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
        else if (step === "year") key = `${d.getFullYear()}`;

        if (key && statsByPeriod[key] !== undefined) {
          if (type === "leads") {
            statsByPeriod[key]++;
            totalValue++;
            if ((r as { status: string }).status === "converted") convertedCount++;
          } else {
            const amt = Number((r as { amount: number }).amount);
            statsByPeriod[key] += amt;
            totalValue += amt;
          }
        }
      }

      const chart_data = Object.entries(statsByPeriod)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, count]) => ({ label, count }));

      await logAdminAction({
        actorId: user.id,
        actorRole: adminRole,
        action: `admin.stats.${type}.${period}`,
      });

      const response: Record<string, any> = { chart_data };
      if (type === "leads") {
        response.total_leads = totalValue;
        response.conversion_rate = totalValue > 0 ? Math.round((convertedCount / totalValue) * 1000) / 10 : 0;
      } else {
        response.total_revenue = totalValue;
      }

      return jsonResponse(200, response);
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
