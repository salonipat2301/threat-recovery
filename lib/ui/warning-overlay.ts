import type { RiskVerdict } from "../types/risk-verdict";
import type { SiteObservation } from "../types/site-observation";

const ROOT_ID = "threat-recovery-warning-root";

export function showRiskWarningOverlay(
  observation: SiteObservation,
  verdict: RiskVerdict,
  requestId: string
): void {
  if (window.top !== window) {
    return;
  }

  dismissRiskWarningOverlay();

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.setAttribute("data-threat-recovery", "warning");

  const shadow = root.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      :host, * { box-sizing: border-box; }
      .overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: rgba(9, 9, 11, 0.72);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
      }
      .card {
        width: min(520px, 100%);
        background: #18181b;
        color: #fafafa;
        border: 1px solid #3f3f46;
        border-radius: 16px;
        padding: 22px;
        box-shadow: 0 24px 80px rgba(0,0,0,0.45);
      }
      .badge {
        display: inline-block;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #fecaca;
        background: #7f1d1d;
        border-radius: 999px;
        padding: 5px 10px;
        margin-bottom: 12px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 22px;
        line-height: 1.25;
      }
      .domain {
        color: #a1a1aa;
        font-size: 13px;
        margin-bottom: 14px;
        word-break: break-all;
      }
      .meta {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 14px;
      }
      .chip {
        font-size: 12px;
        background: #27272a;
        border: 1px solid #3f3f46;
        border-radius: 8px;
        padding: 6px 8px;
      }
      ul {
        margin: 0 0 18px;
        padding-left: 18px;
        color: #e4e4e7;
        font-size: 13px;
        line-height: 1.45;
      }
      .actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      button {
        border: 0;
        border-radius: 10px;
        padding: 11px 14px;
        font-weight: 700;
        cursor: pointer;
        font-size: 13px;
      }
      .leave {
        background: #fafafa;
        color: #18181b;
      }
      .continue {
        background: transparent;
        color: #fca5a5;
        border: 1px solid #7f1d1d;
      }
      .note {
        margin-top: 12px;
        font-size: 11px;
        color: #a1a1aa;
      }
    </style>
    <div class="overlay" role="dialog" aria-modal="true" aria-label="Security warning">
      <div class="card">
        <div class="badge">${escapeHtml(verdict.severity)} risk</div>
        <h1>This site may put you at risk</h1>
        <div class="domain">${escapeHtml(observation.domain)} · score ${verdict.score}</div>
        <div class="meta">
          ${verdict.exposures
            .slice(0, 4)
            .map(
              (exposure) =>
                `<span class="chip">${escapeHtml(exposure.replaceAll("_", " "))}</span>`
            )
            .join("")}
        </div>
        <ul>
          ${verdict.reasons
            .filter((reason) => reason.weight > 0)
            .slice(0, 5)
            .map((reason) => `<li>${escapeHtml(reason.message)}</li>`)
            .join("")}
        </ul>
        <div class="actions">
          <button class="leave" type="button" data-decision="left">Leave this site</button>
          <button class="continue" type="button" data-decision="continued">Continue anyway</button>
        </div>
        <div class="note">
          Threat Recovery never stores passwords, card numbers, or form values.
          Continuing creates a local unresolved security incident.
        </div>
      </div>
    </div>
  `;

  const sendDecision = async (decision: "left" | "continued") => {
    dismissRiskWarningOverlay();
    await chrome.runtime.sendMessage({
      type: "RISK_WARNING_DECISION",
      requestId,
      decision,
    });
  };

  shadow
    .querySelector('[data-decision="left"]')
    ?.addEventListener("click", () => {
      void sendDecision("left");
    });

  shadow
    .querySelector('[data-decision="continued"]')
    ?.addEventListener("click", () => {
      void sendDecision("continued");
    });

  document.documentElement.appendChild(root);
}

export function dismissRiskWarningOverlay(): void {
  document.getElementById(ROOT_ID)?.remove();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
