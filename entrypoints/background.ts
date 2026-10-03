import type { BrowserEvent } from "../lib/types/browser-event";
import { browser as chrome, type Browser } from "wxt/browser";
import type { SiteObservation } from "../lib/types/site-observation";
import type { PageSignals } from "../lib/collectors/page-signals";
import type { PermissionSignals } from "../lib/collectors/permissions";
import type { RiskVerdict } from "../lib/types/risk-verdict";
import { assessRisk } from "../lib/risk/assess-risk";
import { persistIncidentFromDecision } from "../lib/router/evidence-router";
import {
  clearIncidents,
  listIncidents,
  updateIncident,
} from "../lib/storage/incidents";
import {
  clearBrowsingHistory,
  listBrowsingHistory,
  recordBrowserEvent,
  updateBrowserEventRisk,
} from "../lib/storage/history";
import { classifyCategory, getRecentHistory } from "../lib/collectors/history";
import {
  flushEmailNotificationQueue,
  getEmailSettings,
  listQueuedEmailNotifications,
  queueHighRiskIncidentEmail,
  saveEmailSettings,
} from "../lib/storage/email-notifications";

interface TabState {
  url: string;
  pageSignals: PageSignals;
  permissions: PermissionSignals | null;
  latestVerdict?: RiskVerdict;
  lastWarnedKey?: string;
  pendingWarning?: {
    requestId: string;
    observation: SiteObservation;
    verdict: RiskVerdict;
    warningPage?: boolean;
  };
}

const tabStates = new Map<number, TabState>();
const PENDING_WARNINGS_KEY = "pending_risk_warnings";

type PendingWarning = NonNullable<TabState["pendingWarning"]>;

async function findPendingWarning(requestId: string) {
  const saved = await chrome.storage.local.get(PENDING_WARNINGS_KEY);
  const warnings = (saved[PENDING_WARNINGS_KEY] ?? {}) as Record<string, PendingWarning>;
  const match = Object.entries(warnings).find(([, pending]) => pending.requestId === requestId);
  return match ? { tabId: Number(match[0]), pending: match[1] } : undefined;
}

async function savePendingWarning(tabId: number, pending: PendingWarning) {
  const saved = await chrome.storage.local.get(PENDING_WARNINGS_KEY);
  const warnings = (saved[PENDING_WARNINGS_KEY] ?? {}) as Record<string, PendingWarning>;
  await chrome.storage.local.set({
    [PENDING_WARNINGS_KEY]: { ...warnings, [String(tabId)]: pending },
  });
}

async function getPendingWarning(tabId: number): Promise<PendingWarning | undefined> {
  const saved = await chrome.storage.local.get(PENDING_WARNINGS_KEY);
  const warnings = saved[PENDING_WARNINGS_KEY] as Record<string, PendingWarning> | undefined;
  return warnings?.[String(tabId)];
}

async function clearPendingWarning(tabId: number) {
  const saved = await chrome.storage.local.get(PENDING_WARNINGS_KEY);
  const warnings = (saved[PENDING_WARNINGS_KEY] ?? {}) as Record<string, PendingWarning>;
  delete warnings[String(tabId)];
  await chrome.storage.local.set({ [PENDING_WARNINGS_KEY]: warnings });
}

