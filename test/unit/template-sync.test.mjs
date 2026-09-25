import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CODE_GS,
  extractTemplateBlock,
  readTemplate,
  renderTemplateBlock,
} from "../../scripts/sync-template.mjs";
import { loadConnector, plain } from "../helpers/connector.mjs";

test("Code.gs embeds the current connector/template data", () => {
  const block = extractTemplateBlock(readFileSync(CODE_GS, "utf8"));
  assert.notEqual(block, null, "Code.gs has no generated template block");
  assert.equal(
    block,
    renderTemplateBlock(readTemplate()),
    "Code.gs is out of sync. Run: node scripts/sync-template.mjs",
  );
});

test("the embedded TEMPLATE value equals the template files", () => {
  assert.deepEqual(plain(loadConnector().TEMPLATE), readTemplate());
});

test("every template row has the width of its header", () => {
  for (const tab of readTemplate().tabs) {
    const width = tab.rows[0].length;
    tab.rows.forEach((row, i) => {
      assert.equal(row.length, width, `${tab.name}.tsv row ${i + 1} has ${row.length} cells`);
    });
  }
});

test("the sample DESIGN.md starts with YAML front matter", () => {
  const design = readTemplate().design;
  assert.match(design, /^---\n[\s\S]+?\n---\n/);
});
