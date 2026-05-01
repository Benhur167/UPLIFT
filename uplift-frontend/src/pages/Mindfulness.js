import React from "react";
import { Link } from "react-router-dom";
import "../styles/resources.css";


const quotes = [
  "Breathing in, I calm my body. Breathing out, I smile. — Thich Nhat Hanh",
  "You can’t stop the waves, but you can learn to surf. — Jon Kabat-Zinn",
  "The present moment is the only time over which we have dominion. — Thich Nhat Hanh",
  "Mindfulness is a pause — the space between stimulus and response."
];

const exercises = [
  { title: "5-minute breath", desc: "Close your eyes, breathe slowly in/out for five minutes." },
  { title: "Body scan", desc: "Scan from toes to head, noticing sensations without judgement." },
  { title: "Grounding 5-4-3-2-1", desc: "Name 5 things you see, 4 you feel, 3 you hear, 2 you smell, 1 you taste." }
];

export default function Mindfulness() {
  return (
    <div className="page-bg min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <Link to="/resources" className="text-sm text-blue-600 hover:underline">&larr; Back to Resources</Link>
          <h1 className="text-2xl font-semibold text-blue-800 mt-2">Mindfulness</h1>
          <p className="muted-blue mt-1">Short practices, quotes, and quick grounding tools.</p>
        </header>

        <section className="card mb-6">
          <h2 className="text-lg font-semibold text-blue-800">Daily Quotes</h2>
          <div className="mt-3 space-y-3">
            {quotes.map((q, i) => (
              <div key={i} className="widget">
                <div className="text-sm text-slate-700">“{q}”</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card mb-6">
          <h2 className="text-lg font-semibold text-blue-800">Quick Exercises</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {exercises.map((ex, i) => (
              <article key={i} className="p-4 rounded-lg border border-blue-100 bg-white">
                <div className="font-semibold text-blue-700">{ex.title}</div>
                <div className="text-sm text-slate-600 mt-1">{ex.desc}</div>
                <button className="mt-3 btn-primary">Start</button>
              </article>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="text-lg font-semibold text-blue-800">Notes & Prompts</h2>
          <ul className="mt-3 list-disc list-inside text-slate-600">
            <li>Write 3 things you noticed in 5 minutes of stillness.</li>
            <li>When you feel reactive, try a 4-count breath: inhale 4, hold 4, exhale 4.</li>
            <li>Keep a short log: 1 positive observation per day.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