async function reassessTab(tabId: number): Promise<{
  url?: string;
  verdict: RiskVerdict | null;
}> {
  if (!Number.isInteger(tabId)) return { verdict: null };

  const tab = await chrome.tabs.get(tabId);
  if (!tab.url) return { verdict: null };
  const url = tab.url;

  const state = tabStates.get(tabId);
  if (state?.url === url && state.latestVerdict) {
    return { url, verdict: state.latestVerdict };
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "REASSESS_CURRENT_PAGE",
    });
    if (response?.verdict) {
      return { url, verdict: response.verdict };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.warn("Content script unavailable; falling back to URL-only assessment:", message);
    console.warn("TAB_DEBUG:", {
      tabId,
      url,
      status: tab.status,
    });
  }

  const observation = createSiteObservation(
    url,
    {
      hasUsernameField: false,
      hasPasswordField: false,
      hasOtpField: false,
      hasPaymentField: false,
      hasFileUpload: false,
    },
    {
      camera: "unknown",
      microphone: "unknown",
      geolocation: "unknown",
      notifications: "unknown",
    }
  );

  if (!observation) {
    return { url, verdict: null };
  }

  console.log("URL_ONLY_ASSESSMENT", observation);
  const verdict = await assessRisk(observation);
  await updateBrowserEventRisk(url, verdict);
  console.log("URL_ONLY_RISK_VERDICT", verdict);

  tabStates.set(tabId, {
    url,
    pageSignals: observation.pageSignals,
    permissions: observation.permissions,
    latestVerdict: verdict,
  });

  return { url, verdict };
}

export default defineBackground(() => {
  console.log("Threat Recovery background started");

  chrome.alarms.create("email-notification-retry", { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "email-notification-retry") {
      void flushEmailNotificationQueue();
    }
  });
  chrome.runtime.onStartup.addListener(() => {
    void flushEmailNotificationQueue();
  });

  chrome.webNavigation.onCompleted.addListener(handleFullNavigation);
  chrome.webNavigation.onHistoryStateUpdated.addListener(handleSpaNavigation);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "SITE_SIGNALS") {
      void handleSiteSignals(message, sender)
        .then((verdict) => sendResponse({ verdict: verdict ?? null }))
        .catch((error) => {
          console.error("Failed to assess current page", error);
          sendResponse({ verdict: null });
        });
      return true;
    }

    if (message?.type === "RISK_WARNING_DECISION") {
      void handleWarningDecision(message, sender)
        .then((incident) => sendResponse({ ok: true, incident }))
        .catch((error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error("RISK_WARNING_DECISION_FAILED", errorMessage);
          sendResponse({ ok: false, error: errorMessage });
        });
      return true;
    }

    if (message?.type === "GET_INCIDENTS") {
      void listIncidents().then((incidents) => {
        sendResponse({ incidents });
      });
      return true;
    }

    if (message?.type === "GET_EMAIL_SETTINGS") {
      void Promise.all([getEmailSettings(), listQueuedEmailNotifications()]).then(
        ([settings, queue]) => sendResponse({ settings, queuedCount: queue.length })
      );
      return true;
    }

    if (message?.type === "SAVE_EMAIL_SETTINGS") {
      void saveEmailSettings(message.settings).then(async () => {
        await flushEmailNotificationQueue();
        sendResponse({ ok: true });
      });
      return true;
    }

    if (message?.type === "FLUSH_EMAIL_QUEUE") {
      void flushEmailNotificationQueue().then(() => sendResponse({ ok: true }));
      return true;
    }

    if (message?.type === "GET_TAB_RISK") {
      void reassessTab(message.tabId)
        .then(sendResponse)
        .catch((error) => {
          console.error("GET_TAB_RISK_FAILED", error);
          sendResponse({ url: undefined, verdict: null });
        });
      return true;
    }

    if (message?.type === "UPDATE_INCIDENT") {
      void updateIncident(message.id, message.patch).then((incident) => {
        sendResponse({ incident });
      });
      return true;
    }

    if (message?.type === "CLEAR_INCIDENTS") {
      void Promise.all([clearIncidents(), clearBrowsingHistory()]).then(() => {
        sendResponse({ ok: true });
      });
      return true;
    }

    if (message?.type === "GET_HISTORY") {
      void Promise.all([listBrowsingHistory(), getRecentHistory(24 * 30)]).then(
        ([savedEvents, browserEvents]) => {
          const byUrl = new Map<string, (typeof savedEvents)[number]>();
          for (const event of [...browserEvents, ...savedEvents]) {
            const existing = byUrl.get(event.url);
            if (!existing) {
              byUrl.set(event.url, event);
              continue;
            }

            const newest = event.timestamp >= existing.timestamp ? event : existing;
            const existingAssessmentAt = existing.riskAssessedAt ?? 0;
            const eventAssessmentAt = event.riskAssessedAt ?? 0;
            const riskSource = eventAssessmentAt > existingAssessmentAt
              ? event
              : existingAssessmentAt > 0
                ? existing
                : newest;
            byUrl.set(event.url, {
              ...newest,
              riskScore: riskSource.riskScore,
              riskLevel: riskSource.riskLevel,
              riskAssessedAt: riskSource.riskAssessedAt,
            });
          }
          const merged = [...byUrl.values()].sort(
            (a, b) => b.timestamp - a.timestamp
          );
          sendResponse({ events: merged.slice(0, 500) });
        }
      );
      return true;
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    tabStates.delete(tabId);
    void clearPendingWarning(tabId).catch((error) => {
      console.warn("Failed to clear closed-tab warning", error);
    });
  });
});

