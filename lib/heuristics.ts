import type { SiteObservation } from "./types/site-observation";
import { MAX_HEURISTIC_SCORE } from "./threshold";

export interface HeuristicResult {
  score: number;
  reasons: string[];
}

export function assessUrlHeuristics(observation: SiteObservation): HeuristicResult {
  const reasons: string[] = [];
  let score = 0;

  if (observation.protocol === "HTTP") {
    score += 8;
    reasons.push("This site uses HTTP, so its connection is not encrypted.");
  }

  const hostname = safeHostname(observation.url);
  if (hostname?.split(".").some((label) => label.startsWith("xn--"))) {
    score += 7;
    reasons.push("The domain uses internationalized (Punycode) characters.");
  }

  if (hostname && hostname.split(".").length > 4) {
    score += 5;
    reasons.push("The URL uses an unusually deep subdomain structure.");
  }

  try {
    const parsed = new URL(observation.url);
    if (parsed.username || parsed.password) {
      score += 8;
      reasons.push("The URL contains user information before the domain, which can disguise the destination.");
    }

    if (isIpAddress(parsed.hostname)) {
      score += 5;
      reasons.push("The site uses a raw IP address instead of a domain name.");
    }
  } catch {
    // Pipeline 1 only sends valid HTTP(S) URLs.
  }

  return {
    score: Math.min(score, MAX_HEURISTIC_SCORE),
    reasons,
  };
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isIpAddress(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
}
