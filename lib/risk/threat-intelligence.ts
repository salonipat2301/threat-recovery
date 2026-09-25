import {
  checkGoogleSafeBrowsing
} from "./providers/google-safe-browsing";


export async function checkThreatIntelligence(
  url: string
) {
  return checkGoogleSafeBrowsing(url);
}
