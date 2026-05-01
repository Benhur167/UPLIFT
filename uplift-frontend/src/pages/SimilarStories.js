// src/pages/SimilarStories.js
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Home.css";

export default function SimilarStories() {
  const location = useLocation();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try state first
    if (location.state?.matches) {
      setMatches(location.state.matches);
      setLoading(false);
      return;
    }
    // Fallback to localStorage (for new tab)
    try {
      const raw = localStorage.getItem("uplift_similar_matches");
      if (raw) setMatches(JSON.parse(raw) || []);
    } catch (e) {
      console.error("localStorage read error", e);
    } finally {
      setLoading(false);
      // optional cleanup so future visits don’t reuse old data
      localStorage.removeItem("uplift_similar_matches");
    }
  }, [location.state]);

  return (
    <div className="dashboard-container">
      <header className="hero">
        <h1>Similar Success Stories</h1>
        <p>Stories from people who faced something like you did.</p>
      </header>

      <section className="panel story-panel">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : matches.length === 0 ? (
          <p className="muted">No similar stories found yet.</p>
        ) : (
          <div className="cards">
            {matches.map((s) => (
              <article className="card" key={s._id}>
                <h3 className="card-title">{s.title || "Untitled"}</h3>
                <p className="card-text">{s.content}</p>
                <div className="meta">
                  <span>by {s.username || "anonymous"}</span>
                  {Array.isArray(s.tags) && s.tags.length > 0 && (
                    <div className="tags">
                      {s.tags.map((t, i) => (
                        <span className="tag" key={i}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <button className="btn secondary" onClick={() => navigate("/", { replace: true })}>
            Back to Home
          </button>
        </div>
      </section>
    </div>
  );
}
