# Build Brief: Go2Market Tab (v1)

You are starting a fresh build of **Go2Market Tab**, an open-source Chrome extension. All product decisions are final and listed below. Do not re-open them. Start building at "Section 9: First actions".

---

## 1. How to work with me

- Talk in ASD-STE100 Simplified Technical English. Short sentences. Active voice.
- Format for ADHD: lead with the bottom line, short sections, compact bullets, next actions in bold.
- American English. No em dashes. No Oxford commas. Do not use "This isn't X, it's Y" constructions.
- Do not use these phrases: "load-bearing", "blast radius", "You're right to push back", "worth flagging", "I'm going to be honest", "cross-cutting".
- Avoid code snippets in chat. Code goes in files.
- Engineering rules:
  - Do not mock data except in tests (fixtures are fine in `test/`).
  - Use existing implementations before you add new patterns. When a new pattern replaces an old one, remove the old one.
  - Every error is yours to trace and fix at the root cause. Do not label or defer it.
  - Do not write one-time scripts into permanent files.
- Ask me (AskUserQuestion) only at the stop points in Section 10. For everything else, use the decisions in this brief and sensible defaults. Record each assumption in the PR description.

---

## 2. Repositories

| Repo | Role | Access |
|---|---|---|
| `Penguin-Pants/Go2Market_Tab` | **New product repo.** Build everything here. | Read and write |
| `Penguin-Pants/GTM_Tab_4Chrome` | **Reference only.** My original one-company version for GetVocal. Pinned commit `0fbd453a19178ed516cc306a9aa42da8c09f72d5`. | Read only. Attach it with `add_repo` (access "read"). Never push to it. |

- Work on the branch that your session environment assigns in `Go2Market_Tab`.
- Open one PR per milestone (Section 8).
- The GitHub owner is `Penguin-Pants`, so the GitHub Pages base URL is `https://penguin-pants.github.io/Go2Market_Tab/` and the connect page is `https://penguin-pants.github.io/Go2Market_Tab/connect/`.

---

## 3. Product summary

**What it is.** A Chrome extension that replaces the new tab page with a company dashboard: quick links, positioning and messaging cards with one-click copy, sales deck tiles, grouped Drive links, a "recently updated" list and key people.

**Who uses it.**
- **Admin:** a product marketer. Usually **not** a Google Workspace admin. Owns the content in one Google Sheet, normally on a company Shared Drive.
- **Employees:** install the extension and see the content. They **cannot change content**. Their only control is light or dark mode.

**Core principles.**
- No Workspace admin, no Google Cloud project and no OAuth verification needed for the default setup.
- The sheet stays private (shared inside the company).
- No server owned by the maintainer. The only hosted item is a static GitHub Pages site.
- No telemetry. No remote JavaScript. No AI features.
- No bundler and no framework. Plain HTML, CSS and ES modules. One vendored library (`js-yaml`).
- **Thin connector, smart extension.** The Chrome Web Store updates the extension automatically. Each company's copy of the Apps Script never updates. So keep all parsing, validation, layout and theming logic in the extension. The connector only reads and returns raw cell values.

---

## 4. Final decisions (do not re-open)

