// src/pages/SupportStart.js
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
const API_BASE = process.env.REACT_APP_API || "http://localhost:5000/api";


function getUser(){ try { return JSON.parse(localStorage.getItem('uplift_user')||'null'); } catch { return null; } }

export default function SupportStart(){
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      const user = getUser();
      if (!user) return navigate('/signin?next=/support/new');
      const res = await fetch(`${API_BASE}/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-username': user.username },
        body: JSON.stringify({ title: 'Support Request', createdBy: user.username })
      });
      if (!res.ok) return alert('Failed to create support request');
      const data = await res.json();
      navigate(`/support/${data._id}`, { state: { support: data }});
    })();
  },[navigate]);
  return <div style={{padding:20}}>Opening support room…</div>;
}
