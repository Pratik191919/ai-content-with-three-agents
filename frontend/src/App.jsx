import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Calendar, LineChart,
  Activity, Menu, X, ChevronLeft
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Briefs from './pages/Briefs';
import ContentCalendar from './pages/ContentCalendar';
import Analytics from './pages/Analytics';
import VisionBoard from './pages/VisionBoard';
import PostPreview from './pages/PostPreview';
import './index.css';

const NAV_ITEMS = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard',            end: true },
  { to: '/briefs',    icon: FileText,         label: 'Content Briefs' },
  { to: '/calendar',  icon: Calendar,         label: 'Content Calendar' },
  { to: '/analytics', icon: LineChart,        label: 'Performance Analytics' },
  { to: '/vision',    icon: Activity,         label: 'Vision Board (Live)' },
];

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Handle resize
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true); // always open on desktop
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const closeSidebarOnMobile = () => {
    if (isMobile) setSidebarOpen(false);
  };

  return (
    <div className={`app-container ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>

      {/* Mobile overlay backdrop */}
      {isMobile && sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">Content Engine</span>
          </div>
          <button
            className="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            title="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={closeSidebarOnMobile}
            >
              <Icon size={20} className="nav-icon" />
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-text">AI Content Agents v2.0</div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="menu-toggle"
              onClick={() => setSidebarOpen(prev => !prev)}
              title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              {sidebarOpen && !isMobile ? <ChevronLeft size={20} /> : <Menu size={20} />}
            </button>
            <h2 className="topbar-title">OpenClaw Agents Supervisor</h2>
          </div>
          <div className="topbar-right">
            <div className="status-badge">
              <span className="status-dot" />
              <span className="status-text">Agents Active</span>
            </div>
          </div>
        </header>

        <div className="page-content">
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/briefs"    element={<Briefs />} />
            <Route path="/calendar"  element={<ContentCalendar />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/vision"    element={<VisionBoard />} />
            <Route path="/preview/:briefId" element={<PostPreview />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;
