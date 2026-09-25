 import { useState } from "react";

import { getRecentHistory } from "../../lib/collectors/history";

import type { BrowserEvent } from "../../lib/types/browser-event";

export default function App() {
  const [events, setEvents] =
    useState<BrowserEvent[]>([]);

  const [loading, setLoading] =
    useState(false);

  async function loadBrowserActivity() {
    try {
      setLoading(true);

      const history =
        await getRecentHistory(24);

      setEvents(history);
    } catch (error) {
      console.error(
        "Failed to load browser history:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        width: "420px",
        padding: "20px",
      }}
    >
      <h2>Threat Recovery</h2>

      <p>
        Browser Activity Collector
      </p>

      <button
        onClick={loadBrowserActivity}
        disabled={loading}
      >
        {loading
          ? "Loading..."
          : "Load Browser Activity"}
      </button>

      <p>
        {events.length} events found
      </p>

      {events.map((event) => (
        <div
          key={event.id}
          style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop:
              "1px solid #ddd",
          }}
        >
          <strong>
            {event.domain}
          </strong>

          {event.title && (
            <div>
              {event.title}
            </div>
          )}

          <div
            style={{
              fontSize: "12px",
              wordBreak: "break-all",
            }}
          >
            {event.url}
          </div>

          <small>
            {new Date(
              event.timestamp
            ).toLocaleString()}
          </small>

          <div
            style={{
              fontSize: "11px",
              marginTop: "4px",
            }}
          >
            Source: {event.source}
          </div>
        </div>
      ))}
    </div>
  );
}