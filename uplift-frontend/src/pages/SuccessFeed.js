// src/pages/SuccessFeed.js
import React, { useEffect, useState } from "react";
import "./Home.css";

const API_BASE = process.env.REACT_APP_API || "http://localhost:5000/api";

export default function SuccessFeed() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const res = await fetch(`${API_BASE}/stories/success/latest`);
        const data = await res.json();
        setStories(data || []);
      } catch (e) {
        console.error("Failed to load success stories", e);
      } finally {
        setLoading(false);
      }
    };
    fetchStories();
  }, []);

  return (
    <div className="dashboard-container">
      <header className="hero">
        <h1>Success Stories</h1>
        <p>Read how others overcame their struggles.</p>
      </header>

      {loading ? (
        <p className="muted">Loading...</p>
      ) : stories.length === 0 ? (
        <p className="muted">No success stories yet. Be the first to share!</p>
      ) : (
        <div className="cards">
          {stories.map((s) => (
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
    </div>
  );
}
