import fs from "node:fs";
import path from "node:path";
import { HttpsProxyAgent } from "https-proxy-agent";

/**
 * Reads and formats proxy entries from a text file into usable agents.
 * Supported formats per line:
 * - Full proxy URL: e.g. http://host:port, https://..., socks5://...
 * - host:port
 * - host:port:user:password (new premium proxies)
 *
 * @param {string} [filePath="proxies.txt"] Path to the proxies file.
 * @returns {Array<{ url: string, label: string, agent: HttpsProxyAgent }>}
 */
export function getProxies(filePath = "proxies.txt") {
    const absPath = path.resolve(filePath);

    if (!fs.existsSync(absPath)) {
        console.warn(`[Proxy] File not found: ${absPath}`);
        return [];
    }

    const lines = fs
        .readFileSync(absPath, "utf8")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));

    const proxies = [];

    for (const entry of lines) {
        let url = entry;

        // If scheme present, use as-is.
        if (!/^([a-z][a-z0-9+.-]*):\/\//i.test(url)) {
            // Support ip:port:user:password (or host:port:user:password)
            const mAuth = url.match(/^([^:\s]+):(\d+):([^:\s]+):([^\s]+)$/);
            if (mAuth) {
                const [, host, port, user, pass] = mAuth;
                url = `http://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}`;
            } else {
                // Fallbacks: host:port or user:pass@host:port without scheme
                url = `http://${url}`;
            }
        }

        const label = url.replace(/\/\/([^@]*?)@/, "//***:***@");
        try {
            const agent = new HttpsProxyAgent(url);
            proxies.push({ url, label, agent });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err || "Unknown error");
            console.warn(`[Proxy] Invalid proxy "${label}" → ${message}`);
        }
    }

    console.log(`[Proxy] Loaded ${proxies.length} proxies from ${absPath}`);
    return proxies;
}

/**
 * Returns a random proxy object from the provided list.
 * @param {Array<{ url: string, label: string, agent: HttpsProxyAgent }>} proxies
 * @returns {{ url: string, label: string, agent: HttpsProxyAgent } | null}
 */
export function getRandomProxy(proxies) {
    if (!Array.isArray(proxies) || proxies.length === 0) return null;
    const index = Math.floor(Math.random() * proxies.length);
    return proxies[index];
}