async function handleSiteSignals(
  message: {
    pageSignals: PageSignals;
    permissions: PermissionSignals | null;
    isTopFrame: boolean;
  },
  sender: Browser.runtime.MessageSender
) {
  const tabId = sender.tab?.id;
  const url = sender.tab?.url;

  if (tabId === undefined || !url) {
    return null;
  }

  const previous = tabStates.get(tabId);

  const combinedSignals: PageSignals = {
    hasUsernameField:
      (previous?.pageSignals.hasUsernameField ?? false) ||
      message.pageSignals.hasUsernameField,
    hasPasswordField:
      (previous?.pageSignals.hasPasswordField ?? false) ||
      message.pageSignals.hasPasswordField,
    hasOtpField:
      (previous?.pageSignals.hasOtpField ?? false) ||
      message.pageSignals.hasOtpField,
    hasPaymentField:
      (previous?.pageSignals.hasPaymentField ?? false) ||
      message.pageSignals.hasPaymentField,
    hasFileUpload:
      (previous?.pageSignals.hasFileUpload ?? false) ||
      message.pageSignals.hasFileUpload,
  };

  let permissions = previous?.permissions ?? null;

  if (message.isTopFrame && message.permissions) {
    permissions = message.permissions;
  }

  tabStates.set(tabId, {
    url,
    pageSignals: combinedSignals,
    permissions,
    latestVerdict: previous?.latestVerdict,
    lastWarnedKey: previous?.lastWarnedKey,
    pendingWarning: previous?.pendingWarning,
  });

  if (!permissions) {
    return null;
  }

  const observation = createSiteObservation(
    url,
    combinedSignals,
    permissions
  );

  if (!observation) {
    return null;
  }

  console.log("SITE_OBSERVATION", observation);

  const verdict = await assessRisk(observation);
  await updateBrowserEventRisk(url, verdict);
  const currentState = tabStates.get(tabId);
  if (currentState?.url === url) {
    tabStates.set(tabId, { ...currentState, latestVerdict: verdict });
  }

  console.log("RISK_VERDICT", verdict);
  console.log("WARNING_CHECK", {
    url: observation.url,
    score: verdict.score,
    severity: verdict.severity,
    shouldWarn: verdict.shouldWarn,
    reasons: verdict.reasons,
  });

  if (!verdict.shouldWarn) {
    return verdict;
  }

  const warnKey = `${observation.domain}|${verdict.severity}|${verdict.score}`;
  const state = tabStates.get(tabId);

  if (!state || state.lastWarnedKey === warnKey || state.pendingWarning) {
    return verdict;
  }

  const requestId = crypto.randomUUID();
  await presentWarning(tabId, observation, verdict, requestId, warnKey, state);

  return verdict;
}

