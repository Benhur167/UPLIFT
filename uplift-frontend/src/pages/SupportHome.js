// src/pages/SupportHome.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = process.env.REACT_APP_API;

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("uplift_user") || "null"); } catch { return null; }
}

export default function SupportHome() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // optionally load past sessions for this user in the future
  }, []);

  // Called when user clicks "Start Support Session"
  async function startSupportSession() {
    setError("");
    const stored = getStoredUser();
    if (!stored || !stored.username) {
      setError("You must sign in to start a support session. Please log in first.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/support/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-username': stored.username
        },
        body: JSON.stringify({}) // authCheck uses header; body empty is fine
      });

      if (!res.ok) {
        const text = await res.text().catch(()=>null);
        throw new Error(text || `Failed to start session (${res.status})`);
      }

      const session = await res.json();
      navigate(`/support/session/${session._id}`, { state: { session } });
    } catch (e) {
      console.error('startSupportSession error', e);
      setError(e?.message || "Could not start support session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/40 flex flex-col font-sans py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto w-full">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="mx-auto p-3 bg-indigo-50 text-indigo-600 rounded-2xl w-fit mb-4 shadow-sm">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Need Support?</h1>
          <p className="text-slate-500 mt-2 text-sm max-w-md mx-auto leading-relaxed">
            Start a secure, private support session with our moderator team. We're here to listen and help.
          </p>
        </header>

        {/* Card */}
        <section className="bg-white border border-slate-100 shadow-xl shadow-slate-100/50 rounded-2xl p-6 sm:p-8">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">How it works</h3>
              <ol className="relative border-l border-slate-100 space-y-5 ml-2.5">
                <li className="relative pl-6">
                  <span className="absolute -left-3 top-0.5 flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold shadow-sm">1</span>
                  <h4 className="text-xs font-bold text-slate-800">Initialize Private Session</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                    Click the button below to initialize a secure conversation space dedicated entirely to you.
                  </p>
                </li>
                <li className="relative pl-6">
                  <span className="absolute -left-3 top-0.5 flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold shadow-sm">2</span>
                  <h4 className="text-xs font-bold text-slate-800">Request Call or Book Therapist</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                    Inside the session, you can request an immediate callback or schedule an appointment with a psychiatrist.
                  </p>
                </li>
                <li className="relative pl-6">
                  <span className="absolute -left-3 top-0.5 flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold shadow-sm">3</span>
                  <h4 className="text-xs font-bold text-slate-800">Live Support Connection</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                    Our admin team is notified instantly in real time to chat with you and assist with your requests.
                  </p>
                </li>
              </ol>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
              <button
                onClick={startSupportSession}
                disabled={loading}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  "Starting..."
                ) : (
                  <>
                    <span>Start Support Session</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
              <button
                onClick={() => navigate("/")}
                className="py-3 px-5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Back to Home
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
