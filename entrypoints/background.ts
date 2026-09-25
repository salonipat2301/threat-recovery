import type {
  BrowserEvent
} from "../lib/types/browser-event";

import type {
  SiteObservation
} from "../lib/types/site-observation";

import type {
  PageSignals
} from "../lib/collectors/page-signals";

import type {
  PermissionSignals
} from "../lib/collectors/permissions";


// ------------------------------------
// TEMPORARY STATE PER TAB
// ------------------------------------

interface TabState {
  pageSignals: PageSignals;
  permissions: PermissionSignals | null;
}

const tabStates = new Map<number, TabState>();


export default defineBackground(() => {

  console.log(
    "Threat Recovery background started"
  );


  // ------------------------------------
  // FULL PAGE NAVIGATION
  // ------------------------------------

  chrome.webNavigation.onCompleted.addListener(
    handleFullNavigation
  );


  // ------------------------------------
  // SPA NAVIGATION
  // ------------------------------------

  chrome.webNavigation.onHistoryStateUpdated.addListener(
    handleSpaNavigation
  );


  // ------------------------------------
  // CONTENT SCRIPT SIGNALS
  // ------------------------------------

  chrome.runtime.onMessage.addListener(
    (message, sender) => {

      if (message.type !== "SITE_SIGNALS") {
        return;
      }

      const tabId = sender.tab?.id;
      const url = sender.tab?.url;

      if (
        tabId === undefined ||
        !url
      ) {
        return;
      }


      // --------------------------------
      // EXISTING STATE FOR THIS TAB
      // --------------------------------

      const previous =
        tabStates.get(tabId);


      // --------------------------------
      // MERGE SIGNALS FROM ALL FRAMES
      // TRUE ALWAYS WINS
      // --------------------------------

      const combinedSignals: PageSignals = {

        hasUsernameField:
          (previous?.pageSignals.hasUsernameField ?? false) ||
          message.pageSignals.hasUsernameField,

        hasPasswordField:
          (previous?.pageSignals.hasPasswordField ?? false) ||
          message.pageSignals.hasPasswordField,

        hasOtpField:
          (previous?.pageSignals.hasOtpField ?? false) ||
          message.pageSignals.hasOtpField,

        hasPaymentField:
          (previous?.pageSignals.hasPaymentField ?? false) ||
          message.pageSignals.hasPaymentField,

        hasFileUpload:
          (previous?.pageSignals.hasFileUpload ?? false) ||
          message.pageSignals.hasFileUpload,
      };


      // --------------------------------
      // PERMISSIONS
      //
      // Only trust permissions collected
      // from the top-level frame.
      // --------------------------------

      let permissions =
        previous?.permissions ?? null;

      if (
        message.isTopFrame &&
        message.permissions
      ) {
        permissions =
          message.permissions;
      }


      // --------------------------------
      // SAVE TEMPORARY TAB STATE
      // --------------------------------

      tabStates.set(
        tabId,
        {
          pageSignals:
            combinedSignals,

          permissions,
        }
      );


      // We need top-level permissions before
      // creating the complete observation.
      if (!permissions) {
        return;
      }


      // --------------------------------
      // CREATE FINAL SITE OBSERVATION
      // --------------------------------

      const observation =
        createSiteObservation(
          url,
          combinedSignals,
          permissions
        );

      if (!observation) {
        return;
      }


      console.log(
        "SITE_OBSERVATION",
        observation
      );


      /*
       * PIPELINE 2 WILL GO HERE:
       *
       * const assessment =
       *   await assessRisk(observation);
       *
       */
    }
  );


  // ------------------------------------
  // CLEAN UP CLOSED TABS
  // ------------------------------------

  chrome.tabs.onRemoved.addListener(
    (tabId) => {

      tabStates.delete(tabId);

    }
  );

});


// ========================================
// FULL NAVIGATION
// ========================================

function handleFullNavigation(
  details:
    chrome.webNavigation.WebNavigationFramedCallbackDetails
) {

  // Only care about top-level navigation
  if (details.frameId !== 0) {
    return;
  }


  /*
   * IMPORTANT:
   *
   * New document = reset previous
   * page signals.
   *
   * Otherwise:
   *
   * phishing-page.com
   * password = true
   *
   * then user navigates to wikipedia.org
   *
   * password would incorrectly remain true.
   */

  tabStates.delete(
    details.tabId
  );


  logNavigation(details);
}


// ========================================
// SPA NAVIGATION
// ========================================

function handleSpaNavigation(
  details:
    chrome.webNavigation.WebNavigationFramedCallbackDetails
) {

  if (details.frameId !== 0) {
    return;
  }


  /*
   * Don't reset signals here.
   *
   * React / Angular / SPA applications
   * may change URLs without loading a
   * completely new document.
   */

  logNavigation(details);
}


// ========================================
// NAVIGATION LOGGER
// ========================================

function logNavigation(
  details:
    chrome.webNavigation.WebNavigationFramedCallbackDetails
) {

  const event =
    createBrowserEvent(
      details.url,
      details.timeStamp
    );


  if (!event) {
    return;
  }


  console.log(
    "LIVE_BROWSER_EVENT",
    event
  );
}


// ========================================
// CREATE BROWSER EVENT
// ========================================

function createBrowserEvent(
  url: string,
  timestamp: number
): BrowserEvent | null {

  try {

    const parsedUrl =
      new URL(url);


    // Ignore chrome://, extension://, etc.
    if (
      parsedUrl.protocol !== "http:" &&
      parsedUrl.protocol !== "https:"
    ) {
      return null;
    }


    return {

      id:
        crypto.randomUUID(),

      url,

      domain:
        parsedUrl.hostname.replace(
          /^www\./,
          ""
        ),

      timestamp,

      isHttps:
        parsedUrl.protocol === "https:",

      source:
        "live_navigation",
    };


  } catch {

    return null;

  }
}


// ========================================
// CREATE SITE OBSERVATION
// ========================================

function createSiteObservation(

  url: string,

  pageSignals:
    SiteObservation["pageSignals"],

  permissions:
    SiteObservation["permissions"]

): SiteObservation | null {

  try {

    const parsedUrl =
      new URL(url);


    if (
      parsedUrl.protocol !== "http:" &&
      parsedUrl.protocol !== "https:"
    ) {
      return null;
    }


    return {

      url,

      domain:
        parsedUrl.hostname.replace(
          /^www\./,
          ""
        ),

      timestamp:
        Date.now(),

      isHttps:
        parsedUrl.protocol === "https:",

      pageSignals,

      permissions,
    };


  } catch {

    return null;

  }
}