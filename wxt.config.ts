// See https://wxt.dev/api/config.html
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],

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
    ],
    host_permissions: [
      "https://safebrowsing.googleapis.com/*",
    ],
  },
});
