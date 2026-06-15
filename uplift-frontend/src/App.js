import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import NavBar from "./components/Navbar";
import Profile from "./pages/Profile";
import Home from "./pages/Home";
import PostSuccess from "./pages/PostSuccess";
import SuccessFeed from "./pages/SuccessFeed";
import Communities from "./pages/Communities";
import CreateCommunity from "./pages/CreateCommunity";
import CommunityChat from "./pages/CommunityChat";
import CreateAccount from "./pages/CreateAccount";
import SignIn from "./pages/SignIn";
import ForgotPassword from "./pages/ForgotPassword";
import SupportHome from "./pages/SupportHome";
import SupportSession from "./pages/SupportSession";
import AdminSupport from './pages/AdminDashboard';
import Mindfulness from "./pages/Mindfulness";
import Articles from "./pages/Articles";
import Workshops from "./pages/Workshops";import DirectChat from "./pages/DirectChat";


function RequireAdmin({ children }) {
  const stored = JSON.parse(localStorage.getItem('uplift_user') || 'null');
  if (!stored?.user || stored.user.role !== 'admin') return <Navigate to="/signin" replace />;
  return children;
}


function App() {
  useEffect(() => {
    // Check persisted theme or system preference
    const persisted = localStorage.getItem("theme");
    const isDark = persisted === "dark" || (!persisted && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  return (
    <Router>
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/post-success" element={<PostSuccess />} />
        <Route path="/success" element={<SuccessFeed />} />
        <Route path="/community-chat" element={<Communities />} />
        <Route path="/community-create" element={<CreateCommunity />} />
        <Route path="/community/:id" element={<CommunityChat />} />
        <Route path="/dm/:partner" element={<DirectChat />} />
        <Route path="/signup" element={<CreateAccount />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/support" element={<SupportHome />} />
        <Route path="/support/session/:id" element={<SupportSession />} />
        <Route path="/admin/support" element={<RequireAdmin><AdminSupport/></RequireAdmin>} />
        <Route path="/admin/support/:id" element={<RequireAdmin><AdminSupport/></RequireAdmin>} />
        <Route path="/resources" element={<Home />} /> {/* optional list view */}
        <Route path="/resources/mindfulness" element={<Mindfulness />} />
        <Route path="/resources/articles" element={<Articles />} />
        <Route path="/resources/workshops" element={<Workshops />} />
      </Routes>
    </Router>
  );
}

export default App;
