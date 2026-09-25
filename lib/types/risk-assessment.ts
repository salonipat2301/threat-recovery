import type { SiteObservation } from "./site-observation";
import type { ThreatVerdict } from "./threat-verdict";

export type RiskSeverity = "LOW" | "MEDIUM" | "HIGH";

export type ThreatCategory =
  | "PHISHING"
  | "MALWARE"
  | "UNWANTED_SOFTWARE"
  | "SUSPICIOUS"
  | "UNKNOWN";

export type PotentialExposureType =
  | "CREDENTIALS"
  | "AUTHENTICATION_CODES"
  | "FINANCIAL_DATA"
  | "DOCUMENTS_OR_FILES"
  | "CAMERA"
  | "MICROPHONE"
  | "LOCATION"
  | "NOTIFICATIONS";

export interface RiskAssessment {
  observation: SiteObservation;
  threatVerdict: ThreatVerdict;
  score: number;
  severity: RiskSeverity;
  category: ThreatCategory;
  shouldWarn: boolean;
  reasons: string[];
  potentialExposureTypes: PotentialExposureType[];
}
