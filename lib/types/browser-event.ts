export type BrowserEventSource =
  | "history"
  | "live_navigation";

export interface BrowserEvent {
  id: string;
  url: string;
  domain: string;
  title?: string;
  timestamp: number;
  isHttps: boolean;
  category: "anonymizer" | "other";
  riskScore: number;
  riskLevel: "none" | "low" | "medium" | "high" | "critical";

  source: BrowserEventSource;
}
