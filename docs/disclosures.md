# Dependencies, data sources, APIs, and disclosures

## Data sources

- **No external training or evaluation dataset is bundled.** Risk rules are code-based heuristics. The demo page uses synthetic, inert form markup and does not collect demo input.
- **Google Safe Browsing is an optional live threat-intelligence API**, not a project-owned dataset. When configured, the extension submits the current page URL and requested threat categories to Google's `threatMatches:find` endpoint. Google controls the service, returned matches, availability, quotas, and applicable terms. Without a key, local heuristics are used.
- Chrome's browsing history and tab/navigation events are user-browser data collected through extension APIs after permission is granted. They remain in extension local storage by default.

## Third-party APIs and services

| Component | Purpose | Data and credentials |
| --- | --- | --- |
| Chrome / Chromium Manifest V3 APIs | Navigation, history, tabs, storage, alarms, notifications, and extension UI | Access is governed by the permissions in `wxt.config.ts`; stored records remain local to the browser profile. |
| Google Safe Browsing API v4 | Optional lookup of the current page URL against known threat lists | Requires `WXT_GOOGLE_SAFE_BROWSING_API_KEY`. The URL is sent to Google. A key used in a browser extension is visible to users in the built extension and must be restricted/monitored; it is not a secure server secret. |
| User-configured HTTPS email relay | Optional dispatch of high/critical continued-risk evidence reports | Disabled by default. The user supplies endpoint, recipient, and optional bearer token in the dashboard. The repository does not provide a relay or send email itself. The report omits full URLs and form values. AWS SNS is not currently integrated. |

No proprietary mail provider, AWS account, SNS topic, hosted backend, or email credentials are included in this repository. A relay must be separately configured for actual delivery.

## Dependencies

Runtime dependencies:

- `react` and `react-dom` — popup and dashboard UI.

Development/build dependencies (versions are pinned by `package-lock.json`):

- `wxt` — extension development and build tooling.
- `@wxt-dev/module-react` — React integration for WXT.
- `typescript` — type checking.
- `@types/chrome`, `@types/react`, and `@types/react-dom` — development type definitions.
- `tsx` — TypeScript execution for local demo and validation scripts.
- `web-ext` — browser extension tooling used by the development setup.

## Pre-existing components and provenance

- The project uses the WXT React starter structure and WXT-generated build output conventions. Starter assets such as `public/wxt.svg` and `assets/react.svg` are part of the scaffold.
- This final version builds on the repository's earlier Pipeline 1 browser activity collection and Pipeline 2 risk warning / incident work. Their commits are retained in Git history; this project does not claim those earlier components as newly authored for the final integration.
- React, WXT, TypeScript, and related dependencies remain under their respective upstream licenses. Consult package metadata and upstream license files for exact terms before redistribution.
- The presentation is maintained in the linked Google Doc; access to that external document is controlled by its owner.

## Credentials and confidential data

- Do not commit `.env`, API keys, bearer tokens, passwords, private keys, personal browsing exports, or confidential incident data.
- `.env` and `.env.*` are ignored; `.env.example` contains only an empty placeholder.
- Build output, dependencies, and local logs are ignored by Git.
- Before publishing a build, remember that a Safe Browsing API key embedded at build time can be extracted from extension JavaScript. Use a restricted key and rotate it if exposed.
