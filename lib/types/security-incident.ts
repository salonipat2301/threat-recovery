import type {
  PotentialExposureType,
  RiskSeverity,
  ThreatCategory,
} from "./risk-assessment";

export interface SecurityIncident {
  id: string;
  url: string;
  domain: string;
  detectionTimestamp: number;
  threatScore: number;
  severity: RiskSeverity;
  threatCategory: ThreatCategory;
  threatIntelligenceSources: string[];
  reasons: string[];
  userContinued: true;
  potentialExposureTypes: PotentialExposureType[];
  status: "UNRESOLVED" | "RESOLVED";
  resolutionTimestamp?: number;
}

export interface WarningDecision {
  id: string;
  url: string;
  domain: string;
  decisionTimestamp: number;
  decision: "LEFT_SITE" | "CONTINUED";
  warningFollowed: boolean;
  threatScore: number;
  severity: RiskSeverity;
}
