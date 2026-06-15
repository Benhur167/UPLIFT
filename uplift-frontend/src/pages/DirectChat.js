// src/pages/DirectChat.js
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "../socket";

const API_BASE = process.env.REACT_APP_API || "http://localhost:5000/api";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("uplift_user") || "null");
  } catch {
    return null;
  }
}

function normalizeMsg(m) {
  if (!m) return null;
  const id = m._id || m.id || m.clientId || String(Math.random());
  const sender = m.sender || m.username || "anonymous";
  const avatar = m.avatar || null;
  const text = m.text || m.message || "";
  const createdAt = m.createdAt || m.timestamp || new Date().toISOString();
  const clientId = m.clientId || null;
  const roomId = m.roomId || null;
  const seenBy = m.seenBy || [];
  const blockedFor = m.blockedFor || null;
  return { _id: id, clientId, roomId, sender, avatar, text, createdAt, seenBy, blockedFor };
}

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

export default function DirectChat() {
  const { partner } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [msg, setMsg] = useState("");
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [customAlert, setCustomAlert] = useState(null); // { title, message, type: 'alert'|'confirm', onConfirm: fn }
  const [isBlocked, setIsBlocked] = useState(false);

  const chatEndRef = useRef(null);
  const typingTimer = useRef(null);
  const joinedRef = useRef(false);
  const longPressTimer = useRef(null);

  const storedUser = getStoredUser();
  const username = storedUser?.username || null;
  const myAvatar = storedUser?.avatar || null;

  const roomId = `dm_${[username, partner].sort().join('_')}`;

  // Toast notifications managed globally by Navbar

  // Redirect if not logged in
  useEffect(() => {
    if (!username) {
      navigate("/signin");
    }
  }, [username, navigate]);

  // Load chat history & initialize socket connection
  useEffect(() => {
    if (!partner || !username) return;

    let mounted = true;
    joinedRef.current = false;

    const onMessage = (m) => {
      const n = normalizeMsg(m);
      if (!n) return;
      
      // Message in another DM room -> let Navbar handle notifications
      if (n.roomId !== roomId) {
        return;
      }

      setMessages(prev => {
        if (n.clientId) {
          const tempIdx = prev.findIndex(x => x._id === n.clientId);
          if (tempIdx !== -1) {
            const next = [...prev];
            next[tempIdx] = n;
            return next;
          }
        }
        if (prev.some(x => x._id === n._id)) return prev;
        const next = [...prev, n];
        next.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        return next;
      });

      // Automatically mark incoming messages as read/seen if we are in the room
      if (n.sender !== username && !n.seenBy.includes(username)) {
        socket.emit("messageSeen", { messageId: n._id, username, roomId });
      }
    };

    const onMessageSeenUpdate = ({ messageId, seenBy, roomId: rId }) => {
      if (rId !== roomId) return;
      setMessages(prev =>
        prev.map(m => (m._id === messageId ? { ...m, seenBy } : m))
      );
    };

    const onMessagesSeenUpdate = ({ updates, roomId: rId }) => {
      if (rId !== roomId) return;
      setMessages(prev => {
        const updatesMap = new Map(updates.map(u => [u._id, u.seenBy]));
        return prev.map(m => {
          if (updatesMap.has(m._id)) {
            return { ...m, seenBy: updatesMap.get(m._id) };
          }
          return m;
        });
      });
    };

    const onMessageDeleted = ({ messageId, roomId: rId }) => {
      if (rId !== roomId) return;
      setMessages(prev => prev.filter(m => m._id !== messageId));
    };

    const onTyping = ({ roomId: r, user, typing }) => {
      if (r !== roomId || user !== partner) return;
      setPartnerTyping(typing);
    };

    const onDmUnblocked = ({ roomId: rId }) => {
      if (rId !== roomId) return;
      fetch(`${API_BASE}/messages/dm/${partner}`, {
        headers: { "x-username": username }
      })
      .then(res => res.json())
      .then(data => {
        if (mounted) {
          setMessages(data.map(normalizeMsg).filter(Boolean));
        }
      })
      .catch(err => console.error("Failed to reload messages on dm_unblocked", err));
    };

    const onUserOnlineStatus = ({ username: u, online }) => {
      if (u === partner) {
        setPartnerOnline(online);
      }
    };

    async function setupChat() {
      setLoading(true);
      setError("");
      try {
        // Fetch current user's profile to get blocked list
        const profileRes = await fetch(`${API_BASE}/users/profile`, {
          headers: { "x-username": username }
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (mounted) {
            setIsBlocked(profile.blockedUsers?.includes(partner) || false);
          }
        }

        // Fetch DM history
        const res = await fetch(`${API_BASE}/messages/dm/${partner}`, {
          headers: {
            "x-username": username
          }
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "Failed to load DM room");
        }

        const data = await res.json();
        if (mounted) {
          setMessages(data.map(normalizeMsg).filter(Boolean));
        }

        // Connect socket if not connected
        if (!socket.connected) {
          socket.connect();
          await new Promise((resolve) => {
            let done = false;
            socket.once("connect", () => { if (!done) { done = true; resolve(); } });
            socket.once("connect_error", () => { if (!done) { done = true; resolve(); } });
            setTimeout(() => { if (!done) { done = true; resolve(); } }, 2000);
          });
        }

        // Join room and register user rooms
        socket.emit("joinUserRoom", { username });
        socket.emit("joinRoom", { roomId, username, avatar: myAvatar });

        // Query status of partner
        const listRes = await fetch(`${API_BASE}/messages/dms/list`, {
          headers: { "x-username": username }
        });
        if (listRes.ok) {
          const list = await listRes.json();
          const info = list.find(d => d.partner === partner);
          if (info && mounted) {
            setPartnerOnline(info.isOnline);
          }
        }

      } catch (err) {
        console.error(err);
        if (mounted) {
          setError(err.message || "Could not setup DM session.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    setupChat();

    socket.on("chatMessage", onMessage);
    socket.on("messageSeenUpdate", onMessageSeenUpdate);
    socket.on("messagesSeenUpdate", onMessagesSeenUpdate);
    socket.on("messageDeleted", onMessageDeleted);
    socket.on("typing", onTyping);
    socket.on("userOnlineStatus", onUserOnlineStatus);
    socket.on("dm_unblocked", onDmUnblocked);

    return () => {
      mounted = false;
      socket.off("chatMessage", onMessage);
      socket.off("messageSeenUpdate", onMessageSeenUpdate);
      socket.off("messagesSeenUpdate", onMessagesSeenUpdate);
      socket.off("messageDeleted", onMessageDeleted);
      socket.off("typing", onTyping);
      socket.off("userOnlineStatus", onUserOnlineStatus);
      socket.off("dm_unblocked", onDmUnblocked);
    };
  }, [partner, username, roomId, myAvatar, navigate]);

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, partnerTyping]);

  const emitTyping = useCallback((isTyping) => {
    if (!socket.connected || !username) return;
    socket.emit("typing", { roomId, user: username, typing: !!isTyping });
  }, [roomId, username]);

  const handleTyping = (val) => {
    setMsg(val);
    emitTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 800);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!msg.trim() || !username) return;

    const text = msg.trim();
    const clientId = `c_${Date.now()}_${Math.floor(Math.random() * 900000)}`;

    const optimisticMsg = {
      _id: clientId,
      clientId,
      roomId,
      sender: username,
      avatar: myAvatar,
      text,
      createdAt: new Date().toISOString(),
      seenBy: [username]
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setMsg("");
    emitTyping(false);

    if (socket.connected) {
      socket.emit("chatMessage", {
        roomId,
        sender: username,
        avatar: myAvatar,
        text,
        clientId
      });
    } else {
      // Fallback
      fetch(`${API_BASE}/messages/save-fallback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, sender: username, avatar: myAvatar, text, clientId })
      }).catch(err => console.error("Fallback DM send failed", err));
    }
  };

  // Message Delete Handler
  const handleDeleteMessage = async (msgId) => {
    try {
      const res = await fetch(`${API_BASE}/messages/${msgId}`, {
        method: "DELETE",
        headers: {
          "x-username": username
        }
      });
      if (!res.ok) {
        throw new Error("Failed to delete message");
      }
      setSelectedMsg(null);
    } catch (e) {
      console.error(e);
      setCustomAlert({
        title: "Deletion Failed",
        message: e.message || "Could not delete message",
        type: "alert"
      });
    }
  };

  const handleBlockToggle = async () => {
    const action = isBlocked ? "unblock" : "block";
    try {
      const res = await fetch(`${API_BASE}/users/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-username": username
        },
        body: JSON.stringify({ target: partner })
      });
      if (!res.ok) {
        throw new Error(`Failed to ${action} user`);
      }
      
      const newBlockedState = !isBlocked;
      setIsBlocked(newBlockedState);
      
      // Reload history to reflect blocked message updates
      const msgRes = await fetch(`${API_BASE}/messages/dm/${partner}`, {
        headers: { "x-username": username }
      });
      if (msgRes.ok) {
        const data = await msgRes.json();
        setMessages(data.map(normalizeMsg).filter(Boolean));
      }
    } catch (e) {
      console.error(e);
      setCustomAlert({
        title: "Block Action Failed",
        message: e.message || `Could not toggle block status`,
        type: "alert"
      });
    }
  };

  // Long press gesture listeners
  const handleTouchStart = (item) => {
    longPressTimer.current = setTimeout(() => {
      setSelectedMsg(item);
    }, 600); // 600ms hold
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
  };

  const handleMouseDown = (item) => {
    longPressTimer.current = setTimeout(() => {
      setSelectedMsg(item);
    }, 600);
  };

  const handleMouseUp = () => {
    clearTimeout(longPressTimer.current);
  };

  return (
    <div className="flex bg-slate-50 dark:bg-slate-905 font-sans w-full" style={{ height: "calc(100vh - 69px)" }}>
      {/* Main chat viewport */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-905 relative">
        {/* Header */}
        <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-6 flex items-center justify-between shadow-sm z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/community-chat')}
              className="p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition mr-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className={`w-8 h-8 rounded-full ${getAvatarColor(partner)} flex items-center justify-center font-bold text-xs text-white shadow-sm flex-shrink-0`}>
              {String(partner || "P").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                {partner}
              </h3>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`h-1.5 w-1.5 rounded-full ${partnerOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}></span>
                <span className="text-[9px] text-slate-400 dark:text-slate-550 font-medium">
                  {partnerOnline ? "Online" : "Offline"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <button
              onClick={handleBlockToggle}
              className={`px-3 py-1.5 rounded-xl font-bold text-[10px] transition duration-150 shadow-sm ${
                isBlocked
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-rose-500/10 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-500/20"
              }`}
            >
              {isBlocked ? "Unblock" : "Block User"}
            </button>
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 rounded-full">
              Private Chat
            </span>
          </div>
        </header>

        {/* Error State */}
        {error && (
          <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-20 bg-rose-550 text-white text-[11px] font-semibold px-4 py-2 rounded-xl shadow-lg flex items-center gap-2">
            <span>⚠️ {error}</span>
            <button onClick={() => setError("")} className="font-bold underline ml-2">Dismiss</button>
          </div>
        )}

        {/* Loading details */}
        {loading && messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <div className="w-8 h-8 border-4 border-indigo-200 rounded-full border-t-transparent animate-spin mb-2"></div>
            <p className="text-[11px]">Loading chat secure history...</p>
          </div>
        ) : (
          /* Messages view */
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
                <p className="text-xs">This is the beginning of your chat history with {partner}.</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-550 mt-1">Hold any message to see info or delete it.</p>
              </div>
            ) : (
              messages.map((m, idx) => {
                const isMe = m.sender === username;
                const read = m.seenBy.includes(partner);
                const blocked = !!m.blockedFor;
                const delivered = partnerOnline && !blocked; // message is delivered if they are online and not blocked

                return (
                  <div
                    key={m._id}
                    className={`flex items-start gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}
                  >
                    {/* User initial */}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm flex-shrink-0 ${
                        isMe ? "bg-indigo-600" : getAvatarColor(m.sender)
                      }`}
                    >
                      {String(m.sender || "U").slice(0, 1).toUpperCase()}
                    </div>

                    <div className={`max-w-[70%] ${isMe ? "text-right" : ""}`}>
                      <div
                        onTouchStart={() => handleTouchStart(m)}
                        onTouchEnd={handleTouchEnd}
                        onMouseDown={() => handleMouseDown(m)}
                        onMouseUp={handleMouseUp}
                        className={`px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-sm block text-left cursor-pointer select-none active:scale-[0.99] transition duration-100 ${
                          isMe
                            ? "bg-indigo-600 text-white rounded-tr-none"
                            : "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.text}</p>
                        
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className={`text-[8px] ${isMe ? "text-indigo-200" : "text-slate-400 dark:text-slate-500"}`}>
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>

                          {/* WhatsApp Style Ticks */}
                          {isMe && (
                            <span className="flex ml-1 items-center">
                              {read ? (
                                // Double Blue Ticks
                                <svg className="w-3.5 h-3.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M17 5L9.13 14.87L6 11M22 8.5L14.13 18.37L12 16.25" />
                                </svg>
                              ) : delivered ? (
                                // Double Gray Ticks
                                <svg className="w-3.5 h-3.5 text-slate-400 dark:text-slate-555" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M17 5L9.13 14.87L6 11M22 8.5L14.13 18.37L12 16.25" />
                                </svg>
                              ) : (
                                // Single Gray Tick
                                <svg className="w-3.5 h-3.5 text-slate-400 dark:text-slate-555" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20 6L9 17L4 12" />
                                </svg>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Typing Indicator */}
            {partnerTyping && (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 italic px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-full w-fit shadow-sm animate-pulse">
                <span className="flex gap-0.5">
                  <span className="w-1.2 h-1.2 bg-slate-400 rounded-full animate-bounce"></span>
                  <span className="w-1.2 h-1.2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                  <span className="w-1.2 h-1.2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                </span>
                <span>{partner} is typing...</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}

        {/* Input area */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
          {isBlocked ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 px-4 py-3 rounded-2xl">
              <span className="text-xs font-semibold text-rose-700 dark:text-rose-455">
                🚫 You blocked this user. Unblock to send messages.
              </span>
              <button
                onClick={handleBlockToggle}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-750 text-white font-bold text-[11px] rounded-xl shadow-md transition"
              >
                Unblock
              </button>
            </div>
          ) : (
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                value={msg}
                onChange={(e) => handleTyping(e.target.value)}
                placeholder={`Send message to ${partner}...`}
                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition"
              />
              <button
                type="submit"
                disabled={!msg.trim()}
                className="h-8 px-4 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-3.5 h-3.5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Message action dialog (overlay) */}
      {selectedMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-2">Message Actions</h3>
            <p className="text-[11px] text-slate-505 dark:text-slate-450 border-b border-slate-150 dark:border-slate-800 pb-3 mb-4 truncate italic">
              "{selectedMsg.text}"
            </p>

            <div className="flex flex-col gap-2">
              {/* Message seen info details only visible if logged-in user is the sender of this message */}
              {selectedMsg.sender === username && (
                <button
                  onClick={() => {
                    setShowInfoModal(true);
                  }}
                  className="w-full py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition text-center"
                >
                  ℹ️ Message Info
                </button>
              )}

              {selectedMsg.sender === username && (
                <button
                  onClick={() => handleDeleteMessage(selectedMsg._id)}
                  className="w-full py-2.5 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition text-center"
                >
                  🗑️ Delete Message
                </button>
              )}

              <button
                onClick={() => setSelectedMsg(null)}
                className="w-full py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition text-center mt-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Info details sub-modal */}
      {showInfoModal && selectedMsg && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="text-xs font-bold text-slate-805 dark:text-slate-100 mb-3">Message Info</h3>
            
            <div className="space-y-2.5 text-[11px] text-slate-600 dark:text-slate-300">
              <div>
                <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[9px] block">Sender</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedMsg.sender}</span>
              </div>

              <div>
                <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[9px] block">Sent At</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {new Date(selectedMsg.createdAt).toLocaleString()}
                </span>
              </div>

              <div>
                <span className="font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider text-[9px] block">Seen Status</span>
                <div className="mt-1 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    <span>{selectedMsg.sender} (Sent / Creator)</span>
                  </div>
                  {selectedMsg.seenBy.filter(u => u !== selectedMsg.sender).map(u => (
                    <div key={u} className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
                      <span>{u} (Read)</span>
                    </div>
                  ))}
                  {selectedMsg.seenBy.filter(u => u !== selectedMsg.sender).length === 0 && (
                    <span className="text-slate-400 dark:text-slate-550 italic text-[10px]">Not read by recipient yet</span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowInfoModal(false);
                setSelectedMsg(null);
              }}
              className="w-full py-2 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow mt-5 transition text-center"
            >
              Close Info
            </button>
          </div>
        </div>
      )}

      {/* Toast notification markup removed as it is now managed globally by NavBar */}

      {/* Custom Alert/Confirm dialog overlay */}
      {customAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl animate-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{customAlert.type === 'confirm' ? '❓' : '🔔'}</span>
              <h3 className="text-xs font-bold uppercase tracking-wider">{customAlert.title || 'System Notification'}</h3>
            </div>
            <p className="text-xs text-slate-605 dark:text-slate-300 leading-relaxed mb-5">
              {customAlert.message}
            </p>
            <div className="flex gap-2 justify-end">
              {customAlert.type === 'confirm' && (
                <button
                  onClick={() => setCustomAlert(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl transition"
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
