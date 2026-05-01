// src/pages/CommunityChat.js
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import "./CommunityChat.css";

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
      <div style={{ padding: 20 }}>
        <div style={{ color: "#b91c1c", marginBottom: 10 }}>Error: {error}</div>
        <button className="btn" onClick={() => { setError(""); window.location.reload(); }}>Retry</button>
      </div>
    );
  }
  if (!community) return <div style={{ padding: 20 }}>Loading community...</div>;

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div className="chat-header-left">
          <div className="community-dp-small">{(community.name || "??").slice(0,2).toUpperCase()}</div>
          <div>
            <h3 className="chat-title" style={{ color: "#0f172a" }}>{community.name}</h3>
            <div className="chat-sub">{membersCount} members</div>
          </div>
        </div>
        <div className="chat-header-right">
          {/* navigate back to community listing page */}
          <button className="btn" onClick={() => navigate('/community-chat')}>Back</button>
        </div>
      </header>

      <div className="chat-box" role="log" aria-live="polite">
        {grouped.map((g, idx) => {
          const isMe = g.sender === username;
          return (
            <div key={idx} className={`chat-group ${isMe ? 'me' : 'other'}`}>
              <div className="avatar">
                {g.avatar ? <img src={g.avatar.startsWith('http') ? g.avatar : `/${g.avatar}`} alt={g.sender} className="avatar-img" /> :
                  <div className="avatar-placeholder">{(g.sender||'U').slice(0,2).toUpperCase()}</div>}
              </div>
              <div className="bubble-col">
                <div className="sender-line"><strong className="sender-name">{g.sender}</strong></div>
                {g.items.map(it => (
                  <div key={it._id || Math.random()} className={`chat-message ${isMe ? 'me' : 'other'}`}>
                    <p className="chat-text">{it.text}</p>
                    <div className="chat-time">{new Date(it.createdAt).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {Array.from(typingUsers).length > 0 && (
          <div className="typing-indicator">
            {Array.from(typingUsers).join(", ")} typing…
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      <form className="chat-form" onSubmit={handleSend}>
        <input value={msg} onChange={(e) => handleTyping(e.target.value)} placeholder={username ? "Write a message..." : "Sign in to chat"} disabled={!username} />
        <button type="submit" className="btn send" disabled={!username || !msg.trim()}>Send</button>
      </form>
    </div>
  );
}
