// src/pages/SupportChat.js
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import "./SupportChat.css"; // copy community styles or make a small variant

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL;
const API_BASE = process.env.REACT_APP_API || "http://localhost:5000/api";


// single shared socket instance (don't auto connect)
const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  withCredentials: true,
});

socket.on("connect", () => console.log("✅ socket connected (support)", socket.id));
socket.on("connect_error", (err) => console.error("socket connect_error (support)", err && err.message));
socket.on("disconnect", (reason) => console.warn("socket disconnected (support)", reason));

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

export default function SupportChat() {
  const navigate = useNavigate();
  const stored = getStoredUser();
  const username = stored?.username || null;
  const myAvatar = stored?.avatar || null;

  const [messages, setMessages] = useState([]);
  const [msg, setMsg] = useState("");
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const chatEndRef = useRef(null);
  const typingTimer = useRef(null);
  const joinedRef = useRef(false);

  // support room is unique per user
  const roomId = username ? `support:${username}` : null;

  // ensure socket connected and joined
  useEffect(() => {
    if (!roomId || !username) {
      setError("Please sign in to chat with support.");
      return;
    }

    let mounted = true;

    const onMessage = (m) => {
      const n = normalizeMsg(m);
      if (!n) return;
      if (n.roomId && n.roomId !== roomId) return;
      setMessages(prev => {
        // replace optimistic if clientId present
        if (n.clientId) {
          const tempIndex = prev.findIndex(x => x._id === n.clientId);
          if (tempIndex !== -1) {
            const next = prev.slice();
            next[tempIndex] = n;
            return next;
          }
        }
        if (prev.some(x => x._id === n._id)) return prev;
        const next = [...prev, n];
        next.sort((a,b)=> new Date(a.createdAt) - new Date(b.createdAt));
        return next;
      });
    };

    const onTyping = ({ roomId: r, user, typing }) => {
      if (r !== roomId) return;
      setTypingUsers(prev => {
        const next = new Set(prev);
        if (typing) next.add(user); else next.delete(user);
        return next;
      });
    };

    async function setup() {
      setLoading(true);
      try {
        // connect socket if not connected
        if (!socket.connected) {
          socket.connect();
          // wait briefly for connect (non-blocking fallback)
          await new Promise(resolve => {
            let done = false;
            const onConn = () => { if (!done) { done = true; resolve(); } };
            const onErr = () => { if (!done) { done = true; resolve(); } };
            socket.once("connect", onConn);
            socket.once("connect_error", onErr);
            setTimeout(() => { if (!done) { done = true; resolve(); } }, 2000);
          });
        }

        // tell server to join user-support room
        socket.emit("joinRoom", { roomId, username, avatar: myAvatar });

        // load history via REST
        const res = await fetch(`${API_BASE}/messages/${encodeURIComponent(roomId)}`, { cache: "no-store" });
        if (!res.ok) {
          const t = await res.text().catch(()=>null);
          throw new Error(`Failed to fetch history (${res.status}) ${t||''}`);
        }
        const raw = await res.json().catch(()=>[]);
        const msgs = Array.isArray(raw) ? raw : (raw.messages || []);
        const normalized = (msgs || []).map(normalizeMsg).filter(Boolean);
        if (mounted) setMessages(normalized);
        joinedRef.current = true;
      } catch (e) {
        console.error("Support chat setup error", e);
        setError(e.message || "Failed to setup support chat");
        joinedRef.current = false;
      } finally {
        setLoading(false);
      }
    }

    socket.on("chatMessage", onMessage);
    socket.on("typing", onTyping);

    setup();

    return () => {
      mounted = false;
      socket.off("chatMessage", onMessage);
      socket.off("typing", onTyping);
      // don't disconnect global socket here; other pages may use it
    };
  }, [roomId, username, myAvatar]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typingUsers]);

  const emitTyping = useCallback((isTyping) => {
    if (!roomId || !username) return;
    if (!socket.connected) return;
    try { socket.emit("typing", { roomId, user: username, typing: !!isTyping }); } catch(e) { console.warn(e); }
  }, [roomId, username]);

  const handleTyping = (v) => {
    setMsg(v);
    if (!roomId || !username) return;
    emitTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 800);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!msg.trim() || !roomId || !username) return;
    const text = msg.trim();
    const clientId = makeClientId();
    const temp = { _id: clientId, clientId, roomId, sender: username, avatar: myAvatar||null, text, createdAt: new Date().toISOString() };

    setMessages(prev => [...prev, temp]);
    setMsg("");
    emitTyping(false);

    if (socket.connected) {
      try {
        socket.emit("chatMessage", { roomId, sender: username, avatar: myAvatar, text, clientId });
        return;
      } catch (e) {
        console.warn("socket emit failed, falling back", e);
      }
    }

    // fallback REST save
    try {
      const res = await fetch(`${API_BASE}/messages/save-fallback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, sender: username, avatar: myAvatar, text, clientId })
      });
      if (!res.ok) console.warn("fallback save failed", res.status);
    } catch (e) {
      console.error("fallback save exception", e);
    }
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div className="chat-header-left">
          <div className="community-dp-small">AS</div>
          <div>
            <h3 className="chat-title">Admin Support</h3>
            <div className="chat-sub">Private conversation with support</div>
          </div>
        </div>
        <div className="chat-header-right">
          <button className="btn" onClick={() => navigate('/home')}>Back</button>
        </div>
      </header>

      <div className="chat-box" role="log" aria-live="polite">
        {messages.map((m) => {
          const isMe = m.sender === username;
          return (
            <div key={m._id} className={`chat-group ${isMe ? 'me' : 'other'}`}>
              <div className="avatar">
                {m.avatar ? <img src={m.avatar.startsWith('http') ? m.avatar : `/${m.avatar}`} alt={m.sender} className="avatar-img"/> :
                  <div className="avatar-placeholder">{(m.sender||'U').slice(0,2).toUpperCase()}</div>}
              </div>
              <div className="bubble-col">
                <div className="sender-line"><strong className="sender-name">{m.sender}</strong></div>
                <div className={`chat-message ${isMe ? 'me' : 'other'}`}>
                  <p className="chat-text">{m.text}</p>
                  <div className="chat-time">{new Date(m.createdAt).toLocaleTimeString()}</div>
                </div>
              </div>
            </div>
          );
        })}

        {Array.from(typingUsers).length > 0 && (
          <div className="typing-indicator">{Array.from(typingUsers).join(", ")} typing…</div>
        )}

        <div ref={chatEndRef} />
      </div>

      <form className="chat-form" onSubmit={handleSend}>
        <input value={msg} onChange={(e)=>handleTyping(e.target.value)} placeholder={username ? "Message support..." : "Sign in to chat"} disabled={!username}/>
        <button type="submit" className="btn send" disabled={!username || !msg.trim()}>Send</button>
      </form>
    </div>
  );
}