| # | Decision | Choice |
|---|---|---|
| 1 | Product name | "Go2Market Tab". Short name "Go2Market". No GetVocal branding anywhere. |
| 2 | License | MIT. Copyright line: `Copyright (c) 2026 Penguin-Pants`. |
| 3 | Content source | **Only** an Apps Script "connector" web app bound to the content sheet. **Do not** use the gviz or CSV endpoints from the old repo. |
| 4 | Private access | The connector is deployed with "Execute as: Me" and "Who has access: Anyone within [company]". Small companies without Workspace can choose "Anyone". The sheet itself stays private in both cases. |
| 5 | Delivery of the source to employees | Default: a **connect link** to a static GitHub Pages page. Fallback: paste the link on the first-run screen. Optional for IT: `chrome.storage.managed` policy that sets and locks the source. |
| 6 | Fallback if the connector test (P0-0) fails | Option B: one central, Google-verified OAuth app with `spreadsheets.readonly`, owned by the maintainer. **Do not build it** unless I say so after the test. |
| 7 | Theming | The admin pastes a `DESIGN.md` file (Google Labs DESIGN.md format) into cell A1 of the `Design` tab. Apply **all** tokens: colors, typography, rounded, spacing and components. Ignore the prose. |
| 8 | Dark mode | Use explicit dark tokens when the file has them. Otherwise derive dark colors automatically. |
| 9 | Layout | `LayoutMap` tab only. Drop the old coordinate-based placement in the `Layout` tab. |
| 10 | Widget model | Generic widget types with a GTM template as the default content. |
| 11 | Build tooling | No bundler. Vendor `js-yaml` as an ES module. A Node package script builds the store zip. |
| 12 | Connect page host | GitHub Pages from the `site/` folder of the new repo. |
| 13 | SaaS | Deferred. Keep one seam only: a `ContentSource` interface in the extension. |
| 14 | Browser | Chrome only (Chrome 120 or later). |

---

## 5. Reference repo: what to port and what to leave

Attach `Penguin-Pants/GTM_Tab_4Chrome` and read these files at commit `0fbd453`. Port the **logic**. Rewrite names, styles and brand.

**Port (proven logic)**

| What | Old location | Notes |
|---|---|---|
| LayoutMap compiler | `src/sheets.js` lines 248-339 (`resolvePanelKey`, `compileLayoutMap`) | Solid-rectangle check, max 6 columns x 12 rows, reading-order sort, reject the whole map on a bad shape, skip unknown names with a warning |
| Capacity fill and "+N more" | `src/render.js` lines 390-509 (`defaultDensity`, `fitGroupedLinks`, `renderGrid`) | Items per box = rows x density. Grouped links charge one slot for each category header |
| Default layout | `src/render.js` lines 381-388 | Keep it as the fallback when `LayoutMap` is empty |
| URL allowlist | `src/render.js` lines 29-43 (`safeHref`) | Add `msteams:`. Keep it as the single trust boundary for links |
| DOM builder | `src/render.js` lines 1-23 (`el`, `clear`) | Remove the `html` prop. Use inline SVG built with DOM APIs, or static SVG files |
| Copy button | `src/render.js` lines 63-109 | `span role="button"` inside the card link (a button in an `a` is invalid). Show "Copy failed" when the clipboard fails (the old code ignores the failure) |
| Widget renderers | `src/render.js` lines 111-327 | Cards, deck tiles, grouped or flat links, recent list, people with initials avatar, quick links |
| Header lowercasing | `src/sheets.js` lines 49-67 (`rowsToObjects`) | Case-insensitive headers. Also trim them |
| Flash-free theme start | `src/theme-init.js`, `src/theme.js` | Classic script in `<head>`, `localStorage` key, MV3 CSP blocks inline scripts |
| Cache-first start | `src/newtab.js` | Render from cache at once, then refresh |
| CSS structure | `newtab.css` | Token variables, responsive grid (2 columns at 1280px or less, 1 column at 720px or less), panel sizing by row span. **Do not** copy the GetVocal colors, the Geist font or the Aurora comments |
| Sheet docs | `SHEET_TEMPLATE.md` | Reuse the LayoutMap rules, "How boxes fill" and the compact one-row rules. Rewrite all sample data |

**Leave behind (do not port)**
- `src/config.js` (`SHEET_ID` in source, gviz `csvUrl`) and `parseCsv`.
- The coordinate columns of the `Layout` tab (`column`, `row`, `columns`, `rows`, `order`).
- `normalizeImageUrl` Drive rewrite to `drive.google.com/uc?export=view`. Google has returned 403 for it since January 2024.
- The two fetch paths (the new tab page and the alarm both fetch).
- `getvocal-design-system.md`, `claude.md`, `storescreenshot.png`, the GetVocal logo URL (`cdn.sanity.io`), the `getvocal.ai` link, the Geist font, the `sage` / `accent` / `mustard` avatar names and all sample people and Slack URLs.

