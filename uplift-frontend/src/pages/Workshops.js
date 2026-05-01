import React from "react";
import { Link } from "react-router-dom";
import "../styles/resources.css";


const workshops = [
  { title: "Intro to Mindfulness — 30 min", date: "Every Monday 7pm", signup: "#"},
  { title: "Managing Stress in the Moment", date: "Next: 2025-11-02", signup: "#"},
  { title: "Sleep and Routine Clinic", date: "Monthly — 3rd Thu", signup: "#"}
];

export default function Workshops(){
  return (
    <div className="page-bg p-6 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <Link to="/resources" className="text-sm text-blue-600 hover:underline">&larr; Back to Resources</Link>
          <h1 className="text-2xl font-semibold text-blue-800 mt-2">Workshops</h1>
          <p className="muted-blue mt-1">Live group sessions, guided practice and Q&A.</p>
        </header>

        <div className="grid gap-4">
          {workshops.map((w, i) => (
            <div key={i} className="card flex items-center justify-between">
              <div>
                <div className="font-semibold text-blue-800">{w.title}</div>
                <div className="text-sm text-slate-500">{w.date}</div>
              </div>
              <div className="flex gap-2">
                <a href={w.signup} className="btn-primary">Sign up</a>
                <button className="btn-soft">Details</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
