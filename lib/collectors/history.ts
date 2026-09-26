import type { BrowserEvent } from "../types/browser-event";
import { browser as chrome } from "wxt/browser";

export async function getRecentHistory(
  hoursBack = 24
): Promise<BrowserEvent[]> {
  const endTime = Date.now();
  const startTime =
    endTime - hoursBack * 60 * 60 * 1000;

  const results = await chrome.history.search({
    text: "",
    startTime,
    endTime,
    maxResults: 100,
  });

  return results
    .filter(
      (item) =>
        item.url &&
        item.lastVisitTime
    )
    .map((item) => {
      const url = item.url!;

      return {
        id: `history-${item.id}-${item.lastVisitTime}`,
        url,
        domain: getDomain(url),
        title: item.title || undefined,
        timestamp: item.lastVisitTime!,
        source: "history" as const,
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}
