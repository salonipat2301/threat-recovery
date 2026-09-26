// See https://wxt.dev/api/config.html
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],

  webExt: {
    disabled: true,
  },

  manifest: {
    name: "Threat Recovery",
    description:
      "Privacy-first extension that assesses risky sites, warns before exposure, and tracks unresolved incidents locally.",
    permissions: [
      "history",
      "webNavigation",
      "storage",
      "tabs",
      "notifications",
      "alarms",
    ],
    host_permissions: [
      "https://safebrowsing.googleapis.com/*",
    ],
    optional_host_permissions: ["https://*/*", "http://localhost/*", "http://127.0.0.1/*"],
  },
});
