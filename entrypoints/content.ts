import type { SiteObservation } from "../lib/types/site-observation";
import { browser as chrome } from "wxt/browser";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  main() {
    let lastSignature = "";
    let scanTimer: ReturnType<typeof setTimeout> | undefined;

    const scanAndReport = async () => {
      const observation = await collectObservation();
      const signature = JSON.stringify({ ...observation, timestamp: 0 });
      if (signature === lastSignature) return;
      lastSignature = signature;

      void chrome.runtime.sendMessage({
        type: "SITE_OBSERVATION",
        observation,
      }).catch(() => undefined);
    };

    const scheduleScan = () => {
      if (scanTimer) clearTimeout(scanTimer);
      scanTimer = setTimeout(() => void scanAndReport(), 350);
    };

    void scanAndReport();

    if (document.documentElement) {
      new MutationObserver(scheduleScan).observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["type", "name", "id", "autocomplete"],
      });
    }
  },
});

async function collectObservation(): Promise<SiteObservation> {
  const url = location.href;
  const passwordFieldDetected = Boolean(document.querySelector('input[type="password"]'));
  const usernameFieldDetected = Boolean(document.querySelector(
    'input[autocomplete="username"], input[name*="user" i], input[id*="user" i], input[name*="login" i], input[id*="login" i]',
  )) || (passwordFieldDetected && Boolean(document.querySelector('input[type="email"]')));

  return {
    url,
    domain: location.hostname.replace(/^www\./i, ""),
    timestamp: Date.now(),
    protocol: location.protocol === "https:" ? "HTTPS" : "HTTP",
    usernameFieldDetected,
    passwordFieldDetected,
    otpFieldDetected: Boolean(document.querySelector(
      'input[autocomplete="one-time-code"], input[name*="otp" i], input[id*="otp" i], input[name*="verification" i], input[id*="verification" i]',
    )),
    paymentFieldDetected: Boolean(document.querySelector(
      'input[autocomplete^="cc-"], input[name*="card" i], input[id*="card" i], input[name*="cvv" i], input[name*="cvc" i]',
    )),
    fileUploadDetected: Boolean(document.querySelector('input[type="file"]')),
    cameraPermission: await isPermissionGranted("camera"),
    microphonePermission: await isPermissionGranted("microphone"),
    locationPermission: await isPermissionGranted("geolocation"),
    notificationPermission: typeof Notification !== "undefined" && Notification.permission === "granted",
  };
}

async function isPermissionGranted(name: string): Promise<boolean> {
  try {
    const permission = await navigator.permissions.query({ name: name as PermissionName });
    return permission.state === "granted";
  } catch {
    return false;
  }
}
