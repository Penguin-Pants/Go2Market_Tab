/* Test connection view for the P0-0 spike. Developer tool only: it is not
   in the store build, so its strings are not in _locales. */

import { fetchContent } from "../src/fetcher.js";
import { isSourceUrl, redactSourceUrl } from "../src/source.js";
import { summarizeLoad } from "./load-stats.js";

const URL_KEY = "g2mDevTestUrl";

const HINTS = {
  NOT_CONNECTED: "No URL.",
  NOT_SIGNED_IN: "Sign in to the work Google account in this Chrome profile.",
  NO_ACCESS: "The signed-in account has no access to the web app.",
  NOT_FOUND: "The web app URL does not exist. Check the deployment.",
  NOT_A_CONNECTOR: "The URL answered, but not with Go2Market connector JSON.",
  CONNECTOR_OUTDATED: "The connector is older than this extension supports.",
  EXTENSION_OUTDATED: "The connector is newer than this extension supports.",
  OFFLINE: "The browser is offline.",
  UNKNOWN: "Unknown problem. See the error text.",
};

const $ = (id) => document.getElementById(id);

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child != null) node.append(child);
  }
  return node;
}

function setRows(tbody, rows) {
  tbody.replaceChildren(
    ...rows.map(([label, value, cls]) =>
      el("tr", {}, [
        el("th", { scope: "row", text: label }),
        el("td", { class: cls, text: value }),
      ]),
    ),
  );
}

/* Origin and path only. The query of a googleusercontent URL is a user key. */
function stripQuery(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url || "";
  }
}

function payloadSummary(payload) {
  if (!payload) return "";
  const tabs = payload.sheets.map((s) => `${s.name} (${s.values.length})`).join(", ");
  return `connectorVersion ${payload.connectorVersion}, generatedAt ${payload.generatedAt}, tabs: ${tabs}`;
}

function setBusy(busy) {
  for (const button of document.querySelectorAll("button")) button.disabled = busy;
}

function readUrl() {
  const url = $("url").value.trim();
  const error = $("url-error");
  if (!isSourceUrl(url)) {
    error.textContent =
      "This is not a connector URL. It must be https://script.google.com/macros/s/.../exec or https://script.google.com/a/macros/<domain>/s/.../exec.";
    error.hidden = false;
    return null;
  }
  error.hidden = true;
  try {
    localStorage.setItem(URL_KEY, url);
  } catch {
    /* Storage is a convenience here. */
  }
  return url;
}

function showReport(text) {
  $("report-text").value = text;
  $("copy-status").textContent = "";
  $("report").hidden = false;
}

async function testOnce(event) {
  event.preventDefault();
  const url = readUrl();
  if (!url) return;
  setBusy(true);
  const result = await fetchContent(url);
  setBusy(false);
  const { info } = result;
  const rows = [
    ["Classifier result", result.ok ? "OK" : result.errorClass, result.ok ? "ok" : "bad"],
    ["Meaning", result.ok ? "Connector answered with valid content." : HINTS[result.errorClass]],
    ["HTTP status", info.status ? String(info.status) : "(no response)"],
    ["Final URL", stripQuery(info.finalUrl)],
    ["Redirected", info.redirected ? "yes" : "no"],
    ["Content type", info.contentType],
    ["Bytes", String(info.bytes)],
    ["Time", `${info.ms} ms`],
    ["Error text", info.errorText],
    ["Online (navigator.onLine)", String(navigator.onLine)],
    ["Payload", payloadSummary(result.payload)],
  ];
  setRows($("result-rows"), rows);
  $("body-preview").textContent = info.bodyStart || "(empty)";
  $("result").hidden = false;
  showReport(
    [
      `URL: ${redactSourceUrl(url)}`,
      ...rows
        .filter(([label]) => label !== "Meaning")
        .map(([label, value]) => `${label}: ${value}`),
      `Chrome: ${navigator.userAgent}`,
      `Time of test: ${new Date().toISOString()}`,
    ].join("\n"),
  );
}

function renderLoad(title, results, done, total) {
  $("load").hidden = false;
  $("load-progress").textContent = `${title}: ${done} of ${total} requests done.`;
  const s = summarizeLoad(results);
  const errors = Object.entries(s.errors)
    .map(([key, count]) => `${key}: ${count}`)
    .join(", ");
  const rows = [
    ["Test", title],
    ["Requests done", `${s.total} of ${total}`],
    ["OK", String(s.ok), s.failed === 0 ? "ok" : null],
    ["Failed", String(s.failed), s.failed > 0 ? "bad" : null],
    ["Errors by class", errors || "none"],
    [
      "Latency min / p50 / p90 / p99 / max",
      `${s.minMs} / ${s.p50Ms} / ${s.p90Ms} / ${s.p99Ms} / ${s.maxMs} ms`,
    ],
  ];
  setRows($("load-rows"), rows);
  return rows;
}

async function runLoad(title, total, spacingMs) {
  const url = readUrl();
  if (!url) return;
  setBusy(true);
  const results = [];
  const started = Date.now();
  const jobs = [];
  for (let i = 0; i < total; i++) {
    const delay = i * spacingMs;
    jobs.push(
      new Promise((resolve) => setTimeout(resolve, delay))
        .then(() => fetchContent(url))
        .then((r) => {
          results.push({
            ok: r.ok,
            errorClass: r.errorClass,
            status: r.info.status,
            ms: r.info.ms,
          });
          renderLoad(title, results, results.length, total);
        }),
    );
  }
  await Promise.all(jobs);
  setBusy(false);
  const rows = renderLoad(title, results, results.length, total);
  showReport(
    [
      `URL: ${redactSourceUrl(url)}`,
      ...rows.map(([label, value]) => `${label}: ${value}`),
      `Wall time: ${Date.now() - started} ms`,
      `Time of test: ${new Date().toISOString()}`,
    ].join("\n"),
  );
}

async function copyReport() {
  const text = $("report-text").value;
  try {
    await navigator.clipboard.writeText(text);
    $("copy-status").textContent = "Copied.";
  } catch {
    $("report-text").select();
    $("copy-status").textContent = "Copy failed. Press Ctrl+C (Cmd+C on Mac).";
  }
}

try {
  $("url").value = localStorage.getItem(URL_KEY) || "";
} catch {
  /* Storage is a convenience here. */
}
$("form").addEventListener("submit", testOnce);
$("load-parallel").addEventListener("click", () => runLoad("50 parallel", 50, 0));
$("load-minute").addEventListener("click", () => runLoad("200 in one minute", 200, 300));
$("copy-report").addEventListener("click", copyReport);
