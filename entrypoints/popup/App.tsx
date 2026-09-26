import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import type { BrowserEvent } from "../../lib/types/browser-event";
import type { SecurityIncident } from "../../lib/types/security-incident";
import type { RiskVerdict } from "../../lib/types/risk-verdict";
import "./App.css";

export default function App() {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [history, setHistory] = useState<BrowserEvent[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [currentVerdict, setCurrentVerdict] = useState<RiskVerdict | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      browser.runtime.sendMessage({ type: "GET_INCIDENTS" }),
      browser.runtime.sendMessage({ type: "GET_HISTORY" }),
      browser.tabs.query({ active: true, currentWindow: true }),
    ])
      .then(async ([incidentResponse, historyResponse, tabs]) => {
        setIncidents(incidentResponse?.incidents ?? []);
        setHistory(historyResponse?.events ?? []);
        const currentTab = tabs[0];
        setCurrentUrl(currentTab?.url ?? null);
        if (currentTab?.id !== undefined && currentTab.url) {
          const result = await browser.runtime.sendMessage({
            type: "GET_TAB_RISK",
            tabId: currentTab.id,
          });
          setCurrentVerdict(result?.url === currentTab.url ? result.verdict : null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const highRiskDomains = new Set([
    ...incidents
      .filter(
        (item) =>
          item.status === "unresolved" &&
          (item.severity === "high" || item.severity === "critical")
      )
      .map((item) => item.domain),
    ...history
      .filter((event) => event.riskLevel === "high" || event.riskLevel === "critical")
      .map((event) => event.domain),
  ]);
  const currentDomain = (() => {
    if (!currentUrl) return "Current tab unavailable";
    try {
      return new URL(currentUrl).hostname.replace(/^www\./, "");
    } catch {
      return "This browser page cannot be assessed";
    }
  })();
  const currentRiskSignalCount =
    currentVerdict?.reasons.filter((reason) => reason.weight > 0).length ?? 0;
  const currentPageIsWeb = Boolean(currentUrl && /^https?:\/\//i.test(currentUrl));
  const currentPageMessage = currentVerdict
    ? currentRiskSignalCount > 0
      ? `${currentRiskSignalCount} risk signals detected`
      : "No warning indicators detected"
    : loading
      ? "Checking this page…"
      : currentPageIsWeb
        ? "Could not assess this page. Check site access or reload it."
        : "Chrome’s built-in pages can’t be assessed.";

  async function openDashboard() {
    await browser.tabs.create({
      url: browser.runtime.getURL("/dashboard.html"),
    });
    window.close();
  }

  return (
    <main className="popup">
      <header>
        <div className="eyebrow">CYBER DEFENSE</div>
        <h1>Threat Recovery</h1>
        <p>Local site protection</p>
      </header>

      <section className={highRiskDomains.size ? "risk-summary alert" : "risk-summary"}>
        <span className="risk-label">High-risk sites</span>
        <strong>{loading ? "—" : highRiskDomains.size}</strong>
        <span className="risk-caption">
          {loading
            ? "Checking recent activity…"
            : highRiskDomains.size
              ? "Review these sites and incidents in the dashboard."
              : "No high-risk sites in recent activity."}
        </span>
      </section>

      <section className="activity">
        <h2>Current page</h2>
        {currentUrl ? (
          <div className="activity-row">
            <div className="activity-site">
              <strong>{currentDomain}</strong>
              <span>
                {currentPageMessage}
              </span>
            </div>
            {currentVerdict ? (
              <span className={`risk ${currentVerdict.severity}`}>
                {currentVerdict.severity} · {currentVerdict.score}
              </span>
            ) : (
              <span className="risk pending">
                {loading ? "checking" : currentPageIsWeb ? "unavailable" : "not scannable"}
              </span>
            )}
          </div>
        ) : (
          <p className="empty">{loading ? "Loading…" : "Open a website to see its assessment."}</p>
        )}
      </section>

      <button className="dashboard-button" onClick={() => void openDashboard()}>
        View dashboard
      </button>
    </main>
  );
}
