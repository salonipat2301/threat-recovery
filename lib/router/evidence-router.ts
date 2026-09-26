import type { SiteObservation } from "../types/site-observation";
import type { RiskVerdict } from "../types/risk-verdict";
import type {
  SecurityIncident,
  UserDecision,
} from "../types/security-incident";
import { recommendationsForExposures } from "../risk/recommendations";
import { saveIncident } from "../storage/incidents";

export function createUnresolvedIncident(
  observation: SiteObservation,
  verdict: RiskVerdict,
  userDecision: UserDecision
): SecurityIncident {
  const now = Date.now();

  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: "unresolved",
    userDecision,
    severity: verdict.severity,
    score: verdict.score,
    domain: observation.domain,
    url: observation.url,
    reasons: verdict.reasons.map((reason) => reason.message),
    exposures: verdict.exposures,
    recommendedActions: recommendationsForExposures(verdict.exposures),
    completedActions: [],
    observation,
    verdict,
  };
}

export async function persistIncidentFromDecision(
  observation: SiteObservation,
  verdict: RiskVerdict,
  userDecision: UserDecision
): Promise<SecurityIncident | null> {
  // Only create an unresolved incident when the user continues after a warning.
  if (userDecision !== "continued") {
    return null;
  }

  const incident = createUnresolvedIncident(
    observation,
    verdict,
    userDecision
  );

  return saveIncident(incident);
}
