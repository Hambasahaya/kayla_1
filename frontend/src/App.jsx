import React, { useState, useEffect } from 'react';
import { MessageSquare, LayoutDashboard, Terminal, Settings, Sun, Moon } from 'lucide-react';
import StudentChat from './components/StudentChat';
import TeacherDashboard from './components/TeacherDashboard';
import PipelinePlayground from './components/PipelinePlayground';

function App() {
  const [activeView, setActiveView] = useState('student');
  const [theme, setTheme] = useState('dark');


  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="app-container">
      <header className="app-navbar">
        <div className="logo-section">
          <div className="logo-icon">
            <MessageSquare size={22} />
          </div>
          <div>
            <h1 className="logo-text">Rumi</h1>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Sistem Schedule & Pendeteksi Krisis Siswa</p>
          </div>
        </div>

        <nav className="nav-links">
          <button 
            className={`nav-btn ${activeView === 'student' ? 'active' : ''}`}
            onClick={() => setActiveView('student')}
          >
            <MessageSquare size={16} />
            Chat Siswa
          </button>
          <button 
            className={`nav-btn ${activeView === 'teacher' ? 'active' : ''}`}
            onClick={() => setActiveView('teacher')}
          >
            <LayoutDashboard size={16} />
            Dashboard Guru BK
          </button>
          <button 
            className={`nav-btn ${activeView === 'playground' ? 'active' : ''}`}
            onClick={() => setActiveView('playground')}
          >
            <Terminal size={16} />
            Playground
          </button>
        </nav>

        <div className="navbar-right">
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <main className="app-content">
        {activeView === 'student' && <StudentChat userKeys={{}} />}
        {activeView === 'teacher' && <TeacherDashboard userKeys={{}} />}
        {activeView === 'playground' && <PipelinePlayground userKeys={{}} />}
      </main>
    </div>
  );
}

export default App;
