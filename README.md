# PortScope

[![CI](https://github.com/yogi822/portscope/actions/workflows/ci.yml/badge.svg)](https://github.com/yogi822/portscope/actions/workflows/ci.yml)

A small, secure, local web GUI for running **authorized, limited** [Nmap](https://nmap.org/)
scans and viewing the results in a clean dashboard.

> ⚠️ **Authorized use only.** Only scan systems you own or are explicitly
> authorized to test. Unauthorized port scanning may be illegal in your
> jurisdiction. You are solely responsible for how you use this tool.

---

## What it does

PortScope lets an authorized user enter a target domain or IP, choose one of two
safe scan profiles, run the scan, and view the results — open ports, protocol,
service name, and version — in a browser dashboard. Scan history is kept for the
session and exposed over a small REST API with OpenAPI/Swagger docs.

Only two non-aggressive, allow-listed scan profiles are supported:

| Profile | Command |
|---------|---------|
| **Quick Scan** | `nmap -sT -T3 --top-ports 100` |
| **Service Detection** | `nmap -sT -sV -T3 --top-ports 50` |

The client never supplies raw Nmap flags — it only picks a scan type. There is no
support for aggressive timing, NSE attack scripts, brute force, evasion,
spoofing, or any destructive option.

## Tech stack

- **Backend:** Node.js, TypeScript, Express
- **Frontend:** React, Vite, Tailwind CSS
- **Validation:** zod
- **XML parsing:** xml2js (parses Nmap's `-oX` output)
- **Logging:** pino / pino-http (structured JSON logs)
- **API docs:** OpenAPI 3 (generated from zod) + Swagger UI
- **Tests:** Vitest
- **Tooling:** npm workspaces monorepo

## Architecture overview

Layered and framework-agnostic, so storage and scan engines are swappable:

```
client (React) ──HTTP──> Express routes (thin: validate + map HTTP)
                              │
                              ▼
                         ScanService  ── business logic + scan lifecycle
                          │         │       (pending → running → completed | failed)
              ┌───────────┘         └────────────┐
              ▼                                   ▼
       ScanProvider (interface)           ScanRepository (interface)
         └─ NmapScanProvider                 └─ InMemoryScanRepository
```

- **Routes** (`server/src/routes`) — thin HTTP layer; no business logic.
- **ScanService** (`server/src/services`) — all business logic; owns the scan
  status lifecycle and the resolve-first security gate.
- **ScanProvider** (`server/src/providers`) — interface; `NmapScanProvider` is the
  only implementation today. New engines can be added by implementing the
  interface, with no API changes.
- **ScanRepository** (`server/src/repositories`) — interface;
  `InMemoryScanRepository` today, storage-agnostic by design.

This keeps the door open for a future storage backend and hosting target with
minimal refactoring, and for async jobs (the status model is already in place).

---

## Local setup

### Prerequisites

- **Node.js ≥ 18.17** and npm
- **Nmap** installed and on your `PATH`

### Installing Nmap

| OS | Command |
|----|---------|
| Debian/Ubuntu | `sudo apt install nmap` |
| Fedora/RHEL | `sudo dnf install nmap` |
| Arch | `sudo pacman -S nmap` |
| macOS (Homebrew) | `brew install nmap` |
| Windows | Download the installer from <https://nmap.org/download.html> |

Verify with `nmap --version`. If Nmap isn't on your `PATH`, set `NMAP_BIN` to its
full path (see configuration below).

### Install & configure

```bash
git clone https://github.com/yogi822/portscope.git
cd portscope
npm install                 # installs both workspaces (server + client)
cp .env.example .env        # optional; defaults are sensible
```

## How to run the app

```bash
npm run dev                 # server :3001 + client :5173 together
```

Then open **http://localhost:5173**.

- The Vite dev server proxies `/api` → `http://localhost:3001`, so the browser
  only talks to one origin (no CORS setup needed).
- API docs (Swagger UI): **http://localhost:3001/api/docs**

`-sT` (TCP connect) scans are used, so **no root/sudo is required.**

### Example: a safe target you're allowed to scan

The Nmap project hosts **`scanme.nmap.org`** specifically for testing. Enter it as
the target, choose **Quick Scan**, and click **Run Scan**.

```bash
curl -s -X POST http://localhost:3001/api/scans \
  -H 'Content-Type: application/json' \
  -d '{"target":"scanme.nmap.org","scanType":"quick"}'
```

### Other scripts

```bash
npm test                    # server test suite (validation, XML parsing, resolve-gate)
npm run build               # type-check + build server and client
```

## Configuration

Environment variables (all optional; defaults shown):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `LOCAL_SCAN_ENABLED` | `false` | Allow scanning private/internal ranges when `true` |
| `SCAN_TIMEOUT_MS` | `60000` | Per-scan timeout (60s) |
| `RATE_LIMIT_MAX` | `5` | Max scans per window, per IP |
| `RATE_LIMIT_WINDOW_MS` | `300000` | Rate-limit window (5 min) |
| `NMAP_BIN` | `nmap` | Path to the Nmap binary |
| `HISTORY_LIMIT` | `50` | Scans retained in memory |
| `LOG_LEVEL` | `info` | pino log level |

## REST API

Base URL: `http://localhost:3001`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/scans` | Create & run a scan. Body: `{ "target": "...", "scanType": "quick" \| "service" }` |
| `GET` | `/api/scans` | List scan history (newest first) |
| `GET` | `/api/scans/:id` | Get one scan (full parsed result) |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/docs` | Swagger UI |

---

## Security controls

- **Allow-listed scans only.** The client selects a `scanType` enum; it can never
  supply raw Nmap flags. Aggressive modes, NSE attack scripts, brute force,
  evasion, spoofing, and destructive options are not supported.
- **No shell.** Scans run via `child_process.spawn` with a fixed argument array —
  never a shell string, never string interpolation.
- **Strict input validation.** Targets must be a valid domain or IP, ≤253 chars,
  with no shell metacharacters (defence in depth).
- **Resolve-first private-range block.** Domain targets are resolved to their
  IP address(es) **before** scanning; if any resolved address is
  private/loopback/link-local/CGNAT/ULA/multicast/reserved the scan is blocked,
  and the scan is **pinned to the vetted IP** (Nmap scans that address, not the
  name) — closing the TOCTOU gap. IP literals are gated directly.
  `LOCAL_SCAN_ENABLED=true` is the only way to permit private/local targets.
- **Timeout & rate limiting.** 60s per scan; 5 scans / 5 minutes per IP by default.
- **Safe errors.** Internal details (stderr, stack traces) are logged, never
  returned to the client; clients receive categorized, safe messages.

## Limitations

- **No authentication** — intended to run **locally only**. Do not expose it to
  untrusted networks.
- **In-memory history** — scan history is lost when the server restarts.
- **Single-node rate limiting** — the limiter is process-local.
- **TCP connect scans only** (`-sT`) — no SYN scans, by design (no root needed).

## Authorized-use disclaimer

PortScope is intended for **authorized security testing and educational use only**.
You must have explicit permission to scan any target that you do not own.
Unauthorized scanning may violate computer-misuse and anti-hacking laws. The
authors accept no liability for misuse. By using this tool you agree that you are
solely responsible for ensuring your scans are lawful and authorized.

## CI/CD

Every pull request to `main` and every push to `main` runs a GitHub Actions
workflow ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)) on
`ubuntu-latest` with Node.js 22. It:

- installs dependencies (`npm ci` when `package-lock.json` is present, otherwise
  `npm install`), with npm dependency caching;
- runs the test suite (`npm test`);
- type-checks and builds both workspaces (`npm run build`);
- runs a **non-blocking** security audit (`npm audit --audit-level=high`) — the
  result is printed but does not fail the build for now.

Nmap is **not** installed in CI: the tests use XML fixtures and an injected fake
DNS resolver, so no real scans run.

## Roadmap

Milestone 1 (current) delivers a clean, secure local MVP. Possible next steps:

- [ ] Persistent storage backend for scan history
- [ ] Asynchronous scan jobs (the status model is already in place)
- [ ] Additional scan providers behind the existing `ScanProvider` interface
- [ ] Authentication / multi-user support
- [ ] Export results (JSON / CSV)
- [x] CI pipeline (test, build, audit) — GitHub Actions
- [ ] Deployment target for hosted use

## License

For authorized security testing and educational use.
