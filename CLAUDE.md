# CLAUDE.md

Rules for any agent or person who works on Go2Market Tab. The full plan is in [`docs/BUILD_BRIEF.md`](docs/BUILD_BRIEF.md). Its decisions are final.

## How to talk to the maintainer

- Use ASD-STE100 Simplified Technical English. Short sentences. Active voice.
- Format for ADHD: lead with the bottom line, short sections, compact bullets, next actions in bold.
- American English. No em dashes. No Oxford commas. Do not use "This isn't X, it's Y" constructions.
- Do not use these phrases: "load-bearing", "blast radius", "You're right to push back", "worth flagging", "I'm going to be honest", "cross-cutting".
- Avoid code snippets in chat. Code goes in files.

## Engineering rules

- Do not mock data except in tests. Fixtures are fine in `test/`.
- Use existing implementations before you add new patterns. When a new pattern replaces an old one, remove the old one.
- Every error is yours to trace and fix at the root cause. Do not label or defer it.
- Do not write one-time scripts into permanent files.
- Update `CHANGELOG.md` in every PR. Use SemVer.

## Architecture rules

- **No admin setup.** The default setup needs no Workspace admin, no Google Cloud project and no OAuth verification.
- **Private sheet.** The sheet stays shared inside the company only.
- **No maintainer server.** The only hosted item is the static GitHub Pages site in `site/`.
- **No telemetry, no remote JavaScript, no AI features.**
- **No bundler, no framework.** Plain HTML, CSS and ES modules. One vendored library: `js-yaml` in `extension/vendor/`.
- **Thin connector, smart extension.** The Chrome Web Store updates the extension. A company's copy of the Apps Script never updates. So:
  - `connector/Code.gs` only reads the sheet and returns raw display values.
  - All parsing, validation, layout and theming logic lives in `extension/`.
- **One content source seam.** The `ContentSource` interface in `extension/src/source.js` is the only seam for future sources.
- **One fetch path.** Only `extension/src/background.js` fetches content.
- **One link trust boundary.** Every link goes through `safeHref`. Sheet data goes into the DOM only through `textContent`.
- **Chrome only**, version 120 or later.

## Repo layout

- `extension/`: the Chrome extension. Only this folder goes into the store zip.
- `connector/`: the Apps Script connector and the sheet template (`connector/template/` is the source of truth).
- `site/`: GitHub Pages (landing page, connect page, privacy page).
- `docs/`: Markdown docs, the spike kit in `docs/spike/` and the build brief.
- `test/`: `node:test` unit tests in `test/unit/`, fixtures and the Playwright smoke test.
- `scripts/`: permanent build and sync scripts only.

## Commands

- `npm run lint`: ESLint and Prettier check.
- `npm test`: unit tests.
