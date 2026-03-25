import { useState } from 'react';
import Login from './components/Login';
import ManualCheck from './components/ManualCheck';
import CameraCheck from './components/CameraCheck';
import AccessRequestForm from './components/AccessRequestForm';
import MySubmissions from './components/MySubmissions';

const VIEW_HOME = 'home';
const VIEW_MANUAL = 'manual';
const VIEW_CAMERA = 'camera';

export default function App() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('gate_token'));
  const [role, setRole] = useState(() => localStorage.getItem('gate_role') || '');
  const [requestorName, setRequestorName] = useState(() => localStorage.getItem('gate_name') || '');
  const [view, setView] = useState(VIEW_HOME);

  function handleLogout() {
    localStorage.removeItem('gate_token');
    localStorage.removeItem('gate_role');
    localStorage.removeItem('gate_name');
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
      {view === VIEW_HOME && <Home onManual={() => setView(VIEW_MANUAL)} onCamera={() => setView(VIEW_CAMERA)} onLogout={handleLogout} />}
      {view === VIEW_MANUAL && <ManualCheck onBack={() => setView(VIEW_HOME)} onSwitch={() => setView(VIEW_CAMERA)} />}
      {view === VIEW_CAMERA && <CameraCheck onBack={() => setView(VIEW_HOME)} onSwitch={() => setView(VIEW_MANUAL)} />}
    </div>
  );
}

function RequestorView({ onLogout, requestorName }) {
  const [tab, setTab] = useState('form');

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', background: 'var(--card-bg, #fff)' }}>
        <button
          onClick={() => setTab('form')}
          style={tabStyle(tab === 'form')}
        >
          📋 New Request
        </button>
        <button
          onClick={() => setTab('submissions')}
          style={tabStyle(tab === 'submissions')}
        >
          📄 My Submissions
        </button>
      </div>
      {tab === 'form'
        ? <AccessRequestForm onLogout={onLogout} requestorName={requestorName} />
        : <MySubmissions requestorName={requestorName} />
      }
      {tab === 'submissions' && (
        <div style={{ padding: '0 24px 24px' }}>
          <button className="secondary" onClick={onLogout} style={{ width: '100%' }}>Logout</button>
        </div>
      )}
    </div>
  );
}

function tabStyle(active) {
  return {
    flex: 1,
    padding: '14px 0',
    fontSize: 14,
    fontWeight: active ? 700 : 500,
    color: active ? 'var(--primary)' : 'var(--text-muted)',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
    marginBottom: -2,
    cursor: 'pointer',
  };
}

function Home({ onManual, onCamera, onLogout }) {
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
        <button className="scan" onClick={onCamera} style={{ padding: '28px 20px', fontSize: 22 }}>
          📷  Scan ID Card
        </button>
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
