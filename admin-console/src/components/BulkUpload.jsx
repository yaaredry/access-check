import { useState, useRef } from 'react';
import { api } from '../api/client';

export default function BulkUpload({ onDone }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  async function handleUpload(e) {
    e.preventDefault();
    const file = fileRef.current?.files[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await api.uploadCSV(file);
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
        Upload a CSV file with columns: <code>identifier_type, identifier_value, verdict, expiration_date</code>
      </p>
      <form onSubmit={handleUpload} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="file" ref={fileRef} accept=".csv,text/csv" style={{ width: 'auto' }} />
        <button type="submit" className="primary" disabled={loading}>{loading ? 'Uploading…' : 'Upload CSV'}</button>
      </form>

      {error && <p className="error-msg" style={{ marginTop: 10 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius)', fontSize: 13 }}>
          <strong>Upload complete:</strong> {result.inserted} inserted, {result.updated} updated, {result.errors?.length || 0} errors out of {result.totalRows} rows.
          {result.errors?.length > 0 && (
            <ul style={{ marginTop: 8, paddingLeft: 16, color: 'var(--danger)' }}>
              {result.errors.slice(0, 10).map((e, i) => (
                <li key={i}>Line {e.line}: {e.error}</li>
              ))}
              {result.errors.length > 10 && <li>…and {result.errors.length - 10} more</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
