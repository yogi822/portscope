import type { Scan } from '../api';

interface Props {
  scans: Scan[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

const statusDot: Record<string, string> = {
  completed: 'bg-emerald-400',
  failed: 'bg-red-400',
  running: 'bg-amber-400',
  pending: 'bg-slate-400',
};

export default function ScanHistory({ scans, selectedId, onSelect }: Props) {
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-5 shadow-lg">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Scan History
      </h2>
      {scans.length === 0 ? (
        <p className="text-sm text-slate-500">No scans yet.</p>
      ) : (
        <ul className="space-y-1">
          {scans.map((scan) => (
            <li key={scan.id}>
              <button
                onClick={() => onSelect(scan.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-700/50 ${
                  scan.id === selectedId ? 'bg-slate-700/70' : ''
                }`}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${statusDot[scan.status] ?? 'bg-slate-400'}`}
                  title={scan.status}
                />
                <span className="truncate font-medium text-slate-200">{scan.target}</span>
                <span className="ml-auto shrink-0 text-xs text-slate-500">
                  {scan.scanType === 'quick' ? 'Quick' : 'Service'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
