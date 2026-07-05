import React, { useState, useEffect } from 'react';
import { Key, Sparkles, CheckCircle, XCircle, RefreshCw, Cpu } from 'lucide-react';

const BACKEND_URL = 'http://localhost:5000';

function SettingsPanel({ keys, onSaveKeys }) {
  const [geminiKey, setGeminiKey] = useState(keys.geminiApiKey);
  const [hfKey, setHfKey] = useState(keys.hfToken);
  const [showSavedMessage, setShowSavedMessage] = useState(false);
  
  // Backend health status states
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking' | 'connected' | 'disconnected'
  const [sessionsCount, setSessionsCount] = useState(0);

  const checkBackendStatus = async () => {
    setBackendStatus('checking');
    try {
      const response = await fetch(`${BACKEND_URL}/api/status`, { timeout: 3000 });
      if (response.ok) {
        const data = await response.json();
        setBackendStatus('connected');
        setSessionsCount(data.sessionsCount || 0);
      } else {
        setBackendStatus('disconnected');
      }
    } catch (err) {
      setBackendStatus('disconnected');
    }
  };

  useEffect(() => {
    checkBackendStatus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveKeys({
      geminiApiKey: geminiKey,
      hfToken: hfKey
    });
    setShowSavedMessage(true);
    setTimeout(() => {
      setShowSavedMessage(false);
    }, 3000);
  };

  return (
    <div className="settings-container">
      <div>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Key size={22} style={{ color: 'var(--color-primary)' }} />
          <span>Pengaturan Kunci API</span>
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Konfigurasikan kunci API eksternal untuk mengaktifkan pemrosesan model riil.
        </p>
      </div>

      {/* Connection Check section */}
      <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cpu size={16} style={{ color: backendStatus === 'connected' ? 'var(--color-risk-low)' : 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Status Server Backend</span>
          </div>
          <button 
            onClick={checkBackendStatus} 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Muat Ulang Status"
          >
            <RefreshCw size={14} className={backendStatus === 'checking' ? 'spin' : ''} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
          {backendStatus === 'checking' && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Menghubungkan ke server...</span>
          )}
          {backendStatus === 'connected' && (
            <>
              <CheckCircle size={16} style={{ color: 'var(--color-risk-low)' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Tersambung (Aktif | Sesi Tersimpan: {sessionsCount})
              </span>
            </>
          )}
          {backendStatus === 'disconnected' && (
            <>
              <XCircle size={16} style={{ color: 'var(--color-risk-crisis)' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--color-risk-crisis)' }}>
                Terputus. Jalankan server backend terlebih dahulu.
              </span>
            </>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="form-group">
          <label htmlFor="gemini-api">Gemini API Key (Google AI Studio)</label>
          <input 
            id="gemini-api"
            type="password" 
            className="form-input"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AIzaSy..." 
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Digunakan untuk evaluasi skor risiko psikologis dan penyusunan draf respon empatetik Rumi.
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="hf-token">Hugging Face Token (Optional)</label>
          <input 
            id="hf-token"
            type="password" 
            className="form-input"
            value={hfKey}
            onChange={(e) => setHfKey(e.target.value)}
            placeholder="hf_..." 
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Digunakan untuk memanggil model klasifikasi IndoBERT riil di Hugging Face Serverless API.
          </span>
        </div>

        <div className="settings-info-alert">
          Jika Anda tidak mengisi Kunci API di atas, sistem akan otomatis berjalan menggunakan <strong>Fallback Local Simulator</strong> yang beroperasi berdasarkan kecocokan pola kata kunci keluhan.
        </div>

        {showSavedMessage && (
          <div style={{ color: 'var(--color-risk-low)', fontSize: '0.85rem', textAlign: 'center', fontWeight: 'bold' }}>
            ✓ Konfigurasi kunci API berhasil disimpan!
          </div>
        )}

        <button type="submit" className="settings-btn">
          Simpan Konfigurasi Kunci API
        </button>
      </form>
    </div>
  );
}

export default SettingsPanel;
