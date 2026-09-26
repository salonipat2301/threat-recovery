const SAFE_BROWSING_ENDPOINT =
  "https://safebrowsing.googleapis.com/v4/threatMatches:find";

const THREAT_TYPES = [
  "MALWARE",
  "SOCIAL_ENGINEERING",
  "UNWANTED_SOFTWARE",
  "POTENTIALLY_HARMFUL_APPLICATION",
] as const;

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<
  string,
  { expiresAt: number; result: SafeBrowsingResult }
>();

export interface SafeBrowsingResult {
  matched: boolean;
  threatTypes: string[];
  available: boolean;
  error?: string;
}

interface ThreatMatchResponse {
  matches?: Array<{
    threatType?: string;
  }>;
}

export async function lookupSafeBrowsing(
  url: string,
  apiKeyOverride?: string
): Promise<SafeBrowsingResult> {
  // WXT/Vite statically replaces import.meta.env.WXT_* at build time.
  const apiKey = (
    apiKeyOverride ??
    import.meta.env.WXT_GOOGLE_SAFE_BROWSING_API_KEY ??
    ""
  ).trim();

  if (!apiKey) {
    return {
      matched: false,
      threatTypes: [],
      available: false,
      error: "Safe Browsing API key not configured",
    };
  }

  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  try {
    const response = await fetch(
      `${SAFE_BROWSING_ENDPOINT}?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client: {
            clientId: "threat-recovery",
            clientVersion: "0.1.0",
          },
          threatInfo: {
            threatTypes: [...THREAT_TYPES],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url }],
          },
        }),
      }
    );

    if (!response.ok) {
      const body = await response.text();
      return {
        matched: false,
        threatTypes: [],
        available: false,
        error: `Safe Browsing HTTP ${response.status}: ${body.slice(0, 200)}`,
      };
    }

    const data = (await response.json()) as ThreatMatchResponse;
    const threatTypes = [
      ...new Set(
        (data.matches ?? [])
          .map((match) => match.threatType)
          .filter((type): type is string => Boolean(type))
      ),
    ];

    const result: SafeBrowsingResult = {
      matched: threatTypes.length > 0,
      threatTypes,
      available: true,
    };

    cache.set(url, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      result,
    });

    return result;
  } catch (error) {
    return {
      matched: false,
      threatTypes: [],
      available: false,
      error:
        error instanceof Error
          ? error.message
          : "Safe Browsing request failed",
    };
  }
}
