// src/pages/Communities.js
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

const API_BASE = "http://localhost:5000/api";
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL;
const socket = io(SOCKET_URL, { autoConnect: true, transports: ["websocket", "polling"] });

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("uplift_user") || "null");
  } catch {
    return null;
  }
}

export default function Communities() {
  const [communities, setCommunities] = useState([]);
  const [loadingJoin, setLoadingJoin] = useState(null); // id of community being joined
  const [error, setError] = useState("");
  const [membersModal, setMembersModal] = useState(null); // { name, members }
  const navigate = useNavigate();
  const stored = getStoredUser();

  useEffect(() => {
    let mounted = true;
    const fetchCommunities = async () => {
      try {
        const res = await fetch(`${API_BASE}/communities`);
        if (!res.ok) throw new Error("Failed to load communities");
        const data = await res.json();
        if (mounted) setCommunities(data || []);
      } catch (e) {
        console.error("Failed to fetch communities", e);
        if (mounted) setError("Could not load communities. Try again later.");
      }
    };
    fetchCommunities();

    // socket: live updates for community list
    const handler = ({ communityId, membersCount, members }) => {
      setCommunities(prev => prev.map(c => c._id === communityId ? ({ ...c, members: members || c.members }) : c));
    };
    socket.on("communityUpdatedGlobal", handler);

    return () => {
      mounted = false;
      socket.off("communityUpdatedGlobal", handler);
    };
  }, []);

  const isMember = (comm) => {
    if (!stored?.username) return false;
    return Array.isArray(comm.members) && comm.members.includes(stored.username);
  };

  const handleJoin = async (comm) => {
    setError("");
    const storedLocal = JSON.parse(localStorage.getItem("uplift_user") || "null");
    if (!storedLocal || !storedLocal.username) {
      alert("Please sign in to join a community.");
      navigate("/signin");
      return;
    }

    try {
      setLoadingJoin(comm._id);

      const res = await fetch(`${API_BASE}/communities/${comm._id}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-username": storedLocal.username
        },
        body: JSON.stringify({})
      });

      let json = null;
      if (res.status === 200) {
        json = await res.json().catch(() => null);
      } else if (res.status === 204) {
        const r2 = await fetch(`${API_BASE}/communities/${comm._id}`);
        json = await r2.json().catch(() => null);
      } else {
        const bad = await res.json().catch(() => null);
        throw new Error(bad?.message || res.statusText || "Join failed");
      }

      const updatedMembers = json?.members || comm.members || [];
      // update local list so UI updates immediately
      setCommunities(prev => prev.map(c => c._id === comm._id ? ({ ...c, members: updatedMembers }) : c));

      // navigate to community chat, pass community state
      const updatedCommunity = { ...comm, members: updatedMembers };
      navigate(`/community/${comm._id}`, { state: { community: updatedCommunity } });
    } catch (e) {
      console.error("join error", e);
      setError(e.message || "Failed to join community");
    } finally {
      setLoadingJoin(null);
    }
  };

  const handleEnter = (comm) => {
    navigate(`/community/${comm._id}`, { state: { community: comm } });
  };

  const showMembers = (comm) => {
    setMembersModal({ name: comm.name, members: comm.members || [] });
  };

  return (
    <div className="dashboard-container">
      <header className="hero">
        <h1>Welcome to Uplift Communities</h1>
        <p>Find your safe space to connect, belong, and grow together.</p>
      </header>

      <div style={{ display: "flex", justifyContent: "center", margin: "14px 0" }}>
        <Link to="/community-create" className="btn primary" style={{ padding: "8px 12px" }}>
          + Create a Community
        </Link>
      </div>

      {error && (
        <div style={{ color: "#b91c1c", textAlign: "center", marginBottom: 12 }}>{error}</div>
      )}

      <div className="community-list">
        {communities.length === 0 && !error && (
          <p style={{ textAlign: "center", color: "#475569" }}>No communities yet.</p>
        )}

        {communities.map((c) => {
          const joined = isMember(c);
          return (
            <div
              key={c._id}
              className="community-row"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: 10,
                marginBottom: 10,
                background: "#ffffff",
                boxShadow: "0 2px 8px rgba(12,18,30,0.04)",
                border: "1px solid #eef2f7",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img
                  src={c.avatar || c.dp || "logo.jpg"}
                  alt={c.name}
                  className="community-dp"
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 8,
                    objectFit: "cover",
                    border: "1px solid #e6eef7",
                  }}
                />
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{c.name}</h3>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                    {c.description || "No description provided."}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
                    {Array.isArray(c.members) ? c.members.length : (c.members || 0)} members
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  className="btn"
                  onClick={() => showMembers(c)}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 8,
                    background: "#f1f5f9",
                    border: "1px solid #e6eef7",
                  }}
                >
                  Members
                </button>

                {joined ? (
                  <button
                    className="btn success"
                    onClick={() => handleEnter(c)}
                    style={{ padding: "8px 12px", borderRadius: 8 }}
                  >
                    Enter
                  </button>
                ) : (
                  <button
                    className="btn success"
                    onClick={() => handleJoin(c)}
                    disabled={loadingJoin === c._id}
                    style={{ padding: "8px 12px", borderRadius: 8 }}
                  >
                    {loadingJoin === c._id ? "Joining…" : "Join"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Members modal */}
      {membersModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
            zIndex: 2000,
          }}
        >
          <div style={{ width: 340, background: "#fff", borderRadius: 10, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Members - {membersModal.name}</h3>
            <div style={{ maxHeight: 240, overflowY: "auto", marginTop: 8 }}>
              {membersModal.members.length === 0 && <div style={{ color: "#64748b" }}>No members yet</div>}
              {membersModal.members.map((m, i) => (
                <div key={i} style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>
                  {m}
                </div>
              ))}
            </div>
            <div style={{ textAlign: "right", marginTop: 12 }}>
              <button className="btn" onClick={() => setMembersModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