**Known bugs in the old repo that the new design must not repeat**
1. gviz returns the **first** tab when a tab name does not exist. (The connector reads tabs by exact name, so this goes away.)
2. gviz returns the minority type as null in mixed-type columns. (The connector returns display values as text.)
3. Errors in non-Config tabs were discarded. Every tab problem must reach Diagnostics.
4. Unknown panel names in the `Layout` tab were dropped with no warning.
5. Every new tab fetched 9 URLs with `cache: "no-store"`.
6. `onStartup` reset the refresh interval to the default and ignored the sheet value.
7. The cache had no schema version.
8. Raw error text ("HTTP 400", "Failed to fetch") was shown to employees.

---

## 6. Architecture and contracts

### 6.1 Repo layout

```
extension/            Chrome extension (the only thing in the store zip)
  manifest.json
  managed_schema.json
  newtab.html  settings.html  preview.html
  src/                ES modules (see 6.4)
  styles/             tokens.css (neutral default theme), app.css
  vendor/js-yaml.mjs  + vendor/LICENSE-js-yaml
  icons/              16, 48, 128 PNG (simple neutral placeholders)
  _locales/en/messages.json
connector/
  Code.gs             Apps Script connector (web app + sheet menu + template builder)
  appsscript.json
  template/           Source of truth for the template: one TSV per tab + sample DESIGN.md
site/                 GitHub Pages: landing page, connect/, privacy/, docs pages
docs/                 Markdown docs + spike/ + BUILD_BRIEF.md (this file)
test/                 node:test unit tests, fixtures, Playwright smoke test
scripts/              package.mjs (build zip), no one-time scripts
.github/workflows/    ci.yml, release.yml, pages.yml
LICENSE  README.md  CHANGELOG.md  CONTRIBUTING.md  CLAUDE.md
```

### 6.2 Sheet schema v1 (GTM template)

All tabs have a header row except `LayoutMap` and `Design`. Headers are case-insensitive. Tabs whose name starts with `_` are private notes, so the connector skips them.

| Tab | Columns (* = required) | Purpose |
|---|---|---|
| `Config` | `key`, `value` | Keys: `companyName`, `headline`, `homeUrl`, `logoLightUrl`, `logoDarkUrl`, `backgroundUrl`, `fontCssUrl`, `refreshMinutes` (default 30, minimum 5), `schemaVersion` (1) |
| `Widgets` | `id`*, `type`*, `source`*, `category`, `title`, `moreLink`, `density`, `hidden` | Widget registry. When empty, use the GTM defaults below |
| `LayoutMap` | No header. Grid of widget ids | Page layout (rules ported from the old repo) |
| `QuickLinks` | `label`*, `url`*, `icon` | Top-bar chips. `icon` is an emoji or an https image URL |
| `Positioning` | `title`*, `summary`, `body`, `url`, `copyText` | Type `cards` |
| `Decks` | `title`*, `description`, `url`, `thumbnailUrl` | Type `tiles` |
| `Links` | `title`*, `url`*, `category`, `description` | Type `links` |
| `Recent` | `title`*, `url`*, `context` | Type `list` |
| `People` | `name`*, `role`, `url` | Type `people` (Slack, Teams or mailto links) |
| `Design` | A1 = full DESIGN.md text. Optional override table from C1: `role`, `token` | Theming |

**Widget types:** `cards`, `tiles`, `links`, `list` and `people`. A widget reads rows from its `source` tab. A `links` widget with a `category` shows only that category, flat (no group headers). Without a category, it groups by category.

**GTM defaults when `Widgets` is empty:** `positioning` (cards, Positioning), `decks` (tiles, Decks), `links` (links, Links), `recent` (list, Recent) and `people` (people, People). In the `LayoutMap`, a `Links` category name also works as a widget id (old behavior). Built-in ids win on a name clash, and `links:<category>` forces the category.

**Aliases:** Accept `driveUrl` and `slackUrl` as aliases for `url`. Accept `SalesDecks`, `DriveLinks` and `KeyPeople` as aliases for the tab names. This lets an old GetVocal sheet migrate by copy and paste.

