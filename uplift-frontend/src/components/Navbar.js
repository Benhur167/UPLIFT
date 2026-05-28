// src/components/Navbar.js
import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function NavBar() {
  const loc = useLocation();

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
      active ? "text-blue-600 font-bold" : "text-slate-600 hover:text-slate-900"
    }`;
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Left Side: Brand Logo and Main Nav Links */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 font-extrabold text-white shadow-sm transition-transform duration-200 group-hover:scale-105">
              UP
            </div>
            <span className="text-lg font-black tracking-wider text-slate-900 group-hover:text-blue-600 transition-colors">
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

        {/* Right Side: User Profile & Auth Controls */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {user.avatar ? (
                  <img
                    src={user.avatar.startsWith("http") ? user.avatar : `/${user.avatar}`}
                    alt="avatar"
                    className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                    {(user.username || "U").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:inline text-sm font-medium text-slate-700">
                  Hi, {user.username || user.user?.username}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition duration-200"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/signin"
                className="rounded-lg px-3.5 py-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900 transition duration-200"
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
