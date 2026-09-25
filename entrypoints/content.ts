import { collectPageSignals } from "../lib/collectors/page-signals";
import { collectPermissionSignals } from "../lib/collectors/permissions";
import { showRiskWarningOverlay } from "../lib/ui/warning-overlay";
import type { RiskVerdict } from "../lib/types/risk-verdict";
import type { SiteObservation } from "../lib/types/site-observation";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  allFrames: true,

  async main() {
    let previousSignals = "";

    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type !== "SHOW_RISK_WARNING") {
        return;
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

    async function collectAndSend() {
      const pageSignals = collectPageSignals();
      const isTopFrame = window.top === window;
      const serialized = JSON.stringify(pageSignals);

      if (serialized === previousSignals) {
        return;
      }

      previousSignals = serialized;

      const permissions = isTopFrame
        ? await collectPermissionSignals()
        : null;

      await chrome.runtime.sendMessage({
        type: "SITE_SIGNALS",
        frameUrl: window.location.href,
        isTopFrame,
        pageSignals,
        permissions,
      });
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
  },
});