**Row rules:** Ignore rows where a required column is empty, and report the count and the reason in Diagnostics.

### 6.3 Connector contract (Apps Script, `connector/Code.gs`)

- `appsscript.json`:
  - V8 runtime.
  - Scopes: `https://www.googleapis.com/auth/spreadsheets.currentonly` and `https://www.googleapis.com/auth/script.container.ui`.
  - `webapp`: `executeAs: USER_DEPLOYING`, `access: DOMAIN`.
  - If the spike shows `currentonly` fails in a web app, change to `spreadsheets` and write down why.
- `doGet(e)`:
  - Return JSON with `ContentService` and MIME type JSON.
  - Payload: `{ "format": "go2market-tab.content", "connectorVersion": 1, "generatedAt": ISO-8601, "sheets": [ { "name": string, "values": string[][] } ] }`.
  - `values` = `getDataRange().getDisplayValues()` with trailing empty rows and columns trimmed.
  - Include every tab except names that start with `_`. Do not add or reshape anything.
- Cache:
  - `CacheService.getScriptCache()`, TTL 120 s.
  - One cache value holds at most 100 KB. Chunk larger payloads into keys of 90 KB or less with an index key.
  - When a payload is too large to cache, return it uncached and do not fail.
- `onOpen` menu **Go2Market**:
  - **Set up template tabs.** Creates any missing tabs with headers, sample rows and Plain-text format, from data embedded in `Code.gs`. Keep that data in sync with `connector/template/` through a test.
  - **Check sheet.** Basic tab and header checks, shown in a sidebar.
  - **Get connect link.** Shows `https://penguin-pants.github.io/Go2Market_Tab/connect/#src=<encodeURIComponent(ScriptApp.getService().getUrl())>` with copy instructions. If the web app is not deployed yet, show numbered deploy steps.
- Write the connector logic as plain functions that Node tests can load with the `vm` module. Apps Script has no modules.

### 6.4 Extension

**Manifest (MV3)**
- `name`: "Go2Market Tab". `minimum_chrome_version`: "120".
- `chrome_url_overrides.newtab`: `newtab.html`. `options_page`: `settings.html`.
- `background`: `src/background.js`, module.
- `permissions`: `storage`, `alarms`.
- `host_permissions`: `https://script.google.com/*`, `https://script.googleusercontent.com/*`.
- `externally_connectable.matches`: `https://penguin-pants.github.io/Go2Market_Tab/*`.
- `storage.managed_schema`: `managed_schema.json` with `sourceUrl` (string) and `lockSource` (boolean).
- `key`: a development public key so local builds keep a fixed extension ID.
  - Create the key pair with `openssl`.
  - Commit **only** the public key. Add the private key file to `.gitignore`.
  - After I create the Chrome Web Store item, I will give you the store public key to replace it.

**Source URL validation**
- Accept only `^https://script\.google\.com/(a/macros/[A-Za-z0-9.-]+/|macros/)s/[A-Za-z0-9_-]+/exec$`.
- The test build (Section 7) also accepts `http://127.0.0.1:<port>/`.

**Modules in `src/`** (each pure module gets unit tests)
- `source.js`:
  - `ContentSource` interface and `AppsScriptSource`.
  - Resolve the source in this order: managed policy, then local storage.
- `fetcher.js`:
  - `fetch(url, { credentials: "include", redirect: "follow", cache: "no-store" })`.
  - Classify errors: `NOT_CONNECTED`, `NOT_SIGNED_IN` (final URL is on `accounts.google.com`), `NO_ACCESS`, `NOT_FOUND`, `NOT_A_CONNECTOR` (not JSON or wrong `format`), `CONNECTOR_OUTDATED`, `EXTENSION_OUTDATED`, `OFFLINE` and `UNKNOWN`.
  - Update the classifier from the spike results.
