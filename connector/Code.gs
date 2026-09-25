/**
 * Go2Market Tab connector (Apps Script, bound to the content sheet).
 *
 * Deploy it as a web app ("Execute as: Me"). The Go2Market Tab extension
 * reads the web app URL and gets the display values of every tab.
 *
 * Keep this file thin. A company's copy of this script never updates, but
 * the extension updates through the Chrome Web Store. So the connector only
 * reads cells and returns them as text. All parsing, validation, layout and
 * theming logic lives in the extension.
 *
 * Top-level names use `var` and `function` so that Node tests can load this
 * file with the `vm` module and call the plain functions.
 */

var CONNECTOR_FORMAT = "go2market-tab.content";
var CONNECTOR_VERSION = 1;
var CONNECT_PAGE_URL = "https://penguin-pants.github.io/Go2Market_Tab/connect/";

/* The same pattern as the extension. The extension is the authority. */
var SOURCE_URL_PATTERN =
  /^https:\/\/script\.google\.com\/(a\/macros\/[A-Za-z0-9.-]+\/|macros\/)s\/[A-Za-z0-9_-]+\/exec$/;

var CACHE_TTL_SECONDS = 120;
/* CacheService holds at most 100 KB in one value. Keep chunks below that. */
var CACHE_CHUNK_BYTES = 90 * 1024;
/* Larger payloads are returned without the cache. */
var CACHE_MAX_CHUNKS = 20;
var CACHE_KEY_PREFIX = "g2m:v1:";
var CACHE_INDEX_KEY = CACHE_KEY_PREFIX + "index";

/* Script property that holds the ID of the bound sheet. The menu stores it,
   so doGet can open the sheet by ID if the web app has no active sheet. */
var SPREADSHEET_ID_PROPERTY = "g2mSpreadsheetId";

/* Old tab names that the extension also accepts. Used here only to avoid
   duplicate tabs in "Set up template tabs" and to name tabs in "Check sheet". */
var TAB_ALIASES = {
  Decks: ["SalesDecks"],
  Links: ["DriveLinks"],
  People: ["KeyPeople"],
};

/* Basic checks for "Check sheet". The extension does the full validation. */
var REQUIRED_COLUMNS = {
  Config: ["key"],
  Widgets: ["id", "type", "source"],
  QuickLinks: ["label", "url"],
  Positioning: ["title"],
  Decks: ["title"],
  Links: ["title", "url"],
  Recent: ["title", "url"],
  People: ["name"],
};

/* Old column names that the extension also accepts. */
var COLUMN_ALIASES = {
  url: ["driveurl", "slackurl"],
};

/* ------------------------------------------------------------------ */
/* Web app                                                            */
/* ------------------------------------------------------------------ */

function doGet() {
  var spreadsheet = chooseSpreadsheet(
    SpreadsheetApp.getActiveSpreadsheet(),
    function () {
      return PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROPERTY);
    },
    function (id) {
      return SpreadsheetApp.openById(id);
    },
  );
  var json = getContentJson(spreadsheet, CacheService.getScriptCache(), new Date());
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/* A bound web app normally gets its sheet from getActiveSpreadsheet(). Spike
   test T9 checks this with the narrow spreadsheets.currentonly scope. Only
   when there is no active sheet does this read the stored ID and open it.
   That path needs the spreadsheets and script.storage scopes, so it works
   only after the scope change that the spike describes. The normal path
   calls no other service. */
function chooseSpreadsheet(active, readStoredId, openById) {
  if (active) return active;
  var storedId = readStoredId();
  if (storedId) return openById(storedId);
  throw new Error(
    "Go2Market: the web app has no active sheet and no stored sheet ID. " +
      "Open the sheet and click Go2Market > Get connect link once.",
  );
}

/* Called from the menu, where the active sheet is always known. Stores the
   ID for the fallback in chooseSpreadsheet. With the default scopes the
   store can be refused; the menu action must still work, and the doGet
   error above names the fix. Returns true when the ID is stored. */
