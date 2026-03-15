import React, { useState } from 'react';
import ManualCheck from './components/ManualCheck';
import CameraCheck from './components/CameraCheck';

const VIEW_HOME = 'home';
const VIEW_MANUAL = 'manual';
const VIEW_CAMERA = 'camera';

export default function App() {
  const [view, setView] = useState(VIEW_HOME);

  return (
    <div style={{
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 480,
      margin: '0 auto',
    }}>
      {view === VIEW_HOME && <Home onManual={() => setView(VIEW_MANUAL)} onCamera={() => setView(VIEW_CAMERA)} />}
      {view === VIEW_MANUAL && <ManualCheck onBack={() => setView(VIEW_HOME)} />}
      {view === VIEW_CAMERA && <CameraCheck onBack={() => setView(VIEW_HOME)} />}
    </div>
  );
}

function Home({ onManual, onCamera }) {
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
      </div>
    </div>
  );
}
