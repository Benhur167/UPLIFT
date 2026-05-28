// src/pages/Home.js
import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API || "http://localhost:5000/api";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("uplift_user") || "null");
  } catch {
    return null;
  }
}

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

export default function Home() {
  const [story, setStory] = useState("");
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [expandedStories, setExpandedStories] = useState(new Set());
  const similarRef = useRef(null);

  const toggleExpandStory = (storyId) => {
    setExpandedStories(prev => {
      const next = new Set(prev);
      if (next.has(storyId)) {
        next.delete(storyId);
      } else {
        next.add(storyId);
      }
      return next;
    });
  };

  const handleShare = async (e) => {
    e.preventDefault();
    setErr("");

    const text = story.trim();
    if (!text) return setErr("Please write your story first.");

    const stored = getStoredUser();
    if (!stored || !stored.username) {
      return setErr("You must sign in before sharing. Please log in first.");
    }

    setLoading(true);
    try {
      const saveRes = await fetch(`${API_BASE}/stories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-username": stored.username,
        },
        body: JSON.stringify({
          username: stored.username,
          content: text,
          title: "Shared via dashboard",
          tags: [],
        }),
      });

      const saveJson = await saveRes.json().catch(() => null);
      if (!saveRes.ok) {
        const message =
          (saveJson && saveJson.message) ||
          saveRes.statusText ||
          "Failed to save story";
        throw new Error(message);
      }

      const res = await fetch(
        `${API_BASE}/stories/similar-success?q=${encodeURIComponent(text)}`
      );

      if (!res.ok) {
        const t = await res.text().catch(() => null);
        throw new Error(t || "Failed to fetch similar success stories");
      }

      const data = await res.json();
      setMatches(Array.isArray(data) ? data : []);

      setTimeout(() => {
        similarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (error) {
      console.error("handleShare error:", error);
      setErr(error?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/40 flex flex-col font-sans">
      {/* Hero Banner */}
      <section className="bg-gradient-to-b from-indigo-50/60 via-blue-50/30 to-slate-50/40 py-16 px-6 border-b border-slate-100">
        <div className="max-w-4xl mx-auto text-center">
          <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold tracking-wide uppercase">
            Your safe space
          </span>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 mt-4 leading-tight">
            Welcome to{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500">
              UPLIFT
            </span>
          </h1>
          <p className="text-slate-600 mt-3 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            We are here for you. Share your journey, read inspiring stories, chat with peers, or connect with our support team.
          </p>
        </div>
      </section>

      {/* Main Grid: Share + Quick Features */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 w-full flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Share Story Card (Left column: 5 cols wide) */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="bg-white border border-slate-100 shadow-xl shadow-slate-100/50 rounded-2xl p-6 flex flex-col h-full hover:shadow-2xl hover:shadow-slate-100/30 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Share Your Story</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">Your voice can inspire someone today</p>
                </div>
              </div>

              <form className="mt-5 flex flex-col gap-4 flex-1" onSubmit={handleShare}>
                <textarea
                  className="w-full flex-1 min-h-[160px] rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none p-3.5 text-xs text-slate-800 bg-slate-50/50 resize-none leading-relaxed transition-all"
                  placeholder="What is on your mind? Share your struggles, thoughts, or small wins..."
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  required
                  disabled={loading}
                />
                
                <div className="flex items-center justify-between mt-1">
                  {err ? (
                    <p className="text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-100 px-2.5 py-1.5 rounded-lg max-w-[65%] leading-relaxed truncate">
                      {err}
                    </p>
                  ) : (
                    <span className="text-[10px] text-slate-400">Anonymous & secure sharing</span>
                  )}
                  
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
                    disabled={loading}
                  >
                    {loading ? (
                      "Sharing..."
                    ) : (
                      <>
                        <span>Share Story</span>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Feature Hub Grid (Right column: 7 cols wide) */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Success Hub Card */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 w-fit">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.952 11.952 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-xs font-bold text-slate-800 mt-4">Success Stories</h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                  Read inspiring stories of others who conquered adversity, and share your triumphs to uplift the community.
                </p>
              </div>
              <div className="flex gap-2 mt-5">
                <a href="/post-success" className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold shadow-sm transition">
                  Share Success
                </a>
                <a href="/success" className="px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold transition">
                  Browse Gallery
                </a>
              </div>
            </div>

            {/* Peer Chat circles */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 w-fit">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                  </svg>
                </div>
                <h3 className="text-xs font-bold text-slate-800 mt-4">Community Circles</h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                  Join interactive peer chatrooms to discuss hobbies, share advice, and get support in real-time.
                </p>
              </div>
              <div className="mt-5">
                <a href="/community-chat" className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold shadow-sm transition block text-center">
                  Join Chat Rooms
                </a>
              </div>
            </div>

            {/* Help desk / care team */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 w-fit">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <h3 className="text-xs font-bold text-slate-800 mt-4">One-on-One Support</h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                  Connect privately with our support moderators. Request direct telephone calls or book professional psychiatrist sessions.
                </p>
              </div>
              <div className="mt-5">
                <a href="/support" className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold shadow-sm transition block text-center">
                  Get Private Support
                </a>
              </div>
            </div>

            {/* Resources list */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="p-2 rounded-xl bg-teal-50 text-teal-600 w-fit">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-xs font-bold text-slate-800 mt-4">Wellness Resources</h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                  Browse mindfulness guides, read helpful mental wellness articles, or explore scheduled workshops.
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-1.5 mt-5">
                <Link to="/resources/mindfulness" className="py-1.5 px-1 bg-teal-50 hover:bg-teal-100 text-teal-700 text-[9px] font-bold rounded text-center transition">
                  Mindful
                </Link>
                <Link to="/resources/articles" className="py-1.5 px-1 bg-teal-50 hover:bg-teal-100 text-teal-700 text-[9px] font-bold rounded text-center transition">
                  Articles
                </Link>
                <Link to="/resources/workshops" className="py-1.5 px-1 bg-teal-50 hover:bg-teal-100 text-teal-700 text-[9px] font-bold rounded text-center transition">
                  Workshops
                </Link>
              </div>
            </div>

          </div>
        </div>

        {/* Similar Success Stories */}
        {(loading || matches.length > 0 || err) && (
          <section className="mt-12 bg-white rounded-2xl border border-slate-100 shadow-sm p-6" ref={similarRef}>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Similar Success Stories</h2>
                <p className="text-[11px] text-slate-400">Handpicked stories of triumph that resemble your experience</p>
              </div>
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-8 justify-center py-6">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
                </span>
                Finding stories like yours...
              </div>
            )}
            
            {!loading && matches.length === 0 && !err && (
              <p className="text-xs text-slate-400 mt-8 text-center py-6">
                No similar success stories yet. You might be the first to inspire in this category!
              </p>
            )}

            <div className="grid gap-6 mt-6 sm:grid-cols-2 lg:grid-cols-3">
              {matches.map((s) => {
                const initials = String(s.username || "U").slice(0, 2).toUpperCase();
                const isExpanded = expandedStories.has(s._id);
                return (
                  <article 
                    key={s._id} 
                    className="bg-white rounded-xl border border-l-4 border-slate-100 border-l-emerald-500 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
                  >
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 leading-snug">{s.title || "Untitled"}</h3>
                      <p 
                        className={`text-slate-600 mt-2 text-xs leading-relaxed whitespace-pre-line cursor-pointer ${
                          isExpanded ? "" : "line-clamp-3"
                        }`}
                        onClick={() => toggleExpandStory(s._id)}
                      >
                        {s.content}
                      </p>
                      {s.content && s.content.length > 120 && (
                        <button
                          onClick={() => toggleExpandStory(s._id)}
                          className="text-left text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition mt-1 focus:outline-none block"
                        >
                          {isExpanded ? "Show less" : "Read more"}
                        </button>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-3 pt-3 border-t border-slate-50 mt-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${getAvatarColor(s.username || "anonymous")}`}>
                          {initials}
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium">by {s.username || "anonymous"}</span>
                      </div>
                      
                      {Array.isArray(s.tags) && s.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {s.tags.map((t, i) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-semibold">
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
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400 mt-12">
        <div className="flex justify-center gap-4 mb-2">
          <a href="/terms" className="hover:text-slate-600 transition">Terms of Service</a>
          <span>&middot;</span>
          <a href="/privacy" className="hover:text-slate-600 transition">Privacy Policy</a>
        </div>
        <p>&copy; 2026 UPLIFT. Uplifting you, one step at a time.</p>
      </footer>
    </div>
  );
}
