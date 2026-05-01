// src/pages/SupportHome.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = process.env.REACT_APP_API;

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("uplift_user") || "null"); } catch { return null; }
}

export default function SupportHome() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    // optionally load past sessions for this user in the future
  }, []);

  // Called when user clicks "Start Support Session"
  async function startSupportSession() {
    setError("");
    const stored = JSON.parse(localStorage.getItem('uplift_user') || 'null');
    if (!stored || !stored.username) {
      setError("You must sign in to start a support session.");
      // optionally navigate("/signin");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/support/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-username': stored.username
        },
        body: JSON.stringify({}) // authCheck uses header; body empty is fine
      });

      if (!res.ok) {
        const text = await res.text().catch(()=>null);
        throw new Error(text || `Failed to start session (${res.status})`);
      }

      const session = await res.json();
      // navigate to session chat page (adjust route if yours differs)
      navigate(`/support/session/${session._id}`, { state: { session } });
    } catch (e) {
      console.error('startSupportSession error', e);
      setError(e?.message || "Could not start support session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel dashboard-container">
      <header className="hero">
        <h1>Need Support?</h1>
        <p>Start a private support session with our team. You can request a call or book a professional.</p>
      </header>

      <section style={{ maxWidth: 760, margin: "18px auto" }}>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn primary" onClick={startSupportSession} disabled={loading}>
            {loading ? "Starting…" : "Start Support Session"}
          </button>
          <button className="btn secondary" onClick={() => navigate("/")}>Back to Home</button>
        </div>

        {error && <div style={{ color: "#b91c1c", marginTop: 12 }}>{error}</div>}

        <hr style={{ margin: "18px 0" }} />

        <div style={{ background: "#fff", borderRadius: 8, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 style={{ marginTop: 0 }}>What happens next?</h3>
          <ol style={{ paddingLeft: 18 }}>
            <li>We create a private support session for you.</li>
            <li>You can request a phone call or book a session with a psychiatrist on that session page.</li>
            <li>Our admin/support team will be notified in real time and can respond.</li>
          </ol>
        </div>
      </section>
    </div>
  );
}
