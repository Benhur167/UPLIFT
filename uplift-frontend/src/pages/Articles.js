import React, { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/resources.css";

const articles = [
  {
    title: "How to start a daily mindfulness habit",
    excerpt: "Tiny steps build consistency. Start with one minute.",
    content: "Building a new habit is less about the duration of the practice and more about consistency. When starting out with mindfulness, begin with just one minute a day. Choose a specific anchor time, like right after your morning coffee. Sit quietly and focus solely on your breath. If your mind wanders (and it will), gently bring it back. The key is daily frequency, not duration. One minute done daily is vastly superior to 30 minutes done once a week. Gradually, as the habit takes root, you can expand the session to 5, 10, or 20 minutes."
  },
  {
    title: "Managing panic with breathwork",
    excerpt: "A guided 4-4-8 breathing practice to calm the nervous system.",
    content: "When panic strikes, our breathing naturally becomes shallow and rapid, which triggers a fight-or-flight response. To counter this, we can use structured breathing techniques to physically lower our heart rate and calm our nervous system. A simple yet powerful practice is the 4-4-8 method: inhale deeply through your nose for a count of 4, hold the breath for a count of 4, and exhale slowly through pursed lips for a count of 8. Repeat this cycle 5 times. By prolonging the exhalation, you activate the parasympathetic nervous system, signaling to your brain that you are safe."
  },
  {
    title: "Sleep hygiene for better rest",
    excerpt: "Small evening rituals that signal your brain it’s time to wind down.",
    content: "Quality sleep is the cornerstone of mental health. To improve your sleep hygiene, create small evening rituals that signal your brain it's time to recover. Turn off blue-light-emitting screens at least 45 minutes before sleep to allow melatonin levels to rise. Keep your room cool (around 65°F or 18°C) and dark. Write down your to-do list for tomorrow to unload racing thoughts. Finally, practice deep belly breathing in bed. Focus on the rise and fall of your abdomen to ease physical tension and prepare your body for deep rest."
  }
];

export default function Articles() {
  const [activeArticle, setActiveArticle] = useState(null);

  return (
    <div className="page-bg p-6 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <Link to="/" className="text-sm text-blue-600 hover:underline">&larr; Back to Home</Link>
          <h1 className="text-2xl font-semibold text-blue-800 mt-2">Articles</h1>
          <p className="muted-blue mt-1">Short, practical reads to support mental wellbeing.</p>
        </header>

        <div className="grid gap-4">
          {articles.map((a, i) => (
            <article key={i} className="card card-hover flex flex-col">
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-4">
                  <h3 className="text-lg font-semibold text-blue-800">{a.title}</h3>
                  <p className="text-slate-600 mt-1">{a.excerpt}</p>
                </div>
                <div>
                  <button onClick={() => setActiveArticle(a)} className="btn-soft">Read</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Article Detail Modal */}
      {activeArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-all duration-300">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-sm font-bold text-blue-800">
                Mental Wellness Article
              </h2>
              <button
                onClick={() => setActiveArticle(null)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <h1 className="text-xl font-black text-slate-800 mb-3">{activeArticle.title}</h1>
              <p className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded w-fit mb-4">
                {activeArticle.excerpt}
              </p>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                {activeArticle.content}
              </p>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                onClick={() => setActiveArticle(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition"
              >
                Close Article
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
