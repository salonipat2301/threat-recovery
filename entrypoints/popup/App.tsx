import { useEffect, useState } from "react";
import { browser as chrome } from "wxt/browser";
import { getRecentHistory } from "../../lib/collectors/history";
import { getSecurityIncidents, getWarningDecisions } from "../../lib/security-storage";
import type { BrowserEvent } from "../../lib/types/browser-event";
import type { SecurityIncident, WarningDecision } from "../../lib/types/security-incident";

export default function App() {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [decisions, setDecisions] = useState<WarningDecision[]>([]);
  const [events, setEvents] = useState<BrowserEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function refreshDashboard() {
    try {
      const [nextIncidents, nextDecisions] = await Promise.all([
        getSecurityIncidents(),
        getWarningDecisions(),
      ]);
      setIncidents(nextIncidents.sort((a, b) => b.detectionTimestamp - a.detectionTimestamp));
      setDecisions(nextDecisions);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load the local dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refreshDashboard(); }, []);

  async function resolveIncident(id: string) {
    try {
      const result = await chrome.runtime.sendMessage({ type: "RESOLVE_INCIDENT", id });
      if (!result?.ok) throw new Error(result?.error ?? "Could not update this incident.");
      await refreshDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update this incident.");
    }
  }

  async function loadBrowserActivity() {
    setHistoryLoading(true);
    setMessage("");
    try {
      setEvents(await getRecentHistory(24));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load browser activity.");
    } finally {
      setHistoryLoading(false);
    }
  }

  const unresolvedCount = incidents.filter((incident) => incident.status === "UNRESOLVED").length;

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div className="brand-mark">TR</div>
        <div><p className="eyebrow">THREAT RECOVERY</p><h1>Security dashboard</h1></div>
      </header>

      <section className="summary-card">
        <div><span className="summary-label">Unresolved incidents</span><strong>{loading ? "—" : unresolvedCount}</strong></div>
        <span className={`summary-status ${unresolvedCount ? "has-alert" : "is-clear"}`}>
          {unresolvedCount ? "Needs attention" : "No active incidents"}
        </span>
      </section>

      {message && <p className="dashboard-message" role="status">{message}</p>}

      <section className="section-block">
        <div className="section-heading"><h2>Security incidents</h2><span>{incidents.length}</span></div>
        {loading ? <p className="empty-copy">Loading local records…</p> : incidents.length === 0 ? (
          <div className="empty-state"><span className="empty-icon">✓</span><div><strong>You’re all clear</strong><p>Incidents appear here if you continue past a high risk warning.</p></div></div>
        ) : (
          <div className="incident-list">
            {incidents.map((incident) => (
              <article className="incident-card" key={incident.id}>
                <div className="incident-topline">
                  <span className={`severity-pill severity-${incident.severity.toLowerCase()}`}>{incident.severity}</span>
                  <span className={`incident-status ${incident.status === "UNRESOLVED" ? "status-open" : "status-resolved"}`}>{incident.status}</span>
                </div>
                <h3>{incident.domain}</h3>
                <p className="incident-meta">{incident.threatCategory.replaceAll("_", " ")} · Threat score {incident.threatScore}</p>
                <p className="incident-url">{incident.url}</p>
                {incident.potentialExposureTypes.length > 0 && (
                  <p className="exposure-list"><span>Potential exposure</span>{incident.potentialExposureTypes.map(labelExposure).join(" · ")}</p>
                )}
                <p className="incident-date">{new Date(incident.detectionTimestamp).toLocaleString()}</p>
                {incident.status === "UNRESOLVED" && <button className="resolve-button" onClick={() => void resolveIncident(incident.id)}>Mark resolved</button>}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section-block decisions-block">
        <div className="section-heading"><h2>Recent warning decisions</h2><span>{decisions.length}</span></div>
        {decisions.length === 0 ? <p className="empty-copy">No warnings have been shown yet.</p> : (
          <div className="decision-list">
            {decisions.slice(0, 5).map((decision) => (
              <div className="decision-row" key={decision.id}>
                <span className={`decision-icon ${decision.warningFollowed ? "decision-left" : "decision-continued"}`}>{decision.warningFollowed ? "✓" : "!"}</span>
                <div className="decision-detail"><strong>{decision.domain}</strong><span>{decision.warningFollowed ? "Warning followed · site left" : "Continued past warning"}</span></div>
                <time>{new Date(decision.decisionTimestamp).toLocaleDateString()}</time>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="activity-block">
        <div className="section-heading"><h2>Browser activity</h2></div>
        <button className="secondary-button" onClick={() => void loadBrowserActivity()} disabled={historyLoading}>
          {historyLoading ? "Loading activity…" : "Load last 24 hours"}
        </button>
        {events.length > 0 && <p className="activity-count">{events.length} recent visits</p>}
        {events.slice(0, 8).map((event) => (
          <div className="history-row" key={event.id}>
            <strong>{event.domain}</strong><span>{new Date(event.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
      </section>
      <footer className="dashboard-footer">Threat checks and incident records stay on this device except URL lookups sent to Google Safe Browsing.</footer>
    </main>
  );
}

function labelExposure(exposure: string): string {
  const labels: Record<string, string> = {
    CREDENTIALS: "Credentials",
    AUTHENTICATION_CODES: "Authentication codes",
    FINANCIAL_DATA: "Financial data",
    DOCUMENTS_OR_FILES: "Files",
    CAMERA: "Camera",
    MICROPHONE: "Microphone",
    LOCATION: "Location",
    NOTIFICATIONS: "Notifications",
  };
  return labels[exposure] ?? exposure;
}
