import { describe, test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

import { fakeSpreadsheet, loadConnector, memoryCache, plain } from "../helpers/connector.mjs";

const gs = loadConnector();
const NOW = new Date("2026-09-24T12:00:00.000Z");

function utf8Length(text) {
  return Buffer.byteLength(text, "utf8");
}

describe("trimValues", () => {
  test("removes trailing empty rows and columns", () => {
    const values = [
      ["a", "b", "", ""],
      ["", "c", "", ""],
      ["", "", "", ""],
      ["", "", "", ""],
    ];
    assert.deepEqual(plain(gs.trimValues(values)), [
      ["a", "b"],
      ["", "c"],
    ]);
  });

  test("keeps empty rows and columns inside the data", () => {
    const values = [
      ["a", "", "c"],
      ["", "", ""],
      ["d", "", ""],
    ];
    assert.deepEqual(plain(gs.trimValues(values)), values);
  });

  test("pads ragged rows and turns cells into strings", () => {
    assert.deepEqual(plain(gs.trimValues([["a"], ["b", 2, null]])), [
      ["a", ""],
      ["b", "2"],
    ]);
  });

  test("returns an empty grid for an empty tab", () => {
    assert.deepEqual(plain(gs.trimValues([[""]])), []);
    assert.deepEqual(plain(gs.trimValues([])), []);
    assert.deepEqual(plain(gs.trimValues(undefined)), []);
  });
});

describe("buildPayload", () => {
  test("follows the connector contract v1", () => {
    const payload = plain(
      gs.buildPayload(
        [
          {
            name: "Config",
            values: [
              ["key", "value"],
              ["companyName", "Acme"],
              ["", ""],
            ],
          },
          { name: "_notes", values: [["private"]] },
          { name: "LayoutMap", values: [[""]] },
        ],
        NOW,
      ),
    );
    assert.deepEqual(payload, {
      format: "go2market-tab.content",
      connectorVersion: 1,
      generatedAt: "2026-09-24T12:00:00.000Z",
      sheets: [
        {
          name: "Config",
          values: [
            ["key", "value"],
            ["companyName", "Acme"],
          ],
        },
        { name: "LayoutMap", values: [] },
      ],
    });
  });
});

describe("readSheets", () => {
  test("skips private tabs without reading their cells", () => {
    const spreadsheet = fakeSpreadsheet([
      { name: "Config", values: [["key", "value"]] },
      { name: "_drafts", values: [["secret"]] },
    ]);
    const sheets = plain(gs.readSheets(spreadsheet));
    assert.deepEqual(
      sheets.map((s) => s.name),
      ["Config"],
    );
    assert.deepEqual(spreadsheet.reads, ["Config"]);
  });
});

describe("chunkUtf8", () => {
  test("keeps short text in one chunk", () => {
    assert.deepEqual(plain(gs.chunkUtf8("hello", 10)), ["hello"]);
    assert.deepEqual(plain(gs.chunkUtf8("", 10)), [""]);
  });

  test("splits on the byte limit", () => {
    assert.deepEqual(plain(gs.chunkUtf8("abcdefg", 3)), ["abc", "def", "g"]);
  });

  test("counts multi-byte characters and never splits a code point", () => {
    const text = "aé€😀b😀😀c".repeat(50);
    for (const limit of [4, 5, 6, 7, 11]) {
      const chunks = plain(gs.chunkUtf8(text, limit));
      assert.equal(chunks.join(""), text);
      for (const chunk of chunks) {
        assert.ok(utf8Length(chunk) <= limit, `chunk over ${limit} bytes`);
        assert.ok(!/[\uD800-\uDBFF]$/.test(chunk), "chunk ends inside a surrogate pair");
      }
    }
  });
});

describe("cache", () => {
  test("round-trips a small payload through one chunk", () => {
    const cache = memoryCache();
    assert.equal(gs.writeCachedJson(cache, '{"a":1}', 120), true);
    assert.equal(gs.readCachedJson(cache), '{"a":1}');
  });

  test("chunks a payload larger than one cache value", () => {
    const cache = memoryCache();
    const json = JSON.stringify({ text: "x€".repeat(100 * 1024) });
    assert.equal(gs.writeCachedJson(cache, json, 120), true);
    const chunkValues = [...cache.store.entries()].filter(([key]) => !key.endsWith("index"));
    assert.ok(chunkValues.length > 1);
    for (const [, value] of chunkValues) assert.ok(utf8Length(value) <= 90 * 1024);
    assert.equal(gs.readCachedJson(cache), json);
  });

  test("treats a missing chunk as a miss", () => {
    const cache = memoryCache();
    gs.writeCachedJson(cache, "y".repeat(200 * 1024), 120);
    const firstChunk = [...cache.store.keys()].find((key) => key.endsWith(":0"));
    cache.store.delete(firstChunk);
    assert.equal(gs.readCachedJson(cache), null);
  });

  test("refuses a payload with too many chunks", () => {
    const cache = memoryCache();
    const json = "z".repeat(gs.CACHE_CHUNK_BYTES * gs.CACHE_MAX_CHUNKS + 1);
    assert.equal(gs.writeCachedJson(cache, json, 120), false);
    assert.equal(cache.store.size, 0);
  });

  test("returns false when the cache refuses the write", () => {
    assert.equal(gs.writeCachedJson(memoryCache({ failPut: true }), "{}", 120), false);
  });

  test("returns null for a broken index", () => {
    const cache = memoryCache();
    cache.store.set(gs.CACHE_INDEX_KEY, "not json");
    assert.equal(gs.readCachedJson(cache), null);
  });
});

describe("getContentJson", () => {
  test("reads the sheet once and then serves the cache", () => {
    const spreadsheet = fakeSpreadsheet([{ name: "Config", values: [["key", "value"]] }]);
    const cache = memoryCache();
    const first = gs.getContentJson(spreadsheet, cache, NOW);
    const second = gs.getContentJson(spreadsheet, cache, new Date("2026-09-24T12:01:00Z"));
    assert.equal(second, first);
    assert.deepEqual(spreadsheet.reads, ["Config"]);
    assert.equal(JSON.parse(first).format, "go2market-tab.content");
  });

  test("still answers when the cache fails", () => {
    const spreadsheet = fakeSpreadsheet([{ name: "Config", values: [["key", "value"]] }]);
    const json = gs.getContentJson(spreadsheet, memoryCache({ failPut: true }), NOW);
    assert.equal(JSON.parse(json).sheets[0].name, "Config");
  });

  test("still answers when the payload is too large to cache", () => {
    const big = [["x".repeat(gs.CACHE_CHUNK_BYTES * gs.CACHE_MAX_CHUNKS)]];
    const spreadsheet = fakeSpreadsheet([{ name: "Big", values: big }]);
    const cache = memoryCache();
    const json = gs.getContentJson(spreadsheet, cache, NOW);
    assert.equal(JSON.parse(json).sheets[0].values[0][0].length, big[0][0].length);
    assert.equal(cache.store.size, 0);
  });
});

describe("source URL pattern", () => {
  const valid = [
    "https://script.google.com/macros/s/AKfycbx_abc-123/exec",
    "https://script.google.com/a/macros/acme-robotics.com/s/AKfycbx_abc-123/exec",
    "https://script.google.com/a/macros/eu.acme.co.uk/s/X/exec",
  ];
  const invalid = [
    "",
    "http://script.google.com/macros/s/AKfycbx/exec",
    "https://script.google.com/macros/s/AKfycbx/dev",
    "https://script.google.com/macros/s/AKfycbx/exec?x=1",
    "https://script.google.com/macros/s/AKfycbx/exec#x",
    "https://script.google.com.evil.example/macros/s/AKfycbx/exec",
    "https://evil.example/https://script.google.com/macros/s/AKfycbx/exec",
    "https://script.google.com/a/macros/acme_robotics.com/s/AKfycbx/exec",
    "https://script.google.com/macros/s//exec",
    " https://script.google.com/macros/s/AKfycbx/exec",
  ];
  for (const url of valid) test(`accepts ${url}`, () => assert.equal(gs.isSourceUrl(url), true));
  for (const url of invalid) {
    test(`rejects ${JSON.stringify(url)}`, () => assert.equal(gs.isSourceUrl(url), false));
  }
});

describe("connect link", () => {
  test("builds the connect page link with an encoded source", () => {
    const src = "https://script.google.com/a/macros/acme.com/s/AKfy_1-2/exec";
    const state = plain(gs.connectLinkState(src));
    assert.equal(state.kind, "ready");
    assert.equal(
      state.connectLink,
      "https://penguin-pants.github.io/Go2Market_Tab/connect/#src=" + encodeURIComponent(src),
    );
    assert.equal(decodeURIComponent(new URL(state.connectLink).hash.slice(5)), src);
  });

  test("reports a missing deployment", () => {
    assert.equal(gs.connectLinkState(null).kind, "not-deployed");
    assert.equal(gs.connectLinkState("").kind, "not-deployed");
  });

  test("reports a URL that is not an /exec URL", () => {
    const state = plain(gs.connectLinkState("https://script.google.com/macros/s/ABC/dev"));
    assert.deepEqual(state, {
      kind: "not-exec",
      serviceUrl: "https://script.google.com/macros/s/ABC/dev",
    });
  });

  test("renders escaped HTML with a valid client script", () => {
    for (const state of [
      gs.connectLinkState("https://script.google.com/macros/s/ABC/exec"),
      gs.connectLinkState("https://script.google.com/macros/s/<b>/dev"),
      gs.connectLinkState(""),
    ]) {
      const html = gs.renderConnectLinkHtml(state);
      assert.ok(!html.includes("<b>"));
      const script = html.slice(html.indexOf("<script>") + 8, html.indexOf("</script>"));
      assert.doesNotThrow(() => new vm.Script(script));
    }
  });

  test("the client script uses the same URL pattern", () => {
    const script = gs.connectLinkClientScript();
    assert.ok(script.includes(JSON.stringify(gs.SOURCE_URL_PATTERN.source)));
  });
});

describe("planTemplateTabs", () => {
  test("creates every tab in a new sheet", () => {
    const plan = plain(gs.planTemplateTabs(["Sheet1"]));
    assert.deepEqual(
      plan.create.map((tab) => tab.name),
      [
        "Config",
        "Widgets",
        "LayoutMap",
        "QuickLinks",
        "Positioning",
        "Decks",
        "Links",
        "Recent",
        "People",
        "Design",
      ],
    );
    assert.deepEqual(plan.keep, []);
  });

  test("keeps existing tabs, old tab names and other letter case", () => {
    const plan = plain(gs.planTemplateTabs(["config", "SalesDecks", "DriveLinks", "KeyPeople"]));
    assert.deepEqual(plan.keep, [
      { name: "Config", existingName: "config" },
      { name: "Decks", existingName: "SalesDecks" },
      { name: "Links", existingName: "DriveLinks" },
      { name: "People", existingName: "KeyPeople" },
    ]);
    assert.ok(
      !plan.create.some((tab) => ["Config", "Decks", "Links", "People"].includes(tab.name)),
    );
  });

  test("summary names created and kept tabs", () => {
    const text = gs.setupSummaryText(gs.planTemplateTabs(["Config"]));
    assert.match(text, /Created: Widgets, LayoutMap/);
    assert.match(text, /Kept \(not changed\): Config\./);
  });
});

describe("checkSheetStructure", () => {
  function templateSheets() {
    return [
      ...gs.TEMPLATE.tabs.map((tab) => ({ name: tab.name, values: tab.rows })),
      { name: "Design", values: [[gs.TEMPLATE.design, "", "role", "token"]] },
    ];
  }

  test("the template passes with no warnings or errors", () => {
    const report = plain(gs.checkSheetStructure(templateSheets()));
    const problems = report.filter((item) => item.level === "warn" || item.level === "error");
    assert.deepEqual(problems, []);
  });

  test("reports a missing required column", () => {
    const sheets = templateSheets().map((sheet) =>
      sheet.name === "Links"
        ? {
            name: "Links",
            values: [
              ["title", "category"],
              ["A", "B"],
            ],
          }
        : sheet,
    );
    const report = plain(gs.checkSheetStructure(sheets));
    assert.ok(
      report.some(
        (item) => item.level === "error" && /Links: missing column url/.test(item.message),
      ),
    );
  });

  test("accepts old column and tab names", () => {
    const sheets = templateSheets().map((sheet) =>
      sheet.name === "People"
        ? {
            name: "KeyPeople",
            values: [
              ["Name", "Role", "slackUrl"],
              ["A B", "", ""],
            ],
          }
        : sheet,
    );
    const report = plain(gs.checkSheetStructure(sheets));
    assert.ok(
      report.some(
        (item) => item.level === "ok" && /KeyPeople \(read as People\): 1 rows/.test(item.message),
      ),
    );
  });

  test("counts rows with an empty required cell", () => {
    const sheets = templateSheets().map((sheet) =>
      sheet.name === "Recent"
        ? {
            name: "Recent",
            values: [
              ["title", "url"],
              ["A", ""],
              ["B", "https://x.example/"],
            ],
          }
        : sheet,
    );
    const report = plain(gs.checkSheetStructure(sheets));
    assert.ok(
      report.some(
        (item) => item.level === "warn" && /Recent: 2 rows, 1 skipped/.test(item.message),
      ),
    );
  });

  test("reports missing tabs, a Design cell without front matter and other tabs", () => {
    const report = plain(
      gs.checkSheetStructure([
        { name: "Design", values: [["# Just prose"]] },
        { name: "Pricing", values: [["title"]] },
        { name: "_notes", values: [["x"]] },
      ]),
    );
    assert.ok(
      report.some((item) => item.level === "error" && /Tab Config is missing/.test(item.message)),
    );
    assert.ok(
      report.some((item) => item.level === "warn" && /no YAML front matter/.test(item.message)),
    );
    assert.ok(
      report.some((item) => item.level === "info" && /Tab Pricing is not part/.test(item.message)),
    );
    assert.ok(!report.some((item) => /_notes/.test(item.message)));
  });
});

describe("renderReportHtml", () => {
  test("escapes sheet text", () => {
    const html = gs.renderReportHtml([
      { level: "info", message: 'Tab <img src=x onerror="1"> & co' },
    ]);
    assert.ok(html.includes("Tab &lt;img src=x onerror=&quot;1&quot;&gt; &amp; co"));
    assert.ok(!html.includes("<img"));
  });
});

describe("chooseSpreadsheet", () => {
  const never = () => assert.fail("must not be called");

  test("uses the active sheet and calls no other service", () => {
    const active = { name: "bound" };
    assert.equal(gs.chooseSpreadsheet(active, never, never), active);
  });

  test("opens the stored ID when there is no active sheet", () => {
    const opened = gs.chooseSpreadsheet(
      null,
      () => "sheet-id-1",
      (id) => ({ id }),
    );
    assert.deepEqual(plain(opened), { id: "sheet-id-1" });
  });

  test("names the fix when there is no active sheet and no stored ID", () => {
    assert.throws(() => gs.chooseSpreadsheet(null, () => null, never), /Get connect link once/);
  });
});

describe("rememberSpreadsheetId", () => {
  test("stores the sheet ID in the script properties", () => {
    const context = loadConnector();
    const stored = {};
    context.PropertiesService = {
      getScriptProperties: () => ({ setProperty: (key, value) => (stored[key] = value) }),
    };
    assert.equal(context.rememberSpreadsheetId({ getId: () => "abc" }), true);
    assert.deepEqual(stored, { g2mSpreadsheetId: "abc" });
  });

  test("does not break the menu when the store is refused", () => {
    const context = loadConnector();
    context.PropertiesService = {
      getScriptProperties: () => {
        throw new Error("Authorization is required to perform that action.");
      },
    };
    assert.equal(context.rememberSpreadsheetId({ getId: () => "abc" }), false);
  });
});
