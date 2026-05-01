// src/pages/PostSuccess.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";

const API_BASE = process.env.REACT_APP_API || "http://localhost:5000/api";


export default function PostSuccess() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
  e.preventDefault();
  setErr("");

  if (!content.trim()) return;

  const username = localStorage.getItem("username"); // stored after login

  if (!username) {
    setErr("You must be logged in to post a story.");
    return;
  }

  try {
    setLoading(true);
    const res = await fetch(`${API_BASE}/stories/success`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-username": username, // 🔑 required by backend authCheck
      },
      body: JSON.stringify({
        title,
        content,
        tags: tags ? tags.split(",").map((t) => t.trim()) : [],
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Failed to post");
    }

    navigate("/success"); // go to feed
  } catch (e) {
    console.error(e);
    setErr("Failed to post. Try again.");
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="dashboard-container">
      <header className="hero">
        <h1>Share Your Success Story</h1>
        <p>Inspire others by showing how you overcame challenges.</p>
      </header>

      <section className="panel story-panel">
        <form className="story-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <textarea
            placeholder="Write your success story..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Tags (comma separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
          <button type="submit" className="btn success" disabled={loading}>
            {loading ? "Posting..." : "Post Success Story"}
          </button>
        </form>
        {err && <p className="error">{err}</p>}
      </section>
    </div>
  );
}
