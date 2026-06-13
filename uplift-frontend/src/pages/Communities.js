// src/pages/Communities.js
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

const API_BASE = process.env.REACT_APP_API || "http://localhost:5000/api";
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL;
const socket = io(SOCKET_URL, { autoConnect: true, transports: ["websocket", "polling"] });

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

export default function Communities() {
  const [communities, setCommunities] = useState([]);
  const [loadingJoin, setLoadingJoin] = useState(null); // id of community being joined
  const [error, setError] = useState("");
  const [membersModal, setMembersModal] = useState(null); // { name, members }
  const [searchTerm, setSearchTerm] = useState("");
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
    if (!isMember(comm)) {
      setError(`You must join the "${comm.name}" community to view its members.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => setError(""), 4000);
      return;
    }
    setMembersModal({ name: comm.name, members: comm.members || [] });
  };

  const filteredCommunities = communities.filter((c) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const nameMatch = (c.name || "").toLowerCase().includes(term);
    const descMatch = (c.description || "").toLowerCase().includes(term);
    return nameMatch || descMatch;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 font-sans text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* Header */}
      <header className="mb-8 text-center md:text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 leading-tight">Uplift Communities</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm sm:text-base max-w-lg">Find your safe space to connect, belong, share stories, and grow together.</p>
        </div>
        <Link 
          to="/community-create" 
          className="self-center md:self-start px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 animate-pulse-once"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          <span>Create Community</span>
        </Link>
      </header>

      {error && (
        <div className="mb-6 p-3 rounded-xl bg-rose-50 dark:bg-rose-955/30 border border-rose-100 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Search Input */}
      <div className="max-w-md mb-8 relative">
        <input
          type="text"
          placeholder="Search communities..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-750 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm transition"
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

      {/* Grid List */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {communities.length === 0 && !error && (
          <div className="col-span-full text-center py-12 text-slate-400 dark:text-slate-550 text-xs font-semibold">No communities active yet.</div>
        )}
        {communities.length > 0 && filteredCommunities.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400 dark:text-slate-550 text-xs font-semibold">No matching communities found.</div>
        )}

        {filteredCommunities.map((c) => {
          const joined = isMember(c);
          const memberList = c.members || [];
          const initials = String(c.name || "C").slice(0, 2).toUpperCase();

          return (
            <div
              key={c._id}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
            >
              <div className="flex items-start gap-4">
                {c.avatar || c.dp ? (
                  <img
                    src={c.avatar || c.dp}
                    alt={c.name}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-100 dark:border-slate-800 shadow-sm flex-shrink-0"
                  />
                ) : (
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-sm flex-shrink-0 ${getAvatarColor(c.name || "Community")}`}>
                    {initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-snug">{c.name}</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {c.description || "No description provided."}
                  </p>
                  <span className="inline-flex items-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full mt-3">
                    {memberList.length} members
                  </span>
                </div>
              </div>

              <div className="flex gap-2 mt-6 pt-3 border-t border-slate-50 dark:border-slate-800">
                <button
                  onClick={() => showMembers(c)}
                  className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-605 dark:text-slate-350 border border-slate-200 dark:border-slate-700 text-[10px] font-bold transition flex-1 flex items-center justify-center gap-1.5"
                >
                  {!joined && <span className="text-[11px] leading-none">🔒</span>}
                  <span>View Members</span>
                </button>

                {joined ? (
                  <button
                    onClick={() => handleEnter(c)}
                    className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold shadow-sm transition flex-1"
                  >
                    Enter Room
                  </button>
                ) : (
                  <button
                    onClick={() => handleJoin(c)}
                    disabled={loadingJoin === c._id}
                    className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold shadow-sm transition flex-1 disabled:opacity-50"
                  >
                    {loadingJoin === c._id ? "Joining..." : "Join Circle"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Members Modal Overlay */}
      {membersModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm z-50 animate-fade-in">
          <div className="w-80 max-w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl p-5 flex flex-col max-h-[380px] animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Members: {membersModal.name}</h3>
              <button 
                onClick={() => setMembersModal(null)}
                className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto py-3 space-y-1">
              {membersModal.members.length === 0 ? (
                <div className="text-center text-xs text-slate-400 dark:text-slate-500 py-6">No members yet</div>
              ) : (
                membersModal.members.map((m, i) => {
                  const initial = String(m || "U").slice(0, 1).toUpperCase();
                  return (
                    <div key={i} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${getAvatarColor(m || "anonymous")}`}>
                        {initial}
                      </div>
                      <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">{m}</span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-right">
              <button 
                className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-bold rounded-lg transition"
                onClick={() => setMembersModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
