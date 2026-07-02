# Contributing to PortScope

Thanks for your interest in improving PortScope! This is a small, security-focused
project — contributions that keep it simple, safe, and readable are very welcome.

> Please read [SECURITY.md](./SECURITY.md) first. PortScope is for **authorized
> use only**, and security-sensitive changes get extra scrutiny.

## Running locally

Prerequisites: **Node.js ≥ 18.17**, npm, and **Nmap** on your `PATH`
(see the [README](./README.md#installing-nmap)).

```bash
git clone https://github.com/yogi822/portscope.git
cd portscope
npm install            # installs both workspaces (server + client)
cp .env.example .env   # optional
npm run dev            # server :3001 + client :5173
```

Open http://localhost:5173. API docs are at http://localhost:3001/api/docs.

## Testing

```bash
npm test               # run the server test suite (Vitest)
npm run build          # type-check + build server and client
```

Please make sure **both `npm test` and `npm run build` pass** before opening a
pull request. If you change validation, target gating, or command execution, add
or update tests to cover the new behavior — these are the security-critical paths.

## Coding guidelines

- **TypeScript, strict mode.** No `any` unless truly unavoidable, and prefer
  explicit types at module boundaries.
- **Keep layers separated.** Routes stay thin (validate + map HTTP); business
  logic lives in `ScanService`; scanning is behind the `ScanProvider` interface;
  storage is behind the `ScanRepository` interface.
- **Security first.**
  - Never pass user input to a shell. Use `child_process.spawn` with an argument
    array — never `exec` or a shell string.
  - Only add scan options that are safe and non-aggressive. No exploit/NSE attack
    scripts, brute force, evasion, spoofing, or destructive flags.
  - Validate and gate all input; keep the private-range block intact.
- **Structured logging.** Use the pino `logger` — no `console.log`.
- **Match the existing style.** Follow the naming, formatting, and comment density
  of the surrounding code. Add comments where a security control is implemented.
- **Small, focused changes.** One logical change per PR, with a clear description.

## Pull request checklist

- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] No secrets, `.env` files, keys, or real scan outputs committed
- [ ] Tests added/updated for behavioral changes
- [ ] Docs updated if behavior or configuration changed

## Reporting bugs

Open a GitHub issue with steps to reproduce, expected vs. actual behavior, and
your environment (OS, Node version, Nmap version). For **security**
vulnerabilities, follow [SECURITY.md](./SECURITY.md) instead of opening a public
issue.
