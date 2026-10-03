# Threat Recovery — 7-minute presentation + product demo

**Track / category:** Cybersecurity — Cyber Defense  
**Presentation + demo:** 7 minutes  
**Q&A:** 3 minutes

## 0:00–0:45 — Opening: track and problem

**Slide:** *When someone continues, the security story should not disappear.*

**Say:**

> Our track is Cyber Defense. We worked on what happens after someone sees a risky-site warning and continues anyway. The warning can disappear, leaving the person unsure what was detected or what to do next. Threat Recovery adds an assessment and a recovery record: it explains the risk before continuing, then preserves context and suggested actions if the user proceeds through our warning.

## 0:45–1:25 — The user problem

**Slide:** *Detection is only the first moment.*

**Say:**

> We focused on the gap after detection. A person may continue because they need the site or do not understand the warning. Once they do, they can lose the reason for the warning and any chance to review it. We are not claiming to prevent every unsafe action. We want to make risk understandable and keep a useful follow-up record when someone chooses to continue through our warning.

## 1:25–2:25 — Approach and solution

**Slide:** *Signals become a choice, then a recovery plan.*

```text
Observe page signals → Assess risk → Show warning → Record continue decision → Guide recovery
```

**Say:**

> The extension collects page signal types, not field values. It combines local heuristics with an optional Google Safe Browsing lookup. When the assessment should warn, it uses an in-page warning when content-script access is available, and an extension-owned warning page when it is not. Leaving ends the flow without an incident. Continuing through our warning saves a local incident, which the dashboard turns into a review and action checklist.

## 2:25–3:20 — What the current code does

**Slide:** *Storage and heuristics are present in the current commit.*

- A hostname containing a threat term such as `malware` adds **45** heuristic points.
- A Google Safe Browsing match adds **70** points and triggers a warning.
- Incidents and pending warning details are saved in Chrome extension local storage.
- Incident writes are serialized to avoid concurrent updates replacing one another.

**Example:** For `https://malware.wicar.org`, the hostname heuristic alone gives 45 points (medium), and the local elevated-risk rule makes it warning-eligible. A Safe Browsing match adds 70 more. HTTP also adds transport risk.

**Say:**

> Here is what current source says. Local rules add 45 points when a hostname contains a term like malware. On HTTPS malware.wicar.org, that local signal alone is 45, or medium, and the elevated-risk rule makes it warning-eligible. A Safe Browsing match adds 70 points and forces a warning. Incidents and pending warning details use Chrome local extension storage. Incident writes are serialized. This is code evidence; it does not prove the installed browser bundle is current until we run it there.

## 3:20–4:35 — Product demo: show the warning

**Demo setup:** Start the unpacked extension, run `npm run demo`, and open the local demo page at `http://127.0.0.1:4173`.

The local demo page has inert username and password fields. Its form does not submit or save entries. Use synthetic demo data only; do not enter real credentials.

**Say:**

> I am using the local demo page rather than a live malware sample. It is bundled with the project and the form is inert: it will not send or save anything. The extension sees a username and password field and warns because the page is plain HTTP and contains sensitive field types. Notice the options: leave, or continue anyway. I will choose continue to demonstrate what happens next.

**Action:** Click **Continue anyway**.

## 4:35–5:50 — Product demo: show incident and recovery

**Demo action:** Open the dashboard and show the new incident under **Unresolved**. Point out its reason, possible exposure, recommended actions, and resolve control.

**Say:**

> Now I will open the dashboard. The incident should show the domain, time, severity, reasons, possible exposure and suggested actions. I can review the checklist and mark it resolved. The record is local to this browser profile. This happens when someone continues through Threat Recovery's warning; it does not detect a bypass of Chrome's separate interstitial. If the record does not appear, I will show the background console and say which step failed rather than imply success.

**If the incident is missing:** Check the service-worker console for `SECURITY_INCIDENT`. Do not claim the save succeeded if it did not.

## 5:50–7:00 — Privacy, limits, and takeaway

**Slide:** *Support recovery without claiming certainty.*

- Browsing history and incidents are stored locally by default.
- The extension detects field types, not form values.
- If enabled, Safe Browsing sends the page URL to Google.
- The extension does not scan downloaded files or observe bypasses of Chrome's own warning.
- Email alerts are off by default and require a separately configured relay.

**Say:**

> Threat Recovery is a support layer, not a guarantee that every threat will be detected. Local heuristics can be wrong. Safe Browsing is optional and receives the URL when enabled. We do not scan downloaded files or observe bypasses of Chrome's own warning. History and incidents stay in local extension storage by default. Optional email needs a user-configured relay and is off by default. Our outcome is simple: assess, warn, record the choice, and give the person something useful to do next. Thank you.

## 7:00–10:00 — Q&A

### Is the storage persistent?

Current source uses `chrome.storage.local` for incidents and pending warnings. Incident writes are serialized. Confirm the installed extension in a fresh browser run before claiming runtime behavior was demonstrated.

### Why did WICAR show `low · 25` before?

That result does not match the current heuristic source. The current HTTPS hostname heuristic adds 45 points for `malware.wicar.org`. The old screenshot alone cannot show whether Chrome had an older bundle or a stale assessment.

### Does every warning create an incident?

No. Only choosing **Continue anyway** on a Threat Recovery warning saves an incident. Choosing **Leave** does not.

### Does a Safe Browsing match trigger a warning?

Yes. The current assessment adds 70 points and sets the warning flag when Safe Browsing reports a match.

### Are form values collected?

No. The extension detects field types and permission states, not what a person types. A configured Safe Browsing lookup sends the page URL to Google.

### What is not covered?

Downloaded-file scanning, detection of bypasses of Chrome's own interstitial, and an included email relay. The optional email feature needs a user-configured relay.

## Presenter check before the event

Reload the unpacked extension, run the local demo, and confirm the warning, **Continue anyway**, and dashboard incident in the same browser profile. Source inspection and a live browser run are different kinds of evidence.
