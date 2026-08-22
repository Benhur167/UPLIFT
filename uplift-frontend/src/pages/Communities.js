// src/pages/Communities.js
import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import socket from "../socket";

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

export default function Communities() {
  const [activeTab, setActiveTab] = useState("public"); // "public", "dms", "requests"
  const [communities, setCommunities] = useState([]);
  const [loadingJoin, setLoadingJoin] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [membersModal, setMembersModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [customAlert, setCustomAlert] = useState(null); // { title, message, type: 'alert'|'confirm', onConfirm: fn }

  // DM States
  const [activeDms, setActiveDms] = useState([]);
  const [dmRequests, setDmRequests] = useState([]);
  const [recipientInput, setRecipientInput] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [loadingDms, setLoadingDms] = useState(false);

  const navigate = useNavigate();
  const stored = getStoredUser();
  const username = stored?.username || stored?.user?.username || null;

  // Toast notifications managed globally by Navbar

  // Fetch communities, DMs, and requests
  const fetchCommunities = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/communities`);
      if (!res.ok) throw new Error("Failed to load communities");
      const data = await res.json();
      setCommunities(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch communities", e);
      setCommunities([]);
      setError("Could not load communities. Server or database may be offline.");
    }
  }, []);

  const fetchDmsAndRequests = useCallback(async () => {
    if (!username) return;
    setLoadingDms(true);
    try {
      // 1. Fetch active accepted DMs
      const dmsRes = await fetch(`${API_BASE}/messages/dms/list`, {
        headers: { "x-username": username }
      });
      if (dmsRes.ok) {
        const dmsData = await dmsRes.json();
        setActiveDms(Array.isArray(dmsData) ? dmsData : []);
      } else {
        setActiveDms([]);
      }

      // 2. Fetch pending/all requests
      const reqRes = await fetch(`${API_BASE}/messages/dms/requests`, {
        headers: { "x-username": username }
      });
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setDmRequests(Array.isArray(reqData) ? reqData : []);
      } else {
        setDmRequests([]);
      }
    } catch (e) {
      console.error("Failed to fetch DMs/requests", e);
    } finally {
      setLoadingDms(false);
    }
  }, [username]);

  useEffect(() => {
    fetchCommunities();

    if (username) {
      fetchDmsAndRequests();
      // Register online
      socket.emit("joinUserRoom", { username });
    }

    // Socket handlers for community list
    const handleCommunityUpdate = ({ communityId, members }) => {
      setCommunities(prev =>
        prev.map(c => c._id === communityId ? { ...c, members: members || c.members } : c)
      );
    };

    // Socket handlers for DMs
    const handleIncomingRequest = (req) => {
      setDmRequests(prev => {
        if (prev.some(x => x._id === req._id)) return prev;
        return [req, ...prev];
      });
      setSuccess(`New chat request received from ${req.sender}!`);
      setTimeout(() => setSuccess(""), 4000);
    };

    const handleRequestResponse = (req) => {
      fetchDmsAndRequests();
    };

    const handleNewDm = (msg) => {
      // Refresh DM list and unread count badges dynamically
      fetchDmsAndRequests();
    };

    const handleOnlineStatus = ({ username: u, online }) => {
      setActiveDms(prev =>
        prev.map(d => d.partner === u ? { ...d, isOnline: online } : d)
      );
    };

    const handleDmTypingUpdate = ({ roomId, user, typing }) => {
      setActiveDms(prev =>
        prev.map(d => d.partner === user ? { ...d, isTyping: typing } : d)
      );
    };

    socket.on("communityUpdatedGlobal", handleCommunityUpdate);
    socket.on("incoming_dm_request", handleIncomingRequest);
    socket.on("dm_request_response", handleRequestResponse);
    socket.on("new_dm", handleNewDm);
    socket.on("userOnlineStatus", handleOnlineStatus);
    socket.on("dm_typing_update", handleDmTypingUpdate);

    return () => {
      socket.off("communityUpdatedGlobal", handleCommunityUpdate);
      socket.off("incoming_dm_request", handleIncomingRequest);
      socket.off("dm_request_response", handleRequestResponse);
      socket.off("new_dm", handleNewDm);
      socket.off("userOnlineStatus", handleOnlineStatus);
      socket.off("dm_typing_update", handleDmTypingUpdate);
    };
  }, [username, fetchCommunities, fetchDmsAndRequests, navigate]);

  const isMember = (comm) => {
    if (!username) return false;
    return Array.isArray(comm.members) && comm.members.includes(username);
  };

  const handleJoin = async (comm) => {
    setError("");
    if (!username) {
      setCustomAlert({
        title: "SignIn Required",
        message: "Please sign in to join community circles.",
        type: "alert",
        onConfirm: () => navigate("/signin")
      });
      return;
    }

    try {
      setLoadingJoin(comm._id);

      const res = await fetch(`${API_BASE}/communities/${comm._id}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-username": username
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
      setCommunities(prev => prev.map(c => c._id === comm._id ? { ...c, members: updatedMembers } : c));

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

  // Send DM connection request
  const handleSendDmRequest = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!recipientInput.trim()) return;

    setRequestLoading(true);
    try {
      const res = await fetch(`${API_BASE}/messages/dms/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-username": username
        },
        body: JSON.stringify({ recipient: recipientInput.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to send request");
      }

      setSuccess(`Connection request sent successfully to ${recipientInput.trim()}!`);
      setRecipientInput("");
      fetchDmsAndRequests();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to send request");
    } finally {
      setRequestLoading(false);
    }
  };

  // Respond to DM Request
  const handleRespondRequest = async (requestId, action) => {
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/messages/dms/request/${requestId}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-username": username
        },
        body: JSON.stringify({ action })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to respond");
      }

      setSuccess(`Request ${action === 'accept' ? 'accepted' : 'declined'} successfully.`);
      fetchDmsAndRequests();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to respond to request");
    }
  };

  const filteredCommunities = communities.filter((c) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const nameMatch = (c.name || "").toLowerCase().includes(term);
    const descMatch = (c.description || "").toLowerCase().includes(term);
    return nameMatch || descMatch;
  });

  const pendingIncoming = dmRequests.filter(r => r.recipient === username && r.status === 'pending');
  const pendingOutgoing = dmRequests.filter(r => r.sender === username && r.status === 'pending');
  const totalUnreadDms = activeDms.reduce((acc, d) => acc + (d.unreadCount || 0), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 font-sans text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* Header */}
      <header className="mb-8 text-center md:text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 leading-tight">Uplift Social Space</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm sm:text-base max-w-lg">
            Connect in community circles or engage in private messaging safely.
          </p>
        </div>

        {activeTab === "public" && (
          <Link 
            to="/community-create" 
            className="self-center md:self-start px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Circle</span>
          </Link>
        )}
      </header>

      {/* Error & Success Messages */}
      {error && (
        <div className="mb-6 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
          <span>⚠️ {error}</span>
        </div>
      )}
      {success && (
        <div className="mb-6 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-455 text-xs font-semibold flex items-center gap-2">
          <span>✅ {success}</span>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-8 gap-6">
        <button
          onClick={() => setActiveTab("public")}
          className={`pb-3 text-xs font-bold transition duration-150 border-b-2 px-1 ${
            activeTab === "public"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          🌐 Public Circles
        </button>

        {username && (
          <>
            <button
              onClick={() => setActiveTab("dms")}
              className={`pb-3 text-xs font-bold transition duration-150 border-b-2 px-1 flex items-center relative ${
                activeTab === "dms"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                  : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <span>💬 Direct Messages</span>
              {totalUnreadDms > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-rose-500 text-white font-bold text-[8px] rounded-full shadow-sm animate-bounce">
                  {totalUnreadDms}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("requests")}
              className={`pb-3 text-xs font-bold transition duration-150 border-b-2 px-1 relative ${
                activeTab === "requests"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                  : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              🤝 Connection Requests
              {pendingIncoming.length > 0 && (
                <span className="absolute -top-1.5 -right-3 px-1.5 py-0.5 bg-rose-500 text-white font-bold text-[8px] rounded-full">
                  {pendingIncoming.length}
                </span>
              )}
            </button>
          </>
        )}
      </div>

      {/* Tab Contents: Public Circles */}
      {activeTab === "public" && (
        <>
          {/* Search Input */}
          <div className="max-w-md mb-8 relative">
            <input
              type="text"
              placeholder="Search communities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm transition"
            />
            <svg
              className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

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
                  className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-sm flex-shrink-0 ${getAvatarColor(c.name || "Community")}`}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-snug">{c.name}</h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {c.description || "No description provided."}
                      </p>
                      <span className="inline-flex items-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-full mt-3">
                        {memberList.length} members
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-6 pt-3 border-t border-slate-50 dark:border-slate-800">
                    <button
                      onClick={() => showMembers(c)}
                      className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-bold transition flex-1 flex items-center justify-center gap-1.5"
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
        </>
      )}

      {/* Tab Contents: Direct Messages */}
      {activeTab === "dms" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 uppercase tracking-wider">Active Conversations</h2>

          {loadingDms && activeDms.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500">
              <div className="w-6 h-6 border-2 border-indigo-500 rounded-full border-t-transparent animate-spin mx-auto mb-2"></div>
              <p className="text-[11px]">Loading conversations...</p>
            </div>
          ) : activeDms.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 dark:text-slate-500">
              <span className="text-2xl block mb-2">💬</span>
              <p className="text-xs">No active private conversations yet.</p>
              <button
                onClick={() => setActiveTab("requests")}
                className="mt-3 px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg transition"
              >
                Connect with Users
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {activeDms.map((dm) => {
                const partnerInitials = String(dm.partner || "P").slice(0, 1).toUpperCase();
                const unread = dm.unreadCount > 0;

                return (
                  <div
                    key={dm.partner}
                    onClick={() => navigate(`/dm/${dm.partner}`)}
                    className="flex items-center justify-between py-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-3 rounded-xl transition duration-150 cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-sm ${getAvatarColor(dm.partner)}`}>
                          {partnerInitials}
                        </div>
                        <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900 ${dm.isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-350"}`}></span>
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <span>{dm.partner}</span>
                          {dm.isOnline && (
                            <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[8px] rounded-full uppercase tracking-wider">
                              online
                            </span>
                          )}
                        </h4>
                        
                        <p className={`text-[11px] mt-1 truncate ${unread ? "text-slate-900 dark:text-slate-100 font-extrabold" : "text-slate-400 dark:text-slate-500"}`}>
                          {dm.isTyping ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold italic animate-pulse">typing...</span>
                          ) : dm.lastMessage ? (
                            <span>
                              {dm.lastMessage.sender === username ? "You: " : ""}
                              {dm.lastMessage.text}
                            </span>
                          ) : (
                            <span className="italic">No messages yet. Send a hello!</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      {dm.lastMessage && (
                        <span className="text-[9px] text-slate-400 dark:text-slate-500">
                          {new Date(dm.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {unread && (
                        <span className="px-1.5 py-0.5 bg-rose-500 text-white font-bold text-[8px] rounded-full shadow-sm">
                          {dm.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Contents: DM Requests */}
      {activeTab === "requests" && (
        <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
          {/* Send connection request column */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm h-fit">
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-3 uppercase tracking-wider">Connect with User</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              Enter a registered username to send a DM request. Once accepted, you can securely message each other.
            </p>

            <form onSubmit={handleSendDmRequest} className="space-y-3">
              <input
                type="text"
                placeholder="Username..."
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                required
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 dark:bg-slate-955 text-slate-800 dark:text-slate-100 placeholder-slate-400"
              />
              <button
                type="submit"
                disabled={requestLoading || !recipientInput.trim()}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition"
              >
                {requestLoading ? "Sending..." : "Send Connection Request"}
              </button>
            </form>
          </div>

          {/* Pending lists columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Incoming Requests */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-4 uppercase tracking-wider flex items-center gap-2">
                <span>📩 Incoming Requests</span>
                {pendingIncoming.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 font-black text-[9px] rounded-full">
                    {pendingIncoming.length}
                  </span>
                )}
              </h2>

              {pendingIncoming.length === 0 ? (
                <p className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs font-semibold">No pending incoming requests.</p>
              ) : (
                <div className="space-y-3">
                  {pendingIncoming.map((req) => (
                    <div
                      key={req._id}
                      className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] text-white ${getAvatarColor(req.sender)}`}>
                          {String(req.sender).slice(0, 1).toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{req.sender} wants to connect</span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRespondRequest(req._id, "accept")}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg shadow-sm transition"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRespondRequest(req._id, "decline")}
                          className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 text-slate-600 dark:text-slate-400 dark:hover:text-rose-400 text-[10px] font-bold rounded-lg transition"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outgoing Requests */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-4 uppercase tracking-wider">📤 Sent Requests</h2>

              {pendingOutgoing.length === 0 ? (
                <p className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs font-semibold">No pending outgoing requests.</p>
              ) : (
                <div className="space-y-3">
                  {pendingOutgoing.map((req) => (
                    <div
                      key={req._id}
                      className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] text-white ${getAvatarColor(req.recipient)}`}>
                          {String(req.recipient).slice(0, 1).toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Request sent to {req.recipient}</span>
                      </div>

                      <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-bold text-[9px] rounded-full uppercase tracking-wider">
                        pending response
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Members Modal Overlay */}
      {membersModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-50 animate-fade-in">
          <div className="w-80 max-w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl p-5 flex flex-col max-h-[380px]">
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

      {/* Toast notification markup removed as it is now managed globally by NavBar */}

      {/* Custom Alert/Confirm dialog overlay */}
      {customAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl animate-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{customAlert.type === 'confirm' ? '❓' : '🔔'}</span>
              <h3 className="text-xs font-bold uppercase tracking-wider">{customAlert.title || 'System Notification'}</h3>
            </div>
            <p className="text-xs text-slate-650 dark:text-slate-350 leading-relaxed mb-5">
              {customAlert.message}
            </p>
            <div className="flex gap-2 justify-end">
              {customAlert.type === 'confirm' && (
                <button
                  onClick={() => setCustomAlert(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-205 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl transition"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => {
                  const onConfirm = customAlert.onConfirm;
                  setCustomAlert(null);
                  if (onConfirm) onConfirm();
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition"
              >
                {customAlert.type === 'confirm' ? 'Confirm' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