- `schema.js`: turns the raw `sheets` into a normalized content model. Handles header aliases, tab aliases, required fields, widget registry, defaults, per-row warnings and `schemaVersion`.
- `layout.js`: ported LayoutMap compiler and capacity math.
- `design.js`: DESIGN.md engine (6.5).
- `color.js`: sRGB to OKLCH conversion, WCAG contrast ratio and dark derivation.
- `render.js`: DOM renderers. Only `textContent` for sheet data. `safeHref` for every link. Images only `https:` or `data:image/(png|jpeg|gif|webp|svg+xml)`.
- `store.js`: `chrome.storage.local` cache `{ schemaVersion, sourceUrl, raw, model, fetchedAt, lastError }`. Drop the cache when `schemaVersion` differs.
- `background.js`: the **only** place that fetches.
  - Single-flight: one fetch at a time.
  - On message `refresh-if-stale` from a new tab: fetch only if the data is older than 5 minutes.
  - Alarm at `refreshMinutes` with plus or minus 10% jitter. Read the interval from the cache on `onStartup`.
  - `onMessageExternal`:
    1. Accept only when `sender.origin` is `https://penguin-pants.github.io`.
    2. Validate the URL.
    3. Refuse when the policy locks the source.
    4. Save the URL, refresh and reply `{ ok }`.
- `newtab.js`:
  - Render from the cache and send `refresh-if-stale`.
  - Re-render on `chrome.storage.onChanged`.
  - With no source, show the first-run screen: a plain explanation ("Ask your product marketing team for the Go2Market connect link") and a paste field with validation.
- `settings.js`:
  - Theme.
  - "Refresh now".
  - "Updated X min ago".
  - Source status (read-only when managed).
  - Under Advanced: "Reconnect" and "Reset extension".
- `preview.js`: Diagnostics page (M5).

**Employee-facing UI rules**
- Hide empty widgets for employees. Show empty-state hints only in Preview.
- Keep plain error text for employees, for example "Content could not update. Showing saved content." Put technical detail only in Diagnostics.
- Show "Updated X min ago" and a small refresh control on the new tab.
- Keep the theme toggle.
- Links open in the same tab (old behavior).
- All UI strings come from `_locales/en/messages.json` through `chrome.i18n`.

### 6.5 DESIGN.md engine (`design.js`)

- **Parse.** Read `Design!A1`. Extract YAML front matter between `---` lines. Parse it with the vendored `js-yaml`. The spec (alpha) defines the groups `colors`, `typography`, `rounded`, `spacing`, `components` and the keys `name`, `version`, `description`, `omitted`. Resolve `{path.to.token}` references and detect loops.
- **Colors.** Map roles to CSS variables, using the first match:

| Role | CSS variable | Alias list |
|---|---|---|
| bg | `--g2m-bg` | background, bg, canvas, paper, surface-background |
| surface | `--g2m-surface` | surface, surface-container, card |
| text | `--g2m-text` | text, on-background, on-surface, foreground, ink |
| textMuted | `--g2m-text-muted` | text-muted, text-secondary, on-surface-variant, muted |
| accent | `--g2m-accent` | accent, primary, brand |
| onAccent | `--g2m-on-accent` | on-accent, on-primary |
| border | `--g2m-border` | border, outline, outline-variant, divider, rule |
| secondary | `--g2m-secondary` | secondary |
| tertiary | `--g2m-tertiary` | tertiary |
| error, warning, success | matching `--g2m-*` | same name |

  - The override table in `Design!C:D` wins over the alias lists.
  - Also expose **every** color as `--g2m-color-<sanitized-name>` so components can use it.
  - The avatar tones use accent, secondary and tertiary.
- **Typography.** Map roles to page parts:

