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
  };
}

const tabStates = new Map<number, TabState>();

async function reassessTab(tabId: number): Promise<{
  url?: string;
  verdict: RiskVerdict | null;
}> {
  if (!Number.isInteger(tabId)) return { verdict: null };

  const tab = await chrome.tabs.get(tabId);
  if (!tab.url) return { verdict: null };

  const state = tabStates.get(tabId);
  if (state?.url === tab.url && state.latestVerdict) {
    return { url: tab.url, verdict: state.latestVerdict };
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "REASSESS_CURRENT_PAGE",
    });
    return { url: tab.url, verdict: response?.verdict ?? null };
  } catch {
    // Browser-owned pages and pages without extension access cannot be scanned.
    return { url: tab.url, verdict: null };
  }
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
      void handleWarningDecision(message, sender).then((incident) => {
        sendResponse({ ok: true, incident });
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
        .catch(() => sendResponse({ url: undefined, verdict: null }));
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
          const merged = [...savedEvents];
          for (const event of browserEvents) {
            const saved = merged.find((item) => item.url === event.url);
            if (!saved) merged.push(event);
          }
          merged.sort((a, b) => b.timestamp - a.timestamp);
          sendResponse({ events: merged.slice(0, 500) });
        }
      );
      return true;
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    tabStates.delete(tabId);
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
    return;
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
    return;
  }

  const observation = createSiteObservation(
    url,
    combinedSignals,
    permissions
  );

  if (!observation) {
    return;
  }

  console.log("SITE_OBSERVATION", observation);

  const verdict = await assessRisk(observation);
  await updateBrowserEventRisk(url, verdict);
  const currentState = tabStates.get(tabId);
  if (currentState?.url === url) {
    tabStates.set(tabId, { ...currentState, latestVerdict: verdict });
  }
  console.log("RISK_VERDICT", verdict);

  if (!verdict.shouldWarn) {
    return;
  }

  const warnKey = `${observation.domain}|${verdict.severity}|${verdict.score}`;
  const state = tabStates.get(tabId);

  if (!state || state.lastWarnedKey === warnKey || state.pendingWarning) {
    return;
  }

  const requestId = crypto.randomUUID();

  tabStates.set(tabId, {
    ...state,
    lastWarnedKey: warnKey,
    pendingWarning: {
      requestId,
      observation,
      verdict,
    },
  });

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "SHOW_RISK_WARNING",
      requestId,
      observation,
      verdict,
    });
  } catch (error) {
    console.warn("Failed to show warning overlay", error);
    tabStates.set(tabId, {
      ...tabStates.get(tabId)!,
      pendingWarning: undefined,
    });
  }
}

async function handleWarningDecision(
  message: {
    requestId: string;
    decision: "left" | "continued";
  },
  sender: Browser.runtime.MessageSender
) {
  const tabId = sender.tab?.id;

  if (tabId === undefined) {
    return null;
  }

  const state = tabStates.get(tabId);
  const pending = state?.pendingWarning;

  if (!pending || pending.requestId !== message.requestId) {
    return null;
  }

  tabStates.set(tabId, {
    ...state,
    pendingWarning: undefined,
  });

  console.log("USER_DECISION", {
    decision: message.decision,
    domain: pending.observation.domain,
    severity: pending.verdict.severity,
  });

  if (message.decision === "left") {
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

  if (incident) {
    console.log("SECURITY_INCIDENT", incident);

    await queueHighRiskIncidentEmail(incident);
    void flushEmailNotificationQueue();

    if (
      incident.severity === "high" ||
      incident.severity === "critical"
    ) {
      await chrome.notifications.create(incident.id, {
        type: "basic",
        iconUrl: "icon/128.png",
        title: "Unresolved security risk",
        message: `${incident.domain} marked ${incident.severity} after you continued.`,
        priority: 2,
      });
    }
  }

  return incident;
}

function handleFullNavigation(
  details: Browser.webNavigation.WebNavigationFramedCallbackDetails
) {
  if (details.frameId !== 0) {
    return;
  }

  tabStates.delete(details.tabId);
  logNavigation(details);
}

function handleSpaNavigation(
  details: Browser.webNavigation.WebNavigationFramedCallbackDetails
) {
  if (details.frameId !== 0) {
    return;
  }

  logNavigation(details);
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
      riskLevel: "low",
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
