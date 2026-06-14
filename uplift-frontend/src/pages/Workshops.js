import React, { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/resources.css";

const workshops = [
  { 
    title: "Intro to Mindfulness", 
    duration: "30 min", 
    date: "Every Monday 7:00 PM", 
    description: "Join us for an introductory workshop to kickstart your mindfulness journey. We will cover basic breath-awareness exercises, guided body scan techniques, and explain how regular pauses help quiet a busy mind. Perfect for beginners. Includes a live Q&A session at the end."
  },
  { 
    title: "Managing Stress in the Moment", 
    duration: "45 min", 
    date: "Next: Sunday at 2:00 PM", 
    description: "A fast-paced, highly practical class dedicated to panic management and short-term stress reduction. Learn how to implement the 5-4-3-2-1 sensory grounding method, emergency deep breathing, and emotional centering techniques when high-pressure situations arise at work or in daily life."
  },
  { 
    title: "Sleep and Routine Clinic", 
    duration: "60 min", 
    date: "Monthly — 3rd Thursday 8:00 PM", 
    description: "Struggling with racing thoughts before bed? This masterclass goes deep into sleep sciences and routine formulation. We will review how to structure your bedroom environment, optimize circadian rhythms, construct a technology-free wind-down schedule, and use body scans to relax muscle groups."
  }
];

export default function Workshops() {
  const [activeWorkshop, setActiveWorkshop] = useState(null);
  const [signedUpWorkshops, setSignedUpWorkshops] = useState(new Set());
  const [showSuccessModal, setShowSuccessModal] = useState(null); // title of workshop signed up

  const handleSignUp = (title) => {
    setSignedUpWorkshops((prev) => {
      const next = new Set(prev);
      next.add(title);
      return next;
    });
    setShowSuccessModal(title);
  };

  return (
    <div className="page-bg p-6 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <Link to="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">&larr; Back to Home</Link>
          <h1 className="text-2xl font-semibold text-blue-800 dark:text-blue-400 mt-2">Workshops</h1>
          <p className="muted-blue mt-1">Live group sessions, guided practice and Q&A.</p>
        </header>

        <div className="grid gap-4">
          {workshops.map((w, i) => {
            const isSignedUp = signedUpWorkshops.has(w.title);
            return (
              <div key={i} className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-blue-800 dark:text-blue-400 flex items-center gap-2">
                    {w.title}
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded font-normal">{w.duration}</span>
                    {isSignedUp && (
                      <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-350 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 border border-emerald-100 dark:border-emerald-900/50 animate-fade-in">
                        ✓ Registered
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{w.date}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSignUp(w.title)}
                    disabled={isSignedUp}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition ${
                      isSignedUp
                        ? "bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    {isSignedUp ? "Registered" : "Sign up"}
                  </button>
                  <button onClick={() => setActiveWorkshop(w)} className="btn-soft">
                    Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Workshop Details Modal */}
      {activeWorkshop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-all duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <h2 className="text-sm font-bold text-blue-800 dark:text-blue-400">
                Workshop Details
              </h2>
              <button
                onClick={() => setActiveWorkshop(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <h1 className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight">{activeWorkshop.title}</h1>
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded font-semibold">{activeWorkshop.duration}</span>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded font-semibold">{activeWorkshop.date}</span>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {activeWorkshop.description}
              </p>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-950">
              <button
                onClick={() => setActiveWorkshop(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950 text-xs font-bold rounded-xl transition"
              >
                Close
              </button>
              <button
                disabled={signedUpWorkshops.has(activeWorkshop.title)}
                onClick={() => {
                  handleSignUp(activeWorkshop.title);
                  setActiveWorkshop(null);
                }}
                className={`px-4 py-2 text-white text-xs font-bold rounded-xl shadow-sm transition ${
                  signedUpWorkshops.has(activeWorkshop.title)
                    ? "bg-slate-200 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {signedUpWorkshops.has(activeWorkshop.title) ? "Registered" : "Register Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sign Up Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-all duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Body */}
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 dark:text-emerald-400 rounded-full flex items-center justify-center text-xl mx-auto shadow-inner border border-emerald-100 dark:border-emerald-900/50">
                ✓
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Registration Confirmed!</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal px-2">
                You have successfully signed up for <strong>{showSuccessModal}</strong>. We've reserved your spot and sent details to your registered profile email.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-center bg-slate-50 dark:bg-slate-950">
              <button
                onClick={() => setShowSuccessModal(null)}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
              >
                Awesome!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
