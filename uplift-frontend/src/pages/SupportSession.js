// src/pages/SupportSession.js
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

const API = process.env.REACT_APP_API;
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL;

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("uplift_user") || "null");
  } catch {
    return null;
  }
}

// Predefined hourly time slots
const TIME_SLOTS = [
  { label: "09:00 AM - 10:00 AM", start: "09:00:00", end: "10:00:00" },
  { label: "10:00 AM - 11:00 AM", start: "10:00:00", end: "11:00:00" },
  { label: "11:00 AM - 12:00 PM", start: "11:00:00", end: "12:00:00" },
  { label: "01:00 PM - 02:00 PM", start: "13:00:00", end: "14:00:00" },
  { label: "02:00 PM - 03:00 PM", start: "14:00:00", end: "15:00:00" },
  { label: "03:00 PM - 04:00 PM", start: "15:00:00", end: "16:00:00" },
  { label: "04:00 PM - 05:00 PM", start: "16:00:00", end: "17:00:00" },
];

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

export default function SupportSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const stored = getStoredUser();

  // Session and booking state
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [callPhone, setCallPhone] = useState("");
  const [preferredAt, setPreferredAt] = useState("");
  
  // Custom states for simplified slots
  const [bookingDate, setBookingDate] = useState("");
  const [bookingSlotIndex, setBookingSlotIndex] = useState("");
  const [booking, setBooking] = useState({ psychiatristId: "" });

  // Custom inline warning state variables
  const [phoneError, setPhoneError] = useState("");
  const [bookingError, setBookingError] = useState("");
  
  const [statusMsg, setStatusMsg] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Chat-specific state
  const [messages, setMessages] = useState([]); // { senderId, text, createdAt }
  const [text, setText] = useState("");
  const [adminOnline, setAdminOnline] = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);

  const socketRef = useRef(null);
  const messagesRef = useRef(null);
  const typingTimerRef = useRef(null);
  const notifyTypingTimerRef = useRef(null);

  const userId = stored?.user?.id || stored?.user?._id || stored?.username || "anonymous";

  // fetch session helper
  const fetchSession = async () => {
    setRefreshing(true);
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
            senderName: m.senderName || (m.sender === userId ? stored?.username : "support"),
            text: m.text,
            createdAt: m.createdAt || m.created_at,
          }))
        );
      }
      setStatusMsg("Data refreshed successfully!");
      setTimeout(() => setStatusMsg(""), 3000);
    } catch (e) {
      console.error(e);
      setStatusMsg("Failed to refresh data.");
      setTimeout(() => setStatusMsg(""), 3000);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!id) {
      setStatusMsg("No session id provided.");
      return;
    }

    // initial fetch
    fetchSession();

    // setup socket
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      socket.emit("joinRoom", { roomId: id, username: stored?.username || userId });
      socket.emit("join_support_session", { sessionId: id, userId });
      socket.emit("user_joined", { sessionId: id, userId });
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
      setAdminOnline(false);
    });

    const handleIncoming = (payload) => {
      if (!payload) return;
      if (payload.sessionId && String(payload.sessionId) !== String(id)) return;

      console.log("Incoming message:", payload);

      setMessages((prev) => {
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
            return next;
          }
        }

        if (payload._id && prev.some(m => m._id && String(m._id) === String(payload._id))) {
          return prev;
        }

        if (payload.clientId && prev.some(m => m.clientId && m.clientId === payload.clientId)) {
          return prev;
        }

        if (!payload.clientId) {
          const serverTime = payload.createdAt ? new Date(payload.createdAt).getTime() : Date.now();
          const heurIdx = prev.findIndex(m => {
            const isStub = !!m.clientId || !m._id;
            if (!isStub) return false;
            const sameSender = (String(m.senderId) === String(payload.senderId)) || (String(m.senderId) === String(userId) && (payload.senderId == null || String(payload.senderId) === String(userId)));
            if (!sameSender) return false;
            if ((m.text || "").trim() !== (payload.text || "").trim()) return false;
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
            return next;
          }
        }

        return [...prev, {
          _id: payload._id,
          clientId: payload.clientId || null,
          senderId: payload.senderId,
          senderName: payload.senderName || "support",
          text: payload.text,
          createdAt: payload.createdAt || new Date().toISOString()
        }];
      });

      scrollToBottom();
    };

    socket.on("support_message", handleIncoming);
    socket.on("support:message", handleIncoming);

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

    socket.on("support:sessionUpdated", (payload) => {
      if (payload && String(payload._id) === String(id)) {
        setSession(payload);
        setStatusMsg("Session updated.");
      }
    });
    socket.on("support:callRequested", (payload) => {
      if (payload && String(payload.sessionId) === String(id)) {
        setStatusMsg("Call request received by support.");
        fetchSession();
      }
    });
    socket.on("support:bookingCreated", (payload) => {
      if (payload && String(payload.sessionId) === String(id)) {
        setStatusMsg("Booking created.");
        fetchSession();
      }
    });

    // fetch historical messages
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
                _id: m._id,
                senderId: m.sender || m.senderId,
                senderName: m.senderName || (m.sender === userId ? stored?.username : "support"),
                text: m.text,
                createdAt: m.createdAt || m.created_at,
              }))
            );
            scrollToBottom();
          }
        }
      } catch (err) {
        console.error(err);
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

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, adminTyping]);

  const sendMessage = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    const payload = { sessionId: id, message: trimmed, senderId: userId, senderName: stored?.username || "user" };
    try {
      socketRef.current?.emit("support_message", payload);
      socketRef.current?.emit("support:message", payload);
    } catch (e) {
      console.error("socket emit failed", e);
    }

    setMessages((m) => [...m, { senderId: userId, senderName: stored?.username || "user", text: trimmed, createdAt: new Date().toISOString() }]);
    setText("");
    scrollToBottom();

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

  const notifyTyping = () => {
    try {
      if (!socketRef.current) return;
      socketRef.current.emit("user_typing", { sessionId: id, userId });
      clearTimeout(notifyTypingTimerRef.current);
      notifyTypingTimerRef.current = setTimeout(() => {
        try {
          socketRef.current.emit("user_typing", { sessionId: id, userId, typing: false });
        } catch {}
      }, 900);
    } catch (e) {}
  };

  const createCallRequest = async () => {
    if (!stored || !stored.username) {
      setPhoneError("Please sign in to request a call.");
      return;
    }
    if (!callPhone.trim()) {
      setPhoneError("Please enter a valid phone number.");
      return;
    }
    setPhoneError("");
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
      setStatusMsg("Call requested successfully!");
      socketRef.current?.emit("support:callRequested", { sessionId: id });
    } catch (e) {
      console.error(e);
      setPhoneError(e.message || "Call request failed");
    } finally {
      setLoading(false);
    }
  };

  const createBooking = async () => {
    if (!stored || !stored.username) {
      setBookingError("Please sign in to book.");
      return;
    }
    if (!booking.psychiatristId || !bookingDate || bookingSlotIndex === "") {
      setBookingError("Please select a specialist, date, and preferred time slot.");
      return;
    }
    setBookingError("");

    const selectedSlot = TIME_SLOTS[Number(bookingSlotIndex)];
    const slotStart = `${bookingDate}T${selectedSlot.start}`;
    const slotEnd = `${bookingDate}T${selectedSlot.end}`;

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
          slotStart,
          slotEnd,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message || "Booking failed");
      }
      const data = await res.json();
      setSession(data.session || session);
      setStatusMsg("Booking created successfully!");
      socketRef.current?.emit("support:bookingCreated", { sessionId: id });
      
      // Reset booking inputs
      setBookingDate("");
      setBookingSlotIndex("");
      setBooking({ psychiatristId: "" });
    } catch (e) {
      console.error(e);
      setBookingError(e.message || "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/40 dark:bg-slate-950 font-sans">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Navigation back and header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <button
              onClick={() => navigate("/support")}
              className="inline-flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition mb-2"
            >
              &larr; Back to Support
            </button>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center flex-wrap gap-2.5">
              <span>Support Session Workspace</span>
              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm self-center leading-none ${
                socketConnected ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
              }`} style={{ transform: "translateY(1px)" }}>
                <span className={`h-1.5 w-1.5 rounded-full ${socketConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}></span>
                {socketConnected ? "Live" : "Offline"}
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchSession}
              disabled={refreshing}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-950 active:bg-slate-100 dark:active:bg-slate-950 disabled:opacity-60 transition flex items-center gap-1.5"
            >
              {refreshing ? (
                <>
                  <svg className="animate-spin h-3 w-3 text-slate-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Refreshing...</span>
                </>
              ) : (
                <>
                  <span>Refresh Data</span>
                </>
              )}
            </button>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">ID: {id?.slice(-8)}</span>
          </div>
        </div>

        {statusMsg && (
          <div className="mb-6 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-fade-in">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{statusMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left panel: Forms and history (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Call Callback Request Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/40 dark:shadow-none rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Request Callback</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Request a phone call callback from UPLIFT support team</p>
                </div>
              </div>

              {phoneError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{phoneError}</span>
                </div>
              )}

              {session?.requestedCall ? (
                <div className="bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 leading-relaxed text-xs text-slate-700 dark:text-slate-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div><strong>Phone:</strong> {session.requestedCall.phone}</div>
                    <div><strong>Status:</strong> <span className="font-bold text-amber-800 dark:text-amber-300 uppercase text-[9px] bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded">{session.requestedCall.status}</span></div>
                    <div><strong>Preferred Time:</strong> {session.requestedCall.preferredAt ? new Date(session.requestedCall.preferredAt).toLocaleString() : "As soon as possible"}</div>
                    {session.requestedCall.adminAssigned && <div><strong>Assigned Support:</strong> {session.requestedCall.adminAssigned}</div>}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Phone Number</label>
                      <input
                        type="tel"
                        value={callPhone}
                        onChange={(e) => setCallPhone(e.target.value)}
                        placeholder="e.g. +1 555-0199"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded-lg text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Preferred Time (Optional)</label>
                      <input
                        type="datetime-local"
                        value={preferredAt}
                        onChange={(e) => setPreferredAt(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded-lg text-xs text-slate-700 dark:text-slate-300"
                      />
                    </div>
                  </div>
                  <button
                    onClick={createCallRequest}
                    disabled={loading}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shadow-sm transition disabled:opacity-50"
                  >
                    Submit Call Request
                  </button>
                </div>
              )}
            </div>

            {/* Book Psychiatrist Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/40 dark:shadow-none rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Book Psychiatrist / Therapist</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Schedule video sessions with professional therapists</p>
                </div>
              </div>

              {bookingError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{bookingError}</span>
                </div>
              )}

              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Choose Specialist</label>
                    <select
                      value={booking.psychiatristId}
                      onChange={(e) => setBooking({ psychiatristId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded-lg text-xs text-slate-800 dark:text-slate-200"
                    >
                      <option value="">Choose therapist</option>
                      <option value="doc-1">Dr. Anya N (Therapist)</option>
                      <option value="doc-2">Dr. समीर R (Psychiatrist)</option>
                    </select>
                  </div>
                  
                  {/* Predefined single Date selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Choose Date</label>
                    <input
                      type="date"
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded-lg text-xs text-slate-700 dark:text-slate-300"
                    />
                  </div>

                  {/* Predefined hourly Slot selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Preferred Time Slot</label>
                    <select
                      value={bookingSlotIndex}
                      onChange={(e) => setBookingSlotIndex(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded-lg text-xs text-slate-800 dark:text-slate-200"
                    >
                      <option value="">Choose time slot</option>
                      {TIME_SLOTS.map((s, idx) => (
                        <option key={idx} value={idx}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <button
                  onClick={createBooking}
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-sm transition disabled:opacity-50"
                >
                  Book Appointment Slot
                </button>

                {/* Bookings History list */}
                {Array.isArray(session?.bookings) && session.bookings.length > 0 && (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Bookings History</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {session.bookings.map((b, i) => (
                        <div key={i} className="bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl p-3 leading-relaxed text-xs text-slate-600 dark:text-slate-350">
                          <div><strong>Specialist:</strong> {b.psychiatristName || b.psychiatristId}</div>
                          <div><strong>From:</strong> {b.slotStart ? new Date(b.slotStart).toLocaleString() : "—"}</div>
                          <div><strong>To:</strong> {b.slotEnd ? new Date(b.slotEnd).toLocaleString() : "—"}</div>
                          {b.status && (
                            <div className="mt-1">
                              Status: <span className="font-bold uppercase text-[9px] bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-1 rounded">{b.status}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right panel: Integrated chat console (5 cols) */}
          <div className="lg:col-span-5 h-[580px] lg:h-[640px] flex flex-col">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-150/40 dark:shadow-none rounded-2xl flex flex-col h-full overflow-hidden">
              {/* Chat Header */}
              <div className="px-4 py-3 border-b border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between flex-shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">Live Support Chat</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${adminOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}></span>
                      <span className="text-[9px] text-slate-400 dark:text-slate-550 font-semibold">{adminOnline ? "Moderator online" : "Moderator offline"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Messages */}
              <div
                ref={messagesRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/50"
              >
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 text-center px-4">
                    <span className="text-2xl mb-1">👋</span>
                    <p className="text-xs">No messages yet. Send a message to introduce yourself to support.</p>
                  </div>
                ) : (
                  messages.map((m, i) => {
                    const isMine = String(m.senderId) === String(userId);
                    const initial = String(m.senderName || (isMine ? "U" : "S")).slice(0, 1).toUpperCase();

                    return (
                      <div
                        key={m._id || i}
                        className={`flex items-start gap-2 ${isMine ? "flex-row-reverse" : ""}`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm flex-shrink-0 ${
                            isMine ? "bg-indigo-600" : getAvatarColor(m.senderName || "support")
                          }`}
                        >
                          {initial}
                        </div>
                        <div className={`max-w-[75%] ${isMine ? "text-right" : ""}`}>
                          {!isMine && (
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium px-1 block mb-0.5">
                              {m.senderName}
                            </span>
                          )}
                          <div
                            className={`px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-sm inline-block text-left ${
                              isMine
                                ? "bg-indigo-600 text-white rounded-tr-none"
                                : "bg-white dark:bg-slate-950 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none"
                            }`}
                          >
                            {m.text}
                          </div>
                          <span className="text-[8px] text-slate-400 dark:text-slate-500 block mt-0.5 px-1">
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input */}
              <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
                {adminTyping && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-550 italic mb-1.5 px-1">
                    <span className="flex gap-0.5">
                      <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"></span>
                      <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                    </span>
                    <span>Support moderator is typing...</span>
                  </div>
                )}

                <form onSubmit={sendMessage} className="flex gap-2">
                  <input
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      notifyTyping();
                    }}
                    placeholder="Type your message..."
                    className="flex-1 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-550 transition"
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
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
