import React, { useState, useRef } from 'react';
import { api } from '../api/client';
import VerdictDisplay from './VerdictDisplay';

export default function CameraCheck({ onBack }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  function handleCapture(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    submitImage(file);
  }

  async function submitImage(file) {
    setError('');
    setLoading(true);
    try {
      const res = await api.verifyImage(file);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Image verification failed');
    } finally {
      setLoading(false);
      // Reset input so same file can be reselected
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function reset() {
    setResult(null);
    setError('');
  }

  if (result) {
    return (
      <VerdictDisplay
        verdict={result.verdict}
        identifierValue={result.identifierValue || ''}
        onBack={reset}
      />
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      padding: 24,
      flex: 1,
    }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, textAlign: 'center' }}>Scan ID Card</h2>

      <p style={{ color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
        Take a clear photo of the ID card.<br />
        The image will not be stored.
      </p>

      {/* Hidden file input targeting the camera */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        style={{ display: 'none' }}
        id="camera-input"
      />

      {loading ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 18 }}>Processing image…</div>
        </div>
      ) : (
        <label
          htmlFor="camera-input"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            width: '100%',
            maxWidth: 320,
            padding: '40px 24px',
            background: 'var(--surface)',
            border: '3px dashed var(--primary)',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--primary)',
          }}
        >
          <span style={{ fontSize: 56 }}>📷</span>
          Open Camera
        </label>
      )}

      {error && (
        <div style={{ color: 'var(--not-approved)', textAlign: 'center', fontWeight: 600 }}>{error}</div>
      )}

      <button className="back" style={{ maxWidth: 320, width: '100%' }} onClick={onBack} disabled={loading}>
        ← Back
      </button>
    </div>
  );
}
