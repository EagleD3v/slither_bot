import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { getActiveServers } from "./getActiveServers.js";
import { SocketClient } from "./socketClient.js";
import { getProxies, getRandomProxy } from "./getProxies.js";
import { lookupGeo } from "./geo.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const REFRESH_INTERVAL = 120_000; // 2 minutes
const PROXY_RETRY_LIMIT = 3;
const SERVERS_FILE = path.join(__dirname, "servers.json");

// === Toggle testing mode ===
const TEST_MODE = false; // change to false in production

// Store stats keyed by `${ip}:${port}`
let latestStats = {};
let isRefreshing = false;

// Track live page viewers via Server-Sent Events
const viewerClients = new Set();
let viewerCount = 0;

function broadcastViewerCount() {
    if (!viewerClients.size) return;
    const payload = `data: ${JSON.stringify({ viewerCount })}\n\n`;
    for (const client of viewerClients) {
        client.write(payload);
    }
}

function drawProxy(pool) {
    if (!Array.isArray(pool) || pool.length === 0) return null;
    const proxy = getRandomProxy(pool);
    if (!proxy) return null;
    const index = pool.indexOf(proxy);
    if (index >= 0) {
        pool.splice(index, 1);
    }
    return proxy;
}

function isIPv6Literal(ip) {
    return typeof ip === "string" && /^\[[0-9a-fA-F:]+\]$/.test(ip);
}

async function collectStatsWithProxies(server, proxies) {
    const wsUrl = `ws://${server.ip}:${server.po}/slither`;
    const serverKey = `${server.ip}:${server.po}`;
    const available = Array.isArray(proxies) ? proxies.slice() : [];
    let attempt = 0;
    let lastError = null;

    while (attempt < PROXY_RETRY_LIMIT && available.length) {
        const proxy = drawProxy(available);
        if (!proxy) break;
        attempt += 1;

        let client = null;

        try {
            client = new SocketClient(wsUrl, {
                agent: proxy.agent,
                proxyLabel: proxy.label
            });
            const stats = await client.returnStatsPromise();
            return stats;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error || "Unknown error"));
        } finally {
            if (client) {
                client.close();
            }
        }
    }

    // If all proxies failed, try a direct IPv6 connection as a fallback.
    if (isIPv6Literal(server.ip)) {
        let client = null;
        try {
            client = new SocketClient(wsUrl); // no proxy/agent
            const stats = await client.returnStatsPromise();
            return stats;
        } catch (ipv6Err) {
            lastError = ipv6Err instanceof Error ? ipv6Err : new Error(String(ipv6Err || "Unknown error"));
        } finally {
            if (client) client.close();
        }
    }

    if (lastError) {
        lastError.message = `Failed after ${attempt} proxy attempt(s): ${lastError.message}`;
        throw lastError;
    }

    throw new Error(`Failed to connect: no proxies available for ${serverKey}`);
}

function loadServerSeeds() {
    try {
        if (fs.existsSync(SERVERS_FILE)) {
            const raw = fs.readFileSync(SERVERS_FILE, "utf8");
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length) {
                return parsed;
            }
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "Unknown error");
        console.warn(`[Servers] Failed to read ${SERVERS_FILE}: ${message}`);
    }
    return null;
}

async function refreshStats() {
    if (isRefreshing) return;
    isRefreshing = true;

    try {
        const proxies = getProxies();
        if (!proxies.length) {
            console.warn("[Refresh] No proxies available; skipping refresh cycle.");
            return;
        }

        let servers = loadServerSeeds();
        if (!servers || !servers.length) {
            servers = await getActiveServers();
        }

        if (!servers.length) {
            console.warn("[Refresh] No active servers found.");
            return;
        }

        const activeServers = TEST_MODE ? servers.slice(0, 1) : servers;

        const tasks = activeServers
            .map((server, index) => {
                if (!server) return null;
                const serverKey = `${server.ip}:${server.po}`;

                if (TEST_MODE && index > 0) {
                    latestStats[serverKey] = null;
                    return null;
                }

                return (async () => {
                    try {
                        const stats = await collectStatsWithProxies(server, proxies);
                        const geo = lookupGeo(server.ip);
                        latestStats[serverKey] = {
                            ip: server.ip,
                            port: server.po,
                            cluster: server.clu ?? null,
                            timestamp: new Date().toISOString(),
                            ...(geo
                                ? {
                                      countryCode: geo.countryCode,
                                      countryName: geo.countryName,
                                      continentCode: geo.continentCode,
                                      continentName: geo.continentName,
                                      regionCode: geo.regionCode,
                                      timezone: geo.timezone
                                  }
                                : {}),
                            ...stats
                        };
                        console.log(`[OK] Got stats for: ${serverKey}`);
                    } catch (error) {
                        delete latestStats[serverKey];
                        const message = error instanceof Error ? error.message : String(error || "Unknown error");
                        const suffix = message ? ` (${message})` : "";
                        console.warn(`[WARN] Failed to get stats for: ${serverKey}${suffix}`);
                    }
                })();
            })
            .filter(Boolean);

        if (tasks.length) {
            await Promise.allSettled(tasks);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "Unknown error");
        console.error(`[Refresh] Global failure: ${message}`);
    } finally {
        isRefreshing = false;
    }
}

// periodic refresh loop
setInterval(() => {
    refreshStats().catch((error) => {
        const message = error instanceof Error ? error.message : String(error || "Unknown error");
        console.error(`[Refresh] Interval failure: ${message}`);
    });
}, REFRESH_INTERVAL);
refreshStats(); // immediate first run

const publicDir = path.join(__dirname, "public");

// Serve everything in /public (JS, CSS, images, etc.)
app.use(express.static(publicDir));

app.get("/", (req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/live-viewers", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    viewerClients.add(res);
    viewerCount += 1;
    broadcastViewerCount();

    const heartbeat = setInterval(() => {
        res.write(": heartbeat\n\n");
    }, 30000);

    const cleanup = () => {
        clearInterval(heartbeat);
        if (viewerClients.has(res)) {
            viewerClients.delete(res);
            viewerCount = Math.max(0, viewerCount - 1);
            broadcastViewerCount();
        }
    };

    req.on("close", cleanup);
    res.on("close", cleanup);
});

// Express route to return array of server stats
app.get("/stats", async (req, res) => {
    if (req.query.refresh === "1") {
        try {
            await refreshStats();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error || "Unknown error");
            console.error(`[Refresh] Manual refresh failed: ${message}`);
        }
    }

    const list = Object.entries(latestStats)
        .filter(([_, v]) => v !== null)
        .map(([_, v]) => v);

    if (!list.length) {
        return res.status(202).json({
            message: "No stats yet. Collecting...",
            refreshIntervalSeconds: REFRESH_INTERVAL / 1000
        });
    }

    res.json({
        testMode: TEST_MODE,
        updatedAt: new Date().toISOString(),
        refreshIntervalSeconds: REFRESH_INTERVAL / 1000,
        serverCount: list.length,
        onlineViewers: viewerCount,
        servers: list
    });
});

app.listen(3000, () => {
    console.log("Stats API running at http://localhost:3000");
    console.log(`Test mode: ${TEST_MODE ? "ENABLED (1 server only)" : "DISABLED (all servers)"}`);
});
