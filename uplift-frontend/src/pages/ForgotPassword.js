// ForgotPassword.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/auth.css";

const API = process.env.REACT_APP_API;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1); // 1 = Enter Email, 2 = Enter OTP & New Password
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email.trim()) return setError("Please enter your email.");

    setLoading(true);
    try {
      const res = await fetch(`${API}/users/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to request OTP");
        setLoading(false);
        return;
      }

      setInfo(data.message || "An OTP has been sent to your email. (Please check console logs too!)");
      setStep(2);
    } catch (err) {
      console.error(err);
      setError("Server error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!otpCode.trim()) return setError("Please enter the OTP code.");
    if (newPassword.length < 6) return setError("New password must be at least 6 characters.");

    setLoading(true);
    try {
      const res = await fetch(`${API}/users/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: email.trim(), 
          otpCode: otpCode.trim(), 
          newPassword 
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to reset password");
        setLoading(false);
        return;
      }

      setInfo("Password reset successfully! Redirecting to sign in...");
      setTimeout(() => {
        navigate("/signin");
      }, 2000);
    } catch (err) {
      console.error(err);
      setError("Server error. Try again.");
    } finally {
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
              <h1>Recover Account</h1>
              <p>Reset your password securely using an OTP code sent to your email.</p>
            </div>
          </div>
          <div className="note">
            Remember: Your privacy is key. We only use your email to verify password reset requests.
          </div>
        </div>

        <div className="auth-form">
          <h3 style={{ marginTop: 0 }}>Reset Password</h3>
          
          {step === 1 ? (
            <form onSubmit={handleRequestOTP}>
              <div className="field">
                <label>Registered Email Address</label>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  required
                />
              </div>

              {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
              {info && <div className="p-2.5 rounded-lg border font-semibold text-xs mb-3 text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900/50">{info}</div>}

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button className="btn primary" type="submit" disabled={loading} style={{ flex: 1 }}>
                  {loading ? "Sending OTP…" : "Send OTP"}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => navigate("/signin")}
                  style={{ flex: 1 }}
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetPassword}>
              <div className="mb-3 text-xs text-slate-600 dark:text-slate-400">
                An OTP was sent to <strong>{email}</strong>.
              </div>

              <div className="field">
                <label>Enter 6-Digit OTP</label>
                <input
                  className="input"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Enter the 6-digit code"
                  maxLength={6}
                  required
                />
              </div>

              <div className="field">
                <label>Choose New Password</label>
                <div style={{ position: "relative", display: "flex", flexDirection: "column" }}>
                  <input
                    className="input"
                    style={{ width: "100%", paddingRight: "40px" }}
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#64748b",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center"
                    }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
              {info && <div className="p-2.5 rounded-lg border font-semibold text-xs mb-3 text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900/50">{info}</div>}

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button className="btn primary" type="submit" disabled={loading} style={{ flex: 1 }}>
                  {loading ? "Resetting…" : "Reset Password"}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setStep(1)}
                  style={{ flex: 1 }}
                >
                  Change Email
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
