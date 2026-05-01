import React, { useEffect, useState, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import socket from "../lib/socket";

const API_BASE = process.env.REACT_APP_API || "http://localhost:5000/api";


export default function AdminSessionChat() {
  const { id } = useParams(); // session id
  const { state } = useLocation();
  const navigate = useNavigate();
  const sessionInfo = state?.session || null;

  const [session, setSession] = useState(sessionInfo || null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typingUsers, setTypingUsers] = useState(new Set());
  const chatEndRef = useRef(null);
  const typingTimer = useRef(null);

  const admin = (() => {
    try { return JSON.parse(localStorage.getItem("uplift_user") || "null"); } catch { return null; }
  })();
  const adminName = admin?.username || "admin";
  const adminAvatar = admin?.avatar || null;
  const token = admin?.token || null;

  // helper: call admin action endpoint
  const adminCallAction = async (sessionId, action, data = {}) => {
    try {
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      // x-username is used by some server code; include it for compatibility
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
      // update local session object
      if (d.requestedCall) setSession(prev => ({ ...(prev||{}), requestedCall: d.requestedCall }));
      return d;
    } catch (e) {
      console.error("adminCallAction failed", e);
      alert("Failed to update call status: " + (e.message || e));
    }
  };

  useEffect(() => {
    if (!id) return;

    if (!socket.connected) socket.connect();

    socket.emit("support:join", { sessionId: id, username: adminName, avatar: adminAvatar, role: 'admin' });

    (async () => {
      try {
        // fetch session to get requestedCall & messages if available
        const hdrs = { "Content-Type": "application/json", "x-username": adminName };
        if (token) hdrs.Authorization = `Bearer ${token}`;

        // fetch session details (if you have endpoint /api/support/session/:id)
        try {
          const sessRes = await fetch(`${API_BASE}/support/session/${id}`, { headers: hdrs });
          if (sessRes.ok) {
            const sess = await sessRes.json();
            setSession(sess);
          }
        } catch (e) {
          // ignore if not available; we'll rely on socket
          console.warn('could not fetch session details', e);
        }

        // fetch messages
        const res = await fetch(`${API_BASE}/support/session/${id}/messages`, { headers: hdrs });
        if (res.ok) {
          const data = await res.json();
          // if API returns { messages: [] } or array
          const list = Array.isArray(data) ? data : (data.messages || []);
          setMessages(list);
        } else {
          console.warn("failed to fetch support messages", res.status);
        }
      } catch (e) {
        console.error("error fetching support messages", e);
      }
    })();

    const onMsg = (m) => {
      setMessages(prev => {
        if (prev.some(x => String(x._id) === String(m._id))) return prev;
        return [...prev, m];
      });
    };
    const onCallUpdated = (payload) => {
      if (String(payload.sessionId) !== String(id)) return;
      setSession(prev => ({ ...(prev||{}), requestedCall: payload.requestedCall }));
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
      socket.off("support:message", onMsg);
      socket.off("support:typing", onTyping);
      socket.off("support:callUpdated", onCallUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, adminName, adminAvatar]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers, session]);

  function send(e) {
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
  }

  function handleTyping(v) {
    setText(v);
    if (!socket.connected) return;
    socket.emit("support:typing", { sessionId: id, userName: adminName, typing: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit("support:typing", { sessionId: id, userName: adminName, typing: false }), 900);
  }

  const rc = session?.requestedCall || null;

  return (
    <div className="admin-session-chat dashboard-container" style={{ padding: 12 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <button className="btn" onClick={() => navigate('/admin/support')}>Back</button>
          <strong style={{ marginLeft: 12 }}>{session?.userName || session?.user || "User"}</strong>
        </div>
      </header>

      {/* Call request block */}
      {rc && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700 }}>Call request</div>
              <div style={{ color: "#334155" }}>Phone: <a href={`tel:${rc.phone}`}>{rc.phone}</a></div>
              <div style={{ color: "#475569" }}>Preferred: {rc.preferredAt ? new Date(rc.preferredAt).toLocaleString() : "—"}</div>
              <div style={{ marginTop: 6 }}>Status: <strong>{rc.status}</strong> {rc.adminAssigned ? ` — ${rc.adminAssigned}` : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => adminCallAction(id, 'assign')}>Assign to me</button>
              <button className="btn" onClick={() => {
                const scheduledAt = prompt('Enter date/time (ISO or yyyy-mm-ddThh:mm):');
                if (scheduledAt) adminCallAction(id, 'schedule', { scheduledAt });
              }}>Mark scheduled</button>
              <button className="btn" onClick={() => {
                const notes = prompt('Notes (optional):');
                adminCallAction(id, 'complete', { notes });
              }}>Mark completed</button>
              <button className="btn" onClick={() => {
                if (!window.confirm('Cancel this call request?')) return;
                const notes = prompt('Reason (optional):');
                adminCallAction(id, 'cancel', { notes });
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="messages" style={{ maxHeight: "60vh", overflow: "auto", padding: 12, background: "#fff", borderRadius: 8 }}>
        {messages.map(m => (
          <div key={m._id} style={{ marginBottom: 10, display: "flex", flexDirection: m.senderType === "admin" ? "row-reverse" : "row", gap: 10 }}>
            <div style={{ minWidth: 40, textAlign: "center", color: "#0f172a", fontWeight: 700 }}>{(m.senderName || "U").slice(0,2).toUpperCase()}</div>
            <div style={{ maxWidth: "80%" }}>
              <div style={{ fontSize: 13, color: "#334155", fontWeight: 600 }}>{m.senderName}</div>
              <div style={{ padding: "8px 10px", background: m.senderType === "admin" ? "#dcfce7" : "#f8fafc", borderRadius: 8 }}>{m.text}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{new Date(m.createdAt).toLocaleString()}</div>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={send} style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input value={text} onChange={(e) => handleTyping(e.target.value)} placeholder="Type reply..." style={{ flex: 1, padding: 8 }} />
        <button type="submit" className="btn primary">Send</button>
      </form>

      {typingUsers.size > 0 && <div style={{ marginTop: 8, color: "#64748b" }}>{Array.from(typingUsers).join(", ")} typing…</div>}
    </div>
  );
}
