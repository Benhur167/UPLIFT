import React from "react";
import { Link } from "react-router-dom";
import "../styles/resources.css";


const articles = [
  { title: "How to start a daily mindfulness habit", excerpt: "Tiny steps build consistency. Start with one minute." },
  { title: "Managing panic with breathwork", excerpt: "A guided 4-4-8 breathing practice to calm the nervous system." },
  { title: "Sleep hygiene for better rest", excerpt: "Small evening rituals that signal your brain it’s time to wind down." }
];

export default function Articles() {
  return (
    <div className="page-bg p-6 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <Link to="/resources" className="text-sm text-blue-600 hover:underline">&larr; Back to Resources</Link>
          <h1 className="text-2xl font-semibold text-blue-800 mt-2">Articles</h1>
          <p className="muted-blue mt-1">Short, practical reads to support mental wellbeing.</p>
        </header>

        <div className="grid gap-4">
          {articles.map((a, i) => (
            <article key={i} className="card card-hover flex flex-col">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-blue-800">{a.title}</h3>
                  <p className="text-slate-600 mt-1">{a.excerpt}</p>
                </div>
                <div>
                  <button className="btn-soft">Read</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
