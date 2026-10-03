import { useEffect, useState } from "react";
import { browser as chrome } from "wxt/browser";
import type { RiskVerdict } from "../../lib/types/risk-verdict";
import type { SiteObservation } from "../../lib/types/site-observation";

interface PendingWarning {
  requestId: string;
  observation: SiteObservation;
  verdict: RiskVerdict;
}

const PENDING_WARNINGS_KEY = "pending_risk_warnings";

export default function App() {
  const requestId = decodeURIComponent(window.location.hash.slice(1));
  const [pending, setPending] = useState<PendingWarning | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void chrome.storage.local.get(PENDING_WARNINGS_KEY).then((saved) => {
      const records = saved[PENDING_WARNINGS_KEY] as Record<string, PendingWarning> | undefined;
      const match = Object.values(records ?? {}).find((item) => item.requestId === requestId);
      setPending(match ?? null);
      if (!match) setError("This warning is no longer available. Close this tab and return to your previous page.");
    }).catch(() => setError("Could not load the saved warning details."));
  }, [requestId]);

  async function decide(decision: "left" | "continued") {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      const response = await chrome.runtime.sendMessage({
        type: "RISK_WARNING_DECISION",
        requestId: pending.requestId,
        decision,
      });
      if (!response?.ok) throw new Error(response?.error ?? "Your choice could not be saved.");
      if (decision === "left") window.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your choice could not be saved.");
      setBusy(false);
    }
  }

  return (
    <main>
      <section className="card" aria-live="polite">
        <div className="badge">{pending?.verdict.severity ?? "Security"} risk</div>
        <h1>Pause before continuing</h1>
        {pending ? (
          <>
            <p className="domain">{pending.observation.domain}</p>
            <p>This page was flagged as risky. Threat Recovery has paused navigation so you can choose what to do.</p>
            <ul>
              {pending.verdict.reasons.filter((reason) => reason.weight > 0).slice(0, 5).map((reason) => (
                <li key={reason.code}>{reason.message}</li>
              ))}
            </ul>
            <div className="actions">
              <button disabled={busy} onClick={() => void decide("left")}>Leave this site</button>
              <button className="continue" disabled={busy} onClick={() => void decide("continued")}>Continue anyway</button>
            </div>
          </>
        ) : <p>Loading warning details…</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <p className="note">Continuing creates a local unresolved incident. Form values are not collected.</p>
      </section>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; min-height: 100vh; background: #09090b; color: #fafafa; font: 16px system-ui, sans-serif; display: grid; place-items: center; padding: 24px; }
        .card { width: min(620px, 100%); padding: 32px; border: 1px solid #3f3f46; border-radius: 18px; background: #18181b; box-shadow: 0 24px 80px #0008; }
        .badge { display: inline-block; background: #7f1d1d; color: #fecaca; border-radius: 999px; padding: 6px 12px; text-transform: uppercase; font-size: 12px; font-weight: 700; }
        h1 { margin: 18px 0 8px; font-size: 28px; }
        .domain { color: #fca5a5; font-weight: 700; overflow-wrap: anywhere; }
        li { margin: 8px 0; color: #e4e4e7; }
        .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
        button { border: 0; border-radius: 10px; padding: 12px 16px; font-weight: 700; cursor: pointer; }
        button:disabled { opacity: .6; cursor: wait; }
        .continue { background: #7f1d1d; color: #fff; }
        .error { color: #fca5a5; }
        .note { color: #a1a1aa; font-size: 12px; margin-top: 20px; }
      `}</style>
    </main>
  );
}