async function presentWarning(
  tabId: number,
  observation: SiteObservation,
  verdict: RiskVerdict,
  requestId: string,
  warnKey: string,
  state: TabState
) {
  const pendingWarning: PendingWarning = { requestId, observation, verdict };
  tabStates.set(tabId, { ...state, lastWarnedKey: warnKey, pendingWarning });
  await savePendingWarning(tabId, pendingWarning);
  console.info("WARNING_PRESENTATION_STARTED", {
    tabId,
    domain: observation.domain,
    severity: verdict.severity,
    score: verdict.score,
  });

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "SHOW_RISK_WARNING",
      requestId,
      observation,
      verdict,
    });
    console.info("WARNING_OVERLAY_DELIVERED", { tabId, requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("CONTENT_WARNING_UNAVAILABLE", { tabId, requestId, message });
    const warningPagePending = { ...pendingWarning, warningPage: true };
    tabStates.set(tabId, { ...state, lastWarnedKey: warnKey, pendingWarning: warningPagePending });
    await savePendingWarning(tabId, warningPagePending);
    await chrome.tabs.update(tabId, {
      url: `${chrome.runtime.getURL("/warning.html")}#${encodeURIComponent(requestId)}`,
    });
    console.info("WARNING_PAGE_OPENED", { tabId, requestId });
  }
}

async function assessNavigation(url: string, tabId: number) {
  const observation = createSiteObservation(
    url,
    {
      hasUsernameField: false,
      hasPasswordField: false,
      hasOtpField: false,
      hasPaymentField: false,
      hasFileUpload: false,
    },
    {
      camera: "unknown",
      microphone: "unknown",
      geolocation: "unknown",
      notifications: "unknown",
    }
  );
  if (!observation) return;

  try {
    console.info("NAVIGATION_ASSESSMENT_STARTED", { tabId, url });
    const verdict = await assessRisk(observation);
    await updateBrowserEventRisk(url, verdict);
    console.info("NAVIGATION_ASSESSMENT_RESULT", {
      tabId,
      url,
      score: verdict.score,
      severity: verdict.severity,
      shouldWarn: verdict.shouldWarn,
      threatIntel: verdict.threatIntel,
      reasons: verdict.reasons,
    });
    const existing = tabStates.get(tabId);
    const state: TabState = {
      url,
      pageSignals: existing?.url === url ? existing.pageSignals : observation.pageSignals,
      permissions: existing?.url === url ? existing.permissions : observation.permissions,
      latestVerdict: verdict,
      lastWarnedKey: existing?.url === url ? existing.lastWarnedKey : undefined,
      pendingWarning: existing?.url === url ? existing.pendingWarning : undefined,
    };
    tabStates.set(tabId, state);

    if (!verdict.shouldWarn || state.pendingWarning) return;
    const warnKey = `${observation.domain}|${verdict.severity}|${verdict.score}`;
    if (state.lastWarnedKey === warnKey) return;
    await presentWarning(tabId, observation, verdict, crypto.randomUUID(), warnKey, state);
  } catch (error) {
    console.error("NAVIGATION_ASSESSMENT_FAILED", { tabId, url, error });
  }
}

