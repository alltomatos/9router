import { NextResponse } from "next/server";
import { getProxyPools, updateProxyPool, createProxyPool, deleteProxyPool } from "@/models";
import { testProxyUrl } from "@/lib/network/proxyTest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/proxy-pools/webshare/sync
 * 
 * Auto-detects dead Webshare proxies, requests automatic replacement on Webshare API,
 * fetches the updated proxy list, and syncs 9Router database.
 * 
 * Body: {
 *   apiKey: string,
 *   autoReplaceOnWebshare?: boolean, // if true, calls /api/v3/proxy/replace/ on Webshare
 *   removeDeadFrom9Router?: boolean,  // if true, deletes dead proxies that are no longer in Webshare
 *   pageSize?: number
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const autoReplaceOnWebshare = body.autoReplaceOnWebshare !== false;
    const removeDeadFrom9Router = body.removeDeadFrom9Router !== false;
    const pageSize = Math.min(Math.max(Number(body.pageSize) || 50, 1), 100);

    if (!apiKey) {
      return NextResponse.json({ error: "Webshare API Key is required" }, { status: 400 });
    }

    // 1. Get all current Webshare proxy pools from 9Router
    const allPools = await getProxyPools();
    const websharePools = allPools.filter((p) => p.name.startsWith("Webshare ") || p.proxyUrl.includes("webshare"));

    const deadPools = [];
    const deadIpAddresses = [];

    // 2. Health check current Webshare pools (concurrency: 10)
    const queue = [...websharePools];
    const worker = async () => {
      while (queue.length > 0) {
        const pool = queue.shift();
        if (!pool) break;
        try {
          const testRes = await testProxyUrl({ proxyUrl: pool.proxyUrl, timeoutMs: 5000 });
          if (!testRes.ok) {
            deadPools.push(pool);
            // Extract IP address from name "Webshare 1.2.3.4:PORT" or URL
            const m = pool.name.match(/Webshare\s+([0-9.]+):/i) || pool.proxyUrl.match(/@([0-9.]+):/);
            if (m && m[1]) {
              deadIpAddresses.push(m[1]);
            }
          }
        } catch {
          deadPools.push(pool);
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(10, websharePools.length) }, worker));

    let replacedOnWebshareCount = 0;
    let webshareReplacementError = null;

    // 3. Proactively trigger replacement on Webshare API if dead proxies found
    if (autoReplaceOnWebshare && deadIpAddresses.length > 0) {
      try {
        const replaceRes = await fetch("https://proxy.webshare.io/api/v3/proxy/replace/", {
          method: "POST",
          headers: {
            "Authorization": `Token ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to_replace: {
              type: "ip_address",
              ip_addresses: deadIpAddresses,
            },
            replace_with: [
              {
                type: "any",
                count: deadIpAddresses.length,
              },
            ],
            dry_run: false,
          }),
        });

        if (replaceRes.ok) {
          replacedOnWebshareCount = deadIpAddresses.length;
        } else {
          const errData = await replaceRes.json().catch(() => ({}));
          webshareReplacementError = errData.detail || errData.error || `HTTP ${replaceRes.status}`;
        }
      } catch (err) {
        webshareReplacementError = err.message;
      }
    }

    // 4. Fetch the authoritative, fresh proxy list from Webshare
    const listRes = await fetch(`https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page=1&page_size=${pageSize}`, {
      method: "GET",
      headers: {
        Authorization: `Token ${apiKey}`,
      },
    });

    if (!listRes.ok) {
      return NextResponse.json({
        error: `Failed to fetch fresh proxy list from Webshare: HTTP ${listRes.status}`,
        deadDetected: deadPools.length,
        webshareReplacementError,
      }, { status: listRes.status });
    }

    const freshData = await listRes.json();
    const freshProxies = Array.isArray(freshData.results) ? freshData.results : [];

    // Map of fresh valid proxy URLs from Webshare
    const freshProxyUrlMap = new Map();
    for (const item of freshProxies) {
      const auth = item.username && item.password ? `${encodeURIComponent(item.username)}:${encodeURIComponent(item.password)}@` : "";
      const proxyUrl = `http://${auth}${item.proxy_address}:${item.port}`;
      freshProxyUrlMap.set(proxyUrl.toLowerCase(), item);
    }

    // 5. Remove or disable obsolete/dead proxies in 9Router
    let removedCount = 0;
    let disabledCount = 0;

    for (const deadPool of deadPools) {
      // If the dead proxy is no longer present in Webshare fresh list
      const isStillInWebshare = freshProxyUrlMap.has(deadPool.proxyUrl.toLowerCase());
      if (!isStillInWebshare && removeDeadFrom9Router) {
        await deleteProxyPool(deadPool.id);
        removedCount += 1;
      } else {
        // Otherwise deactivate it so it won't be used by providers
        await updateProxyPool(deadPool.id, { isActive: false, testStatus: "error" });
        disabledCount += 1;
      }
    }

    // 6. Add any net-new proxies returned by Webshare
    const currentPools = await getProxyPools();
    const currentUrls = new Set(currentPools.map((p) => p.proxyUrl.toLowerCase()));
    let addedCount = 0;

    for (const [urlLower, item] of freshProxyUrlMap.entries()) {
      if (!currentUrls.has(urlLower)) {
        const country = item.country_code ? ` [${item.country_code}]` : "";
        const city = item.city_name ? ` - ${item.city_name}` : "";
        const name = `Webshare ${item.proxy_address}:${item.port}${country}${city}`;

        await createProxyPool({
          name,
          proxyUrl: `http://${item.username && item.password ? `${encodeURIComponent(item.username)}:${encodeURIComponent(item.password)}@` : ""}${item.proxy_address}:${item.port}`,
          noProxy: "",
          countryCode: item.country_code || null,
          cityName: item.city_name || null,
          isActive: item.valid !== false,
          strictProxy: false,
          type: "http",
        });
        currentUrls.add(urlLower);
        addedCount += 1;
      }
    }

    return NextResponse.json({
      success: true,
      deadDetected: deadPools.length,
      replacedOnWebshare: replacedOnWebshareCount,
      removedFrom9Router: removedCount,
      disabledIn9Router: disabledCount,
      addedFromWebshare: addedCount,
      webshareReplacementError,
    });
  } catch (err) {
    console.error("Webshare sync error:", err);
    return NextResponse.json({ error: err.message || "Failed to sync Webshare proxies" }, { status: 500 });
  }
}
