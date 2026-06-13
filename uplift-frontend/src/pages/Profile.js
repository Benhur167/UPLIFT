// src/pages/Profile.js
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API || "http://localhost:5000/api";
const AVATAR_PRESETS = [
  "avatar1.jpg", "avatar2.jpg", "avatar3.jpg",
  "avatar4.jpg", "avatar5.jpg", "avatar6.jpg",
  "avatar7.jpg", "avatar8.jpg", "avatar9.jpg"
];

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

export default function Profile() {
  const navigate = useNavigate();
  
  // Local storage profile state
  const [localUser, setLocalUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("uplift_user") || "null");
    } catch {
      return null;
    }
  });

  const [dbUser, setDbUser] = useState(null);
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  
  // Tab control
  const [activeTab, setActiveTab] = useState("stories"); // "stories" | "communities" | "support"
  
  // Lists data
  const [stories, setStories] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [supportSessions, setSupportSessions] = useState([]);
  
  // State loaders & alerts
  const [loading, setLoading] = useState(true);
  const [savingBio, setSavingBio] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const username = localUser?.username || localUser?.user?.username || null;

  useEffect(() => {
    if (!localUser || !username) {
      navigate("/signin");
      return;
    }

    const loadProfileData = async () => {
      setLoading(true);
      setError("");
      try {
        const headers = { "x-username": username };

        // 1. Fetch Fresh DB Profile (including Bio)
        const profileRes = await fetch(`${API_BASE}/users/profile`, { headers });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setDbUser(profileData);
          setBio(profileData.bio || "");
          setAvatar(profileData.avatar || "");
          
          // Keep LocalStorage synced with any backend updates
          const syncedLocal = {
            ...localUser,
            avatar: profileData.avatar,
            role: profileData.role,
            email: profileData.email,
            user: {
              ...(localUser.user || {}),
              avatar: profileData.avatar,
              role: profileData.role,
              email: profileData.email,
            }
          };
          localStorage.setItem("uplift_user", JSON.stringify(syncedLocal));
          setLocalUser(syncedLocal);
        }

        // 2. Fetch User Stories
        const storiesRes = await fetch(`${API_BASE}/stories/user/${username}`);
        if (storiesRes.ok) {
          const storiesData = await storiesRes.json();
          setStories(storiesData || []);
        }

        // 3. Fetch All Communities (and filter where current user is member)
        const commsRes = await fetch(`${API_BASE}/communities`);
        if (commsRes.ok) {
          const commsData = await commsRes.json();
          const joined = commsData.filter(c => c.members?.includes(username));
          setCommunities(joined);
        }

        // 4. Fetch User Private Support Sessions
        const supportRes = await fetch(`${API_BASE}/support/user-sessions`, { headers });
        if (supportRes.ok) {
          const supportData = await supportRes.json();
          setSupportSessions(supportData || []);
        }
      } catch (e) {
        console.error("Failed to load profile resources", e);
        setError("Failed to load profile data. Try refreshing the page.");
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const handleSaveBio = async () => {
    setSavingBio(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/users/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-username": username
        },
        body: JSON.stringify({ bio })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save bio");
      
      setSuccess("Bio status updated successfully!");
      setDbUser(data);
      
      // Clear toast after 3s
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      console.error(e);
      setError(e.message || "Error updating bio");
    } finally {
      setSavingBio(false);
    }
  };

  const handleSelectAvatar = async (selectedAvatar) => {
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/users/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-username": username
        },
        body: JSON.stringify({ avatar: selectedAvatar })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update avatar");

      setAvatar(selectedAvatar);
      setDbUser(data);
      setShowAvatarPicker(false);
      setSuccess("Avatar updated successfully!");

      // Sync local storage
      const syncedLocal = {
        ...localUser,
        avatar: selectedAvatar,
        user: { ...(localUser.user || {}), avatar: selectedAvatar }
      };
      localStorage.setItem("uplift_user", JSON.stringify(syncedLocal));
      setLocalUser(syncedLocal);
      
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      console.error(e);
      setError(e.message || "Error updating avatar");
    }
  };

  const handleDeleteStory = async () => {
    if (!deletingId) return;
    setError("");
    try {
      const res = await fetch(`${API_BASE}/stories/${deletingId}`, {
        method: "DELETE",
        headers: { "x-username": username }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete story");

      setStories(stories.filter(s => s._id !== deletingId));
      setSuccess("Story deleted successfully!");
      setDeletingId(null);
      
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      console.error(e);
      setError(e.message || "Error deleting story");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("uplift_user");
    localStorage.removeItem("username");
    window.location.href = "/";
  };

  if (!username) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans py-10 transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Banner Alert/Toasts */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-semibold shadow-sm flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-xs font-semibold shadow-sm flex items-center gap-2 animate-pulse">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
            <span className="flex h-5 w-5 relative mb-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-5 w-5 bg-blue-600"></span>
            </span>
            <p className="text-sm font-semibold">Loading profile parameters...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Account profile cards */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              
              {/* Profile Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/50 dark:shadow-none rounded-2xl p-6 transition-all duration-300">
                <div className="flex flex-col items-center text-center">
                  
                  {/* Avatar section */}
                  <div className="relative group cursor-pointer mb-4" onClick={() => setShowAvatarPicker(true)}>
                    {avatar ? (
                      <img
                        src={`/${avatar}`}
                        alt="avatar"
                        className="h-24 w-24 rounded-full border-2 border-slate-100 dark:border-slate-800 object-cover shadow-md group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className={`h-24 w-24 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-md group-hover:scale-105 transition-transform duration-200 ${getAvatarColor(username)}`}>
                        {username.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    
                    <div className="absolute inset-0 rounded-full bg-slate-950/45 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold tracking-wider transition-opacity duration-200 uppercase">
                      Change
                    </div>
                  </div>

                  <h2 className="text-lg font-black tracking-wide text-slate-900 dark:text-slate-100">{username}</h2>
                  <span className="px-2.5 py-0.5 mt-1.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 capitalize">
                    {dbUser?.role || "user"} account
                  </span>

                  {/* Email Toggle info */}
                  <div className="w-full mt-6 py-3 px-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-900 text-left">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Decoy Recovery Email</label>
                    <div className="flex items-center justify-between mt-1 gap-2">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
                        {showEmail ? (dbUser?.email || "No email linked") : "•••••••••••••••••••••"}
                      </span>
                      <button
                        onClick={() => setShowEmail(!showEmail)}
                        className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0"
                      >
                        {showEmail ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bio status editor */}
                <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Bio & Status</label>
                    <span className="text-[10px] text-slate-400">Public inside circles</span>
                  </div>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="e.g. Seeking positivity & supporting others... (locked username)"
                    maxLength={160}
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/40 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none leading-relaxed transition-all text-slate-800 dark:text-slate-100 resize-none"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] text-slate-400">{160 - bio.length} chars left</span>
                    <button
                      onClick={handleSaveBio}
                      disabled={savingBio}
                      className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] shadow-sm disabled:opacity-50 transition-all flex items-center gap-1"
                    >
                      {savingBio ? "Saving..." : "Save Status"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Actions Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">Account Controls</h3>
                <div className="flex flex-col gap-3">
                  <Link to="/" className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 font-bold text-xs transition text-center">
                    Return to Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/45 text-rose-600 dark:text-rose-400 font-bold text-xs transition border border-rose-100/50 dark:border-rose-900/40"
                  >
                    Logout Account
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Dynamic statistics dashboard & tab sections */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              
              {/* Statistics Counters banner */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm text-center">
                  <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{stories.length}</span>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Stories Shared</p>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm text-center">
                  <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400">{communities.length}</span>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Circles Joined</p>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm text-center">
                  <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{supportSessions.length}</span>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Support Chats</p>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="border-b border-slate-200 dark:border-slate-800 flex gap-6">
                <button
                  onClick={() => setActiveTab("stories")}
                  className={`pb-3 text-xs font-bold tracking-wide transition-all border-b-2 ${
                    activeTab === "stories"
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  My Shared Stories ({stories.length})
                </button>
                
                <button
                  onClick={() => setActiveTab("communities")}
                  className={`pb-3 text-xs font-bold tracking-wide transition-all border-b-2 ${
                    activeTab === "communities"
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Joined Circles ({communities.length})
                </button>

                <button
                  onClick={() => setActiveTab("support")}
                  className={`pb-3 text-xs font-bold tracking-wide transition-all border-b-2 ${
                    activeTab === "support"
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Private Support Log ({supportSessions.length})
                </button>
              </div>

              {/* Tab: My Stories */}
              {activeTab === "stories" && (
                <div className="space-y-4">
                  {stories.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                      You haven't posted any stories yet. 
                      <div className="mt-3">
                        <Link to="/" className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition">
                          Share a story
                        </Link>
                      </div>
                    </div>
                  ) : (
                    stories.map((s) => (
                      <article 
                        key={s._id}
                        className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 shadow-sm rounded-xl p-5 transition flex flex-col sm:flex-row gap-4 justify-between"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                              s.type === "success" 
                                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                                : "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400"
                            }`}>
                              {s.type === "success" ? "Success Story" : "Problem Story"}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug">{s.title || "Untitled shared story"}</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed whitespace-pre-line break-words">{s.content}</p>
                          
                          {Array.isArray(s.tags) && s.tags.length > 0 && (
                            <div className="flex gap-1 flex-wrap mt-3">
                              {s.tags.map((t, i) => (
                                <span key={i} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-semibold">
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex sm:flex-col justify-end items-end mt-2 sm:mt-0">
                          <button
                            onClick={() => setDeletingId(s._id)}
                            className="p-2 text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/25 transition duration-150"
                            title="Delete Story"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              )}

              {/* Tab: Communities Joined */}
              {activeTab === "communities" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {communities.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-400 dark:text-slate-500 text-xs sm:col-span-2">
                      You haven't joined any chat circles yet.
                      <div className="mt-3">
                        <Link to="/community-chat" className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition">
                          Browse Circles
                        </Link>
                      </div>
                    </div>
                  ) : (
                    communities.map((c) => (
                      <div 
                        key={c._id}
                        className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 hover:shadow-md transition flex flex-col justify-between"
                      >
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{c.name}</h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{c.description || "No description provided."}</p>
                          <span className="text-[10px] text-slate-400 font-semibold mt-3 block">{c.members?.length || 0} members active</span>
                        </div>
                        <div className="mt-4">
                          <Link 
                            to={`/community/${c._id}`}
                            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] shadow-sm transition block text-center"
                          >
                            Enter Chat Room
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab: Support Sessions Log */}
              {activeTab === "support" && (
                <div className="space-y-4">
                  {supportSessions.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                      You haven't started any support sessions yet.
                      <div className="mt-3">
                        <Link to="/support" className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition">
                          Request Private Support
                        </Link>
                      </div>
                    </div>
                  ) : (
                    supportSessions.map((sess) => (
                      <div 
                        key={sess._id}
                        className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Session ID: {sess._id.slice(-6).toUpperCase()}</span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                              sess.status === "open"
                                ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                            }`}>
                              {sess.status || "open"}
                            </span>
                          </div>
                          
                          <p className="text-[10px] text-slate-400 mt-1">
                            Started: {new Date(sess.createdAt || sess.created_at).toLocaleString()}
                          </p>

                          {sess.requestedCall?.phone && (
                            <div className="mt-2 text-[10px] bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-900 py-1.5 px-3 rounded-lg w-fit">
                              <span className="font-semibold text-slate-500">Call Request: </span>
                              <span className="text-slate-600 dark:text-slate-300 font-bold">{sess.requestedCall.phone}</span>
                              <span className="text-slate-400"> ({sess.requestedCall.status || "requested"})</span>
                            </div>
                          )}
                        </div>

                        <div>
                          <Link 
                            to={`/support/session/${sess._id}`}
                            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] shadow-sm transition block text-center"
                          >
                            Open Support Room
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

            </div>
          </div>
        )}

      </div>

      {/* MODAL: Avatar Picker */}
      {showAvatarPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-scaleUp">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Select Decoy Avatar</h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-normal">
              Change your profile image to another anonymous preset. Changing is instant.
            </p>

            <div className="grid grid-cols-3 gap-3.5 mt-5">
              {AVATAR_PRESETS.map((p) => (
                <div 
                  key={p}
                  onClick={() => handleSelectAvatar(p)}
                  className={`aspect-square rounded-xl border overflow-hidden cursor-pointer hover:scale-105 transition-all duration-150 ${
                    avatar === p 
                      ? "border-blue-600 ring-2 ring-blue-500/20" 
                      : "border-slate-100 dark:border-slate-800 hover:border-slate-200"
                  }`}
                >
                  <img src={`/${p}`} alt={p} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowAvatarPicker(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Delete Confirmation */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-scaleUp">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Delete Shared Story?</h3>
            <p className="text-[11px] text-slate-400 mt-1.5 leading-normal">
              Are you sure you want to permanently delete this story? This action is irreversible and will remove it from all feeds immediately.
            </p>

            <div className="flex justify-end gap-2.5 mt-6">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteStory}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition"
              >
                Delete Story
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
