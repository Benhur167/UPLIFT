// CreateAccount.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/auth.css";

const API = process.env.REACT_APP_API;
const PRESET = ["avatar2.jpg","avatar4.jpg","avatar5.jpg","avatar6.jpg","avatar8.jpg","avatar9.jpg"];

export default function CreateAccount() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState(PRESET[0]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (username.trim().length < 3) return setError("Username must be at least 3 characters.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");

    setLoading(true);
    try {
      const res = await fetch(`${API}/users/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password, avatar })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Signup failed");
        setLoading(false);
        return;
      }
      // store minimal session
      localStorage.setItem("uplift_user", JSON.stringify({ username: data.username, avatar: data.avatar }));
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

            <div style={{ display:"flex", gap:10, marginTop:12 }}>
              <button className="btn primary" type="submit" disabled={loading}>{loading ? "Creating…" : "Create Account"}</button>
              <button type="button" className="btn ghost" onClick={() => navigate("/signin")}>Already have account</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
