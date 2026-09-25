import { useEffect, useMemo, useState } from "react";
import type { SecurityIncident } from "../../lib/types/security-incident";
import { summarizeIncidents } from "../../lib/storage/incidents";
import "./App.css";

type Filter = "all" | "unresolved" | "high" | "resolved";

export default function App() {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [filter, setFilter] = useState<Filter>("unresolved");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const response = await chrome.runtime.sendMessage({
      type: "GET_INCIDENTS",
    });
    setIncidents(response?.incidents ?? []);
    setLoading(false);
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

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="eyebrow">CYBER DEFENSE</div>
          <h1>Threat Recovery</h1>
          <p>Local unresolved risks after ignored warnings.</p>
        </div>
        <div className="status">
          {loading ? "Loading" : "Local only"}
        </div>
      </header>

      <section className="summary-grid">
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
