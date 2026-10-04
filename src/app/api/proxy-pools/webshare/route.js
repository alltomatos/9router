import { NextResponse } from "next/server";
import { createProxyPool, getProxyPools } from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/proxy-pools/webshare
 * Body: { apiKey: string, mode?: "direct" | "backbone", pageSize?: number, planId?: string }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const mode = body.mode === "backbone" ? "backbone" : "direct";
    const requestedLimit = Math.max(Number(body.pageSize) || 100, 1);
    const planId = body.planId ? String(body.planId).trim() : null;

    if (!apiKey) {
      return NextResponse.json({ error: "Webshare API Key is required" }, { status: 400 });
    }

    // Existing proxies in 9Router to avoid duplicates
    const existing = await getProxyPools();
    const existingUrls = new Set(existing.map((p) => p.proxyUrl.toLowerCase()));

    let created = 0;
    let skipped = 0;
    let totalCount = 0;
    let page = 1;
    const fetchPageSize = 100; // Webshare allows up to 100 per page

    while (created + skipped < requestedLimit) {
      const planParam = planId ? `&plan_id=${encodeURIComponent(planId)}` : "";
      const webshareUrl = `https://proxy.webshare.io/api/v2/proxy/list/?mode=${mode}&page=${page}&page_size=${fetchPageSize}${planParam}`;

      const response = await fetch(webshareUrl, {
        method: "GET",
        headers: {
          Authorization: `Token ${apiKey}`,
        },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const message = errData.detail || errData.message || `Webshare error: HTTP ${response.status}`;
        return NextResponse.json({ error: message }, { status: response.status });
      }

      const data = await response.json();
      totalCount = data.count || 0;
      const results = Array.isArray(data.results) ? data.results : [];

      if (results.length === 0) break;

      for (const item of results) {
        if (created + skipped >= requestedLimit) break;

        const auth = item.username && item.password ? `${encodeURIComponent(item.username)}:${encodeURIComponent(item.password)}@` : "";
        const proxyUrl = `http://${auth}${item.proxy_address}:${item.port}`;

        if (existingUrls.has(proxyUrl.toLowerCase())) {
          skipped += 1;
          continue;
        }

        const country = item.country_code ? ` [${item.country_code}]` : "";
        const city = item.city_name ? ` - ${item.city_name}` : "";
        const name = `Webshare ${item.proxy_address}:${item.port}${country}${city}`;

        await createProxyPool({
          name,
          proxyUrl,
          noProxy: "",
          countryCode: item.country_code || null,
          cityName: item.city_name || null,
          planId: planId || item.plan_id || null,
          isActive: item.valid !== false,
          strictProxy: false,
          type: "http",
        });

        existingUrls.add(proxyUrl.toLowerCase());
        created += 1;
      }

      if (!data.next || results.length < fetchPageSize) {
        break;
      }
      page += 1;
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total: totalCount || (created + skipped),
    });
  } catch (err) {
    console.error("Webshare import error:", err);
    return NextResponse.json({ error: err.message || "Failed to import from Webshare" }, { status: 500 });
  }
}
