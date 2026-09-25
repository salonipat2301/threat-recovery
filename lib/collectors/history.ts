import type { BrowserEvent } from "../types/browser-event";

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
      const parsedUrl = new URL(url);

      return {
        id: `history-${item.id}-${item.lastVisitTime}`,

        url,

        domain:
          parsedUrl.hostname.replace(/^www\./, ""),

        title:
          item.title || undefined,

        timestamp:
          item.lastVisitTime!,

        isHttps:
          parsedUrl.protocol === "https:",

        source:
          "history" as const,
      };
    })
    .sort(
      (a, b) =>
        b.timestamp - a.timestamp
    );
}