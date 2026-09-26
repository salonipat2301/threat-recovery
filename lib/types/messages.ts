import type { RiskVerdict } from "../types/risk-verdict";
import type { SiteObservation } from "../types/site-observation";

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
      type: "GET_INCIDENTS";
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
