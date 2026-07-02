/**
 * Nmap implementation of ScanProvider.
 *
 * SECURITY: this is the ONLY place a scan process is launched.
 *   - Uses child_process.spawn with a FIXED argument ARRAY — never a shell
 *     string, never string interpolation. The `shell` option is never set.
 *   - Only two allow-listed, non-aggressive profiles exist. The client picks a
 *     scanType enum; it can NEVER supply raw Nmap flags.
 *   - The validated target is appended as the final argv element by the server.
 *   - A hard timeout kills the process (SIGTERM then SIGKILL).
 */
import { spawn } from 'node:child_process';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { ScanResult, ScanType } from '../types.js';
import { parseNmapXml } from '../utils/nmapXml.js';
import {
  type ScanProvider,
  type ScanRunOptions,
  ScanProviderError,
} from './scanProvider.js';

/**
 * Allow-listed argument arrays. `-sT` (TCP connect) avoids needing root.
 * Explicitly NO: -sS, -A, -O, --script, -f/evasion, -D/decoy, -S/spoof,
 * timing above -T3, or any destructive option. `-oX -` streams XML to stdout.
 */
const PROFILES: Record<ScanType, string[]> = {
  quick: ['-sT', '-T3', '--top-ports', '100', '-oX', '-'],
  service: ['-sT', '-sV', '-T3', '--top-ports', '50', '-oX', '-'],
};

export class NmapScanProvider implements ScanProvider {
  readonly name = 'nmap';
  readonly supportedTypes = ['quick', 'service'] as const;

  run(target: string, scanType: ScanType, opts: ScanRunOptions): Promise<ScanResult> {
    const profile = PROFILES[scanType];
    if (!profile) {
      return Promise.reject(
        new ScanProviderError('scan_failed', `Unsupported scan type: ${scanType}`),
      );
    }

    // SECURITY: fixed args + validated target as the final element. No shell.
    const args = [...profile, target];

    return new Promise<ScanResult>((resolve, reject) => {
      const timeoutMs = opts.timeoutMs;
      let stdout = '';
      let stderr = '';
      let settled = false;

      logger.debug({ bin: config.nmapBin, args }, 'spawning nmap');

      const child = spawn(config.nmapBin, args, { shell: false });

      // SECURITY: hard timeout — terminate a runaway/hung scan.
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 2_000).unref();
        reject(
          new ScanProviderError(
            'scan_timeout',
            `Scan exceeded the ${Math.round(timeoutMs / 1000)}s time limit.`,
          ),
        );
      }, timeoutMs);

      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));

      child.on('error', (err: NodeJS.ErrnoException) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err.code === 'ENOENT') {
          reject(
            new ScanProviderError(
              'provider_unavailable',
              'Nmap is not installed or not found on PATH (set NMAP_BIN).',
            ),
          );
        } else {
          logger.error({ err }, 'nmap spawn error');
          reject(new ScanProviderError('scan_failed', 'Failed to start the scan.'));
        }
      });

      child.on('close', async (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code !== 0) {
          // stderr is logged (may contain details) but not returned to the client.
          logger.warn({ code, stderr: stderr.trim() }, 'nmap exited non-zero');
          reject(
            new ScanProviderError(
              'scan_failed',
              'The scan failed. Check the target and try again.',
            ),
          );
          return;
        }
        try {
          const result = await parseNmapXml(stdout, target);
          resolve(result);
        } catch (err) {
          logger.error({ err }, 'failed to parse nmap xml');
          reject(new ScanProviderError('scan_failed', 'Could not parse scan output.'));
        }
      });
    });
  }
}
