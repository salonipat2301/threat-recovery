import type { SiteObservation } from "../types/site-observation";
import type { ExposureType, RiskReason } from "../types/risk-verdict";

const SUSPICIOUS_HOST_PATTERNS = [
  /\d{1,3}(?:\.\d{1,3}){3}/,
  /xn--/i,
  /login|signin|verify|secure|account|update|banking|paypal|wallet/i,
];

export interface HeuristicResult {
  score: number;
  reasons: RiskReason[];
  exposures: ExposureType[];
}

export function evaluateHeuristics(
  observation: SiteObservation
): HeuristicResult {
  const reasons: RiskReason[] = [];
  const exposures = new Set<ExposureType>();
  let score = 0;

  const add = (
    code: string,
    message: string,
    weight: number,
    exposure?: ExposureType
  ) => {
    reasons.push({ code, message, weight });
    score += weight;
    if (exposure) {
      exposures.add(exposure);
    }
  };

  if (!observation.isHttps) {
    add(
      "insecure_transport",
      "Site is served over HTTP instead of HTTPS.",
      25,
      "insecure_transport"
    );
  }

  if (observation.pageSignals.hasPasswordField) {
    add(
      "password_field",
      "Page contains a password field.",
      30,
      "credential_phishing"
    );
  }

  if (observation.pageSignals.hasUsernameField) {
    add(
      "username_field",
      "Page contains a username or email login field.",
      12,
      "credential_phishing"
    );
  }

  if (observation.pageSignals.hasOtpField) {
    add(
      "otp_field",
      "Page contains a one-time code / verification field.",
      20,
      "otp_interception"
    );
  }

  if (observation.pageSignals.hasPaymentField) {
    add(
      "payment_field",
      "Page contains payment card input fields.",
      35,
      "payment_theft"
    );
  }

  if (observation.pageSignals.hasFileUpload) {
    add(
      "file_upload",
      "Page accepts file uploads.",
      18,
      "file_exfiltration"
    );
  }

  const sensitiveForm =
    observation.pageSignals.hasPasswordField ||
    observation.pageSignals.hasPaymentField ||
    observation.pageSignals.hasOtpField;

  if (!observation.isHttps && sensitiveForm) {
    add(
      "sensitive_over_http",
      "Sensitive form fields detected on an insecure connection.",
      40,
      "insecure_transport"
    );
  }

  const grantedPermissions = (
    [
      ["camera", observation.permissions.camera],
      ["microphone", observation.permissions.microphone],
      ["geolocation", observation.permissions.geolocation],
      ["notifications", observation.permissions.notifications],
    ] as const
  ).filter(([, state]) => state === "granted");

  if (grantedPermissions.length > 0) {
    add(
      "elevated_permissions",
      `Browser permissions granted: ${grantedPermissions
        .map(([name]) => name)
        .join(", ")}.`,
      10 + grantedPermissions.length * 8,
      "permission_abuse"
    );
  }

  try {
    const host = new URL(observation.url).hostname;
    const looksSuspicious = SUSPICIOUS_HOST_PATTERNS.some((pattern) =>
      pattern.test(host)
    );

    if (looksSuspicious && sensitiveForm) {
      add(
        "suspicious_url_pattern",
        "Hostname pattern looks suspicious for a sensitive form page.",
        22,
        "suspicious_url"
      );
    }

    const labels = host.split(".");
    if (labels.length >= 4) {
      add(
        "deep_subdomain",
        "Hostname uses an unusually deep subdomain chain.",
        10,
        "suspicious_url"
      );
    }
  } catch {
    // ignore invalid URL edge cases; caller already validated
  }

  return {
    score,
    reasons,
    exposures: [...exposures],
  };
}

export function scoreToSeverity(score: number): import("../types/risk-verdict").RiskSeverity {
  if (score >= 90) return "critical";
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  if (score >= 15) return "low";
  return "none";
}

export function shouldWarnForSeverity(
  severity: import("../types/risk-verdict").RiskSeverity
): boolean {
  return (
    severity === "medium" ||
    severity === "high" ||
    severity === "critical"
  );
}
