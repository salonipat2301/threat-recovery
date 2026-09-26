# Threat Recovery

Threat Recovery is a privacy-minded Chrome extension for the recovery step after someone chooses to continue past a security warning. It assesses pages using local signals and, when configured, Google Safe Browsing; records a local incident after the user continues past the extension's warning; and shows the incident and suggested actions in a dashboard.

## What it does

- Checks visited pages for known threats through Google Safe Browsing when an API key is configured, and applies local risk heuristics.
- Detects signal types such as username, password, one-time-code, payment, and file-upload fields, plus browser permission states. It does not read or store field values.
- Shows an in-page warning for pages assessed as high risk. Continuing past this extension's warning creates a persistent local incident with the domain, timestamp, reason, inferred exposure, and recommended actions.
- Keeps browsing history and incidents in extension local storage, and presents a compact popup and a separate dashboard.
- Can optionally queue high or critical incident evidence while offline and post it to a user-configured HTTPS email relay when online. Email is off by default. This repository does not include or operate a mail relay; AWS SNS is not integrated.

The extension cannot observe a user's decision to bypass Chrome's own Safe Browsing interstitial. An incident is created when the user continues through Threat Recovery's warning.

## In development

Threat Recovery does not currently scan downloaded files. Download scanning and malware detection are in development. Planned validation includes the official [EICAR anti-malware test file](https://www.eicar.org/download-anti-malware-testfile/): EICAR.COM is a harmless DOS test program designed to trigger antivirus detection, not real malware.

## Requirements

- Node.js 22 (the project was developed with Node.js v22.23.3)
- npm
- Google Chrome or another Chromium browser supporting Manifest V3

Dependencies are managed by `package-lock.json`. Direct dependencies and their roles are listed in [Dependencies and service disclosures](docs/disclosures.md).

## Setup

```bash
git clone https://github.com/salonipat2301/threat-recovery.git
cd threat-recovery
npm ci
```

Google Safe Browsing is optional. Without a key, local heuristics still run, but known-threat lookups are unavailable. To enable lookups, copy the example file and enter a key you control:

```bash
cp .env.example .env
```

Set `WXT_GOOGLE_SAFE_BROWSING_API_KEY` in `.env`. Never commit `.env` or share a production key. Because a browser extension runs on the user's device, a key compiled into the extension can be extracted from its built JavaScript; restrict and monitor the key in Google Cloud and do not treat it as a server-side secret.

## Run in development

```bash
npm run dev
```

WXT builds the development extension into `.output/chrome-mv3-dev`. In Chrome, open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose that folder. After code changes, reload the extension on the extensions page.

## Build and install a production bundle

```bash
npm run build
```

The production bundle is `.output/chrome-mv3`. Load that directory using **Load unpacked** on `chrome://extensions`. Build output is ignored by Git and should not be committed.

## Verify locally

```bash
npm run compile
npm run build
npm run test:risk
npm run test:safe-browsing
```

## Presentation and architecture

- [Demo video presentation script](docs/demo-video-script.md)
- [Presentation document](https://docs.google.com/document/d/1C_tafPTFGeARg83yS-j7POeyXP-sFswdYF16a8uRQA4/edit?tab=t.0) (Google Doc; access is controlled by its owner)
- [Architecture and workflow diagram](docs/architecture.mmd)
- [Datasets, APIs, dependencies, and project disclosures](docs/disclosures.md)

## Privacy and data handling

Page field values are not collected. Browser history, observations, incidents, and the optional email queue are stored locally in the extension. If configured, the Safe Browsing request sends the current page URL to Google for threat lookup. If the user enables email alerts and configures a relay, a limited evidence report (domain, time, severity, reasons, signal types, decision, inferred exposure, and actions) is sent to that endpoint. The full page URL and form values are excluded from the email report. See [disclosures](docs/disclosures.md) before using external services.
