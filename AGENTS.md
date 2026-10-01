# Go2Market Tab
Project tier: T2
Conventions version: 1.0

## Purpose

Go2Market Tab is an open-source Chrome extension (MIT). It replaces the new tab page with a company go-to-market dashboard. An Apps Script "connector" in a private Google Sheet feeds the content (`README.md`, `package.json`).

## Stack

- JavaScript ES modules, Node `^20.19.0 || ^22.13.0 || >=24` (`package.json`); CI uses Node 22 (`.github/workflows/ci.yml`)
- Chrome extension, Manifest V3, minimum Chrome 120 (`extension/manifest.json`)
- Google Apps Script connector, V8 runtime (`connector/Code.gs`, `connector/appsscript.json`)
- No bundler and no framework (`README.md`, `docs/BUILD_BRIEF.md` section 3)
- Test: Node built-in test runner (`node --test`)
- Lint and format: ESLint 10, Prettier 3 (`eslint.config.js`, `.prettierrc.json`)

## Commands

- Install: `npm install` (CI uses `npm ci`)
- Run: no dev server. Load the `extension/` folder as an unpacked extension in Chrome (unverified)
- Test all: `npm test`
- Test one: `node --test test/unit/<file>.test.mjs` (unverified)
- Lint: `npm run lint` (ESLint plus `prettier --check .`)
- Format: `npm run format`
- Type check: none found
- Build: none found
- Sync sheet template into `connector/Code.gs`: `npm run template:sync` (check only: `node scripts/sync-template.mjs --check`)
- Makefile: none found

## Key paths

- `docs/BUILD_BRIEF.md`: build brief and final product decisions (plan source of truth)
- `docs/spike/P0-0-connector-spike.md`: connector spike steps
- `docs/reference/`: reference copy of the DESIGN.md spec with its license
- `CHANGELOG.md`: progress log
- `extension/`: extension source (`manifest.json`, `src/`, `dev/`, `_locales/`)
- `connector/Code.gs`, `connector/appsscript.json`: Apps Script connector
- `connector/template/`: sheet template, one TSV per tab plus `Design.md` (source of truth)
- `scripts/sync-template.mjs`: embeds the template into `Code.gs`
- `test/unit/`, `test/helpers/`: tests
- `.github/workflows/ci.yml`: CI (lint and unit tests)

## Environment variables

None found. No `.env.example`. The code and CI read none. The connector stores one Apps Script property, `g2mSpreadsheetId` (`connector/Code.gs`).

## Gotchas

- `connector/Code.gs` holds a generated block between `// BEGIN GENERATED TEMPLATE` and `// END GENERATED TEMPLATE`. Edit `connector/template/` and run `npm run template:sync`. A unit test checks both stay in sync.
- Keep the connector thin. It only reads cells and returns text. Parsing, validation, layout and theming belong in the extension (`docs/BUILD_BRIEF.md` section 3, `connector/Code.gs` header).
- `Code.gs` top-level names use `var` and `function` so Node tests can load it with the `vm` module.
- `AGENTS.md` and `CLAUDE.md` are formatted with `mdformat --number`. `npm run lint` runs `prettier --check .` and this repo does not list them in `.prettierignore`. The check may fail on that format (unverified).

## Do not

- Do not edit the generated block in `connector/Code.gs` by hand.
- Do not edit `docs/reference/` (third-party spec copy, Apache 2.0) or `package-lock.json` by hand.
- Do not commit `*.pem` files or `keys/` (`.gitignore`). Only the public key in `extension/manifest.json` is committed.
- Do not add a server, telemetry, remote JavaScript, AI features, a bundler or a framework (`README.md` principles, `docs/BUILD_BRIEF.md`).
- Do not use the gviz or CSV endpoints. The connector is the only content source (`docs/BUILD_BRIEF.md` section 4).

## Existing notes

The lines below are the previous content of this file, kept unchanged apart from heading level.

### Agent Rules

User has diagnosed ADHD. Optimize every reply for scannability, brevity and single-threaded focus.

#### Output (chat, commits, code comments, docs)

01. Write in ASD-STE100. Plain, warm peer tone. Exception: profanity allowed for emphasis when context fits.
02. Multi-turn tasks: line 1 is `Step X/Y: <summary>`, then a blank line, then the body.
03. Next line: the answer, command, file path or diff. Rationale below it.
04. Unprompted explanations: max ~150 words. Elaborate only when asked.
05. Lists: max 5 items; group longer lists by priority. Number ordered steps sequentially (1., 2., 3.), never repeated 1.
06. One issue at a time. End actionable replies with one next step (file or command). No time estimates.
07. State required context inline. Never ask the user to remember anything across turns.
08. No "I" narration of process. State results and changes in concrete terms.
09. No apologies, sycophancy or preamble. On error: fix, then state what changed.
10. No code snippets except out-of-task diffs for approval.
11. Emoji only as status markers (✅ ❌ ⚠️). Max one per line. Never in prose, headings or code.
12. No em dashes. No Oxford commas.

#### Process

1. Verify before asserting: source read, grep or authoritative docs. Never use general knowledge for specifics (APIs, headers, pricing).
2. Cite sources (`path/file.go:42` or URL). Label uncited claims "unverified assumption" and state how to verify.
3. State confidence (high/medium/low) on diagnoses and fixes.
4. Ambiguous request: verify first. If still ambiguous, ask one question before any edit.
5. Challenge the user's reasoning when evidence disagrees.
6. A question is not an edit instruction. Answer it.
7. Run independent tool calls in parallel.
8. After 3 failed fix attempts: stop edits, name the unverified assumption, ask one diagnostic question.

#### Edits

1. In-task edits: proceed without approval. Report changes after.
2. Out-of-task edits: propose a diff in chat. Edit only after explicit approval. Diff >40 lines: give a 1-line summary first; user chooses view or proceed.
3. Every error found, in any file, gets a root-cause fix: apply in-task fixes, propose out-of-task fixes. Never label or defer.
4. Prefer removing components over adding. Use the fewest moving parts that satisfy the requirement.
5. Search the codebase for an existing implementation before adding a new pattern.
6. New pattern replaces old: migrate all call sites and delete the old implementation in the same change.
7. Delete unused code after confirming zero references (incl. dynamic imports, config, external consumers).
8. One-time scripts: run from /tmp, delete after, never commit.
9. Mock data only in tests.

#### Testing (TDD)

1. Stub first. Prove failure on an assertion, not a compile error. Write minimum code to pass.
2. Unit test every public function and error branch. Integration test every feature slice.
3. Assert behavior, not implementation. Delete assertions that survive an inverted requirement.

#### Tooling

- Use Makefile targets over direct calls when present (e.g. `make test`).
- Grep for exact search, `rg` for regex. Mermaid for complex system diagrams.
- Instruction files (SKILL.md, **/prompts/**, AGENTS.md, CLAUDE.md): format only with `mdformat --number`.

#### Subagents

- Default to the cheapest adequate model. Follow `.agents/skills/shared/SUBAGENT-STEERABILITY.md` if present.
- Verify subagent completion. Retry incomplete work with a higher turn limit. Report turn-limit exhaustion with ⚠️.
- Ask before engineering work (edits, design, debugging) on a downgraded model. Mechanical, read-only, git and docs work: no prompt.

You are cherished.
