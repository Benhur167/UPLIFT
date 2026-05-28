import React, { useState, useEffect, useRef } from "react";
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

const bodyScanSteps = [
  "Bring awareness to your feet and toes. Feel their connection to the ground. Notice any warmth, coolness, or pressure. Breathe in, and release tension here.",
  "Move your focus up to your calves, knees, and thighs. Notice any tightness or relaxation. Let your legs feel heavy and completely supported.",
  "Shift attention to your lower back, abdomen, and chest. Feel the gentle rise and fall of your chest with each breath. Release any grip in your stomach.",
  "Direct your attention to your shoulders, arms, and hands. Allow your shoulders to drop away from your ears. Let go of any clenching in your fists.",
  "Finally, bring awareness to your neck, throat, jaw, and face. Relax your jaw, soften your forehead, and let your eyes rest. Feel your entire body calm and still."
];

export default function Mindfulness() {
  const [activeExercise, setActiveExercise] = useState(null);
  
  // 5-minute breath states
  const [breathPhase, setBreathPhase] = useState("Inhale"); // Inhale, Hold, Exhale
  const [breathTimeLeft, setBreathTimeLeft] = useState(60); // 1 minute demo for usability
  const breathTimerRef = useRef(null);
  const breathIntervalRef = useRef(null);

  // Body Scan state
  const [scanStep, setScanStep] = useState(0);

  // Grounding states
  const [groundingInputs, setGroundingInputs] = useState({
    see: "",
    touch: "",
    hear: "",
    smell: "",
    taste: ""
  });
  const [groundingFinished, setGroundingFinished] = useState(false);

  // Handle breathing exercise lifecycle
  useEffect(() => {
    if (activeExercise?.title === "5-minute breath") {
      setBreathTimeLeft(60);
      setBreathPhase("Inhale");

      // Count down timer
      breathTimerRef.current = setInterval(() => {
        setBreathTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(breathTimerRef.current);
            clearInterval(breathIntervalRef.current);
            return 0;
          }
          return t - 1;
        });
      }, 1000);

      // Breath phase cycler (4s inhale, 4s hold, 4s exhale)
      let count = 0;
      breathIntervalRef.current = setInterval(() => {
        count = (count + 1) % 3;
        if (count === 0) setBreathPhase("Inhale");
        else if (count === 1) setBreathPhase("Hold");
        else setBreathPhase("Exhale");
      }, 4000);
    }

    return () => {
      clearInterval(breathTimerRef.current);
      clearInterval(breathIntervalRef.current);
    };
  }, [activeExercise]);

  const handleStart = (ex) => {
    setActiveExercise(ex);
    setScanStep(0);
    setGroundingInputs({ see: "", touch: "", hear: "", smell: "", taste: "" });
    setGroundingFinished(false);
  };

  const closeExercise = () => {
    setActiveExercise(null);
    clearInterval(breathTimerRef.current);
    clearInterval(breathIntervalRef.current);
  };

  return (
    <div className="page-bg min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <Link to="/" className="text-sm text-blue-600 hover:underline">&larr; Back to Home</Link>
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
              <article key={i} className="p-4 rounded-lg border border-blue-100 bg-white shadow-sm flex flex-col justify-between">
                <div>
                  <div className="font-semibold text-blue-700">{ex.title}</div>
                  <div className="text-sm text-slate-600 mt-1">{ex.desc}</div>
                </div>
                <button onClick={() => handleStart(ex)} className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition self-start">
                  Start
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="text-lg font-semibold text-blue-800">Notes & Prompts</h2>
          <ul className="mt-3 list-disc list-inside text-slate-600 space-y-1.5 text-xs">
            <li>Write 3 things you noticed in 5 minutes of stillness.</li>
            <li>When you feel reactive, try a 4-count breath: inhale 4, hold 4, exhale 4.</li>
            <li>Keep a short log: 1 positive observation per day.</li>
          </ul>
        </section>
      </div>

      {/* Guided Exercise Overlay Modal */}
      {activeExercise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-all duration-300">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-sm font-bold text-blue-800 flex items-center gap-1.5">
                <span>🧘</span> {activeExercise.title}
              </h2>
              <button
                onClick={closeExercise}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col items-center min-h-[280px] justify-center text-center">
              
              {/* Exercise 1: 5-minute breath */}
              {activeExercise.title === "5-minute breath" && (
                <div className="space-y-6 w-full flex flex-col items-center">
                  {breathTimeLeft > 0 ? (
                    <>
                      {/* Animated circle */}
                      <div className="relative flex items-center justify-center w-36 h-36">
                        <div 
                          className={`absolute rounded-full bg-blue-100/60 border border-blue-200 transition-all duration-[4000ms] ease-in-out ${
                            breathPhase === "Inhale" ? "w-32 h-32 scale-110 bg-blue-200/80" :
                            breathPhase === "Hold" ? "w-32 h-32 scale-110 bg-indigo-100" :
                            "w-20 h-20 scale-90"
                          }`}
                        />
                        <span className="z-10 text-xs font-bold text-blue-800 uppercase tracking-wider animate-pulse">
                          {breathPhase}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-semibold">
                        Time Remaining: <span className="font-mono text-sm font-bold text-indigo-600">{breathTimeLeft}s</span>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-500 border border-emerald-100 rounded-full flex items-center justify-center text-xl mx-auto shadow-inner animate-fade-in">
                        ✓
                      </div>
                      <h4 className="text-sm font-bold text-slate-800">Breath Session Completed</h4>
                      <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                        Excellent work taking a moment for yourself. Notice how your body feels now.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Exercise 2: Body scan */}
              {activeExercise.title === "Body scan" && (
                <div className="space-y-5 w-full">
                  <div className="flex justify-center gap-1">
                    {bodyScanSteps.map((_, idx) => (
                      <span 
                        key={idx} 
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          idx === scanStep ? "w-6 bg-blue-600" : "w-2 bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>

                  <div className="min-h-[100px] flex items-center justify-center">
                    <p className="text-xs text-slate-600 leading-relaxed max-w-xs">
                      {bodyScanSteps[scanStep]}
                    </p>
                  </div>

                  <div className="flex justify-center gap-2 pt-2">
                    {scanStep > 0 && (
                      <button 
                        onClick={() => setScanStep((s) => s - 1)}
                        className="px-4 py-1.5 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition"
                      >
                        Back
                      </button>
                    )}
                    {scanStep < bodyScanSteps.length - 1 ? (
                      <button 
                        onClick={() => setScanStep((s) => s + 1)}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
                      >
                        Next Step
                      </button>
                    ) : (
                      <button 
                        onClick={closeExercise}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
                      >
                        Complete Scan
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Exercise 3: Grounding 5-4-3-2-1 */}
              {activeExercise.title === "Grounding 5-4-3-2-1" && (
                <div className="space-y-4 w-full text-left">
                  {!groundingFinished ? (
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        setGroundingFinished(true);
                      }} 
                      className="space-y-3"
                    >
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">5 things you can SEE</label>
                        <input 
                          type="text" 
                          required
                          value={groundingInputs.see}
                          onChange={(e) => setGroundingInputs(p => ({ ...p, see: e.target.value }))}
                          placeholder="e.g. a green plant, desk lamp..."
                          className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">4 things you can FEEL/TOUCH</label>
                        <input 
                          type="text" 
                          required
                          value={groundingInputs.touch}
                          onChange={(e) => setGroundingInputs(p => ({ ...p, touch: e.target.value }))}
                          placeholder="e.g. soft sweater, phone screen..."
                          className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">3 things you can HEAR</label>
                        <input 
                          type="text" 
                          required
                          value={groundingInputs.hear}
                          onChange={(e) => setGroundingInputs(p => ({ ...p, hear: e.target.value }))}
                          placeholder="e.g. hum of refrigerator, traffic..."
                          className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">2 things you can SMELL</label>
                        <input 
                          type="text" 
                          required
                          value={groundingInputs.smell}
                          onChange={(e) => setGroundingInputs(p => ({ ...p, smell: e.target.value }))}
                          placeholder="e.g. coffee aroma, fresh rain..."
                          className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">1 thing you can TASTE</label>
                        <input 
                          type="text" 
                          required
                          value={groundingInputs.taste}
                          onChange={(e) => setGroundingInputs(p => ({ ...p, taste: e.target.value }))}
                          placeholder="e.g. mint candy, clean water..."
                          className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <button 
                        type="submit"
                        className="w-full mt-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition"
                      >
                        Complete Grounding
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-4 text-center py-4">
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-500 border border-emerald-100 rounded-full flex items-center justify-center text-xl mx-auto shadow-inner animate-fade-in">
                        ✓
                      </div>
                      <h4 className="text-sm font-bold text-slate-800">Grounding Session Completed</h4>
                      <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                        Well done! Focusing on your 5 senses pulls your attention away from racing thoughts and anchors you safely in the present moment.
                      </p>
                      <button 
                        onClick={closeExercise}
                        className="px-6 py-1.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
