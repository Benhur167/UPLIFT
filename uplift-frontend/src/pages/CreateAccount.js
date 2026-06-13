// CreateAccount.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/auth.css";

const API = process.env.REACT_APP_API;
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "739257618239-mockclientid.apps.googleusercontent.com";
const PRESET = ["avatar2.jpg","avatar4.jpg","avatar5.jpg","avatar6.jpg","avatar8.jpg","avatar9.jpg"];

export default function CreateAccount() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState(PRESET[0]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Load Google Sign-In (GIS) script dynamically for signup
  useEffect(() => {
    const initGoogle = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse
        });
        window.google.accounts.id.renderButton(
          document.getElementById("google-signup-btn"),
          { theme: "outline", size: "large", width: "100%", text: "signup_with" }
        );
      }
    };

    if (!document.getElementById("google-gis-script-signup")) {
      const script = document.createElement("script");
      script.id = "google-gis-script-signup";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = initGoogle;
      document.body.appendChild(script);
    } else {
      initGoogle();
    }
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
        setError(data.message || "Google signup failed");
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

      console.log("✅ Google signup success:", data.username);

      if (data.role === "admin") {
        navigate("/admin/support");
      } else {
        navigate("/");
      }
    } catch (e) {
      console.error(e);
      setError("Google server signup failed. Try again.");
      setLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (username.trim().length < 3) return setError("Username must be at least 3 characters.");
    if (!email.trim()) return setError("Email is required.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");

    setLoading(true);
    try {
      const res = await fetch(`${API}/users/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username: username.trim(), 
          password, 
          avatar, 
          email: email.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Signup failed");
        setLoading(false);
        return;
      }
      
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
              <h1>Uplift — Create Account</h1>
              <p>Use a decoy name and avatar to stay anonymous while connecting with others.</p>
            </div>
          </div>

          <div className="note">
            Choose a decoy username and avatar. This app is designed to protect real identity — do not share real personal data.
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="small">Sample guidelines</div>
            <ul style={{ marginTop:8, color:"#475569" }}>
              <li>Pick a memorable decoy name (3+ chars)</li>
              <li>Strong password helps protect your decoy account</li>
              <li>You can change avatar later in settings</li>
            </ul>
          </div>
        </div>

        <div className="auth-form">
          <h3 style={{ marginTop:0 }}>Create Anonymous Account</h3>
          <form onSubmit={submit}>
            <div className="field">
              <label>Decoy username</label>
              <input className="input" value={username} onChange={e=>setUsername(e.target.value)} placeholder="e.g. calm_mind" />
            </div>

            <div className="field">
              <label>Email (required, for OTP resets)</label>
              <input className="input" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="e.g. your-email@domain.com" />
            </div>

            <div className="field">
              <label>Password</label>
              <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Choose a secure password" />
              <div className="small">At least 6 characters. For demo only — passwords are hashed on the server.</div>
            </div>

            <div className="field">
              <label>Choose an avatar</label>
              <div className="avatar-grid" role="list">
                {PRESET.map(a => (
                  <div
                    key={a}
                    role="listitem"
                    className={`avatar-option ${avatar===a ? "selected" : ""}`}
                    onClick={() => setAvatar(a)}
                  >
                    <img src={`/${a}`} alt={a} />
                  </div>
                ))}
              </div>
            </div>

            {error && <div className="error">{error}</div>}

            <div style={{ display:"flex", gap:10, marginTop:12, flexDirection: "column" }}>
              <div style={{ display:"flex", gap:10 }}>
                <button className="btn primary" type="submit" disabled={loading} style={{ flex: 1 }}>
                  {loading ? "Creating…" : "Create Account"}
                </button>
                <button type="button" className="btn ghost" onClick={() => navigate("/signin")} style={{ flex: 1 }}>
                  Already have account
                </button>
              </div>

              <div style={{ margin: "8px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>or</div>

              <div id="google-signup-btn" style={{ minHeight: 40 }}></div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
