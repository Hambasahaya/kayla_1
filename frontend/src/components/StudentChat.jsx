import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Send, User, Sparkles, AlertCircle, ShieldAlert, Cpu } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

function StudentChat({ userKeys }) {
  const [name, setName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isJoined, setIsJoined] = useState(false);

  const [sessionId, setSessionId] = useState('');
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [counselorStatus, setCounselorStatus] = useState('bot-active'); // 'bot-active' | 'taken-over'

  // Pipeline status states
  const [pipelineState, setPipelineState] = useState({
    emotion: { status: 'idle', result: null },
    sentiment: { status: 'idle', result: null },
    llm: { status: 'idle', result: null }
  });

  const [isPipelineOpen, setIsPipelineOpen] = useState(false);
  const messagesEndRef = useRef(null);

  // Load session or generate
  useEffect(() => {
    let savedSessionId = sessionStorage.getItem('BK_STUDENT_SESSION_ID');
    let savedName = sessionStorage.getItem('BK_STUDENT_NAME');
    let savedAnon = sessionStorage.getItem('BK_STUDENT_ANON') === 'true';

    if (savedSessionId) {
      setSessionId(savedSessionId);
      setName(savedName || '');
      setIsAnonymous(savedAnon);
      setIsJoined(true);
    } else {
      const newSessionId = 'student_' + Math.random().toString(36).substr(2, 9);
      setSessionId(newSessionId);
    }
  }, []);

  // Connect socket
  useEffect(() => {
    if (!isJoined || !sessionId) return;

    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    const displayName = isAnonymous ? 'Siswa Anonim' : (name || 'Siswa');
    newSocket.emit('student-join', { sessionId, studentName: displayName });

    sessionStorage.setItem('BK_STUDENT_SESSION_ID', sessionId);
    sessionStorage.setItem('BK_STUDENT_NAME', name);
    sessionStorage.setItem('BK_STUDENT_ANON', isAnonymous);

    // Socket listeners
    newSocket.on('session-state', (state) => {
      setMessages(state.messages);
      setCounselorStatus(state.status === 'taken-over' ? 'taken-over' : 'bot-active');
    });

    newSocket.on('bot-message', ({ message, analysis }) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('counselor-new-message', ({ sessionId: msgSessionId, message }) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('system-message', ({ sessionId: msgSessionId, message }) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('session-status-changed', ({ status }) => {
      setCounselorStatus(status === 'taken-over' ? 'taken-over' : 'bot-active');
    });

    newSocket.on('pipeline-step', (data) => {
      if (data.step === 'emotion') {
        setPipelineState(prev => ({
          ...prev,
          emotion: { status: data.status, result: data.result || null }
        }));
      } else if (data.step === 'sentiment') {
        setPipelineState(prev => ({
          ...prev,
          sentiment: { status: data.status, result: data.result || null }
        }));
      } else if (data.step === 'llm') {
        setPipelineState(prev => ({
          ...prev,
          llm: { status: data.status, result: data.result || null }
        }));
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [isJoined, sessionId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStartChat = (e) => {
    e.preventDefault();
    if (!isAnonymous && !name.trim()) return;
    setIsJoined(true);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    // Reset pipeline display for a new run
    setPipelineState({
      emotion: { status: 'idle', result: null },
      sentiment: { status: 'idle', result: null },
      llm: { status: 'idle', result: null }
    });

    // Add local student bubble instantly for feedback
    const studentMsg = {
      id: 'local_' + Date.now(),
      sender: 'student',
      text: inputText,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, studentMsg]);

    socket.emit('student-message', {
      sessionId,
      text: inputText,
      userKeys
    });

    setInputText('');
  };

  const handleResetSession = () => {
    sessionStorage.clear();
    window.location.reload();
  };

  if (!isJoined) {
    return (
      <div className="settings-container" style={{ margin: '4rem auto', maxWidth: '500px' }}>
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <div className="logo-icon" style={{ margin: '0 auto 1.5rem', width: '56px', height: '56px', borderRadius: '16px' }}>
            <Sparkles size={28} />
          </div>
          <h2>Chatbot Rumi</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Hubungi asisten konseling digital "Rumi" secara aman dan rahasia.
          </p>
        </div>

        <form onSubmit={handleStartChat} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label>Pilih Cara Menghubungi:</label>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500 }}>
                <input
                  type="radio"
                  checked={!isAnonymous}
                  onChange={() => setIsAnonymous(false)}
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                Gunakan Nama Asli
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500 }}>
                <input
                  type="radio"
                  checked={isAnonymous}
                  onChange={() => setIsAnonymous(true)}
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                Anonim (Rahasia)
              </label>
            </div>
          </div>

          {!isAnonymous && (
            <div className="form-group">
              <label htmlFor="student-name">Nama Lengkap</label>
              <input
                id="student-name"
                type="text"
                className="form-input"
                placeholder="Masukkan nama lengkap kamu..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          {isAnonymous && (
            <div className="settings-info-alert" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px' }}>
              <strong>Mengapa Anonim?</strong> Guru BK kami menghormati kerahasiaan Anda. Masuk sebagai Anonim akan menyembunyikan identitas asli Anda dari log percakapan umum.
            </div>
          )}

          <button type="submit" className="settings-btn" style={{ marginTop: '0.5rem' }}>
            Mulai Obrolan BK
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="student-chat-layout">
      {/* Active Chat Area */}
      <div className="chat-workspace">
        <div className="chat-header">
          <div>
            <h3 style={{ fontSize: '1.05rem' }}>Obrolan dengan Rumi</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {isAnonymous ? 'Sesi Anonim' : `Siswa: ${name}`} ({sessionId})
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => setIsPipelineOpen(!isPipelineOpen)}
              className="mobile-only-btn"
              style={{
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid var(--color-primary)',
                color: 'var(--color-primary)',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Cpu size={12} />
              <span>Proses AI</span>
            </button>
            <div className={`counselor-status-indicator ${counselorStatus}`}>
              {counselorStatus === 'taken-over' ? (
                <>
                  <ShieldAlert size={14} />
                  <span>Manual: Guru BK Aktif</span>
                </>
              ) : (
                <>
                  <Cpu size={14} />
                  <span>AI Rumi Aktif</span>
                </>
              )}
            </div>
            <button
              onClick={handleResetSession}
              style={{
                background: 'none',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              Reset Sesi
            </button>
          </div>
        </div>


        {/* Message Log */}
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="no-sessions-state">
              <Sparkles size={48} />
              <div>
                <h4>Rumi Siap Mendengarmu</h4>
                <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Ketik apa pun yang sedang kamu rasakan atau pikirkan hari ini.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={msg.id || index} className={`msg-wrapper ${msg.sender}`}>
                {msg.sender !== 'system' && (
                  <span className="msg-sender-name">
                    {msg.sender === 'student'
                      ? 'Kamu'
                      : msg.sender === 'ai'
                        ? 'Rumi (Asisten AI)'
                        : (msg.counselorName || 'Guru BK')}
                  </span>
                )}
                <div className="msg-bubble">
                  <div>{msg.text}</div>
                  {msg.sender !== 'system' && (
                    <div className="msg-time">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Text Input Panel */}
        <div className="chat-input-bar">
          <form onSubmit={handleSendMessage} className="input-container">
            <input
              type="text"
              className="chat-input"
              placeholder="Ceritakan sesuatu ke Rumi..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <button type="submit" className="send-btn" disabled={!inputText.trim()}>
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>

      {/* Real-time Pipeline Visualizer Sidebar */}
      {isPipelineOpen && (
        <div className="drawer-overlay" onClick={() => setIsPipelineOpen(false)}></div>
      )}
      <div className={`pipeline-tracker-sidebar ${isPipelineOpen ? 'open' : ''}`}>
        <div className="sidebar-title">
          <Cpu size={18} className="logo-icon" style={{ boxShadow: 'none' }} />
          <span>Pemrosesan Pipeline</span>
        </div>

        <div className="pipeline-steps-list">
          {/* Step 1: Input Text */}
          <div className="pipeline-step-item success">
            <div className="pipeline-connector-line"></div>
            <div className="pipeline-step-node">1</div>
            <div className="pipeline-step-content">
              <span className="pipeline-step-label">Pesan Masuk</span>
              <span className="pipeline-step-desc">Teks siswa dikirim ke backend API.</span>
            </div>
          </div>

          {/* Step 2: IndoBERT Emotion */}
          <div className={`pipeline-step-item ${pipelineState.emotion.status === 'processing' ? 'active' :
              pipelineState.emotion.status === 'done' ? 'success' : ''
            }`}>
            <div className="pipeline-connector-line"></div>
            <div className="pipeline-step-node">2</div>
            <div className="pipeline-step-content">
              <span className="pipeline-step-label">IndoBERT Emotion</span>
              {pipelineState.emotion.status === 'processing' && (
                <span className="pipeline-step-desc">Menganalisis emosi teks (HF Inference API)...</span>
              )}
              {pipelineState.emotion.status === 'done' && pipelineState.emotion.result && (
                <>
                  <span className="pipeline-step-desc">Selesai menganalisis emosi.</span>
                  <div
                    className="pipeline-step-badge"
                    style={{
                      backgroundColor: `var(--color-emotion-${pipelineState.emotion.result.value.toLowerCase()})`,
                      color: 'white'
                    }}
                  >
                    {pipelineState.emotion.result.value} ({Math.round(pipelineState.emotion.result.score * 100)}%)
                  </div>
                </>
              )}
              {pipelineState.emotion.status === 'idle' && (
                <span className="pipeline-step-desc">Menunggu pesan masuk...</span>
              )}
            </div>
          </div>

          {/* Step 3: IndoBERT Sentiment */}
          <div className={`pipeline-step-item ${pipelineState.sentiment.status === 'processing' ? 'active' :
              pipelineState.sentiment.status === 'done' ? 'success' : ''
            }`}>
            <div className="pipeline-connector-line"></div>
            <div className="pipeline-step-node">3</div>
            <div className="pipeline-step-content">
              <span className="pipeline-step-label">IndoBERT Sentiment</span>
              {pipelineState.sentiment.status === 'processing' && (
                <span className="pipeline-step-desc">Mengevaluasi polaritas sentiment (Pos/Neg/Net)...</span>
              )}
              {pipelineState.sentiment.status === 'done' && pipelineState.sentiment.result && (
                <>
                  <span className="pipeline-step-desc">Selesai menganalisis polaritas.</span>
                  <div
                    className="pipeline-step-badge"
                    style={{
                      backgroundColor: pipelineState.sentiment.result.value === 'Positif' ? 'var(--color-risk-low)' :
                        pipelineState.sentiment.result.value === 'Negatif' ? 'var(--color-risk-crisis)' : 'var(--color-emotion-netral)',
                      color: 'white'
                    }}
                  >
                    {pipelineState.sentiment.result.value} ({Math.round(pipelineState.sentiment.result.score * 100)}%)
                  </div>
                </>
              )}
              {pipelineState.sentiment.status === 'idle' && (
                <span className="pipeline-step-desc">Menunggu emosi diklasifikasikan...</span>
              )}
            </div>
          </div>

          {/* Step 4: LLM Analysis & Empathetic Response */}
          <div className={`pipeline-step-item ${pipelineState.llm.status === 'processing' ? 'active' :
              pipelineState.llm.status === 'done' ? 'success' : ''
            }`}>
            <div className="pipeline-connector-line"></div>
            <div className="pipeline-step-node">4</div>
            <div className="pipeline-step-content">
              <span className="pipeline-step-label">LLM Core Processor</span>
              {pipelineState.llm.status === 'processing' && (
                <span className="pipeline-step-desc">Membuat respons empatetik & mengevaluasi risiko...</span>
              )}
              {pipelineState.llm.status === 'done' && pipelineState.llm.result && (
                <>
                  <span className="pipeline-step-desc">Evaluasi Gemini selesai.</span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {pipelineState.llm.result.riskFlags.map((f, i) => (
                      <span key={i} className="indicator-mini">{f}</span>
                    ))}
                  </div>
                </>
              )}
              {pipelineState.llm.status === 'idle' && (
                <span className="pipeline-step-desc">Menunggu polaritas teks...</span>
              )}
            </div>
          </div>

          {/* Step 5: Risk Score & Dashboard Update */}
          <div className={`pipeline-step-item ${pipelineState.llm.status === 'done' ? 'success' : ''
            }`}>
            <div className="pipeline-step-node">5</div>
            <div className="pipeline-step-content">
              <span className="pipeline-step-label">Risk Score Output</span>
              {pipelineState.llm.status === 'done' && pipelineState.llm.result ? (
                <>
                  <span className="pipeline-step-desc">Diteruskan ke Dashboard Guru BK secara real-time.</span>
                  <div
                    className={`risk-badge ${pipelineState.llm.result.riskScore.toLowerCase()}`}
                    style={{ alignSelf: 'flex-start', marginTop: '6px' }}
                  >
                    Risiko: {pipelineState.llm.result.riskScore}
                  </div>
                </>
              ) : (
                <span className="pipeline-step-desc">Menunggu hasil evaluasi risiko...</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudentChat;
