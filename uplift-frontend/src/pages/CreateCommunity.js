// src/pages/CreateCommunity.js
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API || "http://localhost:5000/api";


export default function CreateCommunity() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  const handleCreate = async (e) => {
    e.preventDefault();
    setErr("");
    if (!name.trim()) return setErr("Community name is required");

    const stored = JSON.parse(localStorage.getItem("uplift_user") || "null");
    const username = stored?.username || stored?.user?.username;

    if (!username) {
      return setErr("You must be logged in to create a community.");
    }

    try {
      const res = await fetch(`${API_BASE}/communities`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-username": username
        },
        body: JSON.stringify({
          name,
          description,
          rules: rules.split(",").map((r) => r.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to create community");
      }
      navigate("/community-chat"); // go back after creation
    } catch (e) {
      console.error(e);
      setErr(e.message || "Failed to create community");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Back Button */}
      <div className="mb-6">
        <Link to="/community-chat" className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition">
          &larr; Back to Communities
        </Link>
      </div>

      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">Create a New Community</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg">Give it a name, describe its purpose, and set some guidelines for members.</p>
      </header>

      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 sm:p-8">
        <form onSubmit={handleCreate} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Community Name</label>
            <input
              type="text"
              placeholder="e.g., Support for Work Stress"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Description</label>
            <textarea
              placeholder="What is the purpose of this community? Who is it for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 resize-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Rules (comma separated)</label>
            <input
              type="text"
              placeholder="e.g., Be respectful, No spam, Maintain privacy"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            />
          </div>

          <button 
            type="submit" 
            className="self-start rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-700 transition duration-200 mt-2"
          >
            Create Community
          </button>
        </form>
        {err && <p className="mt-4 text-sm font-semibold text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 p-3 rounded-lg">{err}</p>}
      </section>
    </div>
  );
}
