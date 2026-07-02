# PortScope

A small, local web GUI for running **authorized, limited** [Nmap](https://nmap.org/)
scans and viewing the results in a clean dashboard.

> ⚠️ **Authorized use only.** Only scan systems you own or are explicitly
> authorized to test. Unauthorized port scanning may be illegal in your
> jurisdiction. You are solely responsible for how you use this tool.

---

## Features

- Enter a target **domain or IP**, choose a scan type, run it, and view results.
- Two safe, allow-listed scan profiles only:
  - **Quick Scan** — `nmap -sT -T3 --top-ports 100`
  - **Service Detection** — `nmap -sT -sV -T3 --top-ports 50`
- Results show target, scan type, duration, and open ports (protocol, service, version).
- In-memory scan history with a REST API and OpenAPI/Swagger docs.

## Architecture

Layered and framework-agnostic so storage and scan engines are swappable:

- **Routes** (`server/src/routes`) — thin HTTP layer, no business logic.
- **ScanService** (`server/src/services`) — all business logic; models the scan
  lifecycle `pending → running → completed | failed`.
- **ScanProvider** (`server/src/providers`) — interface; `NmapScanProvider` is one
  implementation. Add Masscan/RustScan/custom by implementing the interface and
  registering it — no API changes.
- **ScanRepository** (`server/src/repositories`) — interface;
  `InMemoryScanRepository` today, swap for a Supabase implementation later.

This keeps the door open for **Supabase** (storage) and **Cloudflare Workers**
(replace only the Express layer) with minimal refactoring, and for **async jobs**
(the status model is already in place).

---

## Prerequisites

- **Node.js ≥ 18.17** and npm.
- **Nmap** installed and on your `PATH`.

### Installing Nmap

| OS | Command |
|----|---------|
| Debian/Ubuntu | `sudo apt install nmap` |
| Fedora/RHEL | `sudo dnf install nmap` |
| Arch | `sudo pacman -S nmap` |
| macOS (Homebrew) | `brew install nmap` |
| Windows | Download the installer from <https://nmap.org/download.html> |

Verify with `nmap --version`. If Nmap isn't on your PATH, set `NMAP_BIN` to its
full path (see below).

---

## Setup & Running

From the `portscope/` directory:

```bash
npm install        # installs both workspaces (server + client)
npm run dev        # runs server (:3001) and client (:5173) together
```

Then open **http://localhost:5173**.

- The client dev server proxies `/api` → `http://localhost:3001`, so no CORS setup
  is needed.
- API docs (Swagger UI): **http://localhost:3001/api/docs**

### Other scripts

```bash
npm run build      # type-check + build server and client
npm test           # run the server test suite (validation + XML parsing)
```

`-sT` (TCP connect) scans are used, so **no root/sudo is required**.

---

## Configuration (environment variables)

Set these before `npm run dev` (e.g. in a `.env` in your shell or inline):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `LOCAL_SCAN_ENABLED` | `false` | Allow scanning private/internal ranges when `true` |
| `SCAN_TIMEOUT_MS` | `60000` | Per-scan timeout (60s) |
| `RATE_LIMIT_MAX` | `5` | Max scans per window, per IP |
| `RATE_LIMIT_WINDOW_MS` | `300000` | Rate-limit window (5 min) |
| `NMAP_BIN` | `nmap` | Path to the Nmap binary |
| `HISTORY_LIMIT` | `50` | Number of scans retained in memory |

Example (allow scanning your own LAN):

```bash
LOCAL_SCAN_ENABLED=true npm run dev
```

---

## REST API

Base URL: `http://localhost:3001`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/scans` | Create & run a scan. Body: `{ "target": "...", "scanType": "quick" \| "service" }` |
| `GET` | `/api/scans` | List scan history (newest first) |
| `GET` | `/api/scans/:id` | Get one scan (full parsed result) |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/docs` | Swagger UI |

Example:

```bash
curl -s -X POST http://localhost:3001/api/scans \
  -H 'Content-Type: application/json' \
  -d '{"target":"scanme.nmap.org","scanType":"quick"}'
```

---

## Security limitations & controls

- **Allow-listed scans only.** The client selects a `scanType` enum; it can never
  supply raw Nmap flags. Aggressive modes, NSE attack scripts, brute force,
  evasion, spoofing, and destructive options are not supported.
- **No shell.** Scans run via `child_process.spawn` with a fixed argument array —
  never a shell string, never string interpolation.
- **Strict input validation.** Targets must be a valid domain or IP, ≤253 chars,
  with no shell metacharacters (defence in depth).
- **Private-range block.** Loopback, RFC-1918, link-local, CGNAT, ULA, multicast,
  and reserved ranges are rejected unless `LOCAL_SCAN_ENABLED=true`. This applies
  to IP literals *and* to the addresses a domain resolves to.
- **Resolve-first gating (TOCTOU mitigation).** Domain targets are resolved to
  their IP address(es) **before** scanning. If *any* resolved address is
  private/internal the scan is blocked, and the scan is then **pinned to the
  vetted IP** (Nmap scans that address, not the name), so a domain cannot resolve
  to a different address between the check and the scan. `LOCAL_SCAN_ENABLED=true`
  remains the only way to permit private/local targets.
- **Timeout & rate limiting.** 60s per scan; 5 scans / 5 minutes per IP by default.
- **No authentication** in this version — intended to run locally only. Do not
  expose it to untrusted networks.

## License

For authorized security testing and educational use.
