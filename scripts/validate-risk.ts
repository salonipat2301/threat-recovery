import {
  evaluateHeuristics,
  hasElevatedLocalRisk,
  scoreToSeverity,
  shouldWarnForSeverity,
} from "../lib/risk/heuristics";
import type { SiteObservation } from "../lib/types/site-observation";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const base: SiteObservation = {
  url: "https://example.com/login",
  domain: "example.com",
  timestamp: Date.now(),
  isHttps: true,
  pageSignals: {
    hasUsernameField: false,
    hasPasswordField: false,
    hasOtpField: false,
    hasPaymentField: false,
    hasFileUpload: false,
  },
  permissions: {
    camera: "prompt",
    microphone: "prompt",
    geolocation: "prompt",
    notifications: "prompt",
  },
};

const clean = evaluateHeuristics(base);
assert(clean.score === 0, "clean site should score 0");
assert(scoreToSeverity(clean.score) === "none", "clean severity");

const normalLogin: SiteObservation = {
  ...base,
  pageSignals: {
    hasUsernameField: true,
    hasPasswordField: true,
    hasOtpField: false,
    hasPaymentField: false,
    hasFileUpload: false,
  },
};

const normalLoginHeuristics = evaluateHeuristics(normalLogin);
const normalLoginSeverity = scoreToSeverity(normalLoginHeuristics.score);
assert(
  !shouldWarnForSeverity(normalLoginSeverity),
  "HTTPS login pages should not warn on field signals alone"
);
assert(
  !hasElevatedLocalRisk(normalLoginHeuristics.reasons),
  "normal HTTPS login should not count as elevated local risk"
);

const phishingLike: SiteObservation = {
  ...base,
  url: "http://secure-login-verify.example.tk/signin",
  domain: "secure-login-verify.example.tk",
  isHttps: false,
  pageSignals: {
    hasUsernameField: true,
    hasPasswordField: true,
    hasOtpField: false,
    hasPaymentField: false,
    hasFileUpload: false,
  },
};

const risky = evaluateHeuristics(phishingLike);
assert(risky.score >= 65, `expected high score, got ${risky.score}`);
assert(
  risky.exposures.includes("credential_phishing"),
  "expected credential exposure"
);
assert(
  shouldWarnForSeverity(scoreToSeverity(risky.score)) ||
    hasElevatedLocalRisk(risky.reasons),
  "expected warning threshold for phishing-like page"
);

console.log("risk heuristic checks passed", {
  cleanScore: clean.score,
  normalLoginScore: normalLoginHeuristics.score,
  normalLoginSeverity,
  riskyScore: risky.score,
  severity: scoreToSeverity(risky.score),
});
