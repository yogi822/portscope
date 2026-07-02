# Security Policy

## Authorized use only

PortScope is a tool for **authorized security testing and educational use only**.
Only scan systems you own or have explicit, written authorization to test.
Unauthorized port scanning may be illegal in your jurisdiction. You are solely
responsible for ensuring your use of this tool is lawful.

## Reporting a vulnerability

If you discover a security vulnerability in PortScope, please report it privately
rather than opening a public issue:

- Open a [GitHub Security Advisory](https://github.com/yogi822/portscope/security/advisories/new)
  for this repository, **or**
- Contact the maintainer privately.

Please include:

- a description of the issue and its impact,
- steps to reproduce (proof of concept), and
- affected version / commit.

We aim to acknowledge reports promptly and will keep you updated on remediation
progress.

## Do not submit secrets

**Never include secrets in issues, pull requests, or advisories** — no API keys,
tokens, passwords, private keys, `.env` files, or real target credentials. If a
report requires sensitive data, note that in the report and we will arrange a
private channel. Redact any sensitive values from logs and screenshots before
sharing.

## Responsible disclosure

Please give us a reasonable opportunity to investigate and release a fix before
disclosing a vulnerability publicly. We appreciate coordinated, responsible
disclosure and will credit reporters who wish to be acknowledged.

## Scope

In scope: the PortScope server and client in this repository (input validation,
target gating, command execution, rate limiting, error handling).

Out of scope: vulnerabilities in Nmap itself (report those upstream to the Nmap
project), and issues that require running the tool outside its documented,
local-only, authorized-use model.
