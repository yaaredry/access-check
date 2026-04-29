import { useState } from 'react';
import Login from './components/Login';
import ManualCheck from './components/ManualCheck';
import CameraCheck from './components/CameraCheck';
import AccessRequestForm from './components/AccessRequestForm';
import MySubmissions from './components/MySubmissions';

const VIEW_HOME = 'home';
const VIEW_MANUAL = 'manual';
const VIEW_CAMERA = 'camera';

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp && Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

function clearGateSession() {
  localStorage.removeItem('gate_token');
  localStorage.removeItem('gate_role');
  localStorage.removeItem('gate_name');
}

export default function App() {
  const [authed, setAuthed] = useState(() => {
    const t = localStorage.getItem('gate_token');
    if (t && isTokenExpired(t)) {
      clearGateSession();
      return false;
    }
    return !!t;
  });
  const [role, setRole] = useState(() => localStorage.getItem('gate_role') || '');
  const [requestorName, setRequestorName] = useState(() => localStorage.getItem('gate_name') || '');
  const [view, setView] = useState(VIEW_MANUAL);

  function handleLogout() {
    clearGateSession();
    setAuthed(false);
    setRole('');
    setRequestorName('');
  }

  function handleLogin(userRole, userName) {
    setRole(userRole);
    setRequestorName(userName || '');
    setAuthed(true);
  }

  if (!authed) {
    return <Login onLogin={handleLogin} />;
  }

  if (role === 'access_requestor') {
    return <RequestorView onLogout={handleLogout} requestorName={requestorName} />;
  }

  return (
    <div style={{
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 480,
      margin: '0 auto',
    }}>
      {view === VIEW_HOME && <Home onManual={() => setView(VIEW_MANUAL)} onLogout={handleLogout} />}
      {view === VIEW_MANUAL && <ManualCheck onBack={() => setView(VIEW_HOME)} />}
      {view === VIEW_CAMERA && <CameraCheck onBack={() => setView(VIEW_HOME)} onSwitch={() => setView(VIEW_MANUAL)} />}
    </div>
  );
}

function RequestorView({ onLogout, requestorName }) {
  const [tab, setTab] = useState('form');
  const [extendRecord, setExtendRecord] = useState(null);

  function handleExtend(row) {
    setExtendRecord(row);
    setTab('form');
  }

  function handleExtendDone() {
    setExtendRecord(null);
  }

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 14px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 0.5 }}>🛡️ Access Check</div>
          {requestorName && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{requestorName}</div>
          )}
        </div>
        <button onClick={onLogout} style={{
          width: 'auto', padding: '8px 16px', fontSize: 13, fontWeight: 600,
          background: 'transparent', border: '1px solid var(--border)',
          color: 'var(--text-muted)', borderRadius: 10, letterSpacing: 0,
        }}>
          Logout
        </button>
      </div>

      {/* Segmented control */}
      <div style={{ padding: '12px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 12, padding: 4, gap: 4 }}>
          <button onClick={() => { setTab('form'); setExtendRecord(null); }} style={segmentStyle(tab === 'form')}>
            📋 New Request
          </button>
          <button onClick={() => setTab('submissions')} style={segmentStyle(tab === 'submissions')}>
            📄 My Submissions
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'form'
          ? <AccessRequestForm onLogout={onLogout} requestorName={requestorName} hideLogout extendRecord={extendRecord} onExtendDone={handleExtendDone} />
          : <MySubmissions requestorName={requestorName} onExtend={handleExtend} />
        }
      </div>
    </div>
  );
}

function segmentStyle(active) {
  return {
    flex: 1,
    padding: '10px 8px',
    fontSize: 14,
    fontWeight: active ? 700 : 500,
    color: active ? '#fff' : 'var(--text-muted)',
    background: active ? 'var(--primary)' : 'transparent',
    border: 'none',
    borderRadius: 9,
    cursor: 'pointer',
    width: 'auto',
    letterSpacing: 0,
    transition: 'background .15s, color .15s',
  };
}

function Home({ onManual, onLogout }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      flex: 1,
      padding: 32,
      minHeight: '100vh',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>🛡️</div>
        <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: 1 }}>Access Check</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>Gate verification system</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 360 }}>
        <button className="manual" onClick={onManual} style={{ padding: '28px 20px', fontSize: 22 }}>
          ✏️  Enter ID Manually
        </button>
        <button className="secondary" onClick={onLogout} style={{ marginTop: 8 }}>
          Logout
        </button>
      </div>
    </div>
  );
}
