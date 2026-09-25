import {
  collectPageSignals
} from "../lib/collectors/page-signals";

import {
  collectPermissionSignals
} from "../lib/collectors/permissions";


export default defineContentScript({
  matches: [
    "http://*/*",
    "https://*/*"
  ],

  // Run inside top page + iframes
  allFrames: true,

  async main() {

    let previousSignals = "";

    async function collectAndSend() {

      // 1. Inspect this frame's DOM
      const pageSignals =
        collectPageSignals();

      // 2. Check whether this is the main/top frame
      const isTopFrame =
        window.top === window;

      // 3. Prevent duplicate messages
      const serialized =
        JSON.stringify(pageSignals);

      if (serialized === previousSignals) {
        return;
      }

      previousSignals = serialized;


      // 4. Only collect permissions for the main page
      // We don't want iframe permissions confusing us.
      const permissions =
        isTopFrame
          ? await collectPermissionSignals()
          : null;


      // 5. Send this frame's observation to background.ts
      await chrome.runtime.sendMessage({
        type: "SITE_SIGNALS",

        frameUrl:
          window.location.href,

        isTopFrame,

        pageSignals,

        permissions,
      });
    }


    // Run once when the page/frame loads
    await collectAndSend();


    // Re-check when dynamic websites modify the DOM
    let timer:
      ReturnType<typeof setTimeout>;

    const observer =
      new MutationObserver(() => {

        clearTimeout(timer);

        timer = setTimeout(() => {
          collectAndSend();
        }, 500);

      });


    observer.observe(
      document.documentElement,
      {
        childList: true,
        subtree: true,
      }
    );
  },
});