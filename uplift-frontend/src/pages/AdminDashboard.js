import React, { useEffect, useState, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import socket from "../lib/socket";

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

export default function AdminDashboard() {
  const { id } = useParams(); // selected session id (optional)
  const { state } = useLocation();
  const navigate = useNavigate();

  // Sidebar state
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const newSessionsRef = useRef(new Set()); // unread sessions

  // Active chat state
  const [sessionDetails, setSessionDetails] = useState(state?.session || null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typingUsers, setTypingUsers] = useState(new Set());
  const chatEndRef = useRef(null);
  const typingTimer = useRef(null);

  // Custom modal state to replace prompt/confirm dialogs
  const [actionModal, setActionModal] = useState(null); // { action, sessionId }
  const [modalDate, setModalDate] = useState("");
  const [modalNotes, setModalNotes] = useState("");

  const stored = (() => {
    try { return JSON.parse(localStorage.getItem("uplift_user") || "null"); } catch { return null; }
  })();
  const token = stored?.token || null;
  const adminName = stored?.username || stored?.user?.username || "admin";
  const adminAvatar = stored?.avatar || null;

  // Sync session details when sessions list updates and our active id is in it
  useEffect(() => {
    if (id && sessions.length > 0) {
      const match = sessions.find(s => String(s.sessionId) === String(id));
      if (match) {
        setSessionDetails(prev => ({
          ...prev,
          userName: match.userName,
          requestedCall: match.requestedCall,
          status: match.status,
        }));
      }
    }
  }, [id, sessions]);

  // 1. Global Sockets Effect (Runs once on mount)
  useEffect(() => {
    if (!socket.connected) socket.connect();
    socket.emit("joinAdminRoom", { token });

    const loadSessions = async () => {
      setLoading(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE}/support/sessions`, { headers });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data.sessions) ? data.sessions.map(s => ({
            sessionId: s._id || s.sessionId || s.id,
            userId: s.createdBy || s.userId,
            userName: s.userName || s.createdByName || s.user || 'anonymous',
            createdAt: s.createdAt || s.created_at || new Date().toISOString(),
            status: s.status || 'open',
            requestedCall: s.requestedCall || null,
            raw: s
          })) : [];
          setSessions(list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        }
      } catch (e) {
        console.warn('failed to fetch open sessions', e);
      } finally {
        setLoading(false);
      }
    };

    loadSessions();

    const onNew = (data) => {
      const item = {
        sessionId: data.sessionId || data._id || data.id,
        userId: data.userId || data.createdBy,
        userName: data.userName || data.user || 'anonymous',
        createdAt: data.createdAt || new Date().toISOString(),
        status: data.status || 'open',
        requestedCall: data.requestedCall || null,
        raw: data
      };

      setSessions(prev => {
        if (prev.some(s => String(s.sessionId) === String(item.sessionId))) return prev;
        return [item, ...prev];
      });

      if (document.hidden || window.location.pathname !== '/admin/support') {
        newSessionsRef.current.add(item.sessionId);
      }

      if (window.Notification && Notification.permission === "granted") {
        new Notification("New support request", { body: `${item.userName || 'Anonymous'} needs support` });
      } else if (window.Notification && Notification.permission !== "denied") {
        Notification.requestPermission().then((perm) => {
          if (perm === "granted") new Notification("New support request", { body: `${item.userName || 'Anonymous'} needs support` });
        });
      }
    };

    const onCallReq = (payload) => {
      setSessions(prev => {
        const exists = prev.find(s => String(s.sessionId) === String(payload.sessionId));
        if (exists) {
          return prev.map(s => String(s.sessionId) === String(payload.sessionId) ? { ...s, requestedCall: payload.requestedCall } : s);
        } else {
          return [{
            sessionId: payload.sessionId,
            userName: payload.userName || 'anonymous',
            createdAt: payload.createdAt || new Date().toISOString(),
            requestedCall: payload.requestedCall,
            status: 'open',
          }, ...prev];
        }
      });

      if (document.hidden || window.location.pathname !== '/admin/support') {
        newSessionsRef.current.add(payload.sessionId);
      }
    };

    const onCallUpdated = (payload) => {
      setSessions(prev => prev.map(s => String(s.sessionId) === String(payload.sessionId) ? { ...s, requestedCall: payload.requestedCall } : s));
    };

    socket.on("support:newSession", onNew);
    socket.on("support:callRequested", onCallReq);
    socket.on("support:callUpdated", onCallUpdated);

    return () => {
      socket.off("support:newSession", onNew);
      socket.off("support:callRequested", onCallReq);
      socket.off("support:callUpdated", onCallUpdated);
    };
  }, [token]);

  // 2. Active Session Sockets Effect (Runs when selected 'id' changes)
  useEffect(() => {
    if (!id) {
      setMessages([]);
      setSessionDetails(null);
      return;
    }

    if (!socket.connected) socket.connect();
    socket.emit("support:join", { sessionId: id, username: adminName, avatar: adminAvatar, role: 'admin' });

    let active = true;
    const hdrs = { "Content-Type": "application/json", "x-username": adminName };
    if (token) hdrs.Authorization = `Bearer ${token}`;

    const fetchSessionData = async () => {
      try {
        const sessRes = await fetch(`${API_BASE}/support/session/${id}`, { headers: hdrs });
        if (sessRes.ok && active) {
          const sess = await sessRes.json();
          setSessionDetails(sess);
        }
      } catch (e) {
        console.warn('could not fetch session details', e);
      }

      try {
        const res = await fetch(`${API_BASE}/support/session/${id}/messages`, { headers: hdrs });
        if (res.ok && active) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.messages || []);
          setMessages(list);
        }
      } catch (e) {
        console.error("error fetching support messages", e);
      }
    };

    fetchSessionData();

    const onMsg = (m) => {
      if (String(m.sessionId) !== String(id)) return;
      setMessages(prev => {
        if (prev.some(x => String(x._id) === String(m._id))) return prev;
        return [...prev, m];
      });
    };

    const onCallUpdated = (payload) => {
      if (String(payload.sessionId) !== String(id)) return;
      setSessionDetails(prev => ({ ...(prev || {}), requestedCall: payload.requestedCall }));
    };

    const onTyping = ({ sessionId, userName, typing }) => {
      if (String(sessionId) !== String(id)) return;
      setTypingUsers(prev => {
        const next = new Set(prev);
        if (typing) next.add(userName); else next.delete(userName);
        return next;
      });
    };

    socket.on("support:message", onMsg);
    socket.on("support:typing", onTyping);
    socket.on("support:callUpdated", onCallUpdated);

    return () => {
      active = false;
      socket.off("support:message", onMsg);
      socket.off("support:typing", onTyping);
      socket.off("support:callUpdated", onCallUpdated);
      setTypingUsers(new Set());
    };
  }, [id, adminName, adminAvatar, token]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers, sessionDetails]);

  // Action: Call control endpoints
  const adminCallAction = async (sessionId, action, data = {}) => {
    try {
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      headers["x-username"] = adminName;

      const res = await fetch(`${API_BASE}/support/session/${sessionId}/call-action`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action, ...data })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message || `status ${res.status}`);
      }
      const d = await res.json();
      if (d.requestedCall) {
        setSessionDetails(prev => ({ ...(prev || {}), requestedCall: d.requestedCall }));
        setSessions(prev => prev.map(s => String(s.sessionId) === String(sessionId) ? {
          ...s,
          requestedCall: d.requestedCall
        } : s));
      }
      return d;
    } catch (e) {
      console.error("adminCallAction failed", e);
      alert("Failed to update call status: " + (e.message || e));
    }
  };

  const send = (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    const payload = {
      sessionId: id,
      text: text.trim(),
      senderType: "admin",
      senderName: adminName,
      senderAvatar: adminAvatar
    };
    if (socket.connected) {
      socket.emit("support:message", payload);
      setText("");
    } else {
      console.warn("socket not connected — message not sent");
    }
  };

  const handleTyping = (v) => {
    setText(v);
    if (!socket.connected) return;
    socket.emit("support:typing", { sessionId: id, userName: adminName, typing: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit("support:typing", { sessionId: id, userName: adminName, typing: false }), 900);
  };

  const markRead = (sessionId) => {
    newSessionsRef.current.delete(sessionId);
    setSessions(prev => [...prev]);
  };

  const selectSession = (s) => {
    try {
      if (!socket.connected) socket.connect();
      socket.emit("support:join", { sessionId: s.sessionId, username: adminName, role: 'admin' });
    } catch (e) {
      console.warn('support:join emit failed', e);
    }
    markRead(s.sessionId);
    navigate(`/admin/support/${s.sessionId}`, { state: { session: s } });
  };

  const filteredSessions = sessions.filter(s =>
    String(s.userName || "anonymous").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const rc = sessionDetails?.requestedCall || null;

  return (
    <div className="flex bg-slate-50 font-sans" style={{ height: "calc(100vh - 69px)" }}>
      {/* Sidebar - Sessions list */}
      <div className={`w-80 border-r border-slate-200 flex flex-col bg-white h-full ${id ? "hidden md:flex" : "flex w-full md:w-80"}`}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-slate-800 tracking-tight">Support Sessions</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">{sessions.length} active sessions</p>
          </div>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>

        {/* Search */}
        <div className="p-3 flex-shrink-0">
          <div className="relative">
            <input
              type="text"
              placeholder="Search user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 placeholder-slate-400 transition"
            />
            <svg
              className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
          {loading && sessions.length === 0 ? (
            <div className="text-center text-xs text-slate-400 py-8">Loading sessions...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center text-xs text-slate-400 py-8 px-4">
              {searchTerm ? "No matching sessions" : "No active sessions yet"}
            </div>
          ) : (
            filteredSessions.map((s) => {
              const isSelected = String(s.sessionId) === String(id);
              const unread = newSessionsRef.current.has(String(s.sessionId));
              const initials = String(s.userName || "U").slice(0, 2).toUpperCase();

              return (
                <div
                  key={s.sessionId}
                  onClick={() => selectSession(s)}
                  className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all duration-150 group ${
                    isSelected
                      ? "bg-indigo-55 text-indigo-900 border-l-4 border-indigo-600 shadow-sm"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                  style={isSelected ? { backgroundColor: "#f0f4ff" } : {}}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] text-white shadow-sm flex-shrink-0 ${getAvatarColor(s.userName || "anonymous")}`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between">
                        <h4 className={`text-xs font-semibold truncate ${isSelected ? "text-indigo-900" : "text-slate-800"}`}>
                          {s.userName || "anonymous"}
                        </h4>
                        <span className="text-[9px] text-slate-400 flex-shrink-0 pl-1">
                          {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-[10px] text-slate-400 truncate pr-1">
                          ID: {s.sessionId.slice(-6)}
                        </p>
                        {s.requestedCall && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 flex-shrink-0 ${
                            s.requestedCall.status === "pending"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}>
                            📞 Call
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {unread && (
                    <span className="ml-2 w-2 h-2 bg-rose-500 rounded-full border border-white flex-shrink-0 shadow-sm animate-pulse"></span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Panel */}
      <div className={`flex-1 flex flex-col h-full bg-slate-50 ${!id ? "hidden md:flex" : "flex"}`}>
        {id ? (
          <>
            {/* Chat Header */}
            <header className="h-14 border-b border-slate-200 bg-white px-4 md:px-6 flex items-center justify-between shadow-sm z-10 flex-shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/admin/support')}
                  className="md:hidden p-1 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white ${getAvatarColor(sessionDetails?.userName || "anonymous")}`}
                >
                  {String(sessionDetails?.userName || "U").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 leading-tight">
                    {sessionDetails?.userName || "User"}
                  </h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[9px] text-slate-400 font-medium">Session Active</span>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400">
                Session ID: <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{id}</span>
              </div>
            </header>

            {/* Call Request Banner */}
            {rc && (
              <div className="bg-amber-50/60 border-b border-amber-100 px-4 md:px-6 py-3 flex-shrink-0 animate-fade-in">
                <div className="max-w-4xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 bg-amber-100 rounded-lg text-amber-700 mt-0.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Pending Call Request</div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-slate-600 text-[11px]">
                        <div>Phone: <a href={`tel:${rc.phone}`} className="text-indigo-600 font-semibold hover:underline">{rc.phone}</a></div>
                        <div>Preferred Time: <span className="font-medium text-slate-700">{rc.preferredAt ? new Date(rc.preferredAt).toLocaleString() : "As soon as possible"}</span></div>
                      </div>
                      <div className="mt-1 text-[11px]">
                        Status: <span className="font-bold text-amber-700 bg-amber-100/50 px-1.5 py-0.5 rounded text-[9px]">{rc.status}</span>
                        {rc.adminAssigned && <span className="text-slate-500 ml-2">Assigned to: <strong className="text-slate-700">{rc.adminAssigned}</strong></span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => adminCallAction(id, 'assign')}
                      className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded-md shadow-sm transition"
                    >
                      Assign to me
                    </button>
                    <button
                      onClick={() => {
                        setModalDate("");
                        setModalNotes("");
                        setActionModal({ action: 'schedule', sessionId: id });
                      }}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[10px] font-bold rounded-md shadow-sm transition"
                    >
                      Schedule
                    </button>
                    <button
                      onClick={() => {
                        setModalDate("");
                        setModalNotes("");
                        setActionModal({ action: 'complete', sessionId: id });
                      }}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-md shadow-sm transition"
                    >
                      Complete
                    </button>
                    <button
                      onClick={() => {
                        setModalDate("");
                        setModalNotes("");
                        setActionModal({ action: 'cancel', sessionId: id });
                      }}
                      className="px-2.5 py-1.5 bg-rose-50 border border-rose-100 text-rose-700 hover:bg-rose-100/40 text-[10px] font-bold rounded-md transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-4 bg-slate-50/50">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <svg className="w-12 h-12 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-xs">No messages yet. Send a greeting to start the conversation.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isAdminMsg = m.senderType === "admin";
                  const initial = String(m.senderName || "U").slice(0, 1).toUpperCase();

                  return (
                    <div
                      key={m._id || Math.random()}
                      className={`flex items-start gap-2.5 ${isAdminMsg ? "flex-row-reverse" : ""}`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm flex-shrink-0 ${
                          isAdminMsg ? "bg-indigo-600" : getAvatarColor(m.senderName || "user")
                        }`}
                      >
                        {initial}
                      </div>

                      <div className={`max-w-[70%] ${isAdminMsg ? "text-right" : ""}`}>
                        <span className="text-[9px] text-slate-400 font-medium px-1 block mb-0.5">
                          {m.senderName}
                        </span>
                        <div
                          className={`px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-sm inline-block text-left ${
                            isAdminMsg
                              ? "bg-indigo-600 text-white rounded-tr-none"
                              : "bg-white border border-slate-100 text-slate-800 rounded-tl-none"
                          }`}
                          style={isAdminMsg ? { backgroundColor: "#4f46e5" } : {}}
                        >
                          {m.text}
                        </div>
                        <span className="text-[8px] text-slate-400 block mt-0.5 px-1">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-3 border-t border-slate-200 bg-white">
              {typingUsers.size > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-slate-400 italic mb-1.5 px-1">
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"></span>
                    <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                  </span>
                  <span>{Array.from(typingUsers).join(", ")} typing...</span>
                </div>
              )}

              <form onSubmit={send} className="flex gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => handleTyping(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white text-slate-800 placeholder-slate-400 transition"
                />
                <button
                  type="submit"
                  disabled={!text.trim()}
                  className="h-8 px-4 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-3.5 h-3.5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-400 p-8">
            <div className="p-3 bg-indigo-50 rounded-full text-indigo-400 mb-3 shadow-inner">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-xs font-bold text-slate-700">No Session Selected</h3>
            <p className="text-[11px] text-slate-500 max-w-[240px] text-center mt-1 leading-normal">
              Select an active support session from the list on the left to start chatting with the user in real-time.
            </p>
          </div>
        )}
      </div>

      {/* Modern Dialog Modals */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-all duration-300 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden border border-slate-100 transition-all transform scale-100">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                {actionModal.action === 'schedule' && (
                  <>
                    <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">📅</span>
                    Schedule Support Call
                  </>
                )}
                {actionModal.action === 'complete' && (
                  <>
                    <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">✅</span>
                    Complete Support Call
                  </>
                )}
                {actionModal.action === 'cancel' && (
                  <>
                    <span className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">❌</span>
                    Cancel Support Call
                  </>
                )}
              </h3>
              <button
                onClick={() => setActionModal(null)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={async (e) => {
              e.preventDefault();
              const { action, sessionId } = actionModal;
              if (action === 'schedule') {
                if (!modalDate) return;
                await adminCallAction(sessionId, 'schedule', { scheduledAt: modalDate });
              } else if (action === 'complete') {
                await adminCallAction(sessionId, 'complete', { notes: modalNotes });
              } else if (action === 'cancel') {
                await adminCallAction(sessionId, 'cancel', { notes: modalNotes });
              }
              setActionModal(null);
            }} className="p-6 space-y-4">
              {actionModal.action === 'schedule' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Select Date and Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 placeholder-slate-400 transition"
                  />
                </div>
              )}

              {(actionModal.action === 'complete' || actionModal.action === 'cancel') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    {actionModal.action === 'complete' ? 'Completion Notes (optional)' : 'Reason for Cancellation (optional)'}
                  </label>
                  <textarea
                    rows={4}
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                    placeholder={actionModal.action === 'complete' ? "Describe outcome of the call..." : "Provide context for cancelling this request..."}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 placeholder-slate-400 transition resize-none"
                  />
                </div>
              )}

              {actionModal.action === 'cancel' && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex gap-2">
                  <span className="text-rose-600 text-sm mt-0.5">⚠️</span>
                  <p className="text-[11px] text-rose-700 leading-normal text-left">
                    <strong>Are you sure?</strong> Cancelling this request will mark it as cancelled, and the user will see that it has been canceled.
                  </p>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl transition"
                >
                  Go Back
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-white text-xs font-bold rounded-xl shadow-sm transition ${
                    actionModal.action === 'schedule' ? 'bg-indigo-600 hover:bg-indigo-700' :
                    actionModal.action === 'complete' ? 'bg-emerald-600 hover:bg-emerald-700' :
                    'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  Confirm Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
