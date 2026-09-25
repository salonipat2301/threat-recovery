// See https://wxt.dev/api/config.html
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],

  manifest: {
    permissions: [
      "history",
      "webNavigation",
    ],
    host_permissions: [
      "https://safebrowsing.googleapis.com/*",
    ],
  },
});