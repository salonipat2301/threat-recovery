import { collectPageSignals } from "../lib/collectors/page-signals";
import { collectPermissionSignals } from "../lib/collectors/permissions";
import { showRiskWarningOverlay } from "../lib/ui/warning-overlay";
import type { RiskVerdict } from "../lib/types/risk-verdict";
import type { SiteObservation } from "../lib/types/site-observation";
import { browser as chrome } from "wxt/browser";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  allFrames: true,

  async main() {
    let previousSignals = "";

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type !== "SHOW_RISK_WARNING") {
        if (message?.type === "REASSESS_CURRENT_PAGE") {
          if (window.top !== window) {
            sendResponse({ verdict: null });
            return false;
          }
          void collectAndSend(true)
            .then((verdict) => sendResponse({ verdict }))
            .catch(() => sendResponse({ verdict: null }));
          return true;
        }
        return false;
      }

      if (window.top !== window) {
        return;
      }

      showRiskWarningOverlay(
        message.observation as SiteObservation,
        message.verdict as RiskVerdict,
        message.requestId as string
      );
    });

    async function collectAndSend(force = false): Promise<RiskVerdict | null> {
      const pageSignals = collectPageSignals();
      const isTopFrame = window.top === window;
      const serialized = JSON.stringify(pageSignals);

      if (!force && serialized === previousSignals) {
        return null;
      }

      previousSignals = serialized;

      const permissions = isTopFrame
        ? await collectPermissionSignals()
        : null;

      const response = await chrome.runtime.sendMessage({
        type: "SITE_SIGNALS",
        frameUrl: window.location.href,
        isTopFrame,
        pageSignals,
        permissions,
      });
      return response?.verdict ?? null;
    }

    await collectAndSend();

    let timer: ReturnType<typeof setTimeout>;

    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void collectAndSend();
      }, 500);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("online", () => {
      void chrome.runtime.sendMessage({ type: "FLUSH_EMAIL_QUEUE" });
    });
  },
});
