# Threat Recovery — Demo Video Script

**Run time:** about 6 minutes 15 seconds, including the code walkthrough.

## 0:00–0:45 — The pain point

**Visual:** Show a browser warning, then a user continuing to the site.

**Voiceover:**

“Browsers and security tools can warn people about dangerous websites. But a warning does not always end the risk. A person might be in a hurry, misunderstand the message, or decide to continue because they believe they need to use the site.

“After that, the warning may disappear. The user is left wondering: What was the risk? Did I expose anything? What should I do now? Traditional warnings focus on the moment before someone enters a site. Threat Recovery focuses on what happens after they choose to continue.”

## 0:45–1:20 — The proposed fix

**Visual:** Show the Threat Recovery extension and a simple flow: assess → warn → record → guide.

**Voiceover:**

“Threat Recovery adds a recovery step to browsing security. It assesses a page using local indicators and, when configured, Google Safe Browsing. If its assessment reaches the warning threshold, it explains the risk before the user continues.

“If the user continues through the Threat Recovery warning, the extension saves a local incident. The dashboard then explains why the page was flagged, what exposure may be involved, and what actions the user can consider.”

## 1:20–2:10 — Assess the current page

**Visual:** Open a regular page, click the extension icon, and point to the current page assessment and high-risk summary.

**Voiceover:**

“Here’s the compact popup. It shows the current page and its assessment, plus a summary of recent high-risk activity. If a page cannot be assessed—for example, a browser-owned page or a page where extension access is unavailable—the popup says that instead of presenting it as safe.

“The extension looks for signal types, such as whether a page has a password or payment field. It does not read the values a person enters. Local heuristics can run without an API key. Google Safe Browsing lookups are optional and require a key configured for the build.”

## 2:10–3:00 — Show the warning and user choice

**Visual:** Open the local demo site at `http://127.0.0.1:4173`. Show the warning overlay and point out the detected reason and options to leave or continue.

**Voiceover:**

“For this demonstration, I’m using our local demo page. It contains inert sample fields so the extension can demonstrate detecting field types; it does not submit or store anything typed into them.

“When a page meets the warning threshold, Threat Recovery explains the detected risk and offers a choice. If the user leaves, the extension does not create a continued-risk incident. If they choose to continue anyway, that decision becomes part of the incident record.”

**Action:** Select **Continue anyway**.

## 3:00–4:10 — Recover through the dashboard

**Visual:** Open the popup, select **View dashboard**, and open the new incident.

**Voiceover:**

“Now the dashboard has a persistent local record. It shows the domain, time, severity, why the page was flagged, and that the user continued past the warning. It also lists potential exposure and recommended next steps.

“The user can work through the checklist and mark an incident resolved when appropriate. This turns a momentary warning into something the user can review and act on afterward.

“The extension stores this security history locally in the browser. One limitation is that it records continuing past Threat Recovery’s own warning; it cannot observe someone bypassing Chrome’s separate Safe Browsing interstitial.”

## 4:10–4:40 — Email alert scope

**Visual:** Show the dashboard email settings with alerts off by default.

**Voiceover:**

“High and critical incidents can be queued for an optional email relay. The extension does not include an email service, and alerts are off by default. Without a relay configured, no email is sent. The report is designed to include security evidence—such as the domain, reason, detected signal types, decision, potential exposure, and suggested actions—without passwords, form values, or the full page URL. AWS SNS is not integrated.”

## 4:40–5:00 — Close

**Visual:** Return to the dashboard summary or project title.

**Voiceover:**

“Threat Recovery does not replace browser protection. It addresses what comes next: helping people understand a risk after they continue, keeping a record they can revisit, and giving them practical recovery steps.”

## 5:00–6:15 — Code walkthrough: how the flow works

**Visual:** Show each named source file briefly, then return to the incident in the dashboard.

**Voiceover:**

“The threat is a user continuing to a risky page and then losing the warning and its context. The protected assets are the user’s accounts and sensitive information, such as passwords, one-time codes, and payment details.

“The flow starts in `entrypoints/content.ts`. The content script detects types of page fields and browser permission states; it does not read what someone types. `entrypoints/background.ts` sends those observations to `lib/risk/assess-risk.ts`, which combines local rules from `lib/risk/heuristics.ts` with an optional Google Safe Browsing lookup.

“The rules assign weights to signals. Scores of 40, 65, and 90 map to medium, high, and critical severity. Medium and higher scores trigger a warning, and a Safe Browsing match triggers a warning too. If the user continues through our warning, `lib/router/evidence-router.ts` creates the incident and `lib/storage/incidents.ts` saves it with `chrome.storage.local`. The dashboard displays the reasons, potential exposure, and recommended actions.

“Our included heuristic validation uses synthetic observations: it asserts that a clean page scores zero, and that a simulated risky login page reaches at least 65, indicates credential exposure, and crosses the warning threshold. That checks selected rule behavior; it is not a real-world detection accuracy study.

“There are important limits. A configured Safe Browsing lookup sends the current page URL to Google. This extension cannot detect a bypass of Chrome’s own interstitial. Email needs a separately configured relay; no relay or SNS service is included. The practical outcome today is a local, persistent incident record that helps the user review what happened and choose follow-up actions.”
