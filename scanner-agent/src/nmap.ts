/**
 * SECURITY: the ONLY place Nmap runs.
 *   - child_process.spawn with a FIXED argument ARRAY — never a shell string,
 *     never interpolation; the `shell` option is never set.
 *   - Two allow-listed, non-aggressive profiles only. -sT avoids needing root.
 *   - Hard timeout kills the process (SIGTERM then SIGKILL).
 */
import { spawn } from 'node:child_process';
import type { ScanResult, ScanType } from '@portscope/shared';
import { config } from './config.js';
import { logger } from './logger.js';
import { parseNmapXml } from './nmapXml.js';

const PROFILES: Record<ScanType, string[]> = {
  quick: ['-sT', '-T3', '--top-ports', '100', '-oX', '-'],
  service: ['-sT', '-sV', '-T3', '--top-ports', '50', '-oX', '-'],
};

export class NmapError extends Error {
  constructor(
    public readonly code: 'scan_failed' | 'scan_timeout' | 'provider_unavailable',
    message: string,
  ) {
    super(message);
    this.name = 'NmapError';
  }
}

/** Run an allow-listed Nmap scan against an already-gated IP/target. */
export function runNmap(target: string, scanType: ScanType): Promise<ScanResult> {
  const profile = PROFILES[scanType];
  if (!profile) {
    return Promise.reject(new NmapError('scan_failed', `Unsupported scan type: ${scanType}`));
  }
  const args = [...profile, target]; // validated target appended as final argv

  return new Promise<ScanResult>((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    logger.debug({ bin: config.nmapBin, args }, 'spawning nmap');
    const child = spawn(config.nmapBin, args, { shell: false });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 2_000).unref();
      reject(
        new NmapError(
          'scan_timeout',
          `Scan exceeded the ${Math.round(config.scanTimeoutMs / 1000)}s time limit.`,
        ),
      );
    }, config.scanTimeoutMs);

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        reject(
          new NmapError(
            'provider_unavailable',
            'Nmap is not installed or not found on PATH (set NMAP_BIN).',
          ),
        );
      } else {
        logger.error({ err }, 'nmap spawn error');
        reject(new NmapError('scan_failed', 'Failed to start the scan.'));
      }
    });

    child.on('close', async (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (exitCode !== 0) {
        logger.warn({ exitCode, stderr: stderr.trim() }, 'nmap exited non-zero');
        reject(new NmapError('scan_failed', 'The scan failed. Check the target and try again.'));
        return;
      }
      try {
        resolve(await parseNmapXml(stdout, target));
      } catch (err) {
        logger.error({ err }, 'failed to parse nmap xml');
        reject(new NmapError('scan_failed', 'Could not parse scan output.'));
      }
    });
  });
}
