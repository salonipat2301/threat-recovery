import type { SecurityIncident } from "../types/security-incident";
import { browser as chrome } from "wxt/browser";

const STORAGE_KEY = "security_incidents";

export async function listIncidents(): Promise<SecurityIncident[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const incidents = result[STORAGE_KEY];

  if (!Array.isArray(incidents)) {
    return [];
  }

  return [...incidents].sort(
    (a, b) => b.updatedAt - a.updatedAt
  ) as SecurityIncident[];
}

export async function saveIncident(
  incident: SecurityIncident
): Promise<SecurityIncident> {
  const incidents = await listIncidents();
  const index = incidents.findIndex((item) => item.id === incident.id);

  if (index >= 0) {
    incidents[index] = incident;
  } else {
    incidents.unshift(incident);
  }

  await chrome.storage.local.set({
    [STORAGE_KEY]: incidents,
  });

  return incident;
}

export async function updateIncident(
  id: string,
  patch: Partial<
    Pick<SecurityIncident, "status" | "completedActions">
  >
): Promise<SecurityIncident | null> {
  const incidents = await listIncidents();
  const index = incidents.findIndex((item) => item.id === id);
  const current = incidents[index];

  if (index < 0 || !current) {
    return null;
  }

  const updated: SecurityIncident = {
    ...current,
    ...patch,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: Date.now(),
  };

  incidents[index] = updated;
  await chrome.storage.local.set({
    [STORAGE_KEY]: incidents,
  });

  return updated;
}

export async function clearIncidents(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY]: [],
  });
}

export function summarizeIncidents(incidents: SecurityIncident[]) {
  return {
    total: incidents.length,
    unresolved: incidents.filter((item) => item.status === "unresolved")
      .length,
    highRisk: incidents.filter(
      (item) =>
        item.status === "unresolved" &&
        (item.severity === "high" || item.severity === "critical")
    ).length,
    resolved: incidents.filter((item) => item.status === "resolved").length,
  };
}
