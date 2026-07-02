import { describe, it, expect } from 'vitest';
import type { AgentScanResponse, ScanType } from '@portscope/shared';
import { ScanService } from '../services/scanService.js';
import { InMemoryScanRepository } from '../repositories/inMemoryScanRepository.js';
import { ScannerError, type Scanner } from '../scanner/scannerClient.js';

const RESULT: AgentScanResponse = {
  resolvedIp: '45.33.32.156',
  provider: 'nmap',
  result: {
    target: '45.33.32.156',
    hosts: [{ address: '45.33.32.156', hostnames: ['scanme.nmap.org'], status: 'up', ports: [] }],
    raw: {},
  },
};

class OkScanner implements Scanner {
  async scan(): Promise<AgentScanResponse> {
    return RESULT;
  }
}
class FailingScanner implements Scanner {
  constructor(private readonly code: string) {}
  async scan(): Promise<AgentScanResponse> {
    throw new ScannerError(this.code, `agent said ${this.code}`);
  }
}

function svc(scanner: Scanner) {
  return new ScanService(new InMemoryScanRepository(10), scanner, 10);
}

describe('ScanService orchestration', () => {
  const input = { target: 'scanme.nmap.org', scanType: 'quick' as ScanType };

  it('completes a scan and records resolvedIp + result', async () => {
    const { scan, errorCode } = await svc(new OkScanner()).createScan(input);
    expect(errorCode).toBeUndefined();
    expect(scan.status).toBe('completed');
    expect(scan.resolvedIp).toBe('45.33.32.156');
    expect(scan.result?.hosts).toHaveLength(1);
    expect(scan.durationMs).toBeTypeOf('number');
  });

  it('marks a failed scan and surfaces the agent error code', async () => {
    const { scan, errorCode } = await svc(new FailingScanner('provider_unavailable')).createScan(input);
    expect(scan.status).toBe('failed');
    expect(errorCode).toBe('provider_unavailable');
    expect(scan.error).toContain('provider_unavailable');
  });

  it('stores history and fetches by id', async () => {
    const service = svc(new OkScanner());
    const { scan } = await service.createScan(input);
    expect(await service.getScan(scan.id)).toMatchObject({ id: scan.id, status: 'completed' });
    expect(await service.listScans()).toHaveLength(1);
    expect(await service.getScan('missing')).toBeNull();
  });
});