| DESIGN.md role | Page part |
|---|---|
| `display-*`, `headline-*`, `h1` | Headline |
| `title-*`, `h2`, `h3` | Panel and card titles |
| `body-*`, `body` | Body text |
| `label-*`, `caption` | Chips and metadata |

  - Apply every valid property: `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, `fontStyle`, `fontFeature`, `fontVariation`.
  - Load fonts in this order:
    1. If `Config.fontCssUrl` is set, load it.
    2. Otherwise, try a Google Fonts `css2` link for each non-system family.
    3. Fall back to the system stack and add a Diagnostics warning.
  - The default neutral theme uses the system font stack, so the default makes **no** remote requests.
- **Rounded, spacing.** `rounded.sm` (chips, buttons), `md` (cards), `lg` (panels), `full` (pills). Map the `spacing` scale to gap and padding variables.
- **Components.** Map the contract names `panel`, `panel-title`, `card`, `chip`, `button`, `banner`, `avatar`, `link` and `headline`. Use the spec properties (`backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height`, `width`). List unknown components and keys in Diagnostics as "ignored".
- **Validation.** Accept a value only if `CSS.supports` passes for its property (in tests, use a regex-based validator). Never inject raw CSS text. Sanitize font family names.
- **Dark mode.**
  - Explicit dark tokens are a `colors-dark` group, or color tokens with a `dark-` prefix or `-dark` suffix. Use them when present.
  - Otherwise derive in OKLCH:
    - Neutral roles (bg, surface, text, textMuted, border): invert lightness within clamps (bg about 0.18 to 0.22, text about 0.93). Keep the hue and reduce chroma.
    - Accent colors: keep hue and chroma, and raise lightness until contrast is 4.5:1 or better on the dark bg.
- **Contrast checks.** text on bg, textMuted on bg, text on surface and onAccent on accent. Warn in Diagnostics below 4.5:1. Auto-adjust **only** derived dark colors, never the admin's explicit values.
- **Sample file.** Ship a neutral sample `DESIGN.md` **with** YAML front matter, including dark tokens, in `connector/template/Design.md`.

---

## 7. Quality, build and release

- **Node 20 or later.** `package.json` holds dev dependencies only (ESLint, Prettier, Playwright, js-yaml for vendoring). The extension ships no npm dependencies at runtime.
- **Unit tests** (`node:test`): schema, layout, capacity, design (parse, refs, mapping, dark derivation), color, fetcher classifier, `safeHref`, URL validation, connector functions (through `vm`) and template sync.
- **Smoke test** (Playwright, Chromium):
  - Load an unpacked **test build** whose host permissions also allow `http://127.0.0.1/*`.
  - Serve a fixture connector payload from a local server and check the render.
  - Also cover the first-run screen and one error state.
  - If this environment has Chromium at `/opt/pw-browsers`, use it. Do not run `playwright install` there.
- **`scripts/package.mjs`:** copies an allowlist of `extension/` files to `dist/`, writes `dist/go2market-tab-<version>.zip` and can emit the test build.
- **CI** (`ci.yml`): lint, unit tests, smoke test, package. **Release** (`release.yml`): on tag `v*`, attach the zip to a GitHub release. **Pages** (`pages.yml`): deploy `site/` with `actions/deploy-pages`.
- **Versioning:** SemVer. Update `CHANGELOG.md` in every PR.

---

## 8. Milestones (one PR each, in this order)

**M0: Bootstrap**
- `LICENSE` (MIT), `README.md` stub, `CLAUDE.md` (engineering rules from Section 1 and the architecture rules from Section 3), `.gitignore`, `package.json`, lint config, empty CI.
- Commit this brief as `docs/BUILD_BRIEF.md`.
- Done when: CI is green on an empty test suite.

**M1: Connector v1 and the spike kit (P0-0)**
- `connector/Code.gs`, `appsscript.json` and `connector/template/*` (GTM sample rows with a fictional company "Acme Robotics").
- `docs/spike/P0-0-connector-spike.md`: a step-by-step test script for me with a results table. Tests:
  - T1: signed in to the work account only.
  - T2: signed in to personal and work accounts, with the work account **not** first. Try the `/a/macros/<domain>/` URL form.
  - T3: signed out.
  - T4: a second user in the same domain.
  - T5: a user outside the domain.
  - T6: "Anyone" access while signed out.
  - T7: which URL form `ScriptApp.getService().getUrl()` returns.
  - T8: load. Run 50 parallel fetches, then 200 in one minute. Record errors and latency.
  - T9: whether `spreadsheets.currentonly` works in `doGet`.
