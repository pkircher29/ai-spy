# AI-Spy

**Recon and command console for every AI agent, harness, and local model on your machine.**

AI-Spy scans your machine for the AI tools you already run — coding agents (Claude Code, Codex,
Copilot), local model runtimes (Ollama, LM Studio), IDEs, and dozens of others — and gives you one
green-phosphor terminal to see what you use, what you spend, what's gone stale, and to actually
*drive* them: launch local models, swap which model each runs, chat with any agent, and have Claude
orchestrate a task across the whole fleet.

Zero runtime dependencies. Plain Node (v18+). Your data never leaves your machine.

![terminal](https://img.shields.io/badge/UI-phosphor%20CRT-3bff77) ![deps](https://img.shields.io/badge/dependencies-0-3bff77) ![node](https://img.shields.io/badge/node-%E2%89%A518-3bff77)

---

## Quick start

```sh
git clone https://github.com/<you>/ai-spy.git
cd ai-spy
node server.mjs
```

Open **http://localhost:4177**. That's it — no build step, no `npm install`.

To make it reachable on your LAN as `http://ai-spy.local` (and, if you use Tailscale, across your
tailnet), see [Networking](#networking) below.

---

## What it does

| Page | What's there |
|---|---|
| **Status** | Machine-wide meters: sessions, API-equivalent value, active tools, idle model disk, spend alerts. |
| **Dispatch** | Give one prompt; Claude plans a route across your agents/models, you can edit it, then it executes each step on the best agent and synthesizes the answer. Past runs are saved and replayable. |
| **Terminal** | Direct 1:1 chat with any single agent (Claude, Codex, Ollama, LM Studio) — pick the model, hold a conversation. |
| **Garage** | Launch / restart local model servers, rename agents, edit descriptions, and load a different model into memory per agent. |
| **Keyring** | Store API keys once, push them to your tools (env vars, this server, Hermes). Masked, gitignored, never sent back to the browser. |
| **Ledger** | Spend trends over time (daily/cumulative/monthly), model mix, and a projected month-end with editable budget alerts. |
| **Caps** | Subscriptions vs API-equivalent value, live usage/remaining where a provider exposes it (OpenRouter credits, Anthropic rate limits). |
| **Workshop** | Benchmark local models — first-token latency and tokens/sec on *your* hardware — so routing is data-driven. |
| **Map** | Discover agent services on this machine and your Tailscale mesh, each labeled with its address and live model list. |
| **Perks** | Inventory of skills, plugins, MCP servers, and subagents across harnesses, with usage counts and share/remove/audit directives you can run with one click. |
| **Inventory** | Every AI tool detected on the machine, with last-used and data footprint. |
| **Radio** | Ask the same question to every installed engine at once (consensus). |
| **Data / Log** | Per-model/project/day usage breakdown; recommendations log. |

Usage and spend are computed from local Claude Code transcripts and other harness logs, priced at
current public API rates (an "API-equivalent value" — useful even on a flat-rate subscription for
deciding which plan tier you need).

---

## Requirements

- **Node.js ≥ 18** (uses built-in `fetch`, ESM, `node:` core modules only).
- **Windows** is the best-supported platform today (process control and mDNS use Windows tooling).
  Core dashboards work cross-platform; agent launch/restart and the `.local` responder are Windows-first.
- Optional, auto-detected if present: Claude Code (`claude`), Codex (`codex`), Ollama, LM Studio (`lms`),
  and any of ~50 other AI tools.

Nothing is required to *view* the dashboards — AI-Spy just reports on whatever it finds.

---

## Networking

By default the server binds `0.0.0.0` on port **4177** and (best-effort) port **80**, so you can reach
it by hostname with no port. A Host-header allowlist keeps DNS-rebinding protection despite the wider
bind — only requests addressed to this machine's own names/IPs are served.

- **LAN:** a built-in zero-dependency mDNS responder advertises `ai-spy.local` (the default). Change
  the alias with `AISPY_HOST=myname node server.mjs`.
- **Tailscale:** name the node to match (`tailscale set --hostname ai-spy`) and MagicDNS resolves it
  across your tailnet.

If you'd rather keep it local-only, run with `PORT=4177` and just use `http://localhost:4177`.

### Keeping it running

For an always-on box, run the **watchdog** instead of the server directly:

```sh
node watchdog.mjs        # or: npm run watch
```

It supervises `server.mjs` and restarts it if it **crashes** (exponential backoff) or **hangs**
(three failed `/api/health` polls in a row → force restart). Server output flows through to the
watchdog console, and events are logged to `data/watchdog.log`. The server itself also swallows
stray request/job errors (`uncaughtException` / `unhandledRejection` are logged, not fatal).

To survive reboots, launch the watchdog from a Startup shortcut (Win+R → `shell:startup`, add a
shortcut to `node <path>\watchdog.mjs`) or register it as a scheduled task at logon.

---

## Configuration

All config lives in `config/` and is created on first run — **none of it is committed** (see
`.gitignore`):

- `config/subscriptions.json` — what you pay per month (seeded from `subscriptions.example.json`). Drives the spend-vs-value comparison.
- `config/agents.json` — the agent registry (auto-generated from what's installed; every discovered model gets a role + description).
- `config/budget.json` — monthly target and daily alert thresholds.
- `config/keys.json` — your API keys (see Security).

---

## Orchestration & chat

**Dispatch** and **Terminal** call your locally-installed CLIs and local model servers directly:
- Local models (Ollama, LM Studio) are called over their OpenAI-compatible `/v1/chat/completions`.
- CLI harnesses (`claude`, `codex`) are invoked as subprocesses.

Claude is the default orchestrator for Dispatch. If you don't have the `claude` CLI, Dispatch falls
back to a single-step route on the best available local model.

---

## Security

AI-Spy is designed to run on a machine you trust, for a single user:

- **API keys** are stored server-side in `config/keys.json` (plaintext, **gitignored**, never served to
  the browser, masked in the API as `••••abcd`). Treat the host as trusted.
- **Host allowlist** blocks DNS-rebinding; cross-origin mutating requests are rejected.
- **Directive execution** is whitelisted to `claude plugin disable/enable <name>` with a validated name
  — no arbitrary commands.
- **Consensus / chat / orchestration** sanitize prompts before they reach any CLI.

Don't expose this to the public internet. It's a local operator console, not a multi-tenant service.

---

## Design

The UI is an original green-phosphor CRT terminal aesthetic (a retro-computing genre, not any specific
product). A **Lite mode** toggle drops the glow/scanline effects for performance on phones or remote
viewing.

---

## CLI

Everything the web console does is also available headless:

```sh
node agentos.mjs report        # write a JSON snapshot + static HTML report
node agentos.mjs scan          # detect installed AI tools + last activity
node agentos.mjs usage         # raw usage analysis
node agentos.mjs consensus "question" [claude,codex,ollama]
```

---

## License

MIT — see [LICENSE](LICENSE).

Not affiliated with, or endorsed by, any of the AI tools or model providers it detects.
