import { collectPageSignals } from "../lib/collectors/page-signals";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],

  main() {
    const signals = collectPageSignals();

    console.log("PAGE_SIGNALS", signals);
  },
});