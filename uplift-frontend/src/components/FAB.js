// src/components/FAB.js
import React from "react";
import { useNavigate } from "react-router-dom";

export default function FAB(){
  const navigate = useNavigate();
  const user = (() => { try { return JSON.parse(localStorage.getItem("uplift_user")||"null"); } catch { return null; } })();

  const onSupport = () => {
    if (!user) return navigate('/signin?next=/support/new');
    // create a new support request via API (or navigate to page that creates one)
    navigate('/support/new'); // your component handles actual creation
  };

  return (
    <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 100 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
        <button
          onClick={() => navigate('/post-success')}
          title="Share Success"
          style={{
            width: 46, height: 46, borderRadius: 12, background: "#06b6d4", color: "#fff",
            boxShadow: "0 6px 18px rgba(3,7,18,0.12)", border: "none"
          }}
        >+</button>

        <button
          onClick={onSupport}
          title="Chat with Support"
          style={{
            width: 46, height: 46, borderRadius: 12, background: "#10B981", color: "#fff",
            boxShadow: "0 6px 18px rgba(3,7,18,0.12)", border: "none"
          }}
        >💬</button>
      </div>
    </div>
  );
}
