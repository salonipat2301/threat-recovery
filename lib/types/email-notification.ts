import type { RiskSeverity } from "./risk-verdict";

export interface EmailNotificationSettings {
  enabled: boolean;
  recipient: string;
  endpointUrl: string;
  bearerToken: string;
}

export interface EmailEvidenceReport {
  incidentId: string;
  domain: string;
  detectedAt: number;
  severity: RiskSeverity;
  score: number;
  userDecision: "continued";
  reasons: string[];
  detectedSignals: string[];
  threatSources: string[];
  potentialExposures: string[];
  recommendedActions: string[];
}

export interface QueuedEmailNotification {
  id: string;
  report: EmailEvidenceReport;
  queuedAt: number;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
}
