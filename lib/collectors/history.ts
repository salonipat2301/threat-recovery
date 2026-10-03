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
        item.lastVisitTime &&
        (() => {
          try {
            const protocol = new URL(item.url).protocol;
            return protocol === "http:" || protocol === "https:";
          } catch {
            return false;
          }
        })()
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

        category: classifyCategory(url),
        riskScore: parsedUrl.protocol === "http:" ? 25 : 0,
        riskLevel: parsedUrl.protocol === "http:" ? ("low" as const) : ("none" as const),

        source:
          "history" as const,
      };
    })
    .sort(
      (a, b) =>
        b.timestamp - a.timestamp
    );
}

export function classifyCategory(url: string): "anonymizer" | "other" {
  try {
    const parsed = new URL(url);
    return /(?:^|[/.])(?:anonymizer|proxy)(?:[/.]|$)|testcat_an(?:\.html)?$/i.test(
      `${parsed.hostname}${parsed.pathname}`
    )
      ? "anonymizer"
      : "other";
  } catch {
    return "other";
  }
}
