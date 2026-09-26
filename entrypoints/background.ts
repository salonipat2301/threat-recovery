import type { BrowserEvent } from "../lib/types/browser-event";
import { browser as chrome } from "wxt/browser";
import type { RiskAssessment } from "../lib/types/risk-assessment";
import type { SiteObservation } from "../lib/types/site-observation";
import type { SecurityIncident, WarningDecision } from "../lib/types/security-incident";
import { assessRisk } from "../lib/assess-risk";
import { resolveSecurityIncident, saveSecurityIncident, saveWarningDecision } from "../lib/security-storage";

interface PendingWarning {
  tabId: number;
  targetUrl: string;
  assessment: RiskAssessment;
}

const processingTabs = new Set<number>();
const latestObservation = new Map<number, SiteObservation>();
const SESSION_PREFIX = "threat-recovery:";

export default defineBackground(() => {
  console.log("Threat Recovery background started");

  chrome.webNavigation.onCompleted.addListener((details) => {
    if (details.frameId !== 0) return;
    const event = createBrowserEvent(details.url, details.timeStamp);
    if (event) console.log("LIVE_BROWSER_EVENT", event);
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    void clearWarningForTab(tabId);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url && !changeInfo.url.startsWith(chrome.runtime.getURL("/warning.html"))) {
      void clearWarningForTab(tabId);
    }
  });

  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (!isRecord(message) || typeof message.type !== "string") return false;

    if (message.type === "SITE_OBSERVATION") {
      if (sender.tab?.id !== undefined && isSiteObservation(message.observation)) {
        latestObservation.set(sender.tab.id, message.observation);
        void processObservations(sender.tab.id);
      }
      return false;
    }

    if (message.type === "GET_WARNING" && typeof message.id === "string") {
      void getPendingWarning(message.id).then(sendResponse);
      return true;
    }

    if (message.type === "LEAVE_WARNING" && typeof message.id === "string") {
      void handleWarningDecision(message.id, sender.tab?.id, "LEFT_SITE")
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
      return true;
    }

    if (message.type === "CONTINUE_WARNING" && typeof message.id === "string") {
      void handleWarningDecision(message.id, sender.tab?.id, "CONTINUED")
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
      return true;
    }

    if (message.type === "RESOLVE_INCIDENT" && typeof message.id === "string") {
      void resolveSecurityIncident(message.id)
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
      return true;
    }

    return false;
  });
});

async function processObservations(tabId: number): Promise<void> {
  if (processingTabs.has(tabId)) return;
  processingTabs.add(tabId);

  try {
    while (latestObservation.has(tabId)) {
      const observation = latestObservation.get(tabId)!;
      latestObservation.delete(tabId);

      if (await hasActiveWarning(tabId)) continue;
      if (await isTemporarilyAllowed(tabId, observation.url)) continue;

      const assessment = await assessRisk(observation);
      if (latestObservation.has(tabId)) continue;
      if (!assessment.shouldWarn) continue;

      const tab = await chrome.tabs.get(tabId).catch(() => undefined);
      if (!tab?.url || !samePage(tab.url, observation.url)) continue;

      const id = crypto.randomUUID();
      const warning: PendingWarning = {
        tabId,
        targetUrl: observation.url,
        assessment,
      };
      await chrome.storage.session.set({ [`${SESSION_PREFIX}warning:${id}`]: warning });
      await chrome.storage.session.set({ [`${SESSION_PREFIX}active:${tabId}`]: id });

      const warningUrl = `${chrome.runtime.getURL("/warning.html")}?id=${encodeURIComponent(id)}`;
      try {
        await chrome.tabs.update(tabId, { url: warningUrl });
      } catch (error) {
        await clearPendingWarning(id, tabId);
        throw error;
      }
      break;
    }
  } catch (error) {
    console.error("Threat assessment failed:", error);
  } finally {
    processingTabs.delete(tabId);
    if (latestObservation.has(tabId)) void processObservations(tabId);
  }
}