function rememberSpreadsheetId(spreadsheet) {
  try {
    PropertiesService.getScriptProperties().setProperty(
      SPREADSHEET_ID_PROPERTY,
      spreadsheet.getId(),
    );
    return true;
  } catch {
    return false;
  }
}

/* Returns the payload as JSON text. Uses the script cache when it can. */
function getContentJson(spreadsheet, cache, now) {
  var cached = readCachedJson(cache);
  if (cached !== null) return cached;
  var json = JSON.stringify(buildPayload(readSheets(spreadsheet), now));
  writeCachedJson(cache, json, CACHE_TTL_SECONDS);
  return json;
}

/* Reads every tab except private tabs (name starts with "_"). */
function readSheets(spreadsheet) {
  return spreadsheet
    .getSheets()
    .filter(function (sheet) {
      return !isPrivateTabName(sheet.getName());
    })
    .map(function (sheet) {
      return { name: sheet.getName(), values: sheet.getDataRange().getDisplayValues() };
    });
}

function isPrivateTabName(name) {
  return String(name).charAt(0) === "_";
}

/* The connector contract, version 1. Do not add or reshape fields. */
function buildPayload(sheets, now) {
  return {
    format: CONNECTOR_FORMAT,
    connectorVersion: CONNECTOR_VERSION,
    generatedAt: now.toISOString(),
    sheets: sheets
      .filter(function (sheet) {
        return !isPrivateTabName(sheet.name);
      })
      .map(function (sheet) {
        return { name: String(sheet.name), values: trimValues(sheet.values) };
      }),
  };
}

/* Removes trailing empty rows and trailing empty columns. Every cell becomes
   a string. The result stays rectangular. */
function trimValues(values) {
  var rows = (values || []).map(function (row) {
    return (row || []).map(function (cell) {
      return cell == null ? "" : String(cell);
    });
  });
  var height = rows.length;
  while (height > 0 && !rowHasText(rows[height - 1])) height--;
  rows = rows.slice(0, height);
  var width = 0;
  rows.forEach(function (row) {
    for (var c = row.length - 1; c >= width; c--) {
      if (row[c] !== "") {
        width = c + 1;
        break;
      }
    }
  });
  return rows.map(function (row) {
    var out = row.slice(0, width);
    while (out.length < width) out.push("");
    return out;
  });
}

function rowHasText(row) {
  return row.some(function (cell) {
    return cell !== "";
  });
}

/* ------------------------------------------------------------------ */
/* Cache (chunked)                                                    */
/* ------------------------------------------------------------------ */