async function handleWarningDecision(
  message: {
    requestId: string;
    decision: "left" | "continued";
  },
  sender: Browser.runtime.MessageSender
) {
  let tabId = sender.tab?.id;
  let state = tabId === undefined ? undefined : tabStates.get(tabId);
  let pending = state?.pendingWarning;
  if (tabId === undefined || !pending) {
    const stored = await findPendingWarning(message.requestId);
    if (stored) {
      tabId = stored.tabId;
      pending = stored.pending;
      state = tabStates.get(tabId);
    }
  }
  if (tabId === undefined) {
    throw new Error("Could not identify the tab for this warning decision.");
  }
  pending ??= await getPendingWarning(tabId);
  if (!pending || pending.requestId !== message.requestId) {
    throw new Error("This warning is no longer pending. Reload the page and try again.");
  }
  console.log("USER_DECISION", {
    decision: message.decision,
    domain: pending.observation.domain,
    severity: pending.verdict.severity,
  });

  if (message.decision === "left") {
    if (state) tabStates.set(tabId, { ...state, pendingWarning: undefined });
    await clearPendingWarning(tabId);
    try {
      await chrome.tabs.update(tabId, { url: "chrome://newtab/" });
    } catch {
      await chrome.tabs.remove(tabId).catch(() => undefined);
    }
    return null;
  }

  const incident = await persistIncidentFromDecision(
    pending.observation,
    pending.verdict,
    "continued"
  );
  if (!incident) {
    throw new Error("The incident could not be saved locally.");
  }

  if (state) tabStates.set(tabId, { ...state, pendingWarning: undefined });
  await clearPendingWarning(tabId).catch((error) => {
    console.warn("Incident saved, but pending warning state could not be cleared", error);
  });

  console.log("SECURITY_INCIDENT", incident);
  try {
    await queueHighRiskIncidentEmail(incident);
    void flushEmailNotificationQueue();
  } catch (error) {
    console.warn("Incident saved, but email notification could not be queued", error);
  }

  if (incident.severity === "high" || incident.severity === "critical") {
    void chrome.notifications.create(incident.id, {
      type: "basic",
      iconUrl: "icon/128.png",
      title: "Unresolved security risk",
      message: `${incident.domain} marked ${incident.severity} after you continued.`,
      priority: 2,
    }).catch((error) => {
      console.warn("Incident saved, but desktop notification failed", error);
    });
  }

  if (pending.warningPage) {
    await chrome.tabs.update(tabId, { url: pending.observation.url });
  }

  return incident;
}

function handleFullNavigation(
    details: Browser.webNavigation.WebNavigationFramedCallbackDetails
  ) {
  if (details.frameId !== 0) {
    return;
  }

  if (details.url.startsWith(chrome.runtime.getURL(""))) return;

  tabStates.delete(details.tabId);
  void clearPendingWarning(details.tabId).catch((error) => {
    console.warn("Failed to clear navigation warning state", error);
  });
  logNavigation(details);
  void assessNavigation(details.url, details.tabId);
}

function handleSpaNavigation(
    details: Browser.webNavigation.WebNavigationFramedCallbackDetails
  ) {
  if (details.frameId !== 0) {
    return;
  }

  if (details.url.startsWith(chrome.runtime.getURL(""))) return;

  void clearPendingWarning(details.tabId).catch((error) => {
    console.warn("Failed to clear SPA navigation warning state", error);
  });
  logNavigation(details);
  void assessNavigation(details.url, details.tabId);
}

  function logNavigation(
    details: Browser.webNavigation.WebNavigationFramedCallbackDetails
  ) {
    const event = createBrowserEvent(details.url, details.timeStamp);

    if (!event) {
      return;
    }

    void recordBrowserEvent(event);
  }

  function createBrowserEvent(
    url: string,
    timestamp: number
  ): BrowserEvent | null {
    try {
      const parsedUrl = new URL(url);

      if (
        parsedUrl.protocol !== "http:" &&
        parsedUrl.protocol !== "https:"
      ) {
        return null;
      }

      return {
        id: crypto.randomUUID(),
        url,
        domain: parsedUrl.hostname.replace(/^www\./, ""),
        timestamp,
        isHttps: parsedUrl.protocol === "https:",
        category: classifyCategory(url),
        riskScore: parsedUrl.protocol === "http:" ? 25 : 0,
        riskLevel: parsedUrl.protocol === "http:" ? "low" : "none",
        source: "live_navigation",
      };
    } catch {
      return null;
    }
  }

  function createSiteObservation(
    url: string,
    pageSignals: SiteObservation["pageSignals"],
    permissions: SiteObservation["permissions"]
  ): SiteObservation | null {
    try {
      const parsedUrl = new URL(url);

      if (
        parsedUrl.protocol !== "http:" &&
        parsedUrl.protocol !== "https:"
      ) {
        return null;
      }

      return {
        url,
        domain: parsedUrl.hostname.replace(/^www\./, ""),
        timestamp: Date.now(),
        isHttps: parsedUrl.protocol === "https:",
        pageSignals,
        permissions,
      };
    } catch {
      return null;
    }
  }
