import { useState } from 'react';
import { api } from '../api/client';

export default function GSheetImport({ onDone }) {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLoad(e) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.importGSheet(url.trim());
      setResult(res);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p style={{ marginBottom: 12, color: 'var(--text-muted)' }}>
        Paste a public Google Sheets URL. The sheet must contain columns{' '}
        <code>תעודת זהות</code> (IL ID) and <code>סטטוס</code> (status).
        Rows with status <em>בתהליך אישור</em> are skipped.
      </p>
      <form onSubmit={handleLoad} style={{ display: 'flex', gap: 8 }}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          style={{ flex: 1 }}
          required
        />
        <button type="submit" className="primary" disabled={loading}>
          {loading ? 'Loading…' : 'Load'}
        </button>
      </form>

      {error && <p className="error-msg" style={{ marginTop: 10 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius)', fontSize: 13 }}>
          <strong>Import complete:</strong>{' '}
          {result.inserted} inserted, {result.updated} updated
          {result.skipped > 0 && `, ${result.skipped} skipped (pending)`}
          {`, ${result.errors?.length || 0} errors`}
          {` out of ${result.totalRows} rows.`}
          {result.errors?.length > 0 && (
            <ul style={{ marginTop: 8, paddingLeft: 16, color: 'var(--danger)' }}>
              {result.errors.slice(0, 10).map((e, i) => (
                <li key={i}>Row {e.line}: {e.error}</li>
              ))}
              {result.errors.length > 10 && <li>…and {result.errors.length - 10} more</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
