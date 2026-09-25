import { useState } from "react";
import { getRecentHistory } from "../../lib/collectors/history";
import type { BrowserEvent } from "../../lib/types/browser-event";

export default function App() {
  const [events, setEvents] = useState<BrowserEvent[]>([]);

  async function loadHistory() {
    const results = await getRecentHistory(24);
    setEvents(results);
  }

  return (
    <div
      style={{
        width: "420px",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h2>Threat Recovery</h2>

      <p>Browser activity from the last 24 hours.</p>

      <button onClick={loadHistory}>
        Load Browser Activity
      </button>

      <p>
        <strong>{events.length}</strong> pages loaded
      </p>

      {events.map((event) => (
        <div
          key={event.id}
          style={{
            borderTop: "1px solid #ddd",
            padding: "12px 0",
          }}
        >
          <strong>{event.domain}</strong>

          <div>
            {event.isHttps ? "HTTPS" : "HTTP"}
          </div>

          <div
            style={{
              fontSize: "12px",
              marginTop: "4px",
              wordBreak: "break-all",
            }}
          >
            {event.url}
          </div>

          <div
            style={{
              fontSize: "11px",
              marginTop: "4px",
            }}
          >
            {new Date(event.timestamp).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

// APP / DASHBOARD TODO

// [ ] Replace raw browser-history view with Security Dashboard

// [ ] Dashboard summary
//     - Total unresolved risks
//     - High-risk incidents
//     - Resolved incidents

// [ ] Security incident cards
//     - Domain / website
//     - Risk category
//     - Severity / response-priority score
//     - Timestamp
//     - Unresolved / Resolved status

// [ ] Incident detail view
//     - Why the site was flagged
//     - Threat-intelligence signals
//     - Sensitive page signals detected
//       (login/password/OTP/payment/upload)
//     - Relevant site permissions
//       (camera/mic/location/notifications)
//     - User action: left / continued

// [ ] Recommended response
//     - Show actions based on exposure type
//     - Credential exposure → password/session/MFA actions
//     - Payment exposure → financial-account actions
//     - File/data exposure → data-protection actions
//     - Permission exposure → revoke unnecessary permissions

// [ ] Remediation checklist
//     - Allow user to mark actions complete
//     - Show remediation progress

// [ ] Mark incident Resolved / Unresolved

// [ ] Persistent security timeline
//     - Read stored incidents from local storage
//     - Show previous risky interactions
//     - Keep incidents after extension/browser popup closes

// [ ] Filtering
//     - All
//     - High Risk
//     - Unresolved
//     - Resolved

// [ ] Notifications
//     - Browser notification for high-priority incidents
//     - Optional email alerts later

// [ ] Privacy section
//     - Explain what the extension observes
//     - Confirm passwords/card numbers/form values are NOT stored
//     - Allow locally stored security events to be cleared

// STRETCH

// [ ] Search incidents
// [ ] Risk trend/summary
// [ ] Export incident summary
// [ ] Additional threat-intelligence details
// [ ] Email notifications