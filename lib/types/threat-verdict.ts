export interface ThreatVerdict {
  status:
    | "KNOWN_THREAT"
    | "NO_KNOWN_THREAT"
    | "LOOKUP_FAILED";

  provider: "GOOGLE_SAFE_BROWSING";

  threatTypes: string[];

  error?: string;
}
