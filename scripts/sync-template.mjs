/* Embeds the sheet template from connector/template/ into connector/Code.gs.

   connector/template/ is the source of truth: one TSV file per tab and
   Design.md for cell A1 of the Design tab. Apps Script has no file system
   and no modules, so Code.gs carries a generated copy of that data between
   the BEGIN and END markers below.

   Usage:
     node scripts/sync-template.mjs          write the block into Code.gs
     node scripts/sync-template.mjs --check  exit 1 when Code.gs is out of sync

   The unit tests import renderTemplateBlock() and readTemplate() to check
   the same thing. */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const TEMPLATE_DIR = join(ROOT, "connector", "template");
export const CODE_GS = join(ROOT, "connector", "Code.gs");

const BEGIN = "// BEGIN GENERATED TEMPLATE";
const END = "// END GENERATED TEMPLATE";

/* Tab order in the new sheet. `header: false` tabs are raw grids. */
export const TEMPLATE_TABS = [
  { name: "Config", header: true },
  { name: "Widgets", header: true },
  { name: "LayoutMap", header: false },
  { name: "QuickLinks", header: true },
  { name: "Positioning", header: true },
  { name: "Decks", header: true },
  { name: "Links", header: true },
  { name: "Recent", header: true },
  { name: "People", header: true },
];

/* TSV cells cannot hold tabs or line breaks. There is no quoting. */
export function parseTsv(text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.map((line) => line.split("\t"));
}

export function readTemplate(dir = TEMPLATE_DIR) {
  const tabs = TEMPLATE_TABS.map((tab) => ({
    name: tab.name,
    header: tab.header,
    rows: parseTsv(readFileSync(join(dir, `${tab.name}.tsv`), "utf8")),
  }));
  const design = readFileSync(join(dir, "Design.md"), "utf8");
  return { tabs, design };
}

/* One sheet row per line, so a diff of Code.gs reads like a diff of the TSV. */
export function renderTemplateBlock(template) {
  const tabs = template.tabs.map((tab) =>
    [
      `    { name: ${JSON.stringify(tab.name)}, header: ${tab.header}, rows: [`,
      ...tab.rows.map((row) => `      ${JSON.stringify(row)},`),
      "    ] },",
    ].join("\n"),
  );
  return [
    `${BEGIN} (node scripts/sync-template.mjs). Do not edit by hand.`,
    "// prettier-ignore",
    "var TEMPLATE = {",
    "  tabs: [",
    ...tabs,
    "  ],",
    `  design: ${JSON.stringify(template.design)},`,
    "};",
    END,
  ].join("\n");
}

/* Returns the block that Code.gs holds now, or null when the markers are missing. */
export function extractTemplateBlock(source) {
  const start = source.indexOf(BEGIN);
  const end = source.indexOf(END);
  if (start < 0 || end < start) return null;
  return source.slice(start, end + END.length);
}

function main() {
  const check = process.argv.includes("--check");
  const source = readFileSync(CODE_GS, "utf8");
  const current = extractTemplateBlock(source);
  if (current === null) {
    console.error(`Code.gs has no "${BEGIN}" ... "${END}" markers.`);
    process.exit(1);
  }
  const next = renderTemplateBlock(readTemplate());
  if (current === next) {
    console.log("Code.gs template block is in sync.");
    return;
  }
  if (check) {
    console.error("Code.gs template block is out of sync. Run: node scripts/sync-template.mjs");
    process.exit(1);
  }
  writeFileSync(
    CODE_GS,
    source.replace(current, () => next),
  );
  console.log("Updated the template block in Code.gs.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
