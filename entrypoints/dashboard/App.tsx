import { useEffect, useMemo, useState, type FormEvent } from "react";
import { browser as chrome } from "wxt/browser";
import type { SecurityIncident } from "../../lib/types/security-incident";
import type { BrowserEvent } from "../../lib/types/browser-event";
import type { EmailNotificationSettings } from "../../lib/types/email-notification";
import { summarizeIncidents } from "../../lib/storage/incidents";
import "./App.css";

type Filter = "all" | "unresolved" | "high" | "resolved";

export default function App() {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [history, setHistory] = useState<BrowserEvent[]>([]);
  const [filter, setFilter] = useState<Filter>("unresolved");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailSettings, setEmailSettings] = useState<EmailNotificationSettings>({
    enabled: false,
    recipient: "",
    endpointUrl: "",
    bearerToken: "",
  });
  const [queuedEmailCount, setQueuedEmailCount] = useState(0);
  const [emailMessage, setEmailMessage] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [incidentResponse, historyResponse, emailResponse] = await Promise.all([
        chrome.runtime.sendMessage({ type: "GET_INCIDENTS" }),
        chrome.runtime.sendMessage({ type: "GET_HISTORY" }),
        chrome.runtime.sendMessage({ type: "GET_EMAIL_SETTINGS" }),
      ]);
      setIncidents(incidentResponse?.incidents ?? []);
      setHistory(historyResponse?.events ?? []);
      if (emailResponse?.settings) {
        setEmailSettings(emailResponse.settings);
      }
      setQueuedEmailCount(emailResponse?.queuedCount ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const summary = useMemo(
    () => summarizeIncidents(incidents),
    [incidents]
  );

  const filtered = useMemo(() => {
    return incidents.filter((incident) => {
      if (filter === "unresolved") {
        return incident.status === "unresolved";
      }
      if (filter === "resolved") {
        return incident.status === "resolved";
      }
      if (filter === "high") {
        return (
          incident.status === "unresolved" &&
          (incident.severity === "high" ||
            incident.severity === "critical")
        );
      }
      return true;
    });
  }, [incidents, filter]);

  const selected =
    filtered.find((incident) => incident.id === selectedId) ??
    filtered[0] ??
    null;

  async function markResolved(id: string) {
    await chrome.runtime.sendMessage({
      type: "UPDATE_INCIDENT",
      id,
      patch: { status: "resolved" },
    });
    await refresh();
  }

  async function toggleAction(incident: SecurityIncident, action: string) {
    const completed = incident.completedActions.includes(action)
      ? incident.completedActions.filter((item) => item !== action)
      : [...incident.completedActions, action];

    await chrome.runtime.sendMessage({
      type: "UPDATE_INCIDENT",
      id: incident.id,
      patch: { completedActions: completed },
    });
    await refresh();
  }

  async function clearAll() {
    await chrome.runtime.sendMessage({ type: "CLEAR_INCIDENTS" });
    setSelectedId(null);
    await refresh();
  }

  async function saveEmailPreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailMessage("");
    let endpoint: URL | null = null;
    try {
      endpoint = new URL(emailSettings.endpointUrl);
    } catch {
      setEmailMessage("Enter a valid email relay URL.");
      return;
    }
    if (
      endpoint.protocol !== "https:" &&
      !(endpoint.protocol === "http:" && ["localhost", "127.0.0.1"].includes(endpoint.hostname))
    ) {
      setEmailMessage("The relay must use HTTPS (HTTP is allowed for localhost testing). ");
      return;
    }
    if (emailSettings.enabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailSettings.recipient)) {
      setEmailMessage("Enter a valid recipient email address.");
      return;
    }
    setSavingEmail(true);
    try {
      if (emailSettings.enabled) {
        const granted = await chrome.permissions.request({ origins: [`${endpoint.origin}/*`] });
        if (!granted) {
          setEmailMessage("Permission to contact this relay was not granted.");
          return;
        }
      }
      await chrome.runtime.sendMessage({ type: "SAVE_EMAIL_SETTINGS", settings: emailSettings });
      setEmailMessage(emailSettings.enabled ? "Preferences saved. High and critical continued risks will queue for delivery." : "Email alerts are off.");
      await refresh();
    } catch {
      setEmailMessage("Could not save email preferences.");
    } finally {
      setSavingEmail(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="eyebrow">CYBER DEFENSE</div>
          <h1>Threat Recovery</h1>
          <p>Browsing history and local security incidents.</p>
        </div>
        <div className="status">
          {loading ? "Loading" : "Local only"}
        </div>
      </header>

      <section className="summary-grid">
        <div className="summary">
          <span className="summary-number">{history.length}</span>
          <span className="summary-label">Visits tracked</span>
        </div>
        <div className="summary">
          <span className="summary-number">{summary.unresolved}</span>
          <span className="summary-label">Unresolved</span>
        </div>
        <div className="summary">
          <span className="summary-number">{summary.highRisk}</span>
          <span className="summary-label">High risk</span>
        </div>
        <div className="summary">
          <span className="summary-number">{summary.resolved}</span>
          <span className="summary-label">Resolved</span>
        </div>
      </section>

      <section className="history-section">
        <div className="history-heading">
          <div>
            <h2>Browsing history</h2>
            <p>Recent visits, including visits saved on this device.</p>
          </div>
          <span>{history.length} saved</span>
        </div>
        {history.length === 0 ? (
          <div className="history-empty">Visited sites will appear here.</div>
        ) : (
          <div className="history-list">
            {history.slice(0, 8).map((event) => (
              <div className="history-row" key={event.id}>
                <div className="history-site">
                  <strong>{event.domain}</strong>
                  <span>{event.category}</span>
                </div>
                <span className={`severity ${event.riskLevel}`}>
                  {event.riskLevel} risk · {event.riskScore}
                </span>
                <time>{new Date(event.timestamp).toLocaleString()}</time>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="email-section">
        <div className="history-heading">
          <div>
            <h2>Email alerts</h2>
            <p>High and critical incidents you continued past can wait locally while offline.</p>
          </div>
          <span>{queuedEmailCount} queued</span>
        </div>
        <form className="email-form" onSubmit={(event) => void saveEmailPreferences(event)}>
          <label className="email-toggle">
            <input
              type="checkbox"
              checked={emailSettings.enabled}
              onChange={(event) => setEmailSettings({ ...emailSettings, enabled: event.target.checked })}
            />
            <span>Enable email alerts</span>
          </label>
          <div className="email-fields">
            <label>Recipient email
              <input type="email" value={emailSettings.recipient} onChange={(event) => setEmailSettings({ ...emailSettings, recipient: event.target.value })} placeholder="you@example.com" disabled={!emailSettings.enabled} />
            </label>
            <label>Email relay HTTPS URL
              <input type="url" value={emailSettings.endpointUrl} onChange={(event) => setEmailSettings({ ...emailSettings, endpointUrl: event.target.value })} placeholder="https://your-relay.example/send" required={emailSettings.enabled} disabled={!emailSettings.enabled} />
            </label>
            <label>Relay bearer token
              <input type="password" autoComplete="off" value={emailSettings.bearerToken} onChange={(event) => setEmailSettings({ ...emailSettings, bearerToken: event.target.value })} placeholder="Optional, if your relay requires it" disabled={!emailSettings.enabled} />
            </label>
          </div>
          <p className="email-note">A mail relay and provider account are required to send email. Evidence includes the domain, timestamp, risk, reason, detected signal types, the decision to continue, inferred exposure, and suggested actions. It never includes passwords, form values, or the full page URL.</p>
          {emailMessage && <p className="email-message" role="status">{emailMessage}</p>}
          <button type="submit" disabled={savingEmail}>{savingEmail ? "Saving…" : "Save email preferences"}</button>
        </form>
      </section>

      <div className="toolbar">
        <div className="filters">
          {(
            [
              ["unresolved", "Unresolved"],
              ["high", "High risk"],
              ["resolved", "Resolved"],
              ["all", "All"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? "filter active" : "filter"}
              onClick={() => setFilter(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <button className="ghost" type="button" onClick={() => void clearAll()}>
          Clear local data
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          {loading
            ? "Loading incidents…"
            : "No incidents yet. Continue past a warning to create one."}
        </div>
      ) : (
        <div className="layout">
          <div className="events">
            {filtered.map((incident) => (
              <button
                key={incident.id}
                type="button"
                className={
                  selected?.id === incident.id
                    ? "event selected"
                    : "event"
                }
                onClick={() => setSelectedId(incident.id)}
              >
                <div className="event-top">
                  <div>
                    <div className="domain">{incident.domain}</div>
                    <div className="title">
                      {incident.exposures[0]?.replaceAll("_", " ") ??
                        "Security risk"}
                    </div>
                  </div>
                  <span className={`severity ${incident.severity}`}>
                    {incident.severity}
                  </span>
                </div>
                <div className="event-footer">
                  <span>{incident.status}</span>
                  <span>
                    {new Date(incident.createdAt).toLocaleString()}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <aside className="detail">
              <div className="detail-header">
                <div>
                  <div className="eyebrow">INCIDENT</div>
                  <h2>{selected.domain}</h2>
                </div>
                <span className={`severity ${selected.severity}`}>
                  score {selected.score}
                </span>
              </div>

              <div className="url">{selected.url}</div>

              <h3>Why flagged</h3>
              <ul>
                {selected.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>

              <h3>Potential exposure</h3>
              <div className="chips">
                {selected.exposures.map((exposure) => (
                  <span className="chip" key={exposure}>
                    {exposure.replaceAll("_", " ")}
                  </span>
                ))}
              </div>

              <h3>Page signals</h3>
              <div className="chips">
                {Object.entries(selected.observation.pageSignals)
                  .filter(([, value]) => value)
                  .map(([key]) => (
                    <span className="chip" key={key}>
                      {key}
                    </span>
                  ))}
              </div>

              <h3>Recommended actions</h3>
              <ul className="checklist">
                {selected.recommendedActions.map((action) => {
                  const done =
                    selected.completedActions.includes(action);
                  return (
                    <li key={action}>
                      <label>
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() =>
                            void toggleAction(selected, action)
                          }
                        />
                        <span className={done ? "done" : undefined}>
                          {action}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div className="detail-actions">
                {selected.status === "unresolved" ? (
                  <button
                    type="button"
                    onClick={() => void markResolved(selected.id)}
                  >
                    Mark resolved
                  </button>
                ) : (
                  <span className="resolved-label">Resolved</span>
                )}
              </div>

              <p className="privacy">
                Privacy: passwords, card numbers, and form values are never
                stored. Only local security metadata is kept on this device.
              </p>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
