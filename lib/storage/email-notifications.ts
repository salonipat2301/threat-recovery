import { browser } from "wxt/browser";
import type { SecurityIncident } from "../types/security-incident";
import type {
  EmailEvidenceReport,
  EmailNotificationSettings,
  QueuedEmailNotification,
} from "../types/email-notification";

const SETTINGS_KEY = "email_notification_settings";
const QUEUE_KEY = "email_notification_queue";
const MAX_QUEUE_SIZE = 250;
let sending = false;

const DEFAULT_SETTINGS: EmailNotificationSettings = {
  enabled: false,
  recipient: "",
  endpointUrl: "",
  bearerToken: "",
};

export async function getEmailSettings(): Promise<EmailNotificationSettings> {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  const saved = stored[SETTINGS_KEY] as Partial<EmailNotificationSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...saved };
}

export async function saveEmailSettings(
  settings: EmailNotificationSettings
): Promise<void> {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function listQueuedEmailNotifications(): Promise<QueuedEmailNotification[]> {
  const stored = await browser.storage.local.get(QUEUE_KEY);
  const queue = stored[QUEUE_KEY];
  return Array.isArray(queue) ? (queue as QueuedEmailNotification[]) : [];
}

export async function queueHighRiskIncidentEmail(
  incident: SecurityIncident
): Promise<void> {
  if (incident.severity !== "high" && incident.severity !== "critical") return;
  if (incident.userDecision !== "continued") return;
  const settings = await getEmailSettings();
  if (!settings.enabled || !settings.recipient || !settings.endpointUrl) return;

  const queue = await listQueuedEmailNotifications();
  if (queue.some((item) => item.id === incident.id)) return;

  const report: EmailEvidenceReport = {
    incidentId: incident.id,
    domain: incident.domain,
    detectedAt: incident.createdAt,
    severity: incident.severity,
    score: incident.score,
    userDecision: incident.userDecision,
    reasons: incident.reasons,
    detectedSignals: [
      ...Object.entries(incident.observation.pageSignals)
        .filter(([, detected]) => detected)
        .map(([signal]) => signal),
      ...Object.entries(incident.observation.permissions)
        .filter(([, state]) => state === "granted")
        .map(([permission]) => `granted ${permission} permission`),
      ...(!incident.observation.isHttps ? ["unencrypted HTTP connection"] : []),
    ],
    threatSources: incident.verdict.threatIntel.matched
      ? [`${incident.verdict.threatIntel.provider}: ${incident.verdict.threatIntel.threatTypes.join(", ")}`]
      : [],
    potentialExposures: incident.exposures,
    recommendedActions: incident.recommendedActions,
  };

  queue.unshift({
    id: incident.id,
    report,
    queuedAt: Date.now(),
    attempts: 0,
    nextAttemptAt: 0,
  });
  await browser.storage.local.set({ [QUEUE_KEY]: queue.slice(0, MAX_QUEUE_SIZE) });
}

export async function flushEmailNotificationQueue(): Promise<void> {
  if (sending || !navigator.onLine) return;
  sending = true;

  try {
    const settings = await getEmailSettings();
    if (!settings.enabled || !settings.endpointUrl || !settings.recipient) return;

    const queue = await listQueuedEmailNotifications();
    for (const notification of queue) {
      if (notification.nextAttemptAt > Date.now()) continue;
      try {
        const response = await fetch(settings.endpointUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.bearerToken}`,
          },
          body: JSON.stringify({
            to: settings.recipient,
            subject: `${notification.report.severity.toUpperCase()} risk detected on ${notification.report.domain}`,
            evidence: notification.report,
          }),
        });
        if (!response.ok) {
          throw new Error(`Email relay returned HTTP ${response.status}`);
        }
        const index = queue.findIndex((item) => item.id === notification.id);
        if (index >= 0) queue.splice(index, 1);
        await browser.storage.local.set({ [QUEUE_KEY]: queue });
      } catch (error) {
        const index = queue.findIndex((item) => item.id === notification.id);
        if (index < 0) continue;
        const attempts = queue[index]!.attempts + 1;
        const backoffMs = Math.min(60 * 60 * 1000, 60_000 * 2 ** Math.min(attempts - 1, 6));
        queue[index] = {
          ...queue[index]!,
          attempts,
          nextAttemptAt: Date.now() + backoffMs,
          lastError: error instanceof Error ? error.message : "Email delivery failed",
        };
        await browser.storage.local.set({ [QUEUE_KEY]: queue });
      }
    }
  } finally {
    sending = false;
  }
}
