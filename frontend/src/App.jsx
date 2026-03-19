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
import Logs from './pages/Logs';
import './index.css';

const NAV_ITEMS = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard',            end: true },
  { to: '/briefs',    icon: FileText,         label: 'Content Briefs' },
  { to: '/calendar',  icon: Calendar,         label: 'Content Calendar' },
  { to: '/analytics', icon: LineChart,        label: 'Performance Analytics' },
  { to: '/vision',    icon: Activity,         label: 'Vision Board (Live)' },
  { to: '/logs',      icon: Activity,         label: 'System Logs' },
];

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  // Handle system theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

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

  const Sun = () => (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
  );

  const Moon = () => (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
  );

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
            <span className="logo-icon">🚀</span>
            <span className="logo-text">Content Agents</span>
          </div>
          {isMobile && (
            <button
              className="sidebar-close-btn"
              onClick={() => setSidebarOpen(false)}
              title="Close sidebar"
            >
              <X size={18} />
            </button>
          )}
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
          <div className="sidebar-footer-text">v2.0 Premium Content Hub</div>
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
            <h2 className="topbar-title">Pipeline Supervisor</h2>
          </div>
          <div className="topbar-right">
            <button 
              className="theme-toggle" 
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </button>
            <div className="status-badge">
              <span className="status-dot" />
              <span className="status-text">Agents Online</span>
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
            <Route path="/logs"      element={<Logs />} />
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
