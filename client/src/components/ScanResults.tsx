import type { Scan } from '../api';

const SCAN_TYPE_LABEL: Record<string, string> = {
  quick: 'Quick Scan',
  service: 'Service Detection',
};

function formatDuration(ms?: number): string {
  if (ms === undefined) return '—';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export default function ScanResults({ scan }: { scan: Scan }) {
  const openPorts = scan.result?.hosts.flatMap((h) =>
    h.ports.filter((p) => p.state === 'open').map((p) => ({ host: h.address, ...p })),
  );

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-5 shadow-lg">
      {/* Summary row */}
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          label="Target"
          value={scan.target}
          sub={scan.resolvedIp && scan.resolvedIp !== scan.target ? `→ ${scan.resolvedIp}` : undefined}
        />
        <Stat label="Scan type" value={SCAN_TYPE_LABEL[scan.scanType] ?? scan.scanType} />
        <Stat label="Duration" value={formatDuration(scan.durationMs)} />
        <Stat label="Status" value={scan.status} status={scan.status} />
      </div>

      {scan.status === 'failed' && (
        <p className="rounded-lg border border-red-700 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {scan.error ?? 'Scan failed.'}
        </p>
      )}

      {scan.status === 'completed' && (
        <div className="overflow-x-auto">
          {openPorts && openPorts.length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-slate-700">
                  <th className="py-2 pr-4">Port</th>
                  <th className="py-2 pr-4">Protocol</th>
                  <th className="py-2 pr-4">Service</th>
                  <th className="py-2 pr-4">Version</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {openPorts.map((p) => (
                  <tr key={`${p.host}-${p.protocol}-${p.portId}`} className="border-b border-slate-800">
                    <td className="py-2 pr-4 font-mono text-cyan-300">{p.portId}</td>
                    <td className="py-2 pr-4">{p.protocol}</td>
                    <td className="py-2 pr-4">{p.service ?? '—'}</td>
                    <td className="py-2 pr-4 text-slate-400">
                      {[p.product, p.version, p.extraInfo].filter(Boolean).join(' ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-400">No open ports found.</p>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  status,
  sub,
}: {
  label: string;
  value: string;
  status?: string;
  sub?: string;
}) {
  const statusColor =
    status === 'completed'
      ? 'text-emerald-400'
      : status === 'failed'
        ? 'text-red-400'
        : status
          ? 'text-amber-400'
          : 'text-slate-100';
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`truncate font-medium ${status ? statusColor : 'text-slate-100'}`} title={value}>
        {value}
      </div>
      {sub && <div className="truncate font-mono text-xs text-slate-500" title={sub}>{sub}</div>}
    </div>
  );
}
