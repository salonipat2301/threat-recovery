import type { SiteObservation } from "../types/site-observation";
import type { ExposureType, RiskVerdict } from "../types/risk-verdict";
import { lookupSafeBrowsing } from "../threat-intel/safe-browsing";
import {
  evaluateHeuristics,
  hasElevatedLocalRisk,
  scoreToSeverity,
  shouldWarnForSeverity,
} from "./heuristics";

const SAFE_BROWSING_WEIGHT = 70;

function threatTypeToExposure(threatType: string): ExposureType {
  switch (threatType) {
    case "SOCIAL_ENGINEERING":
      return "credential_phishing";
    case "MALWARE":
    case "POTENTIALLY_HARMFUL_APPLICATION":
      return "malware";
    case "UNWANTED_SOFTWARE":
      return "unwanted_software";
    default:
      return "suspicious_url";
  }
}

export async function assessRisk(
  observation: SiteObservation
): Promise<RiskVerdict> {
  const heuristics = evaluateHeuristics(observation);
  const safeBrowsing = await lookupSafeBrowsing(observation.url);

  const reasons = [...heuristics.reasons];
  const exposures = new Set<ExposureType>(heuristics.exposures);
  let score = heuristics.score;

  if (safeBrowsing.matched) {
    score += SAFE_BROWSING_WEIGHT;
    reasons.push({
      code: "safe_browsing_match",
      message: `Google Safe Browsing matched: ${safeBrowsing.threatTypes.join(", ")}.`,
      weight: SAFE_BROWSING_WEIGHT,
    });

    for (const threatType of safeBrowsing.threatTypes) {
      exposures.add(threatTypeToExposure(threatType));
    }
  } else if (!safeBrowsing.available && safeBrowsing.error) {
    reasons.push({
      code: "safe_browsing_unavailable",
      message: `Safe Browsing unavailable (${safeBrowsing.error}). Using local heuristics only.`,
      weight: 0,
    });
  }

  const severity = scoreToSeverity(score);
  const mediumWithLocalElevators =
    severity === "medium" && hasElevatedLocalRisk(reasons);

  return {
    url: observation.url,
    domain: observation.domain,
    scoredAt: Date.now(),
    score,
    severity,
    shouldWarn:
      shouldWarnForSeverity(severity) ||
      mediumWithLocalElevators ||
      safeBrowsing.matched,
    reasons,
    exposures: [...exposures],
    threatIntel: {
      provider: safeBrowsing.available
        ? "google_safe_browsing"
        : "none",
      matched: safeBrowsing.matched,
      threatTypes: safeBrowsing.threatTypes,
    },
  };
}
