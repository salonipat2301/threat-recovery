import type { SiteObservation } from "./site-observation";
import type { ExposureType, RiskSeverity, RiskVerdict } from "./risk-verdict";

export type UserDecision = "left" | "continued";

export type IncidentStatus = "unresolved" | "resolved";

export interface SecurityIncident {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: IncidentStatus;
  userDecision: UserDecision;
  severity: RiskSeverity;
  score: number;
  domain: string;
  url: string;
  reasons: string[];
  exposures: ExposureType[];
  recommendedActions: string[];
  completedActions: string[];
  observation: SiteObservation;
  verdict: RiskVerdict;
}
