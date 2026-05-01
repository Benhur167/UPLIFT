// src/components/NavBar.js
import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function NavBar() {
  const loc = useLocation();
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("uplift_user") || "null");
    } catch {
      return null;
    }
  })();

  // Accept either { role } or { user: { role } } shapes
  const role = user?.role || user?.user?.role || null;
  const isAdmin = role === "admin";

  const handleLogout = () => {
    localStorage.removeItem("uplift_user");
    // preserve the existing behaviour — full reload to reset app state
    window.location.href = "/";
  };

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 18px",
        background: "#ffffff",
        borderBottom: "1px solid #eef2f7",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link to="/">
          <strong style={{ color: "#0f172a" }}>UPLIFT</strong>
        </Link>

        <Link
          to="/communities"
          style={{ color: loc.pathname.startsWith("/communities") ? "#0b5cff" : "#334155" }}
        >
          Communities
        </Link>

        <Link to="/success" style={{ color: loc.pathname === "/success" ? "#0b5cff" : "#334155" }}>
          Success
        </Link>

        <Link to="/resources" style={{ color: loc.pathname === "/resources" ? "#0b5cff" : "#334155" }}>
          Resources
        </Link>

        {/* Quick link for regular users to the Support area */}
        <Link to="/support" style={{ color: loc.pathname.startsWith("/support") ? "#0b5cff" : "#334155" }}>
          Support
        </Link>

        {/* Admin-only link */}
        {isAdmin && (
          <Link
            to="/admin/support"
            style={{
              marginLeft: 8,
              padding: "6px 8px",
              background: "#0b5cff",
              color: "#fff",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Admin Console
          </Link>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {user ? (
          <>
            <span style={{ color: "#0f172a" }}>Hi, {user.username || user.user?.username}</span>
            <button onClick={handleLogout} className="btn">
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/signin" className="btn">
              Sign In
            </Link>
            <Link to="/signup" className="btn btn-outline">
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
