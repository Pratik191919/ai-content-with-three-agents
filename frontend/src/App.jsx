import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Calendar, LineChart, Activity } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Briefs from './pages/Briefs';
import ContentCalendar from './pages/ContentCalendar';
import Analytics from './pages/Analytics';
import VisionBoard from './pages/VisionBoard';
import PostPreview from './pages/PostPreview';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <aside className="sidebar">
          <div className="logo">
            <h1>Content Engine</h1>
          </div>
          <nav>
            <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''} end><LayoutDashboard size={20} /> Dashboard</NavLink>
            <NavLink to="/briefs" className={({ isActive }) => isActive ? 'active' : ''}><FileText size={20} /> Content Briefs</NavLink>
            <NavLink to="/calendar" className={({ isActive }) => isActive ? 'active' : ''}><Calendar size={20} /> Content Calendar</NavLink>
            <NavLink to="/analytics" className={({ isActive }) => isActive ? 'active' : ''}><LineChart size={20} /> Performance Analytics</NavLink>
            <NavLink to="/vision" className={({ isActive }) => isActive ? 'active' : ''}><Activity size={20} /> Vision Board (Live)</NavLink>
          </nav>
        </aside>
        <main className="main-content">
          <header className="topbar">
            <h2>OpenClaw Agents Supervisor</h2>
            <div className="status-badge">Agents Active</div>
          </header>
          <div className="page-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/briefs" element={<Briefs />} />
              <Route path="/calendar" element={<ContentCalendar />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/vision" element={<VisionBoard />} />
              <Route path="/preview/:briefId" element={<PostPreview />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