- A "Test connection" view in a minimal extension dev build. It shows the status, final URL, content type, byte count, time and the classifier result.
- Done when: unit tests pass and the kit is ready for me. **Then stop and ask me to run the spike (stop point S1).** While you wait, continue with M2 using fixtures.

**M2: Extension core**
- Manifest, source resolution, background fetch and cache, schema, ported layout and renderers, neutral theme, first-run screen, settings page, i18n strings.
- Done when: the smoke test renders the fixture, the first-run screen works and there are no GetVocal references (add a CI grep check for "getvocal", "vocal", "sanity.io" and "Geist").

**M3: Connect page and managed policy**
- `site/connect/`:
  1. Read `#src=`, validate it and keep it out of logs.
  2. For each known extension ID (dev key, then store), try `chrome.runtime.sendMessage`.
  3. If no extension answers, show an Install button (Chrome Web Store URL, or "load unpacked" steps before the listing exists). Poll every 2 s after the click.
  4. On success, show "Connected. Open a new tab."
- `managed_schema.json` with lock behavior.
- `docs/it-rollout.md` with a copy-ready policy JSON example.

**M4: DESIGN.md engine** (Section 6.5), with full unit tests and the sample file.

**M5: Preview and Diagnostics page**
- Connector version.
- Each tab found or missing, with rows kept and dropped plus the reasons.
- A LayoutMap grid preview with warnings.
- Design tokens applied, ignored and derived, with contrast results.
- The last error with its class and a plain fix.

**M6: Docs and store assets**
- `README.md` with two paths, "I manage the content" and "I use the tab".
- `docs/admin-guide.md` (template setup, deploy the connector, connect link, DESIGN.md, LayoutMap and "How boxes fill").
- `docs/employee-faq.md`, `docs/troubleshooting.md` (one entry for each error class), `docs/it-request.md` (text a marketer can send to IT when the company allowlists extensions) and `docs/migrating-from-gtm-tab.md` (old GetVocal sheet to schema v1).
- `site/privacy/`: no data collection, no telemetry. Content goes only between the browser and the company's own Apps Script.
- Store description draft and a screenshot of the fixture.

**M7: Release readiness**
- Release workflow, Pages workflow, version `1.0.0-rc.1` and a final pass on accessibility (keyboard, focus and contrast).

---

## 9. First actions for this session

1. Attach `Penguin-Pants/GTM_Tab_4Chrome` (read) with `add_repo`. Read the files listed in Section 5 at commit `0fbd453`.
2. Inspect `Penguin-Pants/Go2Market_Tab`. It is new and may contain only a README.
3. Download the Google DESIGN.md spec (`https://github.com/google-labs-code/design.md/blob/main/docs/spec.md`) and save the version you used in `docs/reference/design-md-spec.md`, with the retrieval date and source link. If the network blocks it, build from Section 6.5 and write that down.
4. Do M0, then M1. Push and open the PRs.
5. Report to me in the style of Section 1: what is done, what I must do next (in bold) and any assumptions you made.

---

## 10. Stop points (ask me only here)

| ID | When | What you need from me |
|---|---|---|
| S1 | M1 is done | I run the spike in a real Workspace and send you the results table. If T1, T2 (with the domain URL form) or T8 fail, stop the source work and propose the Option B plan. |
| S2 | Before M3 is final | I create the Chrome Web Store item and give you its public key and extension ID. |
| S3 | Before M6 publishes Pages | I enable GitHub Pages with source "GitHub Actions" in the repo settings. |
| S4 | Any product decision not covered by this brief | Ask with AskUserQuestion. Give a recommended option first. |

---

## 11. Out of scope for v1

- Public gviz or CSV reading, and any Google Cloud or OAuth setup (unless S1 fails and I approve Option B).
- Server backend, accounts, billing, analytics or telemetry.
- Content editing inside the extension.
- Firefox or Safari. Edge is P2.
- A search box (P2, as an admin toggle).
- Translations beyond English (the strings are ready for them in `_locales`).
