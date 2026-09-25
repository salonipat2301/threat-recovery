import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { lookupSafeBrowsing } from "../lib/threat-intel/safe-browsing";

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadDotEnv();
  const apiKey = process.env.WXT_GOOGLE_SAFE_BROWSING_API_KEY;

  const malware = await lookupSafeBrowsing(
    "http://testsafebrowsing.appspot.com/s/malware.html",
    apiKey
  );
  const clean = await lookupSafeBrowsing("https://example.com/", apiKey);

  console.log("malware fixture", malware);
  console.log("clean fixture", clean);

  if (!malware.available) {
    console.warn("Safe Browsing unavailable:", malware.error);
    process.exitCode = 0;
    return;
  }

  if (!malware.matched) {
    throw new Error("expected malware test URL to match");
  }

  if (clean.matched) {
    throw new Error("expected example.com not to match");
  }

  console.log("Safe Browsing checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
