// SignIn.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/auth.css";

const API = process.env.REACT_APP_API;
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "739257618239-mockclientid.apps.googleusercontent.com"; // Fallback placeholder

export default function SignIn() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Load Google Sign-In (GIS) script dynamically
  useEffect(() => {
    const initGoogle = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse
        });
        window.google.accounts.id.renderButton(
          document.getElementById("google-signin-btn"),
          { theme: "outline", size: "large", width: "100%", text: "signin_with" }
        );
      }
    };

    const existingScript = document.getElementById("google-gis-script");
    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "google-gis-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = initGoogle;
      document.body.appendChild(script);
    } else {
      if (window.google) {
        initGoogle();
      } else {
        existingScript.addEventListener("load", initGoogle);
      }
    }

    return () => {
      const script = document.getElementById("google-gis-script");
      if (script) {
        script.removeEventListener("load", initGoogle);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleResponse = async (googleRes) => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/users/google-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: googleRes.credential }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Google login failed");
        setLoading(false);
        return;
      }

      // Save user details with both structures for full compatibility
      const userData = {
        username: data.username,
        avatar: data.avatar,
        role: data.role || "user",
        email: data.email || null,
        user: {
          username: data.username,
          avatar: data.avatar,
          role: data.role || "user",
          email: data.email || null
        }
      };

      localStorage.setItem("uplift_user", JSON.stringify(userData));
      localStorage.setItem("username", data.username);

      console.log("✅ Google login success:", data.username);

      if (data.role === "admin") {
        navigate("/admin/support");
      } else {
        navigate("/");
      }
    } catch (e) {
      console.error(e);
      setError("Google server login failed. Try again.");
      setLoading(false);
    }
  };

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

      // Save user details with both structures for full compatibility
      const userData = {
        username: data.username,
        avatar: data.avatar,
        role: data.role || "user",
        email: data.email || null,
        user: {
          username: data.username,
          avatar: data.avatar,
          role: data.role || "user",
          email: data.email || null
        }
      };

      localStorage.setItem("uplift_user", JSON.stringify(userData));
      localStorage.setItem("username", data.username);

      console.log("✅ Logged in as:", data.username);

      if (data.role === "admin") {
        navigate("/admin/support");
      } else {
        navigate("/");
      }
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ margin: 0 }}>Password</label>
                <span 
                  onClick={() => navigate("/forgot-password")} 
                  className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer underline"
                >
                  Forgot password?
                </span>
              </div>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>

            {error && <div className="error">{error}</div>}

            <div style={{ display: "flex", gap: 10, marginTop: 12, flexDirection: "column" }}>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn primary" type="submit" disabled={loading} style={{ flex: 1 }}>
                  {loading ? "Signing in…" : "Sign In"}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => navigate("/signup")}
                  style={{ flex: 1 }}
                >
                  Create account
                </button>
              </div>
              
              <div className="my-2 text-center text-slate-400 dark:text-slate-500 text-xs">or</div>
              
              <div id="google-signin-btn" style={{ minHeight: 40 }}></div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
