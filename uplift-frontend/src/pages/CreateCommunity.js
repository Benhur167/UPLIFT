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

    try {
      await fetch(`${API_BASE}/communities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          rules: rules.split(",").map((r) => r.trim()).filter(Boolean),
          createdBy: "anonymous",
        }),
      });
      navigate("/community-chat"); // go back after creation
    } catch (e) {
      console.error(e);
      setErr("Failed to create community");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Back Button */}
      <div className="mb-6">
        <Link to="/community-chat" className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800 transition">
          &larr; Back to Communities
        </Link>
      </div>

      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900">Create a New Community</h1>
        <p className="text-slate-600 mt-2 text-lg">Give it a name, describe its purpose, and set some guidelines for members.</p>
      </header>

      <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 sm:p-8">
        <form onSubmit={handleCreate} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700">Community Name</label>
            <input
              type="text"
              placeholder="e.g., Support for Work Stress"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm bg-slate-50/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700">Description</label>
            <textarea
              placeholder="What is the purpose of this community? Who is it for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm bg-slate-50/50 resize-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700">Rules (comma separated)</label>
            <input
              type="text"
              placeholder="e.g., Be respectful, No spam, Maintain privacy"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm bg-slate-50/50"
            />
          </div>

          <button 
            type="submit" 
            className="self-start rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-700 transition duration-200 mt-2"
          >
            Create Community
          </button>
        </form>
        {err && <p className="mt-4 text-sm font-semibold text-red-600 bg-red-50 border border-red-100 p-3 rounded-lg">{err}</p>}
      </section>
    </div>
  );
}
