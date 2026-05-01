// src/pages/SupportSession.js
import React, { useEffect, useState, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import "./SupportSession.css"; // keep your styles

const API = process.env.REACT_APP_API;
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL;

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("uplift_user") || "null");
  } catch {
    return null;
  }
}

export default function SupportSession() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const stored = getStoredUser();

  // Session and booking state (your existing fields)
  const [session, setSession] = useState(state?.session || null);
  const [loading, setLoading] = useState(false);
  const [callPhone, setCallPhone] = useState("");
  const [preferredAt, setPreferredAt] = useState("");
  const [booking, setBooking] = useState({
    psychiatristId: "",
    slotStart: "",
    slotEnd: "",
  });
  const [statusMsg, setStatusMsg] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);

  // Chat-specific state
  const [messages, setMessages] = useState([]); // { senderId, text, createdAt }
  const [text, setText] = useState("");
  const [adminOnline, setAdminOnline] = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);
  const [callRequested, setCallRequested] = useState(false);
  const [showChat, setShowChat] = useState(false); // NEW: toggle chat widget

  const socketRef = useRef(null);
  const messagesRef = useRef(null);
  const typingTimerRef = useRef(null);
  const notifyTypingTimerRef = useRef(null);

  const userId = stored?.user?.id || stored?.user?._id || stored?.username || "anonymous";

  // fetch session helper
  const fetchSession = async () => {
    try {
      const res = await fetch(`${API}/support/session/${id}`);
      if (!res.ok) throw new Error("failed to load");
      const data = await res.json();
      setSession(data);
      // seed messages if server returns them
      if (Array.isArray(data?.messages)) {
        setMessages(
          data.messages.map((m) => ({
            senderId: m.sender || m.senderId,
            text: m.text,
            createdAt: m.createdAt || m.created_at,
          }))
        );
      }
      if (data?.requestedCall) setCallRequested(true);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!id) {
      setStatusMsg("No session id provided.");
      return;
    }

    // initial fetch if state not provided
    if (!session) fetchSession();

    // setup socket
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      // join both legacy and new room names (server may expect joinRoom or join_support_session)
      socket.emit("joinRoom", { roomId: id, username: stored?.username || userId });
      socket.emit("join_support_session", { sessionId: id, userId });

      // announce presence for admins to see
      socket.emit("user_joined", { sessionId: id, userId });
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
      setAdminOnline(false);
    });

    // Incoming message (two possible event names handled)
    // replace your existing handleIncoming with this
    const handleIncoming = (payload) => {
      if (!payload) return;
      // filter by session
      if (payload.sessionId && String(payload.sessionId) !== String(id)) return;

      // debug
      console.log("📩 Incoming support:message", payload);

      setMessages((prev) => {
        console.log("📝 Current messages before update", prev);

        // 1) If server provides clientId -> find stub by clientId and replace it
        if (payload.clientId) {
          const idx = prev.findIndex(m => m.clientId && m.clientId === payload.clientId);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = {
              _id: payload._id || next[idx]._id,
              clientId: payload.clientId,
              senderId: payload.senderId ?? next[idx].senderId,
              senderName: payload.senderName ?? next[idx].senderName,
              text: payload.text ?? next[idx].text,
              createdAt: payload.createdAt ?? next[idx].createdAt
            };
            console.log("✅ Replaced optimistic stub by clientId:", next[idx]);
            return next;
          }
        }

        // 2) If server message has an _id that already exists in state -> ignore (duplicate)
        if (payload._id && prev.some(m => m._id && String(m._id) === String(payload._id))) {
          console.log("⚠️ Duplicate ignored (same _id)", payload._id);
          return prev;
        }

        // 3) If payload has clientId and a message with that clientId already exists -> ignore
        if (payload.clientId && prev.some(m => m.clientId && m.clientId === payload.clientId)) {
          console.log("⚠️ Duplicate ignored (same clientId)", payload.clientId);
          return prev;
        }

        // 4) Heuristic fallback: server didn't include clientId.
        //    Try to find a recent optimistic stub from this user with identical text and close timestamp.
        //    If found, replace it with the server canonical message to avoid double display.
        if (!payload.clientId) {
          // parse server createdAt (if string) to time number
          const serverTime = payload.createdAt ? new Date(payload.createdAt).getTime() : Date.now();
          // Find index of candidate stub: same sender (or same userId), same text, and created within 6s
          const heurIdx = prev.findIndex(m => {
            // only match optimistic stubs (they have clientId OR no _id)
            const isStub = !!m.clientId || !m._id;
            if (!isStub) return false;
            // sender match — prefer match to local userId
            const sameSender = (String(m.senderId) === String(payload.senderId)) || (String(m.senderId) === String(userId) && (payload.senderId == null || String(payload.senderId) === String(userId)));
            if (!sameSender) return false;
            // text equality
            if ((m.text || "").trim() !== (payload.text || "").trim()) return false;
            // time closeness (6 seconds)
            const localTime = m.createdAt ? new Date(m.createdAt).getTime() : 0;
            return Math.abs(serverTime - localTime) <= 6000;
          });

          if (heurIdx !== -1) {
            const next = [...prev];
            next[heurIdx] = {
              _id: payload._id || next[heurIdx]._id || `msg_fallback_${Date.now()}`,
              clientId: payload.clientId || next[heurIdx].clientId || null,
              senderId: payload.senderId || next[heurIdx].senderId,
              senderName: payload.senderName || next[heurIdx].senderName,
              text: payload.text || next[heurIdx].text,
              createdAt: payload.createdAt || next[heurIdx].createdAt || new Date().toISOString()
            };
            console.log("🔁 Heuristic replaced optimistic stub with server message:", next[heurIdx]);
            return next;
          }
        }

        // 5) No match — append normally
        console.log("➕ Appending new message", payload);
        return [...prev, {
          _id: payload._id,
          clientId: payload.clientId || null,
          senderId: payload.senderId,
          senderName: payload.senderName,
          text: payload.text,
          createdAt: payload.createdAt || new Date().toISOString()
        }];
      });

      scrollToBottom();
    };

    socket.on("support_message", handleIncoming);
    socket.on("support:message", handleIncoming);

    // Admin presence / typing
    socket.on("admin_joined", (p) => {
      if (p?.sessionId && String(p.sessionId) !== String(id)) return;
      setAdminOnline(true);
    });
    socket.on("admin_left", (p) => {
      if (p?.sessionId && String(p.sessionId) !== String(id)) return;
      setAdminOnline(false);
    });
    socket.on("admin_typing", (p) => {
      if (p?.sessionId && String(p.sessionId) !== String(id)) return;
      setAdminTyping(true);
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setAdminTyping(false), 1500);
    });

    // session updates from server
    socket.on("support:sessionUpdated", (payload) => {
      if (payload && String(payload._id) === String(id)) {
        setSession(payload);
        setStatusMsg("Session updated.");
      }
    });
    socket.on("support:callRequested", (payload) => {
      if (payload && String(payload.sessionId) === String(id)) {
        setStatusMsg("Call request received by support.");
        setCallRequested(true);
      }
    });
    socket.on("support:bookingCreated", (payload) => {
      if (payload && String(payload.sessionId) === String(id)) {
        setStatusMsg("Booking created.");
        fetchSession();
      }
    });

    // fetch historical messages if server provides a dedicated endpoint
    (async () => {
      try {
        const res = await fetch(`${API}/support/session/${id}/messages`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: stored?.token ? `Bearer ${stored.token}` : ""
          },
          credentials: "include"
        });

        if (res.ok) {
          const d = await res.json();
          if (Array.isArray(d.messages)) {
            setMessages(
              d.messages.map((m) => ({
                senderId: m.sender || m.senderId,
                text: m.text,
                createdAt: m.createdAt || m.created_at,
              }))
            );
            scrollToBottom();
          }
        }
      } catch {
        // ignore — not required
      }
    })();

    return () => {
      try {
        socket.emit("leave_support_session", { sessionId: id, userId });
      } catch (e) {}
      socket.disconnect();
      socketRef.current = null;
      clearTimeout(typingTimerRef.current);
      clearTimeout(notifyTypingTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // auto-scroll
  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    });
  };

  // send message
  const sendMessage = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    const payload = { sessionId: id, message: trimmed, senderId: userId };
    // emit both event name possibilities; server may handle one or the other
    try {
      socketRef.current?.emit("support_message", payload);
      socketRef.current?.emit("support:message", payload);
    } catch (e) {
      console.error("socket emit failed", e);
    }

    // optimistic UI
    setMessages((m) => [...m, { senderId: userId, text: trimmed, createdAt: new Date().toISOString() }]);
    setText("");
    scrollToBottom();

    // optional: persist via REST fallback (if socket down)
    if (!socketConnected) {
      (async () => {
        try {
          await fetch(`${API}/support/session/${id}/message`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-username": stored?.username },
            body: JSON.stringify({ text: trimmed }),
          });
        } catch (err) {
          console.error("fallback message save failed", err);
        }
      })();
    }
  };

  // notify server that user is typing (debounced)
  const notifyTyping = () => {
    try {
      if (!socketRef.current) return;
      socketRef.current.emit("user_typing", { sessionId: id, userId });
      // throttle typing emits so it's not spammy
      clearTimeout(notifyTypingTimerRef.current);
      notifyTypingTimerRef.current = setTimeout(() => {
        try {
          socketRef.current.emit("user_typing", { sessionId: id, userId, typing: false });
        } catch {}
      }, 900);
    } catch (e) {}
  };

  // existing call request (keeps x-username header to match your backend)
  const createCallRequest = async () => {
    if (!stored || !stored.username) {
      alert("Please sign in to request a call.");
      navigate("/signin");
      return;
    }
    if (!callPhone) {
      alert("Enter a phone number.");
      return;
    }
    setLoading(true);
    setStatusMsg("");
    try {
      const res = await fetch(`${API}/support/session/${id}/call-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-username": stored.username,
        },
        body: JSON.stringify({
          phone: callPhone,
          preferredAt: preferredAt || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message || "Call request failed");
      }
      const data = await res.json();
      setSession(data.session || session);
      setStatusMsg("Call requested. The team has been notified.");
      // broadcast to room if socket alive
      socketRef.current?.emit("support:callRequested", { sessionId: id });
      setCallRequested(true);
    } catch (e) {
      console.error(e);
      setStatusMsg(e.message || "Call request failed");
    } finally {
      setLoading(false);
    }
  };

  // booking flow (keeps your header usage)
  const createBooking = async () => {
    if (!stored || !stored.username) {
      alert("Please sign in to book.");
      navigate("/signin");
      return;
    }
    if (!booking.psychiatristId || !booking.slotStart || !booking.slotEnd) {
      alert("Choose psychiatrist and slot start/end.");
      return;
    }
    setLoading(true);
    setStatusMsg("");
    try {
      const res = await fetch(`${API}/support/session/${id}/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-username": stored.username,
        },
        body: JSON.stringify({
          psychiatristId: booking.psychiatristId,
          slotStart: booking.slotStart,
          slotEnd: booking.slotEnd,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message || "Booking failed");
      }
      const data = await res.json();
      setSession(data.session || session);
      setStatusMsg("Booking created. We'll confirm shortly.");
      // notify via socket
      socketRef.current?.emit("support:bookingCreated", { sessionId: id });
    } catch (e) {
      console.error(e);
      setStatusMsg(e.message || "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="support-session-page">
      <header className="hero">
        <h1>Support Session</h1>
        <p>
          Session ID: {id}{" "}
          {socketConnected ? (
            <span style={{ color: "#059669" }}>● live</span>
          ) : (
            <span style={{ color: "#c2410c" }}>● offline</span>
          )}
        </p>
      </header>

      <div style={{ maxWidth: 900, margin: "18px auto" }}>
        <div
          style={{
            background: "#fff",
            padding: 14,
            borderRadius: 8,
            boxShadow: "0 1px 4px rgba(2,6,23,0.04)",
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            {session?.userName ? `Requested by ${session.userName}` : "Your session"}
          </h3>
          <div style={{ color: "#475569", marginBottom: 8 }}>
            Status: <strong>{session?.status || "open"}</strong>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <div>
              <h4>Request a Call</h4>
              <input value={callPhone} onChange={(e) => setCallPhone(e.target.value)} placeholder="Phone number" />
              <input value={preferredAt} onChange={(e) => setPreferredAt(e.target.value)} type="datetime-local" />
              <div style={{ marginTop: 8 }}>
                <button className="btn primary" onClick={createCallRequest} disabled={loading}>
                  Request Call
                </button>
              </div>
            </div>

            <div>
              <h4>Book a Psychiatrist Session</h4>
              <select
                value={booking.psychiatristId}
                onChange={(e) => setBooking((b) => ({ ...b, psychiatristId: e.target.value }))}
              >
                <option value="">Choose therapist</option>
                <option value="doc-1">Dr. Anya N (Therapist)</option>
                <option value="doc-2">Dr. Samir R (Psychiatrist)</option>
              </select>
              <input
                type="datetime-local"
                value={booking.slotStart}
                onChange={(e) => setBooking((b) => ({ ...b, slotStart: e.target.value }))}
              />
              <input
                type="datetime-local"
                value={booking.slotEnd}
                onChange={(e) => setBooking((b) => ({ ...b, slotEnd: e.target.value }))}
              />
              <div style={{ marginTop: 8 }}>
                <button className="btn primary" onClick={createBooking} disabled={loading}>
                  Book Slot
                </button>
              </div>
            </div>
          </div>

          <hr style={{ margin: "12px 0" }} />

          <div>
  <h4>Session details</h4>

  <div style={{ fontSize: 14, color: "#334155" }}>
    <div>
      <strong>Created at:</strong>{" "}
      {session?.createdAt
        ? new Date(session.createdAt).toLocaleString()
        : "—"}
    </div>

    {/* --- Call Request Details --- */}
    <div style={{ marginTop: 10 }}>
      <strong>Call request:</strong>{" "}
      {session?.requestedCall ? (
        <div
          style={{
            background: "#f9fafb",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "8px 10px",
            marginTop: 6,
            lineHeight: 1.6,
          }}
        >
          <div><strong>Phone:</strong> {session.requestedCall.phone || "—"}</div>
          <div><strong>Status:</strong> {session.requestedCall.status || "pending"}</div>
          {session.requestedCall.preferredAt && (
            <div>
              <strong>Preferred Time:</strong>{" "}
              {new Date(session.requestedCall.preferredAt).toLocaleString()}
            </div>
          )}
          {session.requestedCall.adminAssigned && (
            <div><strong>Assigned to:</strong> {session.requestedCall.adminAssigned}</div>
          )}
          <div>
            <strong>Requested at:</strong>{" "}
            {new Date(session.requestedCall.createdAt).toLocaleString()}
          </div>
        </div>
      ) : (
        <span>None</span>
      )}
    </div>

    {/* --- Booking Details --- */}
    <div style={{ marginTop: 14 }}>
      <strong>Bookings:</strong>
      {Array.isArray(session?.bookings) && session.bookings.length > 0 ? (
        <div style={{ marginTop: 6 }}>
          {session.bookings.map((b, i) => (
            <div
              key={i}
              style={{
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "8px 10px",
                marginBottom: 8,
              }}
            >
              <div><strong>Psychiatrist:</strong> {b.psychiatristName || b.psychiatristId || "—"}</div>
              <div>
                <strong>From:</strong>{" "}
                {b.slotStart ? new Date(b.slotStart).toLocaleString() : "—"}
              </div>
              <div>
                <strong>To:</strong>{" "}
                {b.slotEnd ? new Date(b.slotEnd).toLocaleString() : "—"}
              </div>
              {b.status && (
                <div><strong>Status:</strong> {b.status}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 6, color: "#64748b" }}>No bookings yet.</div>
      )}
    </div>
  </div>
</div>


          {statusMsg && <div style={{ marginTop: 12, color: "#065f46" }}>{statusMsg}</div>}
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button className="btn secondary" onClick={() => navigate("/support")}>
            Back to Support
          </button>
          <button className="btn" onClick={fetchSession}>
            Refresh
          </button>
        </div>

        {/* Floating Chat Button + Chat Box */}
        <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 1000 }}>
          {!showChat ? (
            <button
              className="btn primary"
              onClick={() => setShowChat(true)}
              style={{ borderRadius: "50%", width: 60, height: 60, fontSize: 20 }}
              aria-label="Open chat with support"
            >
              💬
            </button>
          ) : (
            <div
              role="dialog"
              aria-label="Support chat"
              style={{
                width: 340,
                height: 460,
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: 8,
                boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid #eee",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <strong>Support Chat</strong>
                <div style={{ fontSize: 12, color: "#475569", flex: 1, textAlign: "center" }}>
                  {adminOnline ? <span style={{ color: "#059669" }}>Admin online</span> : <span>Admin offline</span>}
                  {adminTyping && <span style={{ marginLeft: 8, fontStyle: "italic" }}>typing…</span>}
                </div>
                <button onClick={() => setShowChat(false)} aria-label="Close chat" style={{ marginLeft: 8 }}>
                  ✕
                </button>
              </div>

              <div
                ref={messagesRef}
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: 10,
                  background: "#fafafa",
                }}
              >
                {messages.length === 0 && <div style={{ color: "#666" }}>No messages yet. Say hi 👋</div>}
                {messages.map((m, i) => {
                  const mine = String(m.senderId) === String(userId);
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 8 }}>
                      <div
                        style={{
                          maxWidth: "75%",
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: mine ? "#DCF8C6" : "#fff",
                          boxShadow: "0 0 0 1px rgba(0,0,0,0.02)",
                        }}
                      >
                        <div style={{ fontSize: 14 }}>{m.text}</div>
                        <div style={{ fontSize: 11, color: "#888", marginTop: 6, textAlign: "right" }}>
                          {new Date(m.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={sendMessage} style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid #eee" }}>
                <input
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    notifyTyping();
                  }}
                  placeholder="Type your message…"
                  aria-label="Type your message"
                  style={{ flex: 1, padding: "10px 12px", borderRadius: 6, border: "1px solid #ddd" }}
                />
                <button className="btn primary" type="submit" aria-label="Send message">
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