/* UTF-8 byte count of one code point. */
function utf8Bytes(codePoint) {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/* Splits text into chunks of at most maxBytes UTF-8 bytes. Never splits a
   code point (surrogate pairs stay together). */
function chunkUtf8(text, maxBytes) {
  var chunks = [];
  var start = 0;
  var bytes = 0;
  var i = 0;
  while (i < text.length) {
    var codePoint = text.codePointAt(i);
    var units = codePoint > 0xffff ? 2 : 1;
    var size = utf8Bytes(codePoint);
    if (bytes + size > maxBytes) {
      chunks.push(text.slice(start, i));
      start = i;
      bytes = 0;
    }
    bytes += size;
    i += units;
  }
  if (start < text.length || chunks.length === 0) chunks.push(text.slice(start));
  return chunks;
}

function chunkKey(id, index) {
  return CACHE_KEY_PREFIX + id + ":" + index;
}

/* Returns the cached JSON text, or null on a miss or any cache problem. */
function readCachedJson(cache) {
  try {
    var index = cache.get(CACHE_INDEX_KEY);
    if (!index) return null;
    var parsed = JSON.parse(index);
    var keys = [];
    for (var i = 0; i < parsed.n; i++) keys.push(chunkKey(parsed.id, i));
    var found = cache.getAll(keys);
    var parts = [];
    for (var k = 0; k < keys.length; k++) {
      if (typeof found[keys[k]] !== "string") return null;
      parts.push(found[keys[k]]);
    }
    return parts.join("");
  } catch {
    return null;
  }
}

/* Stores the JSON text in chunks, then the index. Returns false when the
   payload is too large or the cache refuses it. A cache problem never fails
   the request. */
function writeCachedJson(cache, json, ttlSeconds) {
  var chunks = chunkUtf8(json, CACHE_CHUNK_BYTES);
  if (chunks.length > CACHE_MAX_CHUNKS) return false;
  var id = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  var values = {};
  chunks.forEach(function (chunk, i) {
    values[chunkKey(id, i)] = chunk;
  });
  try {
    cache.putAll(values, ttlSeconds);
    /* The index goes last, so a reader never sees a partial set of chunks. */
    cache.put(CACHE_INDEX_KEY, JSON.stringify({ id: id, n: chunks.length }), ttlSeconds);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Sheet menu                                                         */
/* ------------------------------------------------------------------ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Go2Market")
    .addItem("Set up template tabs", "setupTemplateTabs")
    .addItem("Check sheet", "checkSheet")
    .addItem("Get connect link", "showConnectLink")
    .addToUi();
}

/* Tab names match without case, because Sheets does not allow two tabs whose
   names differ only in case. */
function findTabName(existingNames, name) {
  var candidates = [name].concat(TAB_ALIASES[name] || []).map(function (n) {
    return n.toLowerCase();
  });
  for (var i = 0; i < existingNames.length; i++) {
    if (candidates.indexOf(String(existingNames[i]).toLowerCase()) >= 0) return existingNames[i];
  }
  return null;
}

/* Decides which template tabs to create. Existing tabs are never changed. */
function planTemplateTabs(existingNames) {
  var plan = { create: [], keep: [] };
  TEMPLATE.tabs.forEach(function (tab) {
    var found = findTabName(existingNames, tab.name);
    if (found) plan.keep.push({ name: tab.name, existingName: found });
    else plan.create.push(tab);
  });
  if (findTabName(existingNames, "Design")) {
    plan.keep.push({ name: "Design", existingName: findTabName(existingNames, "Design") });
  } else {
    plan.create.push({ name: "Design", design: TEMPLATE.design });
  }
  return plan;
}

function setupTemplateTabs() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  rememberSpreadsheetId(spreadsheet);
  var existing = spreadsheet.getSheets().map(function (sheet) {
    return sheet.getName();
  });
  var plan = planTemplateTabs(existing);
  plan.create.forEach(function (tab) {
    if (tab.design !== undefined) writeDesignTab(spreadsheet, tab);
    else writeTemplateTab(spreadsheet, tab);
  });
  SpreadsheetApp.getUi().alert(
    "Go2Market",
    setupSummaryText(plan),
    SpreadsheetApp.getUi().ButtonSet.OK,
  );
}

function setupSummaryText(plan) {
  var lines = [];
  if (plan.create.length > 0) {
    lines.push(
      "Created: " +
        plan.create
          .map(function (tab) {
            return tab.name;
          })
          .join(", ") +
        ".",
    );
  } else {
    lines.push("All template tabs are already in this sheet. Nothing changed.");
  }
  if (plan.keep.length > 0) {
    lines.push(
      "Kept (not changed): " +
        plan.keep
          .map(function (tab) {
            return tab.existingName;
          })
          .join(", ") +
        ".",
    );
  }
  lines.push("Next: Go2Market > Check sheet, then Go2Market > Get connect link.");
  return lines.join("\n\n");
}

/* Pads rows to one width, so setValues gets a rectangle. */
function padRows(rows) {
  var width = rows.reduce(function (max, row) {
    return Math.max(max, row.length);
  }, 0);
  return rows.map(function (row) {
    var out = row.slice();
    while (out.length < width) out.push("");
    return out;
  });
}

function writeTemplateTab(spreadsheet, tab) {
  var sheet = spreadsheet.insertSheet(tab.name, spreadsheet.getNumSheets());
  /* Plain text everywhere, so Sheets does not turn "30" into a number or a
     URL into a formula. */
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).setNumberFormat("@");
  var rows = padRows(tab.rows);
  if (rows.length === 0) return;
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  if (tab.header) {
    sheet.getRange(1, 1, 1, rows[0].length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
}

function writeDesignTab(spreadsheet, tab) {
  var sheet = spreadsheet.insertSheet(tab.name, spreadsheet.getNumSheets());
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).setNumberFormat("@");
  sheet
    .getRange("A1")
    .setValue(tab.design)
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)
    .setVerticalAlignment("top");
  sheet
    .getRange("C1:D1")
    .setValues([["role", "token"]])
    .setFontWeight("bold");
}

/* ------------------------------------------------------------------ */
/* Check sheet                                                        */
/* ------------------------------------------------------------------ */

function checkSheet() {
  var report = checkSheetStructure(readSheets(SpreadsheetApp.getActiveSpreadsheet()));
  var output = HtmlService.createHtmlOutput(renderReportHtml(report)).setTitle(
    "Go2Market: Check sheet",
  );
  SpreadsheetApp.getUi().showSidebar(output);
}

function headerIndex(headers, column) {
  var names = [column].concat(COLUMN_ALIASES[column] || []);
  for (var i = 0; i < names.length; i++) {
    var at = headers.indexOf(names[i]);
    if (at >= 0) return at;
  }
  return -1;
}

/* Basic tab and header checks. Returns [{ level, message }] where level is
   "ok", "info", "warn" or "error". */
function checkSheetStructure(sheets) {
  var report = [];
  var names = sheets.map(function (sheet) {
    return sheet.name;
  });
  var known = {};
  var byName = {};
  sheets.forEach(function (sheet) {
    byName[sheet.name] = sheet;
  });

  TEMPLATE.tabs.forEach(function (tab) {
    var found = findTabName(names, tab.name);
    if (!found) {
      report.push({
        level: tab.name === "Config" ? "error" : "warn",
        message: "Tab " + tab.name + " is missing. Run Go2Market > Set up template tabs.",
      });
      return;
    }
    known[found] = true;
    var label = found === tab.name ? tab.name : found + " (read as " + tab.name + ")";
    var values = trimValues(byName[found].values);
    if (!tab.header) {
      report.push({
        level: "ok",
        message:
          label +
          (values.length === 0
            ? ": empty. The page uses the default layout."
            : ": " + values.length + " rows."),
      });
      return;
    }
    if (values.length === 0) {
      report.push({ level: "warn", message: label + ": no header row." });
      return;
    }
    var headers = values[0].map(function (h) {
      return h.trim().toLowerCase();
    });
    var required = REQUIRED_COLUMNS[tab.name] || [];
    var missing = required.filter(function (column) {
      return headerIndex(headers, column) < 0;
    });
    if (missing.length > 0) {
      report.push({
        level: "error",
        message: label + ": missing column " + missing.join(", ") + " in row 1.",
      });
      return;
    }
    var dataRows = values.slice(1).filter(rowHasText);
    var incomplete = dataRows.filter(function (row) {
      return required.some(function (column) {
        return String(row[headerIndex(headers, column)] || "").trim() === "";
      });
    }).length;
    report.push({
      level: incomplete > 0 ? "warn" : "ok",
      message:
        label +
        ": " +
        dataRows.length +
        " rows" +
        (incomplete > 0
          ? ", " + incomplete + " skipped (empty " + required.join(" or ") + ")."
          : "."),
    });
  });

  var design = findTabName(names, "Design");
  if (!design) {
    report.push({
      level: "info",
      message: "Tab Design is missing. The page uses the neutral default theme.",
    });
  } else {
    known[design] = true;
    var a1 = String(((byName[design].values || [])[0] || [])[0] || "").trim();
    if (a1 === "") {
      report.push({
        level: "info",
        message: "Design: cell A1 is empty. The page uses the neutral default theme.",
      });
    } else if (a1.indexOf("---") !== 0) {
      report.push({
        level: "warn",
        message: "Design: cell A1 has no YAML front matter (a first line of ---). No tokens apply.",
      });
    } else {
      report.push({ level: "ok", message: "Design: DESIGN.md found in cell A1." });
    }
  }

  names.forEach(function (name) {
    if (known[name] || isPrivateTabName(name)) return;
    report.push({
      level: "info",
      message:
        "Tab " +
        name +
        " is not part of the template. A Widgets row can use it as a source. Start the name with _ to keep it private.",
    });
  });
  return report;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

var REPORT_LABELS = { ok: "OK", info: "Note", warn: "Check", error: "Fix" };

function renderReportHtml(report) {
  var items = report
    .map(function (item) {
      return (
        '<li class="' +
        escapeHtml(item.level) +
        '"><strong>' +
        escapeHtml(REPORT_LABELS[item.level] || item.level) +
        "</strong> " +
        escapeHtml(item.message) +
        "</li>"
      );
    })
    .join("");
  return (
    "<!doctype html><html><head><style>" +
    "body{font:13px/1.45 system-ui,sans-serif;margin:12px;color:#1b1f24}" +
    "ul{list-style:none;padding:0;margin:0}li{padding:6px 0;border-bottom:1px solid #e3e6ea}" +
    "strong{display:inline-block;min-width:44px}.error strong{color:#c4312b}" +
    ".warn strong{color:#9a6700}.ok strong{color:#1a7f37}.info strong{color:#57606a}" +
    "</style></head><body><ul>" +
    items +
    "</ul><p>The Go2Market Tab Preview page shows the full check.</p></body></html>"
  );
}

/* ------------------------------------------------------------------ */
/* Connect link                                                       */
/* ------------------------------------------------------------------ */

function isSourceUrl(url) {
  return SOURCE_URL_PATTERN.test(String(url || ""));
}

function buildConnectLink(sourceUrl) {
  return CONNECT_PAGE_URL + "#src=" + encodeURIComponent(sourceUrl);
}

/* "ready": a valid /exec URL. "not-exec": a URL of another form (for example
   the /dev test URL). "not-deployed": no web app yet. */
function connectLinkState(serviceUrl) {
  var url = String(serviceUrl || "").trim();
  if (url === "") return { kind: "not-deployed" };
  if (isSourceUrl(url))
    return { kind: "ready", sourceUrl: url, connectLink: buildConnectLink(url) };
  return { kind: "not-exec", serviceUrl: url };
}

function showConnectLink() {
  rememberSpreadsheetId(SpreadsheetApp.getActiveSpreadsheet());
  var state = connectLinkState(ScriptApp.getService().getUrl());
  var output = HtmlService.createHtmlOutput(renderConnectLinkHtml(state))
    .setWidth(600)
    .setHeight(520);
  SpreadsheetApp.getUi().showModalDialog(output, "Go2Market connect link");
}

var DEPLOY_STEPS = [
  "In the Apps Script editor (Extensions > Apps Script), click Deploy > New deployment.",
  "Click the gear icon next to Select type. Select Web app.",
  "Set Execute as to Me.",
  "Set Who has access to Anyone within your company. (No Google Workspace? Select Anyone.)",
  "Click Deploy. Authorize the script if Google asks.",
  "Copy the Web app URL. It ends with /exec. Paste it below.",
];

function renderConnectLinkHtml(state) {
  var body;
  if (state.kind === "ready") {
    body =
      "<p>Send this link to your team by email, chat or intranet. A person opens it in Chrome with Go2Market Tab installed. The tab then shows the content of this sheet.</p>" +
      '<textarea id="link" readonly rows="4">' +
      escapeHtml(state.connectLink) +
      "</textarea>" +
      '<p><button id="copy">Copy link</button> <span id="status"></span></p>' +
      '<p class="note">Web app URL: ' +
      escapeHtml(state.sourceUrl) +
      "</p>";
  } else {
    var intro =
      state.kind === "not-exec"
        ? "<p>The script reports this URL: <code>" +
          escapeHtml(state.serviceUrl) +
          "</code>. It is not a deployed web app URL (it must end with /exec). Do these steps:</p>"
        : "<p>The connector is not deployed as a web app yet. Do these steps:</p>";
    body =
      intro +
      "<ol>" +
      DEPLOY_STEPS.map(function (step) {
        return "<li>" + escapeHtml(step) + "</li>";
      }).join("") +
      "</ol>" +
      '<p><label for="url">Web app URL</label><br><input id="url" type="url" placeholder="https://script.google.com/.../exec"></p>' +
      '<p><button id="make">Make connect link</button> <span id="status"></span></p>' +
      '<textarea id="link" readonly rows="4" hidden></textarea>' +
      '<p><button id="copy" hidden>Copy link</button></p>';
  }
  return (
    "<!doctype html><html><head><style>" +
    "body{font:13px/1.5 system-ui,sans-serif;margin:16px;color:#1b1f24}" +
    "textarea,input{width:100%;box-sizing:border-box;font:12px/1.4 ui-monospace,monospace;padding:6px}" +
    "button{font:inherit;padding:6px 12px;cursor:pointer}.note{color:#57606a;word-break:break-all}" +
    "code{word-break:break-all}" +
    "</style></head><body>" +
    body +
    "<script>" +
    connectLinkClientScript() +
    "</script></body></html>"
  );
}

/* Runs inside the dialog. It uses the same URL pattern and page URL. */
function connectLinkClientScript() {
  return (
    "(function(){" +
    "var pattern=new RegExp(" +
    JSON.stringify(SOURCE_URL_PATTERN.source) +
    ");" +
    "var page=" +
    JSON.stringify(CONNECT_PAGE_URL) +
    ";" +
    "var link=document.getElementById('link');var status=document.getElementById('status');" +
    "var copy=document.getElementById('copy');var make=document.getElementById('make');" +
    "function copyLink(){link.hidden=false;link.focus();link.select();" +
    "var done=function(){status.textContent='Copied.';};" +
    "var manual=function(){status.textContent='Press Ctrl+C (Cmd+C on Mac) to copy.';};" +
    "if(navigator.clipboard){navigator.clipboard.writeText(link.value).then(done,function(){" +
    "try{document.execCommand('copy')?done():manual();}catch(e){manual();}});}" +
    "else{try{document.execCommand('copy')?done():manual();}catch(e){manual();}}}" +
    "copy.addEventListener('click',copyLink);" +
    "if(make){make.addEventListener('click',function(){" +
    "var url=document.getElementById('url').value.trim();" +
    "if(!pattern.test(url)){status.textContent='This is not a web app URL. It must start with https://script.google.com/ and end with /exec.';return;}" +
    "link.value=page+'#src='+encodeURIComponent(url);link.hidden=false;copy.hidden=false;" +
    "status.textContent='Link ready.';});}" +
    "})();"
  );
}

/* ------------------------------------------------------------------ */
/* Template data                                                      */
/* ------------------------------------------------------------------ */

// BEGIN GENERATED TEMPLATE (node scripts/sync-template.mjs). Do not edit by hand.
// prettier-ignore
var TEMPLATE = {
  tabs: [
    { name: "Config", header: true, rows: [
      ["key","value"],
      ["companyName","Acme Robotics"],
      ["headline","Sell outcomes, not robots."],
      ["homeUrl","https://www.example.com/"],
      ["logoLightUrl",""],
      ["logoDarkUrl",""],
      ["backgroundUrl",""],
      ["fontCssUrl",""],
      ["refreshMinutes","30"],
      ["schemaVersion","1"],
    ] },
    { name: "Widgets", header: true, rows: [
      ["id","type","source","category","title","moreLink","density","hidden"],
      ["positioning","cards","Positioning","","Positioning and messaging","","",""],
      ["decks","tiles","Decks","","Sales decks","https://www.example.com/acme/decks","",""],
      ["links","links","Links","","Drive links","","",""],
      ["recent","list","Recent","","Recently updated","","",""],
      ["people","people","People","","Key people","","",""],
      ["case-studies","links","Links","Case studies","Case studies","","",""],
    ] },
    { name: "LayoutMap", header: false, rows: [
      ["positioning","positioning","decks","recent"],
      ["positioning","positioning","people","recent"],
      ["links","links","case-studies","case-studies"],
    ] },
    { name: "QuickLinks", header: true, rows: [
      ["label","url","icon"],
      ["Mail","https://mail.google.com/","✉️"],
      ["Calendar","https://calendar.google.com/","📅"],
      ["Drive","https://drive.google.com/","📁"],
      ["CRM","https://www.example.com/acme/crm","📈"],
      ["Brand portal","https://www.example.com/acme/brand","🎨"],
    ] },
    { name: "Positioning", header: true, rows: [
      ["title","summary","body","url","copyText"],
      ["Elevator pitch","One line for cold outreach","Acme Robotics helps warehouses ship orders faster with autonomous picking robots that work next to people.","https://www.example.com/acme/messaging/elevator-pitch",""],
      ["Value pillars","Three reasons customers buy","1. Faster picking. 2. Fewer errors. 3. No new building needed.","https://www.example.com/acme/messaging/pillars","Acme Robotics customers pick orders 2x faster, cut picking errors by 60% and deploy in their existing warehouse."],
      ["Boilerplate","Standard company paragraph for press and partners","Acme Robotics builds autonomous mobile robots for order picking. Founded in 2019, Acme serves retailers and third-party logistics providers in North America and Europe.","",""],
      ["Competitive one-liner","Use when a prospect names a competitor","Acme deploys in weeks with no fixed infrastructure, so customers keep their current racks and layout.","https://www.example.com/acme/messaging/competitive",""],
    ] },
    { name: "Decks", header: true, rows: [
      ["title","description","url","thumbnailUrl"],
      ["Corporate pitch deck","Current primary deck for first meetings","https://www.example.com/acme/decks/corporate-pitch",""],
      ["ROI calculator walkthrough","Use in the business case stage","https://www.example.com/acme/decks/roi-walkthrough",""],
      ["Security and compliance","For IT and procurement reviews","https://www.example.com/acme/decks/security",""],
    ] },
    { name: "Links", header: true, rows: [
      ["title","url","category","description"],
      ["One-pager library","https://www.example.com/acme/drive/one-pagers","Collateral","PDFs and one-pager templates"],
      ["Logo and brand kit","https://www.example.com/acme/drive/brand-kit","Collateral","Approved logos and colors"],
      ["Grocer case study","https://www.example.com/acme/drive/case-grocer","Case studies","Regional grocer, 2x picking speed"],
      ["Fashion 3PL case study","https://www.example.com/acme/drive/case-3pl","Case studies","Peak season without temp staff"],
      ["Onboarding playbook","https://www.example.com/acme/drive/onboarding","Enablement","Day-one reading for new sellers"],
      ["Objection handling guide","https://www.example.com/acme/drive/objections","Enablement","Answers to the top ten objections"],
    ] },
    { name: "Recent", header: true, rows: [
      ["title","url","context"],
      ["Corporate pitch deck v4","https://www.example.com/acme/decks/corporate-pitch","Updated this week"],
      ["Grocer case study","https://www.example.com/acme/drive/case-grocer","New"],
      ["Pricing FAQ","https://www.example.com/acme/drive/pricing-faq","Updated last week"],
    ] },
    { name: "People", header: true, rows: [
      ["name","role","url"],
      ["Alex Rivera","Product marketing: decks and messaging","mailto:alex.rivera@example.com"],
      ["Sam Okafor","Sales enablement: playbooks and onboarding","mailto:sam.okafor@example.com"],
      ["Jordan Lee","Solutions engineering: demos and security reviews","https://teams.microsoft.com/l/chat/0/0?users=jordan.lee@example.com"],
    ] },
  ],
  design: "---\nversion: alpha\nname: Go2Market Neutral\ndescription: Neutral sample theme for Go2Market Tab. Replace it with your company DESIGN.md.\ncolors:\n  background: \"#F6F7F9\"\n  surface: \"#FFFFFF\"\n  text: \"#1B1F24\"\n  text-muted: \"#57606A\"\n  primary: \"#2F5BD3\"\n  on-primary: \"#FFFFFF\"\n  border: \"#D8DDE3\"\n  secondary: \"#0E7C66\"\n  tertiary: \"#8A4FBF\"\n  error: \"#C4312B\"\n  warning: \"#9A6700\"\n  success: \"#1A7F37\"\n  background-dark: \"#16191D\"\n  surface-dark: \"#1F2328\"\n  text-dark: \"#E8EBEF\"\n  text-muted-dark: \"#9EA7B3\"\n  primary-dark: \"#7FA2FF\"\n  on-primary-dark: \"#0B1A3A\"\n  border-dark: \"#343A42\"\n  secondary-dark: \"#4CC3A5\"\n  tertiary-dark: \"#C39BEA\"\ntypography:\n  headline-md:\n    fontFamily: system-ui\n    fontSize: 20px\n    fontWeight: 500\n    lineHeight: 1.3\n  title-sm:\n    fontFamily: system-ui\n    fontSize: 16px\n    fontWeight: 600\n    lineHeight: 1.4\n  body-md:\n    fontFamily: system-ui\n    fontSize: 14px\n    fontWeight: 400\n    lineHeight: 1.5\n  label-sm:\n    fontFamily: system-ui\n    fontSize: 12px\n    fontWeight: 500\n    lineHeight: 1.3\n    letterSpacing: 0.06em\nrounded:\n  sm: 4px\n  md: 8px\n  lg: 12px\n  full: 9999px\nspacing:\n  xs: 4px\n  sm: 8px\n  md: 16px\n  lg: 24px\n  xl: 48px\ncomponents:\n  panel:\n    backgroundColor: \"{colors.surface}\"\n    rounded: \"{rounded.lg}\"\n    padding: \"{spacing.lg}\"\n  panel-title:\n    typography: \"{typography.label-sm}\"\n    textColor: \"{colors.text-muted}\"\n  card:\n    backgroundColor: \"{colors.background}\"\n    rounded: \"{rounded.md}\"\n  chip:\n    rounded: \"{rounded.full}\"\n  button:\n    backgroundColor: \"{colors.primary}\"\n    textColor: \"{colors.on-primary}\"\n    rounded: \"{rounded.sm}\"\n---\n\n# Go2Market Neutral\n\n## Overview\n\nA calm, neutral theme. It keeps the focus on the content. It uses the system font, so it makes no font requests.\n\n## Colors\n\n- **Background (#F6F7F9):** the page color.\n- **Surface (#FFFFFF):** panels.\n- **Text (#1B1F24) and Text muted (#57606A):** body text and metadata.\n- **Primary (#2F5BD3):** links, focus rings and the copy button.\n- **Dark tokens:** each color with the `-dark` suffix is the dark mode value.\n\n## Typography\n\nSystem font for all text. Titles use weight 600. Labels use small caps spacing.\n\n## Shapes\n\nSmall radius on chips and buttons, medium on cards, large on panels.\n",
};
// END GENERATED TEMPLATE
