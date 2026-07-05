import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { ShieldAlert, AlertTriangle, MessageSquare, AlertCircle, Info, Sparkles, Send, CheckCircle2, User, Search, Trash2 } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

// Helper to sort sessions based on risk priority
const getRiskWeight = (score) => {
  switch (score) {
    case 'Crisis': return 4;
    case 'High': return 3;
    case 'Medium': return 2;
    case 'Low': return 1;
    default: return 0;
  }
};

function TeacherDashboard({ userKeys }) {
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [socket, setSocket] = useState(null);
  const [mobileTab, setMobileTab] = useState('queue'); // 'queue' | 'chat' | 'insights'

  // Counselor input states
  const [inputText, setInputText] = useState('');
  const [counselorName, setCounselorName] = useState('Ibu Siska (Guru BK)');
  const [searchTerm, setSearchTerm] = useState('');

  // Real-time AI recommendation suggestion for selected student
  const [aiSuggestion, setAiSuggestion] = useState(null);

  const messagesEndRef = useRef(null);

  // Initialize socket
  useEffect(() => {
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.emit('counselor-join');

    newSocket.on('counselor-sessions-update', (updatedSessions) => {
      // Sort sessions: high priority risk first, then date created
      const sorted = [...updatedSessions].sort((a, b) => {
        const weightA = getRiskWeight(a.analysis.riskScore);
        const weightB = getRiskWeight(b.analysis.riskScore);
        if (weightB !== weightA) return weightB - weightA;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      setSessions(sorted);
    });

    newSocket.on('student-new-message', ({ sessionId, message }) => {
      setSessions(prevSessions => {
        return prevSessions.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              messages: [...s.messages, message]
            };
          }
          return s;
        });
      });
    });

    newSocket.on('counselor-new-message', ({ sessionId, message }) => {
      setSessions(prevSessions => {
        return prevSessions.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              messages: [...s.messages, message]
            };
          }
          return s;
        });
      });
    });

    newSocket.on('system-message', ({ sessionId, message }) => {
      setSessions(prevSessions => {
        return prevSessions.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              messages: [...s.messages, message]
            };
          }
          return s;
        });
      });
    });

    newSocket.on('session-status-changed', ({ sessionId, status }) => {
      setSessions(prevSessions => {
        return prevSessions.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              status
            };
          }
          return s;
        });
      });
    });

    newSocket.on('counselor-ai-suggestion', ({ sessionId, suggestedResponse, analysis }) => {
      setAiSuggestion({ sessionId, response: suggestedResponse });
      // Update local metrics
      setSessions(prevSessions => {
        return prevSessions.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              analysis
            };
          }
          return s;
        });
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Set the first session as selected if none is selected
  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  // Scroll current chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedSessionId, sessions]);

  // Retrieve current active session
  const activeSession = sessions.find(s => s.id === selectedSessionId);

  // Toggle take over mode
  const handleToggleTakeOver = (e) => {
    if (!socket || !activeSession) return;
    const value = e.target.checked;
    socket.emit('counselor-take-over', { sessionId: activeSession.id, value });
    if (!value) {
      setAiSuggestion(null); // Clear suggestion if turning off manual mode
    }
  };

  const handleSendCounselorMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !socket || !activeSession) return;

    socket.emit('counselor-message', {
      sessionId: activeSession.id,
      text: inputText,
      counselorName
    });

    setInputText('');
    setAiSuggestion(null); // Clear suggestion after sending
  };

  const handleUseAiResponse = () => {
    if (aiSuggestion && aiSuggestion.response) {
      setInputText(aiSuggestion.response);
    }
  };

  const handleClearAllSessions = async () => {
    if (window.confirm('Apakah Anda yakin ingin menghapus semua sesi konseling di memori backend?')) {
      try {
        await fetch(`${BACKEND_URL}/api/sessions/clear`, { method: 'POST' });
        setSessions([]);
        setSelectedSessionId(null);
        setAiSuggestion(null);
      } catch (err) {
        console.error('Failed to clear sessions', err);
      }
    }
  };

  // Filter sessions
  const filteredSessions = sessions.filter(s => {
    const term = searchTerm.toLowerCase();
    return (
      s.studentName.toLowerCase().includes(term) ||
      s.id.toLowerCase().includes(term) ||
      s.analysis.riskScore.toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Mobile-only dashboard sub-tabs */}
      <div className="dashboard-mobile-tabs">
        <button 
          className={`mobile-tab-btn ${mobileTab === 'queue' ? 'active' : ''}`}
          onClick={() => setMobileTab('queue')}
        >
          <Search size={14} />
          <span>Antrean</span>
        </button>
        <button 
          className={`mobile-tab-btn ${mobileTab === 'chat' ? 'active' : ''}`}
          onClick={() => setMobileTab('chat')}
        >
          <MessageSquare size={14} />
          <span>Obrolan</span>
        </button>
        <button 
          className={`mobile-tab-btn ${mobileTab === 'insights' ? 'active' : ''}`}
          onClick={() => setMobileTab('insights')}
        >
          <Sparkles size={14} />
          <span>Analisis AI</span>
        </button>
      </div>

      <div className={`dashboard-grid show-${mobileTab}`}>
      {/* 1. Left Sidebar: Student Queue */}
      <div className="sessions-sidebar">
        <div className="sidebar-search">
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.05rem', flex: 1 }}>Sesi Konseling</h3>
            <button 
              onClick={handleClearAllSessions} 
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-risk-crisis)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Hapus Semua Sesi"
            >
              <Trash2 size={16} />
            </button>
          </div>
          
          <div className="search-input-wrapper">
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Cari siswa atau tingkat risiko..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="session-cards-list">
          {filteredSessions.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Tidak ada sesi aktif.
            </div>
          ) : (
            filteredSessions.map(s => {
              const lastMsg = s.messages.filter(m => m.sender !== 'system').slice(-1)[0];
              const isSelected = s.id === selectedSessionId;
              
              return (
                <div 
                  key={s.id} 
                  className={`session-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedSessionId(s.id);
                    setAiSuggestion(null);
                    setMobileTab('chat'); // Auto-switch tab on mobile for instant view
                  }}
                  style={{
                    borderLeft: isSelected ? `4px solid var(--color-risk-${s.analysis.riskScore.toLowerCase()})` : '1px solid transparent'
                  }}
                >
                  <div className="session-card-header">
                    <span className="session-card-name">{s.studentName}</span>
                    <span className={`risk-badge ${s.analysis.riskScore.toLowerCase()}`}>
                      {s.analysis.riskScore}
                    </span>
                  </div>
                  
                  <p className="session-card-msg">
                    {lastMsg ? lastMsg.text : 'Siswa masuk ruang obrolan.'}
                  </p>

                  <div className="indicator-row">
                    <span className="indicator-mini emotion">
                      Emosi: {s.analysis.emotion}
                    </span>
                    <span className="indicator-mini">
                      Sentimen: {s.analysis.sentiment}
                    </span>
                    {s.status === 'taken-over' && (
                      <span className="indicator-mini" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-risk-low)' }}>
                        Manual
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Middle Panel: Live Conversation Monitor */}
      <div className="counselor-chat-panel">
        {activeSession ? (
          <>
            <div className="panel-header">
              <div className="student-info-meta">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {activeSession.studentName}
                  {activeSession.analysis.riskScore === 'Crisis' && <ShieldAlert size={16} style={{ color: 'var(--color-risk-crisis)' }} />}
                  {activeSession.analysis.riskScore === 'High' && <AlertTriangle size={16} style={{ color: 'var(--color-risk-high)' }} />}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  ID Sesi: {activeSession.id} | Dibuat: {new Date(activeSession.createdAt).toLocaleTimeString()}
                </span>
              </div>

              <div className="takeover-control">
                <span className="takeover-label">Ambil Alih Obrolan (Manual)</span>
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={activeSession.status === 'taken-over'}
                    onChange={handleToggleTakeOver}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            {/* Live Chat Logs */}
            <div className="chat-messages" style={{ background: 'rgba(0,0,0,0.1)' }}>
              {activeSession.messages.map((msg, index) => (
                <div key={msg.id || index} className={`msg-wrapper ${msg.sender}`}>
                  <span className="msg-sender-name">
                    {msg.sender === 'student' 
                      ? activeSession.studentName 
                      : msg.sender === 'ai' 
                        ? 'Rumi (Asisten AI)' 
                        : (msg.counselorName || 'Guru BK')}
                  </span>
                  <div className="msg-bubble">
                    <div>{msg.text}</div>
                    
                    {/* Pipeline inspection tags directly in the dashboard chat logs */}
                    {msg.sender === 'student' && msg.analysis && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px', fontSize: '0.65rem' }}>
                        <span style={{ color: `var(--color-emotion-${msg.analysis.emotion.toLowerCase()})`, fontWeight: 'bold' }}>
                          {msg.analysis.emotion}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>|</span>
                        <span style={{ color: msg.analysis.sentiment === 'Positif' ? 'var(--color-risk-low)' : msg.analysis.sentiment === 'Negatif' ? 'var(--color-risk-crisis)' : 'var(--text-muted)' }}>
                          {msg.analysis.sentiment}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>|</span>
                        <span className={`risk-badge ${msg.analysis.riskScore.toLowerCase()}`} style={{ padding: '0px 4px', fontSize: '0.55rem', borderRadius: '3px' }}>
                          {msg.analysis.riskScore}
                        </span>
                      </div>
                    )}

                    {msg.sender !== 'system' && (
                      <div className="msg-time">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* AI Response Suggestion Box */}
            {activeSession.status === 'taken-over' && aiSuggestion && aiSuggestion.sessionId === activeSession.id && (
              <div className="ai-suggestion-box">
                <div className="ai-suggestion-header">
                  <Sparkles size={14} />
                  <span>Saran Jawaban Empatetik (AI Rumi)</span>
                </div>
                <p className="ai-suggestion-text">
                  "{aiSuggestion.response}"
                </p>
                <button onClick={handleUseAiResponse} className="ai-suggestion-use-btn">
                  Gunakan Saran AI
                </button>
              </div>
            )}

            {/* Control Input */}
            <div className="chat-input-bar">
              {activeSession.status === 'taken-over' ? (
                <form onSubmit={handleSendCounselorMessage} className="input-container" style={{ borderColor: 'var(--color-risk-low)' }}>
                  <input 
                    type="text" 
                    className="chat-input" 
                    placeholder="Ketik balasan konseling Anda di sini..." 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                  <button type="submit" className="send-btn" style={{ backgroundColor: 'var(--color-risk-low)' }} disabled={!inputText.trim()}>
                    <Send size={18} />
                  </button>
                </form>
              ) : (
                <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-color)', borderRadius: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Asisten AI Rumi sedang aktif mendampingi siswa ini. Nyalakan <strong>Ambil Alih Obrolan</strong> untuk mengirim pesan manual.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="no-sessions-state">
            <MessageSquare size={64} />
            <div>
              <h3>Tidak Ada Sesi Terpilih</h3>
              <p style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                Silakan pilih sesi siswa dari kolom kiri untuk memantau detail konseling.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Right Panel: AI Insights & Recommended Action Plan */}
      <div className="insights-sidebar">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
          <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />
          <span>AI Analisis & Rekomendasi</span>
        </h3>

        {activeSession ? (
          <>
            {/* Model source badge */}
            <div style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '6px', color: 'var(--text-muted)' }}>
              Sumber Pemrosesan: <strong>{activeSession.analysis.source || 'Local Simulator'}</strong>
            </div>

            {/* Profile Emosi */}
            <div className="section-box">
              <span className="section-box-title">Analisis Emosi</span>
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.15)',
                  borderLeft: `5px solid var(--color-emotion-${activeSession.analysis.emotion.toLowerCase()})`
                }}
              >
                <div style={{ flex: 1 }}>
                  <h4 style={{ color: `var(--color-emotion-${activeSession.analysis.emotion.toLowerCase()})` }}>
                    {activeSession.analysis.emotion}
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Tingkat Keyakinan: {activeSession.analysis.emotionScore ? `${Math.round(activeSession.analysis.emotionScore * 100)}%` : 'Tinggi'}
                  </p>
                </div>
              </div>
            </div>

            {/* Sentiment meter */}
            <div className="section-box">
              <span className="section-box-title">Indeks Sentimen</span>
              <div className="sentiment-meter">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>Negatif</span>
                  <span style={{ fontWeight: 'bold' }}>{activeSession.analysis.sentiment}</span>
                  <span>Positif</span>
                </div>
                <div className="sentiment-bar-bg">
                  <div 
                    className={`sentiment-bar-fill ${activeSession.analysis.sentiment.toLowerCase()}`}
                    style={{
                      width: activeSession.analysis.sentiment === 'Positif' ? '100%' : 
                             activeSession.analysis.sentiment === 'Negatif' ? '30%' : '65%',
                      marginLeft: activeSession.analysis.sentiment === 'Positif' ? '0%' : 
                                  activeSession.analysis.sentiment === 'Negatif' ? '0' : '0'
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Detected Risk Flags */}
            <div className="section-box">
              <span className="section-box-title">Faktor Risiko Terdeteksi</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {['Self-Harm', 'Bullying', 'Academic', 'Family Issues', 'Social Issues', 'Depression'].map(flag => {
                  const isChecked = activeSession.analysis.riskFlags.includes(flag);
                  return (
                    <div key={flag} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: isChecked ? 1 : 0.4 }}>
                      <CheckCircle2 size={16} style={{ color: isChecked ? 'var(--color-risk-crisis)' : 'var(--text-muted)' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: isChecked ? 600 : 400 }}>{flag}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', lineHeight: 1.4 }}>
                <strong>Analisis Risiko:</strong> {activeSession.analysis.riskReason}
              </div>
            </div>

            {/* BK Counseling Action Plan */}
            <div className="section-box" style={{ flex: 1 }}>
              <span className="section-box-title">Langkah Penanganan BK</span>
              <div className="recommendations-list">
                {activeSession.analysis.actionPlan && activeSession.analysis.actionPlan.map((plan, index) => (
                  <div key={index} className="recommendation-item">
                    <span className="recommendation-item-dot">•</span>
                    <span>{plan}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Pilih sesi untuk memuat rekomendasi tindakan.
          </div>
        )}
      </div>
    </div>
  </div>
  );
}

export default TeacherDashboard;
