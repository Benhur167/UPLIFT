// CreateAccount.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/auth.css";

const API = process.env.REACT_APP_API;
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "739257618239-mockclientid.apps.googleusercontent.com";
const PRESET = ["avatar2.jpg","avatar4.jpg","avatar5.jpg","avatar6.jpg","avatar8.jpg","avatar9.jpg"];

// Decodes standard base64 Google JWT token payload locally
const decodeJWT = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("JWT decode failed", e);
    return null;
  }
};

export default function CreateAccount() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState(PRESET[0]);
  const [isGoogleSignUp, setIsGoogleSignUp] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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

  const handleGoogleResponse = (googleRes) => {
    setError("");
    setSuccess("");
    try {
      const payload = decodeJWT(googleRes.credential);
      if (!payload || !payload.email) {
        throw new Error("Could not extract email address from Google Account.");
      }

      setEmail(payload.email);
      if (payload.picture) {
        setAvatar(payload.picture);
      }
      setIsGoogleSignUp(true);
      setSuccess("Google account connected! Now choose your decoy username and password below to complete registration.");
    } catch (e) {
      console.error(e);
      setError(e.message || "Google connection failed. Try again.");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
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
          
          {success && (
            <div style={{ color: "#065f46", backgroundColor: "#ecfdf5", padding: "10px", borderRadius: "8px", fontSize: "11px", marginBottom: "12px", border: "1px solid #10b981", lineHeight: "1.4" }}>
              {success}
            </div>
          )}

          <form onSubmit={submit}>
            <div className="field">
              <label>Decoy username</label>
              <input className="input" value={username} onChange={e=>setUsername(e.target.value)} placeholder="e.g. calm_mind" />
            </div>

            <div className="field">
              <label>Email (required, for OTP resets)</label>
              <input 
                className="input" 
                type="email" 
                required 
                disabled={isGoogleSignUp}
                value={email} 
                onChange={e=>setEmail(e.target.value)} 
                placeholder="e.g. your-email@domain.com" 
                style={isGoogleSignUp ? { backgroundColor: "#f1f5f9", cursor: "not-allowed", color: "#475569" } : {}}
              />
              {isGoogleSignUp && (
                <button
                  type="button"
                  onClick={() => {
                    setIsGoogleSignUp(false);
                    setEmail("");
                    setAvatar(PRESET[0]);
                    setSuccess("");
                  }}
                  style={{
                    fontSize: "11.5px",
                    color: "#ef4444",
                    textDecoration: "underline",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    marginTop: "6px",
                    display: "block",
                    padding: 0
                  }}
                >
                  Clear Google connection
                </button>
              )}
            </div>

            <div className="field">
              <label>Password</label>
              <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Choose a secure password" />
              <div className="small">At least 6 characters. Passwords are safely hashed on the server.</div>
            </div>

            <div className="field">
              <label>Choose an avatar</label>
              {avatar.startsWith("http") ? (
                <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px" }}>
                  <img src={avatar} alt="Google Avatar" style={{ width: "45px", height: "45px", borderRadius: "50%", border: "2px solid #3b82f6", objectCover: "cover" }} />
                  <span style={{ fontSize: "11px", color: "#3b82f6", fontWeight: "bold" }}>Google profile photo imported</span>
                </div>
              ) : (
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
              )}
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

              {!isGoogleSignUp && (
                <>
                  <div style={{ margin: "8px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>or</div>
                  <div id="google-signup-btn" style={{ minHeight: 40 }}></div>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
