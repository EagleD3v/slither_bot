import geoip from "geoip-lite";
import { countries, continents } from "countries-list";

const COUNTRY_LOOKUP = Object.entries(countries).reduce((acc, [code, entry]) => {
    const continentCode = entry.continent ?? null;
    const continentRaw = continentCode ? continents[continentCode] : null;
    const continentName =
        typeof continentRaw === "string" ? continentRaw : continentRaw?.name ?? null;

    acc[code.toUpperCase()] = {
        name: entry.name,
        continentCode,
        continentName
    };
    return acc;
}, {});

function normalizeIp(ip) {
    if (typeof ip !== "string") return ip;
    return ip.replace(/^\[/, "").replace(/\]$/, "");
}

export function lookupGeo(ip) {
    if (!ip) return null;
    const result = geoip.lookup(normalizeIp(ip));
    if (!result) {
        return null;
    }

    const countryCode = result.country ?? null;
    const metadata = countryCode ? COUNTRY_LOOKUP[countryCode.toUpperCase()] : null;

    return {
        countryCode: countryCode ?? null,
        countryName: metadata?.name ?? null,
        continentCode: metadata?.continentCode ?? null,
        continentName: metadata?.continentName ?? null,
        timezone: result.timezone ?? null,
        regionCode: result.region ?? null
    };
}
