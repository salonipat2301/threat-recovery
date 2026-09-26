import { useEffect, useState } from "react";
import { browser as chrome } from "wxt/browser";
import type { RiskAssessment } from "../../lib/types/risk-assessment";

interface PendingWarning {
  tabId: number;
  targetUrl: string;
  assessment: RiskAssessment;
}

export default function Warning() {
  const [warning, setWarning] = useState<PendingWarning | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = new URLSearchParams(location.search).get("id");

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("This warning has expired.");
      return;
    }
    chrome.runtime.sendMessage({ type: "GET_WARNING", id })
      .then((result: PendingWarning | null) => {
        if (result) setWarning(result);
        else setError("This warning has expired or was already handled.");
      })
      .catch(() => setError("Could not load the security warning."))
      .finally(() => setLoading(false));
  }, [id]);

  async function choose(decision: "LEAVE_WARNING" | "CONTINUE_WARNING") {
    if (!id || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await chrome.runtime.sendMessage({ type: decision, id });
      if (!result?.ok) throw new Error(result?.error ?? "Could not save your choice.");
      if (decision === "LEAVE_WARNING") setError("Your choice was recorded. Returning to the previous page…");
      else setError("Your choice was recorded. Continuing to the site…");
    } catch (reason) {
      setBusy(false);
      setError(reason instanceof Error ? reason.message : "Could not save your choice.");
    }
  }

  if (loading) return <main className="warning-shell"><p>Checking warning…</p></main>;
  if (!warning) return <main className="warning-shell"><div className="warning-card"><div className="brand">THREAT RECOVERY</div><h1>Warning unavailable</h1><p>{error}</p></div></main>;

  const { assessment } = warning;
  const high = assessment.severity === "HIGH";

  return (
    <main className="warning-shell">
      <section className={`warning-card ${high ? "is-high" : "is-medium"}`}>
        <div className="brand">THREAT RECOVERY</div>
        <div className="risk-kicker">{assessment.severity} RISK WEBSITE</div>
        <h1>{assessment.category === "PHISHING" ? "Possible phishing site" : "Potentially dangerous site"}</h1>
        <p className="warning-intro">Google Safe Browsing found a known threat for this address.</p>
        <div className="target-url" title={warning.targetUrl}>{warning.targetUrl}</div>

        <div className="score-line">
          <span>Threat Score</span>
          <strong>{assessment.score}<small> / 100</small></strong>
        </div>

        <section className="explanation">
          <h2>Why you’re seeing this</h2>
          <ul>
            {assessment.reasons.map((reason, index) => <li key={`${index}-${reason}`}>{reason}</li>)}
          </ul>
        </section>

        {assessment.potentialExposureTypes.length > 0 && (
          <p className="exposure-note">If you continue and interact with this page, the listed information or permissions may be exposed. Threat Recovery does not collect form values or files.</p>
        )}

        {error && <p className="action-message" role="status">{error}</p>}
        <div className="warning-actions">
          <button className="leave-button" disabled={busy} onClick={() => void choose("LEAVE_WARNING")}>
            Leave Site
          </button>
          <button className="continue-button" disabled={busy} onClick={() => void choose("CONTINUE_WARNING")}>
            Continue Anyway
          </button>
        </div>
        <p className="source-note">Threat intelligence: Google Safe Browsing</p>
      </section>
    </main>
  );
}
