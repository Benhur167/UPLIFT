// src/pages/CreateCommunity.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

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
    <div className="dashboard-container">
      <header className="hero">
        <h1>Create a New Community</h1>
        <p>Give it a name, describe its purpose, and set some rules.</p>
      </header>

      <section className="panel">
        <form onSubmit={handleCreate} className="story-form">
          <input
            type="text"
            placeholder="Community Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input
            type="text"
            placeholder="Rules (comma separated)"
            value={rules}
            onChange={(e) => setRules(e.target.value)}
          />
          <button type="submit" className="btn primary">
            Create Community
          </button>
        </form>
        {err && <p className="error">{err}</p>}
      </section>
    </div>
  );
}
