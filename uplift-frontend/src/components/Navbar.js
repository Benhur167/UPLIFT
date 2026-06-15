// src/components/Navbar.js
import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import socket from "../socket";

const API_BASE = process.env.REACT_APP_API || "http://localhost:5000/api";

export default function NavBar() {
  const loc = useLocation();
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);
  const [toastNotification, setToastNotification] = useState(null);
  const commNamesCache = useRef(new Map());

  // Initialize theme from document element class
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
  }, []);

  // Parse user session
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("uplift_user") || "null");
    } catch {
      return null;
    }
  })();

  const username = user?.username || user?.user?.username || null;

  // Auto-dismiss toast notification
  useEffect(() => {
    if (toastNotification) {
      const timer = setTimeout(() => setToastNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);

  // Connect socket and listen globally
  useEffect(() => {
    if (!username) return;

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("joinUserRoom", { username });

    const fetchCommName = async (commId) => {
      if (commNamesCache.current.has(commId)) {
        return commNamesCache.current.get(commId);
      }
      try {
        const res = await fetch(`${API_BASE}/communities/${commId}`);
        if (res.ok) {
          const data = await res.json();
          commNamesCache.current.set(commId, data.name);
          return data.name;
        }
      } catch (err) {
        console.error("Failed to fetch community name for toast", err);
      }
      return "Circle";
    };

    const handleChatMessage = async (msg) => {
      if (msg.sender === username || msg.sender === "system") return;

      // Check if user is currently inside this community's page
      const currentPath = window.location.pathname;
      if (currentPath === `/community/${msg.roomId}`) return;

      const commName = await fetchCommName(msg.roomId);
      setToastNotification({
        title: `🌐 Message in ${commName}`,
        message: `${msg.sender}: ${msg.text}`,
        route: `/community/${msg.roomId}`
      });
    };

    const handleNewDm = (msg) => {
      if (msg.sender === username) return;

      // Check if user is currently inside DM room with the sender
      const currentPath = window.location.pathname;
      if (currentPath === `/dm/${msg.sender}`) return;

      setToastNotification({
        title: `💬 DM from ${msg.sender}`,
        message: msg.text,
        route: `/dm/${msg.sender}`
      });
    };

    socket.on("chatMessage", handleChatMessage);
    socket.on("new_dm", handleNewDm);

    return () => {
      socket.off("chatMessage", handleChatMessage);
      socket.off("new_dm", handleNewDm);
    };
  }, [username, navigate]);

  const toggleTheme = () => {
    if (dark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setDark(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setDark(true);
    }
  };

  // Hide the navigation bar on authentication pages
  const isAuthPage = 
    loc.pathname === "/signin" || 
    loc.pathname === "/signup" || 
    loc.pathname === "/forgot-password";
    
  if (isAuthPage) return null;

  const role = user?.role || user?.user?.role || null;
  const isAdmin = role === "admin";

  const handleLogout = () => {
    localStorage.removeItem("uplift_user");
    localStorage.removeItem("username");
    window.location.href = "/";
  };

  const linkActiveStyle = (path) => {
    const active = loc.pathname.startsWith(path);
    return `text-sm font-semibold transition-colors duration-200 ${
      active 
        ? "text-blue-600 dark:text-blue-400 font-bold" 
        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
    }`;
  };

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          {/* Left Side: Brand Logo and Main Nav Links */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 font-extrabold text-white shadow-sm transition-transform duration-200 group-hover:scale-105">
                UP
              </div>
              <span className="text-lg font-black tracking-wider text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                UPLIFT
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-6">
              <Link to="/community-chat" className={linkActiveStyle("/community-chat")}>
                Communities
              </Link>
              <Link to="/success" className={linkActiveStyle("/success")}>
                Success Stories
              </Link>
              <Link to="/resources" className={linkActiveStyle("/resources")}>
                Resources
              </Link>
              <Link to="/support" className={linkActiveStyle("/support")}>
                Get Support
              </Link>

              {isAdmin && (
                <Link
                  to="/admin/support"
                  className="ml-2 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 hover:shadow transition-all duration-200"
                >
                  Admin Console
                </Link>
              )}
            </div>
          </div>

          {/* Right Side: Theme Switcher & User Profile Controls */}
          <div className="flex items-center gap-4">
            {/* Light/Dark Toggle */}
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 shadow-sm transition-all duration-200"
              aria-label="Toggle Theme"
              type="button"
            >
              {dark ? (
                // Sun Icon for Light Mode
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.364l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                // Moon Icon for Dark Mode
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {user ? (
              <div className="flex items-center gap-3">
                <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition duration-200 group">
                  {user.avatar ? (
                    <img
                      src={user.avatar.startsWith("http") ? user.avatar : `/${user.avatar}`}
                      alt="avatar"
                      className="h-8 w-8 rounded-full border border-slate-200 dark:border-slate-700 object-cover group-hover:border-blue-500 transition duration-200"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50 text-xs font-bold text-blue-700 dark:text-blue-300">
                      {(user.username || "U").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden sm:inline text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition duration-200">
                    Hi, {user.username || user.user?.username}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition duration-200"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/signin"
                  className="rounded-lg px-3.5 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition duration-200"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition duration-200"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {toastNotification && (
        <div 
          onClick={() => {
            if (toastNotification.route) {
              navigate(toastNotification.route);
            }
            setToastNotification(null);
          }}
          className="fixed top-4 right-4 z-[9999] max-w-sm w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition duration-150 animate-in slide-in-from-top-5 duration-200 flex items-start gap-3.5 text-slate-800 dark:text-slate-100"
        >
          <div className="bg-indigo-50 dark:bg-indigo-950/40 p-2 rounded-xl text-indigo-650 dark:text-indigo-400 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">{toastNotification.title}</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">{toastNotification.message}</p>
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setToastNotification(null);
            }}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 text-xs flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
