import type { RiskVerdict } from "./risk-verdict";
import type { SiteObservation } from "./site-observation";
import type { EmailNotificationSettings } from "./email-notification";

export type ExtensionMessage =
  | {
      type: "SITE_SIGNALS";
      frameUrl: string;
      isTopFrame: boolean;
      pageSignals: SiteObservation["pageSignals"];
      permissions: SiteObservation["permissions"] | null;
    }
  | {
      type: "SHOW_RISK_WARNING";
      observation: SiteObservation;
      verdict: RiskVerdict;
      requestId: string;
    }
  | {
      type: "RISK_WARNING_DECISION";
      requestId: string;
      decision: "left" | "continued";
    }
  | {
      type: "REASSESS_CURRENT_PAGE";
    }
  | {
      type: "GET_TAB_RISK";
      tabId: number;
    }
  | {
      type: "GET_INCIDENTS";
    }
  | {
      type: "GET_HISTORY";
    }
  | {
      type: "GET_EMAIL_SETTINGS";
    }
  | {
      type: "SAVE_EMAIL_SETTINGS";
      settings: EmailNotificationSettings;
    }
  | {
      type: "FLUSH_EMAIL_QUEUE";
    }
  | {
      type: "UPDATE_INCIDENT";
      id: string;
      patch: {
        status?: "unresolved" | "resolved";
        completedActions?: string[];
      };
    }
  | {
      type: "CLEAR_INCIDENTS";
    };
