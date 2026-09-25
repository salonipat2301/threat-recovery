import type {
  PotentialExposureType,
  RiskAssessment,
  ThreatCategory,
} from "./types/risk-assessment";
import type { SiteObservation } from "./types/site-observation";
import { checkThreatIntelligence } from "./risk/threat-intelligence";
import { assessUrlHeuristics } from "./heuristics";
import {
  HIGH_THRESHOLD,
  VERIFIED_THREAT_SCORE,
  WARNING_THRESHOLD,
} from "./threshold";

export async function assessRisk(
  observation: SiteObservation,
): Promise<RiskAssessment> {
  const [threatVerdict, heuristics] = await Promise.all([
    checkThreatIntelligence(observation.url),
    Promise.resolve(assessUrlHeuristics(observation)),
  ]);

  const knownThreat = threatVerdict.status === "KNOWN_THREAT";
  const score = Math.min(
    100,
    heuristics.score + (knownThreat ? VERIFIED_THREAT_SCORE : 0),
  );
  const severity = score >= HIGH_THRESHOLD
    ? "HIGH"
    : score >= WARNING_THRESHOLD
      ? "MEDIUM"
      : "LOW";
  const potentialExposureTypes = getPotentialExposureTypes(observation);
  const reasons = [...heuristics.reasons];

  if (knownThreat) {
    const types = threatVerdict.threatTypes.join(", ") || "unspecified threat";
    reasons.unshift(`Google Safe Browsing identified this URL as a known threat (${types}).`);
  } else if (threatVerdict.status === "NO_KNOWN_THREAT") {
    reasons.unshift("Google Safe Browsing has no known threat match for this URL; that does not guarantee the site is safe.");
  } else {
    reasons.unshift(`Google Safe Browsing could not check this URL: ${threatVerdict.error ?? "lookup failed"}.`);
  }

  for (const exposure of potentialExposureTypes) {
    reasons.push(exposureReason(exposure));
  }

  return {
    observation,
    threatVerdict,
    score,
    severity,
    category: classifyThreat(threatVerdict, heuristics.score),
    shouldWarn: score >= WARNING_THRESHOLD,
    reasons,
    potentialExposureTypes,
  };
}

export function getPotentialExposureTypes(
  observation: SiteObservation,
): PotentialExposureType[] {
  const exposures: PotentialExposureType[] = [];
  if (observation.usernameFieldDetected || observation.passwordFieldDetected) {
    exposures.push("CREDENTIALS");
  }
  if (observation.otpFieldDetected) exposures.push("AUTHENTICATION_CODES");
  if (observation.paymentFieldDetected) exposures.push("FINANCIAL_DATA");
  if (observation.fileUploadDetected) exposures.push("DOCUMENTS_OR_FILES");
  if (observation.cameraPermission) exposures.push("CAMERA");
  if (observation.microphonePermission) exposures.push("MICROPHONE");
  if (observation.locationPermission) exposures.push("LOCATION");
  if (observation.notificationPermission) exposures.push("NOTIFICATIONS");
  return exposures;
}

function classifyThreat(
  verdict: RiskAssessment["threatVerdict"],
  heuristicScore: number,
): ThreatCategory {
  if (verdict.status === "KNOWN_THREAT") {
    if (verdict.threatTypes.includes("SOCIAL_ENGINEERING")) return "PHISHING";
    if (verdict.threatTypes.includes("MALWARE")) return "MALWARE";
    if (verdict.threatTypes.includes("UNWANTED_SOFTWARE")) return "UNWANTED_SOFTWARE";
    return "UNKNOWN";
  }
  return heuristicScore > 0 ? "SUSPICIOUS" : "UNKNOWN";
}

function exposureReason(exposure: PotentialExposureType): string {
  const reasons: Record<PotentialExposureType, string> = {
    CREDENTIALS: "The page has a login or password field; credentials could be exposed if entered.",
    AUTHENTICATION_CODES: "The page has a one-time code field; an authentication code could be exposed if entered.",
    FINANCIAL_DATA: "The page has payment fields; financial details could be exposed if entered.",
    DOCUMENTS_OR_FILES: "The page can accept file uploads; selected documents could be exposed.",
    CAMERA: "Camera access is granted to this site; camera content may be exposed.",
    MICROPHONE: "Microphone access is granted to this site; audio may be exposed.",
    LOCATION: "Location access is granted to this site; location data may be exposed.",
    NOTIFICATIONS: "Notification access is granted to this site; it may send notifications.",
  };
  return reasons[exposure];
}
