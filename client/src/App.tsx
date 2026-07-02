import { useEffect, useState } from 'react';
import ScanForm from './components/ScanForm';
import ScanResults from './components/ScanResults';
import ScanHistory from './components/ScanHistory';
import { createScan, listScans, getScan, ApiError, type Scan, type ScanType } from './api';

export default function App() {
  const [current, setCurrent] = useState<Scan | null>(null);
  const [history, setHistory] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshHistory() {
    try {
      setHistory(await listScans());
    } catch {
      /* history is non-critical; ignore transient failures */
    }
  }

  useEffect(() => {
    refreshHistory();
  }, []);

  async function handleScan(target: string, scanType: ScanType) {
    setLoading(true);
    setError(null);
    try {
      const scan = await createScan(target, scanType);
      setCurrent(scan);
      await refreshHistory();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(id: string) {
    setError(null);
    try {
      setCurrent(await getScan(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load scan.');
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Port<span className="text-cyan-400">Scope</span>
          </h1>
          <p className="text-sm text-slate-400">Authorized Nmap scanning dashboard</p>
        </header>

        {/* SECURITY: persistent authorized-use warning — always visible. */}
        <div className="mb-6 rounded-lg border border-amber-600/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          ⚠️ <strong>Authorized use only.</strong> Only scan systems you own or are
          authorized to test. Unauthorized scanning may be illegal.
        </div>

        <ScanForm onScan={handleScan} loading={loading} />

        {error && (
          <div className="mt-4 rounded-lg border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            {loading && (
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5 text-sm text-slate-400">
                Running scan… this can take up to a minute.
              </div>
            )}
            {current && !loading && <ScanResults scan={current} />}
            {!current && !loading && (
              <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
                Run a scan to see results here.
              </div>
            )}
          </div>

          <ScanHistory scans={history} selectedId={current?.id} onSelect={handleSelect} />
        </div>
      </div>
    </div>
  );
}
