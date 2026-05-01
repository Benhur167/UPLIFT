// SignIn.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/auth.css";

const API = process.env.REACT_APP_API;

export default function SignIn() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Login failed");
        setLoading(false);
        return;
      }

      // ✅ Save both the full user object and plain username
      localStorage.setItem(
        "uplift_user",
        JSON.stringify({ username: data.username, avatar: data.avatar })
      );
      localStorage.setItem("username", data.username); // 👈 Needed for PostSuccess.js

      console.log("✅ Logged in as:", data.username);

      navigate("/");
    } catch (e) {
      console.error(e);
      setError("Server error. Try again.");
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-left">
          <div className="brand">
            <div className="logo-mark">UP</div>
            <div>
              <h1>Welcome Back</h1>
              <p>
                Sign in to your anonymous account and continue sharing &
                connecting.
              </p>
            </div>
          </div>

          <div className="note">
            If you don't have an account, use the sign-up button to create one
            with an avatar and decoy name.
          </div>
        </div>

        <div className="auth-form">
          <h3 style={{ marginTop: 0 }}>Sign In</h3>
          <form onSubmit={submit}>
            <div className="field">
              <label>Decoy username</label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your decoy username"
              />
            </div>

            <div className="field">
              <label>Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>

            {error && <div className="error">{error}</div>}

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button className="btn primary" type="submit" disabled={loading}>
                {loading ? "Signing in…" : "Sign In"}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => navigate("/signup")}
              >
                Create account
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
