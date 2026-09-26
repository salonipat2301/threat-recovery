# Threat Recovery

Privacy-first browser extension for **Cyber Defense & Threat Response**.

Browsers already warn about known bad sites. This project focuses on what happens
**after** a user ignores a warning and continues: capture exposure context, create
a local unresolved incident, and guide remediation from a dashboard.

## Pipelines

1. **Observation** - navigation events, DOM page signals, permission signals → `SiteObservation`
2. **Risk & warning** - Google Safe Browsing + local heuristics → warning overlay → user decision
3. **Persistence & dashboard** - unresolved `SecurityIncident` in `chrome.storage.local` + popup UI

## Setup

```bash
npm install
cp .env.example .env
# set WXT_GOOGLE_SAFE_BROWSING_API_KEY in .env
npm run dev
```

Load the unpacked extension from `.output/chrome-mv3`.

## Safe local demo

Start the local demo page in a second terminal:

```bash
npm run demo
```

Open `http://127.0.0.1:4173` while the unpacked extension is enabled. The page
uses fake credentials in an inert form to trigger the extension warning; it does
not send or store form contents. Choose **Continue anyway**, then open the
dashboard to see the resulting incident and remediation checklist.

## Validate

```bash
npm run compile
npm run build
npm run test:risk
```

## Privacy

Passwords, card numbers, and form field values are never collected or stored.
Only local security metadata (domain, reasons, exposures, decisions) is kept on-device.

## TODO — Presentation deliverables

- [ ] Complete README setup, installation, execution, and demo instructions.
- [ ] Include a presentation document and an architecture or workflow diagram.
- [ ] Disclose datasets, APIs, third-party services, and pre-existing work.
