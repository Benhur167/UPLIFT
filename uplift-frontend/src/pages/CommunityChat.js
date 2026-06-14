// src/pages/CommunityChat.js
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL;
const API_BASE = process.env.REACT_APP_API || "http://localhost:5000/api";


// Single socket instance (autoConnect: false -> we connect when ready)
const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  withCredentials: true
});

// debug listeners (global)
socket.on("connect", () => console.log("✅ socket connected", socket.id));
socket.on("connect_error", (err) => console.error("❌ socket connect_error", err && err.message));
socket.on("disconnect", (reason) => console.warn("⚠️ socket disconnected", reason));

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("uplift_user") || "null"); } catch { return null; }
}
function normalizeMsg(m) {
  if (!m) return null;
  const id = m._id || m.id || m.clientId || String(Math.random());
  const sender = m.sender || m.username || m.createdBy || "anonymous";
  const avatar = m.avatar || m.userAvatar || null;
  const text = m.text || m.message || m.content || "";
  const createdAt = m.createdAt || m.timestamp || new Date().toISOString();
  const clientId = m.clientId || null;
  const roomId = m.roomId || m.room || null;
  return { _id: id, clientId, roomId, sender, avatar, text, createdAt };
}
function makeClientId() {
  return `c_${Date.now()}_${Math.floor(Math.random()*900000)}`;
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

export default function CommunityChat() {
  const { state } = useLocation();
  const params = useParams();
  const navigate = useNavigate();
  const communityFromState = state?.community;

  const [community, setCommunity] = useState(communityFromState || null);
  const [membersCount, setMembersCount] = useState(communityFromState?.members?.length || 0);
  const [messages, setMessages] = useState([]); // normalized msgs
  const [msg, setMsg] = useState("");
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const chatEndRef = useRef(null);
  const typingTimer = useRef(null);
  const joinedRef = useRef(false);

  const storedUser = getStoredUser();
  const username = storedUser?.username || null;
  const myAvatar = storedUser?.avatar || null;

  // load community by id if not passed via state
  useEffect(() => {
    const id = params.id || communityFromState?._id;
    if (!id) {
      setError("No community selected.");
      return;
    }
    if (communityFromState) {
      setCommunity(communityFromState);
      setMembersCount(communityFromState.members?.length || 0);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/communities/${id}`);
        if (!res.ok) throw new Error(`Failed to load community (${res.status})`);
        const data = await res.json();
        setCommunity(data);
        setMembersCount(data.members?.length || 0);
      } catch (e) {
        console.error(e);
        setError(e.message || "Could not load community.");
      }
    })();
  }, [params.id, communityFromState]);

  // join room, ensure socket connected, load history, attach socket listeners
  useEffect(() => {
    if (!community || !username) return;

    const roomId = community._id;
    let mounted = true;

    // message handler: replace optimistic (clientId) or append, avoid duplicates
    const onMessage = (m) => {
      const n = normalizeMsg(m);
      if (!n) return;
      // ensure it's for this room (server may broadcast globally in some configs)
      if (n.roomId && n.roomId !== roomId) return;

      setMessages(prev => {
        // If server saved message includes clientId (echo), replace optimistic message
        if (n.clientId) {
          const tempIdx = prev.findIndex(x => x._id === n.clientId);
          if (tempIdx !== -1) {
            const next = prev.slice();
            next[tempIdx] = n;
            return next;
          }
        }

        // avoid duplicates by _id
        if (prev.some(x => x._id === n._id)) return prev;

        // append and sort by createdAt to keep order safe
        const next = [...prev, n];
        next.sort((a,b)=>new Date(a.createdAt) - new Date(b.createdAt));
        return next;
      });
    };

    // typing handler
    const onTyping = ({ roomId: r, user, typing }) => {
      if (r !== roomId) return;
      setTypingUsers(prev => {
        const next = new Set(prev);
        if (typing) next.add(user); else next.delete(user);
        return next;
      });
    };

    // community update handler
    const onCommunityUpdated = ({ roomId: r, members, membersCount: mc }) => {
      if (r !== roomId) return;
      if (Array.isArray(members)) setCommunity(prev => ({ ...(prev||{}), members }));
      if (typeof mc === "number") setMembersCount(mc);
    };

    async function setup() {
      setLoading(true);
      try {
        if (joinedRef.current) {
          setLoading(false);
          return;
        }
        joinedRef.current = true;

        // REST join (idempotent)
        const joinRes = await fetch(`${API_BASE}/communities/${roomId}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-username": username },
          body: JSON.stringify({})
        });
        if (!joinRes.ok) {
          const txt = await joinRes.text().catch(()=>null);
          throw new Error(`Join failed (${joinRes.status}) ${txt||''}`);
        }
        const joinJson = await joinRes.json().catch(()=>null);
        const updatedMembers = joinJson?.members || community.members || [];
        if (mounted) {
          setCommunity(prev => ({ ...(prev||{}), members: updatedMembers }));
          setMembersCount(updatedMembers.length);
        }

        // Ensure socket connected before emitting join
        if (!socket.connected) {
          socket.connect();
          // wait for connect or short fallback
          await new Promise((resolve) => {
            let done = false;
            const onConn = () => { if (!done) { done = true; resolve(); } };
            const onErr = () => { if (!done) { done = true; resolve(); } };
            socket.once("connect", onConn);
            socket.once("connect_error", onErr);
            setTimeout(() => { if (!done) { done = true; resolve(); } }, 2000);
          });
        }

        // Emit joinRoom with username/avatar
        socket.emit("joinRoom", { roomId, username, avatar: myAvatar });

        // fetch message history (no-cache)
        const msgRes = await fetch(`${API_BASE}/messages/${roomId}`, { cache: "no-store" });
        if (!msgRes.ok) {
          const t = await msgRes.text().catch(() => null);
          throw new Error(`Messages fetch failed (${msgRes.status}) ${t || ""}`);
        }
        const raw = await msgRes.json().catch(()=>[]);
        const msgs = Array.isArray(raw) ? raw : (raw.messages || []);
        const normalized = (msgs || []).map(normalizeMsg).filter(Boolean);
        setMessages(normalized);
      } catch (e) {
        console.error("Chat setup error", e);
        setError(e.message || "Failed to setup chat");
        joinedRef.current = false;
      } finally {
        setLoading(false);
      }
    }

    // attach listeners
    socket.on("chatMessage", onMessage);
    socket.on("typing", onTyping);
    socket.on("communityUpdated", onCommunityUpdated);

    // run setup
    setup();

    return () => {
      mounted = false;
      socket.off("chatMessage", onMessage);
      socket.off("typing", onTyping);
      socket.off("communityUpdated", onCommunityUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [community, username]);

  // scroll to bottom on messages change
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typingUsers]);

  // emit typing (debounced pattern controlled in handleTyping)
  const emitTyping = useCallback((isTyping) => {
    if (!community || !username) return;
    if (!socket.connected) return;
    try { socket.emit("typing", { roomId: community._id, user: username, typing: !!isTyping }); } catch (e) { console.warn("emitTyping error", e); }
  }, [community, username]);

  const handleTyping = (v) => {
    setMsg(v);
    if (!community || !username) return;
    emitTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 800);
  };

  // send message with optimistic update and clientId for replacement
  const handleSend = async (e) => {
    e.preventDefault();
    if (!msg.trim() || !community || !username) return;
    const text = msg.trim();
    const clientId = makeClientId();
    const temp = { _id: clientId, clientId, roomId: community._id, sender: username, avatar: myAvatar || null, text, createdAt: new Date().toISOString() };

    // optimistic append
    setMessages(prev => [...prev, temp]);
    setMsg("");
    emitTyping(false);

    // emit via socket if connected (server will persist and broadcast back including clientId)
    if (socket.connected) {
      try {
        socket.emit("chatMessage", { roomId: community._id, sender: username, avatar: myAvatar, text, clientId });
        return;
      } catch (e) {
        console.warn("socket emit failed, falling back to REST", e);
      }
    }

    // fallback - POST to REST endpoint that saves message and broadcasts
    try {
      const res = await fetch(`${API_BASE}/messages/save-fallback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: community._id, sender: username, avatar: myAvatar, text, clientId })
      });
      if (!res.ok) console.warn("fallback save failed", res.status);
    } catch (e) {
      console.error("fallback save exception", e);
    }
  };

  // group consecutive messages by sender for rendering
  const grouped = [];
  for (let i = 0; i < messages.length; ) {
    const cur = messages[i];
    const senderName = cur.sender || "anonymous";
    const group = { sender: senderName, avatar: cur.avatar || null, items: [cur] };
    let j = i + 1;
    while (j < messages.length && (messages[j].sender || "anonymous") === senderName) {
      group.items.push(messages[j]); j++;
    }
    grouped.push(group);
    i += group.items.length;
  }

  // UI
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 p-8">
        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 rounded-full text-rose-500 mb-3 shadow-inner">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">Connection Error</h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[240px] text-center mt-1 leading-normal">
          {error}
        </p>
        <button
          onClick={() => { setError(""); window.location.reload(); }}
          className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!community && loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
        <div className="relative w-10 h-10 mb-4">
          <div className="absolute inset-0 border-4 border-indigo-200 dark:border-indigo-950/50 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="text-xs font-semibold">Loading community space...</p>
      </div>
    );
  }

  if (!community) return <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-550">Loading community...</div>;

  return (
    <div className="flex bg-slate-50 dark:bg-slate-950 font-sans w-full" style={{ height: "calc(100vh - 69px)" }}>
      {/* Left Sidebar - Details & Members */}
      <div className="w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 h-full hidden lg:flex flex-shrink-0">
        {/* Community Info */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col items-center flex-shrink-0">
          <div className="bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold text-lg w-16 h-16 rounded-2xl flex items-center justify-center shadow-md mb-4">
            {(community.name || "??").slice(0, 2).toUpperCase()}
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 text-center px-2 truncate w-full">
            {community.name}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center mt-2 leading-relaxed max-h-24 overflow-y-auto px-1">
            {community.description || "Welcome to our supportive space. Let's grow together!"}
          </p>
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 rounded-full mt-3 w-fit">
            {membersCount} members
          </span>
        </div>

        {/* Rules section */}
        {Array.isArray(community.rules) && community.rules.length > 0 && (
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 max-h-48 overflow-y-auto">
            <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">
              Community Rules
            </h4>
            <ol className="list-decimal list-inside space-y-1.5">
              {community.rules.map((rule, idx) => (
                <li key={idx} className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                  {rule}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Member list section */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Room Members
          </h4>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
          {Array.isArray(community.members) && community.members.length > 0 ? (
            community.members.map((m, i) => {
              const initials = String(m || "U").slice(0, 2).toUpperCase();
              return (
                <div key={i} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-950 transition duration-150">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] text-white shadow-sm flex-shrink-0 ${getAvatarColor(m || "anonymous")}`}>
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{m}</p>
                  </div>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                </div>
              );
            })
          ) : (
            <div className="text-center text-[11px] text-slate-400 dark:text-slate-500 py-6">No members here yet.</div>
          )}
        </div>

        {/* Leave button */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
          <button
            onClick={() => navigate('/community-chat')}
            className="w-full py-2 bg-slate-50 dark:bg-slate-950 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-800 hover:border-rose-100 dark:hover:border-rose-900/50 font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2"
          >
            <span>🚪</span> Leave Room
          </button>
        </div>
      </div>

      {/* Right Panel - Chat Workspace */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        {/* Chat Header */}
        <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-6 flex items-center justify-between shadow-sm z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/community-chat')}
              className="lg:hidden p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition mr-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xs text-white shadow-sm flex-shrink-0">
              {(community.name || "??").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                {community.name}
              </h3>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">{membersCount} members</span>
              </div>
            </div>
          </div>

          {/* Current User Badge */}
          {username && (
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1">
              <div className={`w-5 h-5 rounded-full ${getAvatarColor(username)} flex items-center justify-center text-[9px] font-bold text-white shadow-sm`}>
                {String(username).slice(0, 1).toUpperCase()}
              </div>
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[80px]">
                {username}
              </span>
            </div>
          )}
        </header>

        {/* Messages list */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-4 bg-slate-50/50 dark:bg-slate-950/50">
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
              <svg className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-2 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-xs">No messages yet. Say hello to get started!</p>
            </div>
          ) : (
            grouped.map((g, idx) => {
              const isMe = g.sender === username;
              const initials = String(g.sender || "U").slice(0, 1).toUpperCase();

              return (
                <div
                  key={idx}
                  className={`flex items-start gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}
                >
                  {/* Sender Avatar */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm flex-shrink-0 ${
                      isMe ? "bg-indigo-600" : getAvatarColor(g.sender || "user")
                    }`}
                    style={isMe ? { backgroundColor: "#4f46e5" } : {}}
                  >
                    {initials}
                  </div>

                  <div className={`max-w-[70%] ${isMe ? "text-right" : ""}`}>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium px-1 block mb-0.5">
                      {g.sender}
                    </span>
                    <div className="space-y-1 inline-flex flex-col items-end">
                      {g.items.map(it => (
                        <div
                          key={it._id || Math.random()}
                          className={`px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-sm block text-left ${
                            isMe
                              ? "bg-indigo-600 text-white rounded-tr-none"
                              : "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{it.text}</p>
                          <span className={`text-[8px] block mt-1 text-right ${isMe ? "text-indigo-200" : "text-slate-400 dark:text-slate-500"}`}>
                            {new Date(it.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Typing Indicator */}
          {Array.from(typingUsers).length > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 italic px-2 py-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-full w-fit shadow-sm animate-pulse">
              <span className="flex gap-0.5">
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"></span>
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
              </span>
              <span>{Array.from(typingUsers).join(", ")} typing...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Message Input Form */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={msg}
              onChange={(e) => handleTyping(e.target.value)}
              placeholder={username ? "Write a message..." : "Sign in to chat"}
              disabled={!username}
              className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-550 transition"
            />
            <button
              type="submit"
              disabled={!username || !msg.trim()}
              className="h-8 px-4 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