async function handleWarningDecision(
  id: string,
  senderTabId: number | undefined,
  decision: WarningDecision["decision"],
): Promise<void> {
  const warning = await getPendingWarning(id);
  if (!warning || senderTabId !== warning.tabId) {
    throw new Error("This warning is no longer active.");
  }

  const assessment = warning.assessment;
  const decisionRecord: WarningDecision = {
    id: crypto.randomUUID(),
    url: warning.targetUrl,
    domain: assessment.observation.domain,
    decisionTimestamp: Date.now(),
    decision,
    warningFollowed: decision === "LEFT_SITE",
    threatScore: assessment.score,
    severity: assessment.severity,
  };

  await saveWarningDecision(decisionRecord);

  if (decision === "CONTINUED") {
    const incident: SecurityIncident = {
      id: crypto.randomUUID(),
      url: warning.targetUrl,
      domain: assessment.observation.domain,
      detectionTimestamp: assessment.observation.timestamp,
      threatScore: assessment.score,
      severity: assessment.severity,
      threatCategory: assessment.category,
      threatIntelligenceSources: assessment.threatVerdict.status === "KNOWN_THREAT"
        ? [assessment.threatVerdict.provider]
        : [],
      reasons: assessment.reasons,
      userContinued: true,
      potentialExposureTypes: assessment.potentialExposureTypes,
      status: "UNRESOLVED",
    };
    await saveSecurityIncident(incident);
    await chrome.storage.session.set({
      [`${SESSION_PREFIX}allow:${warning.tabId}`]: {
        url: warning.targetUrl,
        expiresAt: Date.now() + 2 * 60 * 1000,
      },
    });
  }

  await clearPendingWarning(id, warning.tabId);

  setTimeout(() => {
    if (decision === "LEFT_SITE") {
      chrome.tabs.goBack(warning.tabId, () => {
        if (chrome.runtime.lastError) {
          void chrome.tabs.update(warning.tabId, { url: "chrome://newtab/" });
        }
      });
    } else {
      void chrome.tabs.update(warning.tabId, { url: warning.targetUrl });
    }
  }, 150);
}

async function getPendingWarning(id: string): Promise<PendingWarning | null> {
  const key = `${SESSION_PREFIX}warning:${id}`;
  const result = await chrome.storage.session.get(key);
  return (result[key] as PendingWarning | undefined) ?? null;
}

async function hasActiveWarning(tabId: number): Promise<boolean> {
  const key = `${SESSION_PREFIX}active:${tabId}`;
  const result = await chrome.storage.session.get(key);
  return typeof result[key] === "string";
}

async function isTemporarilyAllowed(tabId: number, url: string): Promise<boolean> {
  const key = `${SESSION_PREFIX}allow:${tabId}`;
  const result = await chrome.storage.session.get(key);
  const allow = result[key] as { url: string; expiresAt: number } | undefined;
  if (!allow) return false;
  if (allow.expiresAt <= Date.now()) {
    await chrome.storage.session.remove(key);
    return false;
  }
  return samePage(allow.url, url);
}

async function clearPendingWarning(id: string, tabId: number): Promise<void> {
  await chrome.storage.session.remove([
    `${SESSION_PREFIX}warning:${id}`,
    `${SESSION_PREFIX}active:${tabId}`,
  ]);
}

async function clearWarningForTab(tabId: number): Promise<void> {
  const key = `${SESSION_PREFIX}active:${tabId}`;
  const result = await chrome.storage.session.get(key);
  const id = result[key];
  if (typeof id === "string") await clearPendingWarning(id, tabId);
}

function samePage(first: string, second: string): boolean {
  try {
    const a = new URL(first);
    const b = new URL(second);
    return a.origin === b.origin && a.pathname === b.pathname && a.search === b.search;
  } catch {
    return first === second;
  }
}

function isSiteObservation(value: unknown): value is SiteObservation {
  if (!isRecord(value)) return false;
  if (typeof value.url !== "string" || typeof value.domain !== "string") return false;
  if (value.protocol !== "HTTP" && value.protocol !== "HTTPS") return false;
  const booleanFields = [
    "usernameFieldDetected", "passwordFieldDetected", "otpFieldDetected",
    "paymentFieldDetected", "fileUploadDetected", "cameraPermission",
    "microphonePermission", "locationPermission", "notificationPermission",
  ];
  if (typeof value.timestamp !== "number"
    || !booleanFields.every((field) => typeof value[field] === "boolean")) return false;
  try {
    return /^https?:$/.test(new URL(value.url).protocol);
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function createBrowserEvent(url: string, timestamp: number): BrowserEvent | null {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") return null;
    return {
      id: crypto.randomUUID(),
      url,
      domain: parsedUrl.hostname.replace(/^www\./, ""),
      timestamp,
      source: "live_navigation",
    };
  } catch {
    return null;
  }
}
