# Go2Market Tab

Go2Market Tab is an open-source Chrome extension. It replaces the new tab page with a company go-to-market dashboard:

- Quick links.
- Positioning and messaging cards with one-click copy.
- Sales deck tiles.
- Grouped Drive links.
- A "recently updated" list.
- Key people.

A product marketer keeps the content in one private Google Sheet. A small Apps Script "connector" in that sheet sends the content to the extension. Employees see the content. They cannot change it.

## Status

Early development. See [`docs/BUILD_BRIEF.md`](docs/BUILD_BRIEF.md) for the plan and [`CHANGELOG.md`](CHANGELOG.md) for progress.

## Principles

- No Google Workspace admin, no Google Cloud project and no OAuth verification for the default setup.
- The sheet stays private to the company.
- No server. The only hosted item is a static GitHub Pages site.
- No telemetry, no remote JavaScript and no AI features.

## Development

- Node 20.19 or later on the 20 line, 22.13 or later on the 22 line, or Node 24 and later (the ESLint 10 range).
- `npm install`
- `npm run lint`
- `npm test`

## License

[MIT](LICENSE). Copyright (c) 2026 Penguin-Pants.
