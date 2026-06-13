// src/components/Navbar.js
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

export default function NavBar() {
  const loc = useLocation();
  const [dark, setDark] = useState(false);

  // Initialize theme from document element class
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
  }, []);

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

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("uplift_user") || "null");
    } catch {
      return null;
    }
  })();

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
  );
}
