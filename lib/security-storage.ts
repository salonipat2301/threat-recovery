import type { SecurityIncident, WarningDecision } from "./types/security-incident";
import { browser as chrome } from "wxt/browser";

const INCIDENTS_KEY = "securityIncidents";
const DECISIONS_KEY = "warningDecisions";
const MAX_RECORDS = 200;

export async function getSecurityIncidents(): Promise<SecurityIncident[]> {
  const result = await chrome.storage.local.get(INCIDENTS_KEY);
  return (result[INCIDENTS_KEY] as SecurityIncident[] | undefined) ?? [];
}

export async function saveSecurityIncident(incident: SecurityIncident): Promise<void> {
  const incidents = await getSecurityIncidents();
  await chrome.storage.local.set({
    [INCIDENTS_KEY]: [incident, ...incidents.filter((item) => item.id !== incident.id)].slice(0, MAX_RECORDS),
  });
}

export async function resolveSecurityIncident(id: string): Promise<void> {
  const incidents = await getSecurityIncidents();
  const updated = incidents.map((incident) => incident.id === id
    ? { ...incident, status: "RESOLVED" as const, resolutionTimestamp: Date.now() }
    : incident);
  await chrome.storage.local.set({ [INCIDENTS_KEY]: updated });
}

export async function getWarningDecisions(): Promise<WarningDecision[]> {
  const result = await chrome.storage.local.get(DECISIONS_KEY);
  return (result[DECISIONS_KEY] as WarningDecision[] | undefined) ?? [];
}

export async function saveWarningDecision(decision: WarningDecision): Promise<void> {
  const decisions = await getWarningDecisions();
  await chrome.storage.local.set({
    [DECISIONS_KEY]: [decision, ...decisions].slice(0, MAX_RECORDS),
  });
}
