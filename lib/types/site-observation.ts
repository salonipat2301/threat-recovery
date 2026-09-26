import type {
  PageSignals
} from "../collectors/page-signals";

import type {
  PermissionSignals
} from "../collectors/permissions";

export interface SiteObservation {
  url: string;
  domain: string;
  timestamp: number;

  isHttps: boolean;

  pageSignals: PageSignals;

  permissions: PermissionSignals;
}