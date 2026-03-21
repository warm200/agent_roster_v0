---
description: 
globs: 
alwaysApply: true
---

# AGENTS.MD

Woody owns this. Start: say hi + 1 motivating line.
Work style: telegraph; min tokens.

## Agent Protocol
- Workspace: `docs/` (specs w/ front-matter).
- Missing repo: clone `https://github.com/warm200/<repo>.git`.
- PRs: use `gh pr view/diff` (no URLs).
- “Make a note” => edit AGENTS.md (shortcut; not a blocker). Ignore `CLAUDE.md`.
- No `./runner`. Guardrails: use `trash` for deletes.
- Need upstream file: stage in `/tmp/`, then cherry-pick; never overwrite tracked.
- Bugs: add regression test when it fits.
- Keep files <~500 LOC; split/refactor as needed.
- Commits: Conventional Commits (`feat|fix|refactor|build|ci|chore|docs|style|perf|test`).
- Editor: `code <path>`.
- CI: `gh run list/view` (rerun/fix til green).
- Prefer end-to-end verify; if blocked, say what’s missing.
- New deps: quick health check (recent releases/commits, adoption).
- Web: search early; quote exact errors; prefer 2024–2025 sources; fallback Firecrawl (`pnpm mcp:*`) / `mcporter`.
- Style: telegraph. Drop filler/grammar. Min tokens (global AGENTS + replies).

## Screenshots (“use a screenshot”)
- Pick newest PNG in `~/Desktop` or `~/Downloads`.
- Verify it’s the right UI (ignore filename).
- Size: `sips -g pixelWidth -g pixelHeight <file>` (prefer 2×).
- Optimize: `imageoptim <file>` (install: `brew install imageoptim-cli`).
- Replace asset; keep dimensions; commit; run gate; verify CI.

## Docs
- Start: run docs list (`npx tsx scripts/docs-list.ts`); open docs before coding.
- Follow links until domain makes sense; honor `Read when` hints.
- Keep notes short; update docs when behavior/API changes (no ship w/o docs).
- Add `read_when` hints on cross-cutting docs.
- Model preference: latest only. OK: Anthropic Opus 4.6 / Sonnet 4.5 (Sonnet 3.5 = old; avoid), OpenAI GPT-5.4, xAI Grok-4.1 Fast, Google Gemini 3 Flash.

## Flow & Runtime
- Use repo’s package manager/runtime; no swaps w/o approval.
- Use Codex background for long jobs; tmux only for interactive/persistent (debugger/server).

## Build / Test
- Before handoff: run full gate (lint/typecheck/tests/docs).
- For every code change, run the full gate via `bash scripts/gate.sh [--no-build]`; do not treat single-file or targeted tests as final verification.
- Gate: `scripts/gate.sh [--no-build]`
  - Runs: Biome (lint+format+imports), tsc typecheck, debug-stmt check, trailing whitespace, build, tests.
  - `--no-build` skips the build step.
  - Set `PROJECT_DIR` env var to point to a different root (default: `.`).
  - Only check changed file/codes for lint; don't fix old code if it can't be lint:fix real quick.
- Uses Biome (replaces ESLint+Prettier). Quick fix: `npm run lint:fix`.
- CI red: `gh run list/view`, rerun, fix, push, repeat til green.
- Keep it observable (logs, panes, tails, MCP/browser tools).
- Release: read `docs/RELEASING.md` (or find best checklist if missing).

## Git
- Safe by default: `git status/diff/log`. Push only when user asks.
- Branch changes require user consent.
- Destructive ops forbidden unless explicit (`reset --hard`, `clean`, `restore`, `rm`, …).
- Don’t delete/rename unexpected stuff; stop + ask.
- No repo-wide S/R scripts; keep edits small/reviewable.
- Avoid manual `git stash`; if Git auto-stashes during pull/rebase, that’s fine (hint, not hard guardrail).
- If user types a command (“pull and push”), that’s consent for that command.
- No amend unless asked.
- Big review: `git --no-pager diff --color=never`.
- Multi-agent: check `git status/diff` before edits; ship small commits.

## Language/Stack Notes


### TypeScript/React 
- React 19 + TypeScript + Vite. All frontend code should be under `frontend/`.
- Dev server: `cd frontend && npm run dev` (already running in another terminal — do NOT restart).
- Lint: `cd frontend && npm run lint` (Biome — lint + format + import sorting in one pass).
- Auto-fix: `cd frontend && npm run lint:fix` (Biome applies safe fixes).
- Format only: `cd frontend && npm run format`.
- Typecheck: `cd frontend && npx tsc -b --noEmit`.
- Build: `cd frontend && npm run build` (runs tsc + vite build).
- Path alias: `@/*` maps to `frontend/src/*` (configured in tsconfig + vite).
- Styling: TailwindCSS v4 with class-based dark mode. Colors use HSL CSS variables.
- HTTP: always use shared axios from `frontend/src/services/api.ts`; never raw `fetch`.
- State: React Context API (AuthContext, ThemeContext, CookieContext).
- Keep components <500 LOC; split into sub-components as needed.

## Critical Thinking
- Fix root cause (not band-aid).
- Unsure: read more code; if still stuck, ask w/ short options.
- Conflicts: call out; pick safer path.
- Unrecognized changes: assume other agent; keep going; focus your changes. If it causes issues, stop + ask user.
- Leave breadcrumb notes in thread.

## Tools

Read `~/Projects/agent-scripts/tools.md` for the full tool catalog if it exists.


### committer
- Commit helper (PATH). Stages only listed paths; required here. Repo may also ship `./scripts/committer`.

### trash
- Move files to Trash: `trash …` (system command).

###  bin/docs-list / scripts/docs-list.ts
- Optional. Lists `docs/` + enforces front-matter. Ignore if `bin/docs-list` not installed. Rebuild: `bun build scripts/docs-list.ts --compile --outfile bin/docs-list`.

### bin/browser-tools / scripts/browser-tools.ts
- Chrome DevTools helper. Cmds: `start`, `nav`, `eval`, `screenshot`, `pick`, `cookies`, `inspect`, `kill`.
- Rebuild: `bun build scripts/browser-tools.ts --compile --target bun --outfile bin/browser-tools`.

### gh
- GitHub CLI for PRs/CI/releases. Given issue/PR URL (or `/pull/5`): use `gh`, not web search.
- Examples: `gh issue view <url> --comments -R owner/repo`, `gh pr view <url> --comments --files -R owner/repo`.

### tmux
- Use only when you need persistence/interaction (debugger/server).
- Quick refs: `tmux new -d -s codex-shell`, `tmux attach -t codex-shell`, `tmux list-sessions`, `tmux kill-session -t codex-shell`.

<frontend_aesthetics>
Avoid “AI slop” UI. Be opinionated + distinctive.

Do:
- follow the existing Theme, css, taste, do not create something that's not corresponding to the current theme
</frontend_aesthetics>
