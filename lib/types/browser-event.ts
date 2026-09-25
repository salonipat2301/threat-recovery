export type BrowserEventSource =
  | "history"
  | "live_navigation";

export interface BrowserEvent {
  id: string;
  url: string;
  domain: string;
  title?: string;
  timestamp: number;

  source: "history" | "live_navigation";

  signals?: {
    hasPasswordField?: boolean;
    hasLoginForm?: boolean;
  };
}