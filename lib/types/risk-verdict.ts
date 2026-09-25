export type RiskSeverity =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "critical";

export type ExposureType =
  | "credential_phishing"
  | "payment_theft"
  | "otp_interception"
  | "file_exfiltration"
  | "permission_abuse"
  | "malware"
  | "unwanted_software"
  | "insecure_transport"
  | "suspicious_url";

export interface RiskReason {
  code: string;
  message: string;
  weight: number;
}

export interface RiskVerdict {
  url: string;
  domain: string;
  scoredAt: number;
  score: number;
  severity: RiskSeverity;
  shouldWarn: boolean;
  reasons: RiskReason[];
  exposures: ExposureType[];
  threatIntel: {
    provider: "google_safe_browsing" | "none";
    matched: boolean;
    threatTypes: string[];
  };
}
