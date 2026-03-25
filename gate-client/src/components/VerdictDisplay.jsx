import { useEffect } from 'react';

const CONFIG = {
  APPROVED: {
    color: 'var(--approved)',
    icon: '✓',
    label: 'APPROVED',
    bg: 'rgba(34,197,94,.15)',
  },
  NOT_APPROVED: {
    color: 'var(--not-approved)',
    icon: '✕',
    label: 'NOT APPROVED',
    bg: 'rgba(239,68,68,.15)',
  },
  EXPIRED: {
    color: 'var(--expired)',
    icon: '⏱',
    label: 'EXPIRED',
    bg: 'rgba(245,158,11,.15)',
  },
  ADMIN_APPROVED: {
    color: '#ca8a04',
    icon: '✓',
    label: 'ADMIN APPROVED',
    bg: 'rgba(234,179,8,.15)',
  },
  NOT_FOUND: {
    color: 'var(--not-found)',
    icon: '?',
    label: 'NOT FOUND',
    bg: 'rgba(100,116,139,.15)',
  },
};

export default function VerdictDisplay({ verdict, identifierValue, onBack, autoResetMs = 8000 }) {
  const cfg = CONFIG[verdict] || CONFIG.NOT_FOUND;

  useEffect(() => {
    if (!autoResetMs) return;
    const t = setTimeout(onBack, autoResetMs);
    return () => clearTimeout(t);
  }, [verdict, onBack, autoResetMs]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      flex: 1,
      padding: 24,
    }}>
      <div style={{
        width: 160,
        height: 160,
        borderRadius: '50%',
        background: cfg.bg,
        border: `4px solid ${cfg.color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 72,
        color: cfg.color,
        lineHeight: 1,
      }}>
        {cfg.icon}
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: cfg.color, letterSpacing: 2 }}>
          {cfg.label}
        </div>
        {identifierValue && (
          <div style={{ fontSize: 18, color: 'var(--text-muted)', marginTop: 8, letterSpacing: 2 }}>
            {identifierValue}
          </div>
        )}
      </div>

      {verdict === 'ADMIN_APPROVED' && (
        <ul style={{
          listStyle: 'disc',
          paddingLeft: 28,
          margin: 0,
          textAlign: 'left',
          display: 'inline-block',
        }}>
          <li style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.6 }}>All visitor cameras must be covered with blue stickers</li>
          <li style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.6 }}>All visitors must obtain and wear a badge at all times</li>
        </ul>
      )}

      <button className="back" style={{ marginTop: 16, maxWidth: 320 }} onClick={onBack}>
        ← Back
      </button>

      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        Auto-reset in {autoResetMs / 1000}s
      </div>
    </div>
  );
}
