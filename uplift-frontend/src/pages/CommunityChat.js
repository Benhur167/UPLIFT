// src/pages/CommunityChat.js
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import socket from "../socket";

const API_BASE = process.env.REACT_APP_API || "http://localhost:5000/api";

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
  const seenBy = m.seenBy || [];
  return { _id: id, clientId, roomId, sender, avatar, text, createdAt, seenBy };
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

export default function CommunityChat() {
  const { state } = useLocation();
  const params = useParams();
  const navigate = useNavigate();
  const communityFromState = state?.community;

  const [community, setCommunity] = useState(communityFromState || null);
  const [membersCount, setMembersCount] = useState(communityFromState?.members?.length || 0);
  const [messages, setMessages] = useState([]);
  const [msg, setMsg] = useState("");
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [error, setError] = useState("");
  const [customAlert, setCustomAlert] = useState(null); // { title, message, type: 'alert'|'confirm', onConfirm: fn }

  // Modals & action states
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null); // username string
  const [leaving, setLeaving] = useState(false);

  const chatEndRef = useRef(null);
  const typingTimer = useRef(null);
  const joinedRef = useRef(false);
  const longPressTimer = useRef(null);

  const storedUser = getStoredUser();
  const username = storedUser?.username || null;
  const myAvatar = storedUser?.avatar || null;

  const roomId = params.id || communityFromState?._id;

  // Toast notifications managed globally by Navbar

  // Load community by ID if needed
  useEffect(() => {
    if (!roomId) {
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
        const res = await fetch(`${API_BASE}/communities/${roomId}`);
        if (!res.ok) throw new Error(`Failed to load community (${res.status})`);
        const data = await res.json();
        setCommunity(data);
        setMembersCount(data.members?.length || 0);
      } catch (e) {
        console.error(e);
        setError(e.message || "Could not load community.");
      }
    })();
  }, [roomId, communityFromState]);

  // Join room and connect socket
  useEffect(() => {
    if (!community || !username) return;

    let mounted = true;

    const onMessage = (m) => {
      const n = normalizeMsg(m);
      if (!n) return;
      
      // If message is for another circle room, let Navbar handle notifications
      if (n.roomId && n.roomId !== roomId) {
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

      // Mark incoming messages as seen
      if (n.sender !== username && n.sender !== "system" && !n.seenBy.includes(username)) {
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
      if (r !== roomId) return;
      setTypingUsers(prev => {
        const next = new Set(prev);
        if (typing) next.add(user); else next.delete(user);
        return next;
      });
    };

    const onCommunityUpdated = ({ roomId: r, members, membersCount: mc }) => {
      if (r !== roomId) return;
      setCommunity(prev => prev ? { ...prev, members } : null);
      if (typeof mc === "number") setMembersCount(mc);
    };

    const onMemberKicked = ({ roomId: r, username: target }) => {
      if (r !== roomId) return;
      if (target === username) {
        setCustomAlert({
          title: "Removed from Circle",
          message: "You have been removed from this community by an admin.",
          type: "alert",
          onConfirm: () => navigate("/community-chat")
        });
      }
    };

    // DM notifications managed globally by Navbar

    async function setup() {
      try {
        if (joinedRef.current) return;
        joinedRef.current = true;

        // REST Join
        const joinRes = await fetch(`${API_BASE}/communities/${roomId}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-username": username },
          body: JSON.stringify({})
        });

        if (!joinRes.ok) {
          const txt = await joinRes.text().catch(() => null);
          throw new Error(`Join failed (${joinRes.status}) ${txt || ""}`);
        }

        const joinJson = await joinRes.json().catch(() => null);
        const updatedMembers = joinJson?.members || community.members || [];
        if (mounted) {
          setCommunity(prev => prev ? { ...prev, members: updatedMembers } : null);
          setMembersCount(updatedMembers.length);
        }

        // Connect socket
        if (!socket.connected) {
          socket.connect();
          await new Promise((resolve) => {
            let done = false;
            socket.once("connect", () => { if (!done) { done = true; resolve(); } });
            socket.once("connect_error", () => { if (!done) { done = true; resolve(); } });
            setTimeout(() => { if (!done) { done = true; resolve(); } }, 2000);
          });
        }

        socket.emit("joinUserRoom", { username });
        socket.emit("joinRoom", { roomId, username, avatar: myAvatar });

        // Load message history
        const msgRes = await fetch(`${API_BASE}/messages/${roomId}`, {
          headers: {
            "x-username": username
          }
        });
        if (!msgRes.ok) {
          const t = await msgRes.text().catch(() => null);
          throw new Error(`Messages fetch failed (${msgRes.status}) ${t || ""}`);
        }
        const raw = await msgRes.json().catch(() => []);
        if (mounted) {
          const validList = Array.isArray(raw) ? raw : [];
          setMessages(validList.map(normalizeMsg).filter(Boolean));
        }
      } catch (e) {
        console.error("Chat setup error", e);
        if (mounted) {
          setError(e.message || "Failed to setup chat");
        }
        joinedRef.current = false;
      }
    }

    setup();

    socket.on("chatMessage", onMessage);
    socket.on("messageSeenUpdate", onMessageSeenUpdate);
    socket.on("messagesSeenUpdate", onMessagesSeenUpdate);
    socket.on("messageDeleted", onMessageDeleted);
    socket.on("typing", onTyping);
    socket.on("communityUpdated", onCommunityUpdated);
    socket.on("memberKicked", onMemberKicked);

    return () => {
      mounted = false;
      socket.off("chatMessage", onMessage);
      socket.off("messageSeenUpdate", onMessageSeenUpdate);
      socket.off("messagesSeenUpdate", onMessagesSeenUpdate);
      socket.off("messageDeleted", onMessageDeleted);
      socket.off("typing", onTyping);
      socket.off("communityUpdated", onCommunityUpdated);
      socket.off("memberKicked", onMemberKicked);
    };
  }, [community, username, roomId, myAvatar, navigate]);

  // Scroll bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  const emitTyping = useCallback((isTyping) => {
    if (!socket.connected || !username) return;
    socket.emit("typing", { roomId, user: username, typing: !!isTyping });
  }, [roomId, username]);

  const handleTyping = (v) => {
    setMsg(v);
    emitTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 800);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!msg.trim() || !username) return;

    const text = msg.trim();
    const clientId = `c_${Date.now()}_${Math.floor(Math.random() * 900000)}`;

    const temp = {
      _id: clientId,
      clientId,
      roomId,
      sender: username,
      avatar: myAvatar,
      text,
      createdAt: new Date().toISOString(),
      seenBy: [username]
    };

    setMessages(prev => [...prev, temp]);
    setMsg("");
    emitTyping(false);

    if (socket.connected) {
      socket.emit("chatMessage", { roomId, sender: username, avatar: myAvatar, text, clientId });
    } else {
      fetch(`${API_BASE}/messages/save-fallback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, sender: username, avatar: myAvatar, text, clientId })
      }).catch(err => console.error("Fallback send failed", err));
    }
  };

  // Leave Community circle action
  const handleLeaveCommunity = () => {
    setCustomAlert({
      title: "Leave Circle",
      message: "Are you sure you want to leave this circle?",
      type: "confirm",
      onConfirm: async () => {
        setLeaving(true);
        try {
          const res = await fetch(`${API_BASE}/communities/${roomId}/leave`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-username": username },
          });
          if (!res.ok) {
            throw new Error("Failed to leave circle");
          }
          navigate("/community-chat");
        } catch (e) {
          console.error(e);
          setCustomAlert({
            title: "Error Leaving",
            message: e.message || "Failed to leave circle",
            type: "alert"
          });
        } finally {
          setLeaving(false);
        }
      }
    });
  };

  // Promote member
  const handlePromoteMember = async (memberUser) => {
    try {
      const res = await fetch(`${API_BASE}/communities/${roomId}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-username": username },
        body: JSON.stringify({ username: memberUser })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Promotion failed");
      
      setCustomAlert({
        title: "Promotion Success",
        message: `${memberUser} has been promoted to Admin successfully.`,
        type: "alert"
      });
      setSelectedMember(null);
    } catch (e) {
      setCustomAlert({
        title: "Promotion Failed",
        message: e.message || "Failed to promote",
        type: "alert"
      });
    }
  };

  // Kick member
  const handleKickMember = (memberUser) => {
    setCustomAlert({
      title: "Kick Member",
      message: `Are you sure you want to kick ${memberUser}?`,
      type: "confirm",
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE}/communities/${roomId}/kick`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-username": username },
            body: JSON.stringify({ username: memberUser })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Kick failed");
          
          setCustomAlert({
            title: "Member Kicked",
            message: `${memberUser} was removed from this circle successfully.`,
            type: "alert"
          });
          setSelectedMember(null);
        } catch (e) {
          setCustomAlert({
            title: "Kick Failed",
            message: e.message || "Failed to kick member",
            type: "alert"
          });
        }
      }
    });
  };

  // Send Direct Message from profile click
  const handleSendDirectMessage = async (memberUser) => {
    try {
      // Send a DM Request
      const res = await fetch(`${API_BASE}/messages/dms/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-username": username },
        body: JSON.stringify({ recipient: memberUser })
      });
      const data = await res.json();
      if (res.ok) {
        setCustomAlert({
          title: "Request Sent",
          message: `Connection request sent to ${memberUser}! If accepted, you will find them in your Direct Messages tab.`,
          type: "alert"
        });
        setSelectedMember(null);
      } else {
        if (data.message === "chat already accepted") {
          // If already connected, jump straight to DM
          navigate(`/dm/${memberUser}`);
        } else {
          throw new Error(data.message || "Failed to request connection");
        }
      }
    } catch (e) {
      setCustomAlert({
        title: "Request Failed",
        message: e.message || "Connection request failed",
        type: "alert"
      });
    }
  };

  // Delete community message
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
      setCustomAlert({
        title: "Deletion Failed",
        message: e.message || "Failed to delete message",
        type: "alert"
      });
    }
  };

  // Long press handles
  const handleTouchStart = (item) => {
    longPressTimer.current = setTimeout(() => { setSelectedMsg(item); }, 600);
  };
  const handleTouchEnd = () => clearTimeout(longPressTimer.current);
  const handleMouseDown = (item) => {
    longPressTimer.current = setTimeout(() => { setSelectedMsg(item); }, 600);
  };
  const handleMouseUp = () => clearTimeout(longPressTimer.current);

  // Group consecutives
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

  const isUserAdmin = community?.admins?.includes(username) || false;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 p-8">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">Circle Access Error</h3>
        <p className="text-[11px] mt-1 text-center max-w-xs">{error}</p>
        <button onClick={() => navigate("/community-chat")} className="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow">
          Back to Circles
        </button>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-4 border-indigo-200 rounded-full border-t-transparent animate-spin mb-2"></div>
        <p className="text-xs">Entering circle space...</p>
      </div>
    );
  }

  return (
    <div className="flex bg-slate-50 dark:bg-slate-950 font-sans w-full" style={{ height: "calc(100vh - 69px)" }}>
      {/* Left Sidebar - Details & Members */}
      <div className="w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 h-full hidden lg:flex flex-shrink-0">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col items-center flex-shrink-0">
          <div className={`bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold text-lg w-16 h-16 rounded-2xl flex items-center justify-center shadow-md mb-4`}>
            {(community.name || "??").slice(0, 2).toUpperCase()}
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 text-center px-2 truncate w-full">
            {community.name}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center mt-2 leading-relaxed max-h-20 overflow-y-auto px-1">
            {community.description || "Welcome to our supportive space. Let's grow together!"}
          </p>
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 rounded-full mt-3 w-fit">
            {membersCount} members
          </span>
        </div>

        {/* Members Sidebar List */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Circle Members
          </h4>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
          {Array.isArray(community.members) && community.members.length > 0 ? (
            community.members.map((m, i) => {
              const initials = String(m || "U").slice(0, 2).toUpperCase();
              const isCreator = m === community.creator;
              const isAdmin = community.admins?.includes(m);

              return (
                <div 
                  key={i} 
                  onClick={() => m !== username && setSelectedMember(m)}
                  className={`flex items-center justify-between p-2 rounded-xl transition duration-150 ${
                    m !== username ? "hover:bg-slate-50 dark:hover:bg-slate-950 cursor-pointer" : ""
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] text-white shadow-sm flex-shrink-0 ${getAvatarColor(m || "anonymous")}`}>
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                        {m}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isCreator && (
                      <span className="flex-shrink-0 text-[9px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200/30 flex items-center gap-0.5">
                        👑 Creator
                      </span>
                    )}
                    {!isCreator && isAdmin && (
                      <span className="flex-shrink-0 text-[9px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-200/30 flex items-center gap-0.5">
                        🛡️ Admin
                      </span>
                    )}
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center text-[11px] text-slate-400 dark:text-slate-500 py-6">No members.</div>
          )}
        </div>

        {/* Leave Room Button */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
          <button
            onClick={handleLeaveCommunity}
            disabled={leaving}
            className="w-full py-2 bg-slate-50 dark:bg-slate-950 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-800 hover:border-rose-100 dark:hover:border-rose-900/50 font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>🚪</span> {leaving ? "Leaving..." : "Leave Circle"}
          </button>
        </div>
      </div>

      {/* Right Chat Panel */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950">
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
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold text-xs text-white shadow-sm flex-shrink-0">
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

          {username && (
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1">
              <div className={`w-5 h-5 rounded-full ${getAvatarColor(username)} flex items-center justify-center text-[9px] font-bold text-white shadow-sm`}>
                {String(username).slice(0, 1).toUpperCase()}
              </div>
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[80px]">
                {username}
              </span>
            </div>
          )}
        </header>

        {/* Message feed viewport */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-4 bg-slate-50/50 dark:bg-slate-950/50">
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
              <p className="text-xs">This circle is empty. Say hello first!</p>
              <p className="text-[10px] mt-1 italic">Hold messages to delete or view seen details.</p>
            </div>
          ) : (
            grouped.map((g, idx) => {
              // Center system notifications
              if (g.sender === "system") {
                return (
                  <div key={idx} className="flex justify-center my-3 w-full animate-in fade-in duration-200 select-none">
                    <div className="bg-slate-200/50 dark:bg-slate-800/60 text-slate-650 dark:text-slate-350 text-[10.5px] font-medium tracking-wide px-4 py-1.5 rounded-2xl text-center shadow-sm max-w-[85%]">
                      {g.items.map((it, i) => (
                        <p key={i} className="leading-relaxed">{it.text}</p>
                      ))}
                    </div>
                  </div>
                );
              }

              const isMe = g.sender === username;
              const initials = String(g.sender || "U").slice(0, 1).toUpperCase();

              return (
                <div
                  key={idx}
                  className={`flex items-start gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm flex-shrink-0 ${getAvatarColor(g.sender)}`}>
                    {initials}
                  </div>

                  <div className={`max-w-[70%] ${isMe ? "text-right" : ""}`}>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium px-1 block mb-0.5">
                      {g.sender}
                    </span>
                    <div className="space-y-1 inline-flex flex-col items-end">
                      {g.items.map(it => {
                        const otherSeenList = (it.seenBy || []).filter(u => u !== username);
                        const seenCount = otherSeenList.length;

                        return (
                          <div
                            key={it._id}
                            onTouchStart={() => handleTouchStart(it)}
                            onTouchEnd={handleTouchEnd}
                            onMouseDown={() => handleMouseDown(it)}
                            onMouseUp={handleMouseUp}
                            className="px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-sm block text-left cursor-pointer active:scale-[0.99] transition duration-75 text-slate-800 dark:text-slate-100 rounded-tl-none bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
                          >
                            <p className="whitespace-pre-wrap">{it.text}</p>
                            
                            <div className="flex items-center justify-end gap-2 mt-1">
                              {isMe && seenCount > 0 && (
                                <span className="text-[8px] font-semibold text-indigo-200">
                                  Seen by {seenCount}
                                </span>
                              )}
                              <span className={`text-[8px] block ${isMe ? "text-indigo-200" : "text-slate-400 dark:text-slate-500"}`}>
                                {new Date(it.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Typing Indicator */}
          {Array.from(typingUsers).length > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 italic px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-full w-fit shadow-sm animate-pulse">
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

        {/* Message Input */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={msg}
              onChange={(e) => handleTyping(e.target.value)}
              placeholder={username ? "Write a message..." : "Sign in to chat"}
              disabled={!username}
              className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-905 text-slate-800 dark:text-slate-100 placeholder-slate-400 transition"
            />
            <button
              type="submit"
              disabled={!username || !msg.trim()}
              className="h-8 px-4 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      {/* Member Details Modal Overlay */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex flex-col items-center mb-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-white text-base shadow-md mb-2 ${getAvatarColor(selectedMember)}`}>
                {String(selectedMember).slice(0, 1).toUpperCase()}
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{selectedMember}</h3>
              <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Circle Member</span>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleSendDirectMessage(selectedMember)}
                className="w-full py-2.5 text-xs font-semibold text-white bg-indigo-650 hover:bg-indigo-700 rounded-xl transition text-center shadow-sm"
              >
                💬 Send Direct Message
              </button>

              {isUserAdmin && (
                <>
                  {!community.admins?.includes(selectedMember) && (
                    <button
                      onClick={() => handlePromoteMember(selectedMember)}
                      className="w-full py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition text-center"
                    >
                      🛡️ Promote to Admin
                    </button>
                  )}

                  {community.creator !== selectedMember && (
                    <button
                      onClick={() => handleKickMember(selectedMember)}
                      className="w-full py-2.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/50 rounded-xl transition text-center"
                    >
                      🚪 Remove from Circle
                    </button>
                  )}
                </>
              )}

              <button
                onClick={() => setSelectedMember(null)}
                className="w-full py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition text-center mt-1"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message action dialog */}
      {selectedMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-2">Message Actions</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-150 dark:border-slate-800 pb-3 mb-4 truncate italic">
              "{selectedMsg.text}"
            </p>

            <div className="flex flex-col gap-2">
              {/* Only show Message Info if the logged-in user is the sender of this message */}
              {selectedMsg.sender === username && (
                <button
                  onClick={() => setShowInfoModal(true)}
                  className="w-full py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition text-center"
                >
                  ℹ️ Message Info
                </button>
              )}

              {/* Creator can delete any message, normal members can only delete their own */}
              {(selectedMsg.sender === username || community.creator === username) && (
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
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-3">Message Info</h3>
            
            <div className="space-y-2.5 text-[11px] text-slate-600 dark:text-slate-300">
              <div>
                <span className="font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider text-[9px] block">Sender</span>
                <span className="font-semibold text-slate-750 dark:text-slate-200">{selectedMsg.sender}</span>
              </div>

              <div>
                <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[9px] block">Sent At</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {new Date(selectedMsg.createdAt).toLocaleString()}
                </span>
              </div>

              <div>
                <span className="font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider text-[9px] block">Seen By Members</span>
                <div className="mt-1 max-h-32 overflow-y-auto space-y-1 pr-1">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    <span>{selectedMsg.sender} (Sender)</span>
                  </div>
                  {selectedMsg.seenBy.filter(u => u !== selectedMsg.sender).map(u => (
                    <div key={u} className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                      <span>{u}</span>
                    </div>
                  ))}
                  {selectedMsg.seenBy.filter(u => u !== selectedMsg.sender).length === 0 && (
                    <span className="text-slate-400 dark:text-slate-500 italic text-[10px] block mt-1">No other member has seen this yet</span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowInfoModal(false);
                setSelectedMsg(null);
              }}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow mt-5 transition text-center"
            >
              Close Info
            </button>
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
            <p className="text-xs text-slate-655 dark:text-slate-350 leading-relaxed mb-5">
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
