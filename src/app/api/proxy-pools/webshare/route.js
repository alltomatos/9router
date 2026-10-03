import { NextResponse } from "next/server";
import { createProxyPool, getProxyPools } from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/proxy-pools/webshare
 * Body: { apiKey: string, mode?: "direct" | "backbone", pageSize?: number }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const mode = body.mode === "backbone" ? "backbone" : "direct";
    const pageSize = Math.min(Math.max(Number(body.pageSize) || 25, 1), 100);

    if (!apiKey) {
      return NextResponse.json({ error: "Webshare API Key is required" }, { status: 400 });
    }

    // Call Webshare Proxy List API
    const webshareUrl = `https://proxy.webshare.io/api/v2/proxy/list/?mode=${mode}&page=1&page_size=${pageSize}`;
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
    const results = Array.isArray(data.results) ? data.results : [];

    if (results.length === 0) {
      return NextResponse.json({
        created: 0,
        skipped: 0,
        total: 0,
        message: "No proxies found in this Webshare account/plan",
      });
    }

    // Existing proxies to avoid duplicates
    const existing = await getProxyPools();
    const existingUrls = new Set(existing.map((p) => p.proxyUrl.toLowerCase()));

    let created = 0;
    let skipped = 0;

    for (const item of results) {
      // Build standard proxy URL: http://username:password@proxy_address:port
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
        isActive: item.valid !== false,
        strictProxy: false,
        type: "http",
      });

      existingUrls.add(proxyUrl.toLowerCase());
      created += 1;
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total: data.count || results.length,
    });
  } catch (err) {
    console.error("Webshare import error:", err);
    return NextResponse.json({ error: err.message || "Failed to import from Webshare" }, { status: 500 });
  }
}
