// src/pages/PostSuccess.js
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Back Button */}
      <div className="mb-6">
        <Link to="/success" className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition">
          &larr; Back to Success Stories
        </Link>
      </div>

      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">Share Your Success Story</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg">Inspire others by showing how you overcame emotional and mental challenges.</p>
      </header>

      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Story Title</label>
            <input
              type="text"
              placeholder="e.g., Finding light after a year of isolation"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Your Journey / Experience</label>
            <textarea
              placeholder="Describe your struggle, the steps you took to improve, and how you feel now..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={8}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 resize-none leading-relaxed"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tags (comma separated)</label>
            <input
              type="text"
              placeholder="e.g., anxiety, depression, meditation"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="self-start rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 transition duration-200 mt-2"
          >
            {loading ? "Posting..." : "Post Success Story"}
          </button>
        </form>
        {err && <p className="mt-4 text-sm font-semibold text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 p-3 rounded-lg">{err}</p>}
      </section>
    </div>
  );
}
