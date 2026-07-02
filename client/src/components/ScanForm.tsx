import { useState, type FormEvent } from 'react';
import type { ScanType } from '../api';

interface Props {
  onScan: (target: string, scanType: ScanType) => void;
  loading: boolean;
}

export default function ScanForm({ onScan, loading }: Props) {
  const [target, setTarget] = useState('');
  const [scanType, setScanType] = useState<ScanType>('quick');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!target.trim() || loading) return;
    onScan(target.trim(), scanType);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-700 bg-slate-800/50 p-5 shadow-lg"
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-300">
            Target domain or IP
          </span>
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="scanme.nmap.org"
            maxLength={253}
            disabled={loading}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500 disabled:opacity-60"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-300">Scan type</span>
          <select
            value={scanType}
            onChange={(e) => setScanType(e.target.value as ScanType)}
            disabled={loading}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-cyan-500 disabled:opacity-60"
          >
            <option value="quick">Quick Scan (top 100 ports)</option>
            <option value="service">Service Detection (top 50, -sV)</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={loading || !target.trim()}
          className="rounded-lg bg-cyan-600 px-5 py-2 font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Scanning…' : 'Run Scan'}
        </button>
      </div>
    </form>
  );
}
