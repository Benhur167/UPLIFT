import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../lib/socket";

const API = process.env.REACT_APP_API;

export default function AdminDashboard() {
  const [sessions, setSessions] = useState([]); // newest first
  const [loading, setLoading] = useState(true);
  const newSessionsRef = useRef(new Set()); // unread
  const navigate = useNavigate();

  const stored = (() => {
    try { return JSON.parse(localStorage.getItem("uplift_user") || "null"); } catch { return null; }
  })();
  const token = stored?.token || null;
  const adminName = stored?.username || stored?.user?.username || "admin";

  useEffect(() => {
    if (!socket.connected) socket.connect();
    socket.emit("joinAdminRoom", { token });

    const load = async () => {
      setLoading(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API}/support/sessions`, { headers });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data.sessions) ? data.sessions.map(s => ({
            sessionId: s._id || s.sessionId || s.id,
            userId: s.createdBy || s.userId,
            userName: s.userName || s.createdByName || s.user || 'anonymous',
            createdAt: s.createdAt || s.created_at || new Date().toISOString(),
            status: s.status || 'open',
            requestedCall: s.requestedCall || null,
            raw: s
          })) : [];
          setSessions(list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
        } else {
          console.warn('GET /api/support/sessions returned', res.status);
        }
      } catch (e) {
        console.warn('failed to fetch open sessions', e);
      } finally {
        setLoading(false);
      }
    };

    load();

    const onNew = (data) => {
      const item = {
        sessionId: data.sessionId || data._id || data.id,
        userId: data.userId || data.createdBy,
        userName: data.userName || data.user || 'anonymous',
        createdAt: data.createdAt || new Date().toISOString(),
        status: data.status || 'open',
        requestedCall: data.requestedCall || null,
        raw: data
      };

      setSessions(prev => {
        if (prev.some(s => String(s.sessionId) === String(item.sessionId))) return prev;
        return [item, ...prev];
      });

      if (document.hidden || window.location.pathname !== '/admin/support') {
        newSessionsRef.current.add(item.sessionId);
      }

      if (window.Notification && Notification.permission === "granted") {
        new Notification("New support request", { body: `${item.userName || 'Anonymous'} needs support` });
      } else if (window.Notification && Notification.permission !== "denied") {
        Notification.requestPermission().then((perm) => {
          if (perm === "granted") new Notification("New support request", { body: `${item.userName || 'Anonymous'} needs support` });
        });
      }
    };

    const onCallReq = (payload) => {
      // payload: { sessionId, requestedCall, userId, userName, createdAt }
      setSessions(prev => {
        const exists = prev.find(s => String(s.sessionId) === String(payload.sessionId));
        if (exists) {
          return prev.map(s => String(s.sessionId) === String(payload.sessionId) ? { ...s, requestedCall: payload.requestedCall } : s);
        } else {
          const item = {
            sessionId: payload.sessionId,
            userName: payload.userName || 'anonymous',
            createdAt: payload.createdAt || new Date().toISOString(),
            requestedCall: payload.requestedCall,
            status: 'open',
          };
          return [item, ...prev];
        }
      });

      if (document.hidden || window.location.pathname !== '/admin/support') {
        newSessionsRef.current.add(payload.sessionId);
      }
    };

    const onCallUpdated = (payload) => {
      setSessions(prev => prev.map(s => String(s.sessionId) === String(payload.sessionId) ? { ...s, requestedCall: payload.requestedCall } : s));
    };

    socket.on("support:newSession", onNew);
    socket.on("support:callRequested", onCallReq);
    socket.on("support:callUpdated", onCallUpdated);

    return () => {
      socket.off("support:newSession", onNew);
      socket.off("support:callRequested", onCallReq);
      socket.off("support:callUpdated", onCallUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markRead = (sessionId) => {
    newSessionsRef.current.delete(sessionId);
    setSessions(prev => [...prev]);
  };

  const openSession = (s) => {
    try {
      if (!socket.connected) socket.connect();
      socket.emit("support:join", { sessionId: s.sessionId, username: adminName, role: 'admin' });
    } catch (e) {
      console.warn('support:join emit failed', e);
    }
    markRead(s.sessionId);
    navigate(`/admin/support/${s.sessionId}`, { state: { session: s } });
  };

  return (
    <div className="admin-dashboard dashboard-container" style={{ padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Support — Active Sessions</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>{loading ? "Loading…" : `${sessions.length} session${sessions.length === 1 ? "" : "s"}`}</div>
      </header>

      {sessions.length === 0 ? (
        <div style={{ color: "#64748b", padding: 24, borderRadius: 8, background: "#fff" }}>No active sessions yet. Waiting for users to request support…</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {sessions.map(s => {
            const unread = newSessionsRef.current.has(String(s.sessionId));
            return (
              <li key={s.sessionId} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 12,
                borderRadius: 8,
                background: "#fff",
                marginBottom: 10,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "#eef2ff", fontWeight: 700, color: "#0f172a"
                  }}>
                    {s.userName ? String(s.userName).slice(0,2).toUpperCase() : "U"}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{s.userName || "anonymous"}</div>
                    <div style={{ fontSize: 13, color: "#64748b" }}>{new Date(s.createdAt).toLocaleString()}</div>
                    {s.requestedCall && (
                      <div style={{ marginTop: 6, fontSize: 13, color: "#0b5cff" }}>
                        📞 Call: {s.requestedCall.phone} — <strong>{s.requestedCall.status}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {unread && <span style={{ background: "#ef4444", color: "#fff", padding: "4px 8px", borderRadius: 20, fontSize: 12 }}>New</span>}
                  <button className="btn primary" onClick={() => openSession(s)}>Open</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
