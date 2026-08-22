// src/pages/SuccessFeed.js
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API || "http://localhost:5000/api";

// Helper for dynamic persistent avatar colors
const getAvatarColor = (name) => {
  const colors = [
    "bg-rose-500", "bg-pink-500", "bg-purple-500", "bg-indigo-500",
    "bg-blue-500", "bg-cyan-500", "bg-teal-500", "bg-emerald-500",
    "bg-amber-500", "bg-orange-500"
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function SuccessFeed() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedStories, setExpandedStories] = useState(new Set());

  const toggleExpand = (id) => {
    setExpandedStories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const res = await fetch(`${API_BASE}/stories/success/latest`);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();
        setStories(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load success stories", e);
        setStories([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStories();
  }, []);

  const filteredStories = stories.filter((s) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const titleMatch = (s.title || "").toLowerCase().includes(term);
    const contentMatch = (s.content || "").toLowerCase().includes(term);
    const authorMatch = (s.username || "").toLowerCase().includes(term);
    const tagsMatch = Array.isArray(s.tags) && s.tags.some(t => t.toLowerCase().includes(term));
    return titleMatch || contentMatch || authorMatch || tagsMatch;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 font-sans text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* Back Button */}
      <div className="mb-6">
        <Link to="/" className="inline-flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition">
          &larr; Back to Home
        </Link>
      </div>

      <header className="mb-8 text-center sm:text-left">
        <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 leading-tight">Success Stories</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm sm:text-base max-w-xl">Real stories of overcoming emotional and personal struggles. Browse and find inspiration.</p>
      </header>

      {/* Search Input */}
      <div className="max-w-md mb-8 relative">
        <input
          type="text"
          placeholder="Search success stories by topic, keyword, or tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-750 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm transition"
        />
        <svg
          className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs font-semibold">Loading stories...</div>
      ) : filteredStories.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm p-8 text-slate-400 dark:text-slate-500 text-xs font-medium">
          {searchTerm ? "No matching success stories found." : "No success stories yet. Be the first to share your journey!"}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStories.map((s) => {
            const initials = String(s.username || "U").slice(0, 2).toUpperCase();
            return (
              <article 
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm p-5 hover:shadow-md transition flex flex-col justify-between" 
                key={s._id}
              >
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug mb-3">{s.title || "Untitled"}</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed mb-2 whitespace-pre-line">
                    {s.content && s.content.length > 200 && !expandedStories.has(s._id)
                      ? `${s.content.slice(0, 200)}...`
                      : s.content}
                  </p>
                  {s.content && s.content.length > 200 && (
                    <button
                      onClick={() => toggleExpand(s._id)}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 mb-3 transition focus:outline-none"
                    >
                      {expandedStories.has(s._id) ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>
                
                <div className="flex flex-col gap-3 pt-3 border-t border-slate-50 dark:border-slate-800 mt-auto">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${getAvatarColor(s.username || "anonymous")}`}>
                      {initials}
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">by {s.username || "anonymous"}</span>
                  </div>

                  {Array.isArray(s.tags) && s.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {s.tags.map((t, i) => (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-450 text-[9px] font-semibold" key={i}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
