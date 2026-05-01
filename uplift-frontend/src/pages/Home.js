// src/pages/Home.js
import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API || "http://localhost:5000/api";


function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("uplift_user") || "null");
  } catch {
    return null;
  }
}

export default function Home() {
  const [story, setStory] = useState("");
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const similarRef = useRef(null);

  const handleShare = async (e) => {
    e.preventDefault();
    setErr("");

    const text = story.trim();
    if (!text) return setErr("Please write your story first.");

    const stored = getStoredUser();
    if (!stored || !stored.username) {
      return setErr("You must sign in before sharing. Go to Sign In.");
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

  const storedUser = getStoredUser();

  return (
      <div className="min-h-screen bg-blue-150 flex flex-col">   
      {/* Header */}
      <header className="bg-white shadow-sm px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome to Your Safe Space</h1>
            <p className="text-gray-600">We're here for you. Share, explore, connect.</p>
          </div>

          <div className="flex items-center gap-3">
            {storedUser ? (
              <>
                <span className="text-gray-700">Welcome, {storedUser.username}</span>
                <button
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
                  onClick={() => {
                    localStorage.removeItem("uplift_user");
                    window.location.reload();
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <a href="/signin" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">
                  Sign In
                </a>
                <a href="/signup" className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200 transition">
                  Sign Up
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Share Story */}
      <section className="max-w-3xl mx-auto mt-8 bg-white shadow-sm rounded-xl p-6">
        <h2 className="text-xl font-semibold text-gray-900">Share Your Story</h2>
        <p className="text-gray-600 mt-1">
          Your voice matters. Share your experiences, challenges, or achievements to inspire others.
        </p>

        <form className="mt-4 flex flex-col gap-3" onSubmit={handleShare}>
          <textarea
            className="w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none p-3 resize-none"
            rows={4}
            placeholder="What's on your mind?"
            value={story}
            onChange={(e) => setStory(e.target.value)}
            required
            disabled={loading}
          />
          <button
            type="submit"
            className="self-start px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
            disabled={loading}
          >
            {loading ? "Sharing…" : "Share"}
          </button>
        </form>

        {err && <p className="text-red-600 mt-3">{err}</p>}
      </section>

      {/* Quick Links */}
      <div className="flex justify-center gap-4 mt-6">
        <a href="/post-success" className="px-5 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition">
          Share a Success Story
        </a>
        <a href="/success" className="px-5 py-2 rounded-lg bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200 transition">
          View Success Stories
        </a>
      </div>

      {/* Explore + Community */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto mt-8">
        <section className="bg-white shadow-sm rounded-xl p-6">
          <h2 className="text-xl font-semibold text-gray-900">Explore Resources</h2>

            <div className="mt-4">
              <div className="max-w-3xl mx-auto">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Link
                    to="/resources/mindfulness"
                    className="w-full inline-flex items-center justify-center h-12 px-4 py-2 rounded-md bg-green-500 text-white font-medium shadow-sm hover:brightness-95 transition"
                  >
                    Mindfulness
                  </Link>

                  <Link
                    to="/resources/articles"
                    className="w-full inline-flex items-center justify-center h-12 px-4 py-2 rounded-md bg-green-500 text-white font-medium shadow-sm hover:brightness-95 transition"
                  >
                    Articles
                  </Link>

                  <Link
                    to="/resources/workshops"
                    className="w-full inline-flex items-center justify-center h-12 px-4 py-2 rounded-md bg-green-500 text-white font-medium shadow-sm hover:brightness-95 transition"
                  >
                    Workshops
                  </Link>
                </div>
              </div>
            </div>
        </section>

        <section className="bg-white shadow-sm rounded-xl p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900">Chat with the Community</h2>
          <p className="text-gray-600 mt-1">
            Connect with others who are here to listen, support, and share their own stories.
          </p>
          <a className="mt-4 inline-block px-5 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition" href="/community-chat">
            Join the Conversation
          </a>
          <div className="mt-3">
            <a className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition" href="/support">
              Get Support
            </a>
          </div>
        </section>
      </div>

      {/* Similar Success Stories */}
      {(loading || matches.length > 0 || err) && (
        <section className="max-w-5xl mx-auto mt-10 bg-white shadow-sm rounded-xl p-6" ref={similarRef}>
          <h2 className="text-xl font-semibold text-gray-900">Similar Success Stories</h2>

          {err && <p className="text-red-600 mt-2">{err}</p>}
          {loading && <p className="text-gray-500 mt-2">Finding stories like yours…</p>}
          {!loading && matches.length === 0 && !err && (
            <p className="text-gray-500 mt-2">No similar success stories yet. You might be the first to inspire!</p>
          )}

          <div className="grid gap-4 mt-4 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((s) => (
              <article key={s._id} className="bg-gray-50 rounded-lg border border-gray-200 p-4 hover:shadow transition">
                <h3 className="font-semibold text-gray-900">{s.title || "Untitled"}</h3>
                <p className="text-gray-600 mt-1">{s.content}</p>
                <div className="text-sm text-gray-500 mt-2">
                  <span>by {s.username || "anonymous"}</span>
                  {Array.isArray(s.tags) && s.tags.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {s.tags.map((t, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 text-xs">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="mt-12 bg-white border-t border-gray-200 py-6 text-center text-sm text-gray-500">
        <a href="/terms" className="hover:underline">Terms of Service</a> |{" "}
        <a href="/privacy" className="hover:underline">Privacy Policy</a>
        <p className="mt-2">&copy; 2025 UPLIFT. Uplifting you, one step at a time.</p>
      </footer>
    </div>
  );
}
