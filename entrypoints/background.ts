import type { BrowserEvent } from "../lib/types/browser-event";
import { checkThreatIntelligence } from "../lib/risk/threat-intelligence";

export default defineBackground(() => {
  console.log("Threat Recovery background started");

  chrome.webNavigation.onCompleted.addListener((details) => {
    // Ignore iframes/subframes
    if (details.frameId !== 0) return;

    const event = createBrowserEvent(
      details.url,
      details.timeStamp
    );

    if (!event) return;

    console.log("LIVE_BROWSER_EVENT", event);

    checkThreatIntelligence(event.url)
      .then((verdict) => {
        console.log("THREAT_VERDICT", verdict);
      })
      .catch((error) => {
        console.error("THREAT_LOOKUP_ERROR", error);
      });
  });
});

function createBrowserEvent(
  url: string,
  timestamp: number
): BrowserEvent | null {
  try {
    const parsedUrl = new URL(url);

    // Only normal websites
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
      source: "live_navigation",
    };
  } catch {
    return null;
  }
}
