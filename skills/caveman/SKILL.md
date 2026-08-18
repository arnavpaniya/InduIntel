---
name: caveman
description: Use when you want Claude Code (or Codex/Gemini/Cursor/30+ agents) to cut ~75% of output tokens by replying in fragment/telegraphic style — full technical accuracy, smaller mouth.
source: https://github.com/JuliusBrussee/caveman/blob/main/README.md
generated: 2026-05-12T18:03:58.555Z
category: tool
audience: general
---

## When to use

- Cutting Claude Code output-token spend without sacrificing technical accuracy on coding work
- Compressing CLAUDE.md / memory files with /caveman-compress to save ~46% input tokens every session
- Tighter PR comments and Conventional Commit messages via /caveman-review and /caveman-commit
- Wrapping any MCP server with caveman-shrink to compress tool descriptions before they reach the model

## Key concepts

### talk like caveman

Skill instructs the agent to drop filler words, hedging, and pleasantries — keep substance in telegraphic fragments. Same fix, ~75% fewer output tokens, 100% technical accuracy. Brain still big, mouth small. Benchmarks across 10 coding prompts show 65% average output reduction (range 22–87%).

### four grunt levels

/caveman accepts a level argument: `lite` (drop filler only), `full` (default caveman fragments), `ultra` (telegraphic, code-comment style), `wenyan` (classical Chinese, even shorter). Level persists until end of session or `normal mode`. Pick by how aggressive you want compression.

### /caveman-compress for memory files

Sub-skill that rewrites CLAUDE.md, project notes, and todo lists into caveman-speak. Code/URLs/paths byte-preserved. ~46% average input-token reduction every session — savings stack forever, not just per reply. Receipts in benchmarks/.

### caveman-shrink (MCP middleware)

Separate npm package that wraps any MCP server and compresses tool descriptions before they're sent to the model. Cuts tool-description tokens — a hidden tax on every agent call — without changing tool behaviour.

### cavecrew subagents

Caveman-style subagents (investigator / builder / reviewer). ~60% fewer tokens than vanilla subagents, so the main context lasts longer when delegating. Drop-in for Claude Code's Task tool flow.

### statusline + /caveman-stats

Claude Code shows `[CAVEMAN] ⛏ 12.4k` in the statusline — lifetime tokens saved. /caveman-stats reads the real session log, computes savings + USD equivalent, and can emit a `--share` line for Twitter. Set CAVEMAN_STATUSLINE_SAVINGS=0 to silence the badge.

### auto-activate per agent

Claude Code / Codex / Gemini auto-activate via skill discovery. Cursor / Windsurf / Cline / Copilot get always-on rule files via `--with-init`. Other agents trigger per-session with `/caveman` or 'talk like caveman'. Stop with 'normal mode'.

## API reference

```
One-line install (Mac / Linux / WSL / Git Bash)
```

Finds every agent on the machine and installs the caveman skill into each. ~30s. Needs Node ≥18. Safe to re-run (idempotent).

```
curl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.sh | bash
```

```
Windows install (PowerShell 5.1+)
```

Same installer, PowerShell variant. Use when shell is PowerShell, not Git Bash.

```
irm https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.ps1 | iex
```

```
/caveman [lite|full|ultra|wenyan]
```

Activates caveman mode for the current session. Without an argument defaults to `full`. Level persists until you say 'normal mode' or end the session.

```
/caveman ultra
# agent now answers in telegraphic fragments until session ends or 'normal mode'
```

```
Sub-skills
```

Targeted compression commands beyond the always-on chat mode. Each covers a specific surface where filler tokens add up.

```
/caveman-commit             # Conventional Commit msg, ≤50 char subject
/caveman-review             # one-line PR comments: `L42: 🔴 bug: user null`
/caveman-stats              # real session token usage + lifetime savings
/caveman-stats --share      # tweetable savings line
/caveman-compress <file>    # rewrite CLAUDE.md / notes into caveman-speak
```

```
caveman-shrink (MCP middleware)
```

Wraps any MCP server and compresses its tool descriptions before they hit the model. Available on npm.

```
npx -y caveman-shrink wrap <your-mcp-server-command>
# or install globally:
npm i -g caveman-shrink
```

```
Install for one agent only
```

Skip multi-agent autodiscovery and target a single agent (e.g. OpenClaw).

```
curl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.sh | bash -s -- --only openclaw
```

## Gotchas

- Output tokens only — thinking/reasoning tokens are untouched. Caveman makes the mouth smaller, not the brain.
- Code, URLs, and file paths are byte-preserved by /caveman-compress — but only when the input is structured. Mixed prose may shift terminology.
- Statusline shows lifetime tokens saved. Disable with CAVEMAN_STATUSLINE_SAVINGS=0 if you find it noisy.
- Auto-activate is built-in for Claude Code / Codex / Gemini. Other agents need `--with-init` (always-on rules) or `/caveman` per session.
- Levels persist until session end or explicit `normal mode` — don't expect a one-shot caveman reply unless you set `lite` and switch back manually.
- `/caveman-stats` reads the Claude Code session log. If the log location is non-standard, stats will undercount; check INSTALL.md for the path override.
- When wrapping an MCP server with caveman-shrink, verify tools still execute end-to-end — compressed descriptions occasionally trip strict tool routers.
- Skill is opinionated about voice (fragments + caveman-speak). If you need verbose explanations for a teammate, run `normal mode` for that turn rather than fighting the skill.

---
Generated by SkillMake from https://github.com/JuliusBrussee/caveman/blob/main/README.md on 2026-05-12T18:03:58.555Z.
Verify against source before relying on details.