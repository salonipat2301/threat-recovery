import type { ExposureType } from "../types/risk-verdict";

export function recommendationsForExposures(
  exposures: ExposureType[]
): string[] {
  const actions = new Set<string>();

  for (const exposure of exposures) {
    switch (exposure) {
      case "credential_phishing":
        actions.add("Change passwords used on this site if you entered them.");
        actions.add("Enable MFA on affected accounts.");
        actions.add("Review recent account login activity.");
        break;
      case "otp_interception":
        actions.add("Do not reuse any one-time codes you entered.");
        actions.add("Check account recovery settings for unexpected changes.");
        break;
      case "payment_theft":
        actions.add("Contact your bank/card issuer and monitor transactions.");
        actions.add("Consider freezing or replacing any card you entered.");
        break;
      case "file_exfiltration":
        actions.add("Assume uploaded files may be exposed; rotate shared secrets.");
        actions.add("Scan devices if you downloaded anything from the site.");
        break;
      case "permission_abuse":
        actions.add("Revoke camera, microphone, location, and notification access for this site.");
        break;
      case "malware":
      case "unwanted_software":
        actions.add("Run a malware scan and avoid opening downloads from this site.");
        break;
      case "insecure_transport":
        actions.add("Avoid entering sensitive data on HTTP pages.");
        break;
      case "suspicious_url":
        actions.add("Verify the real domain before interacting again.");
        break;
    }
  }

  if (actions.size === 0) {
    actions.add("Leave the site and avoid entering sensitive information.");
  }

  return [...actions];
}
