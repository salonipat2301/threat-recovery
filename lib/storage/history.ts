import { browser as chrome } from "wxt/browser";
import type { BrowserEvent } from "../types/browser-event";
import type { RiskVerdict } from "../types/risk-verdict";

const STORAGE_KEY = "browsing_history";
const MAX_EVENTS = 500;

export async function listBrowsingHistory(): Promise<BrowserEvent[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const events = stored[STORAGE_KEY];
  return Array.isArray(events) ? (events as BrowserEvent[]) : [];
}

export async function recordBrowserEvent(event: BrowserEvent): Promise<void> {
  const events = await listBrowsingHistory();
  const duplicateIndex = events.findIndex(
    (item) => item.url === event.url && Math.abs(item.timestamp - event.timestamp) < 1500
  );
  if (duplicateIndex >= 0) events.splice(duplicateIndex, 1);
  events.unshift(event);
  await chrome.storage.local.set({
    [STORAGE_KEY]: events.slice(0, MAX_EVENTS),
  });
}

export async function updateBrowserEventRisk(
  url: string,
  verdict: RiskVerdict
): Promise<void> {
  const events = await listBrowsingHistory();
  const riskAssessedAt = Date.now();
  let updated = false;
  for (let index = 0; index < events.length; index += 1) {
    const current = events[index];
    if (current?.url !== url) continue;
    events[index] = {
      ...current,
      riskScore: verdict.score,
      riskLevel: verdict.severity,
      riskAssessedAt,
    };
    updated = true;
  }
  if (!updated) return;
  await chrome.storage.local.set({ [STORAGE_KEY]: events });
}

export async function clearBrowsingHistory(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
}
