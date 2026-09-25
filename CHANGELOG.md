# Changelog

All notable changes to this project are recorded in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- M0 bootstrap: MIT license, README stub, `CLAUDE.md` rules, `.gitignore`, `package.json`, ESLint and Prettier config and a CI workflow (lint and unit tests).
- Build brief in `docs/BUILD_BRIEF.md`.
- Reference copy of the Google Labs DESIGN.md spec (alpha) in `docs/reference/design-md-spec.md`, with its Apache 2.0 license text in `docs/reference/LICENSE-design-md-spec`.
- M1 connector v1 (`connector/Code.gs`, `connector/appsscript.json`):
  - `doGet` returns every non-private tab as display values (contract `go2market-tab.content`, version 1).
  - Script cache for 120 seconds, chunked below 90 KB per value. Payloads that are too large skip the cache.
  - **Go2Market** sheet menu: Set up template tabs, Check sheet, Get connect link.
- Sheet template for the fictional company Acme Robotics in `connector/template/` (one TSV per tab and a neutral sample `Design.md` with dark tokens). `npm run template:sync` embeds it in `Code.gs`. A unit test keeps both in sync.
- Minimal dev extension (`extension/`) with a fixed development key (ID `oiceifkieliajphhhfnclagbjaniojgk`), `src/fetcher.js` (fetch and error classifier), `src/source.js` (source URL validation) and the "Test connection" view in `extension/dev/`.
- P0-0 spike kit: `docs/spike/P0-0-connector-spike.md`.
- Unit tests for the connector (through `vm`), template sync, fetcher classifier, URL validation and load-test statistics.
