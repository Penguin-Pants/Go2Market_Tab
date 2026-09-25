/* Fetches the connector payload and classifies every failure.

   The classifier rules below are the starting point before the P0-0 spike
   (docs/spike/P0-0-connector-spike.md). Each rule names the spike test
   that confirms it. Update the rules from the spike results. */

export const CONTENT_FORMAT = "go2market-tab.content";

/* Connector versions that this extension can read. */
export const SUPPORTED_CONNECTOR_VERSIONS = { min: 1, max: 1 };

export const ErrorClass = Object.freeze({
  NOT_CONNECTED: "NOT_CONNECTED",
  NOT_SIGNED_IN: "NOT_SIGNED_IN",
  NO_ACCESS: "NO_ACCESS",
  NOT_FOUND: "NOT_FOUND",
  NOT_A_CONNECTOR: "NOT_A_CONNECTOR",
  CONNECTOR_OUTDATED: "CONNECTOR_OUTDATED",
  EXTENSION_OUTDATED: "EXTENSION_OUTDATED",
  OFFLINE: "OFFLINE",
  UNKNOWN: "UNKNOWN",
});

export const FETCH_TIMEOUT_MS = 30000;
/* Diagnostics keep the start of the response body, not all of it. */
const BODY_START_CHARS = 600;

const SIGN_IN_HOSTS = new Set(["accounts.google.com"]);

/* Text on the HTML pages that Google shows instead of the web app output.
   To confirm in spike tests T2 and T5. */
const NO_ACCESS_TEXT = [
  /you need access/i,
  /you need permission/i,
  /request access/i,
  /unable to open the file/i,
];

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/* Checks a parsed payload against the connector contract.
   Returns null when it is valid, or an error class. */
export function checkPayload(payload) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return ErrorClass.NOT_A_CONNECTOR;
  }
  if (payload.format !== CONTENT_FORMAT) return ErrorClass.NOT_A_CONNECTOR;
  const version = payload.connectorVersion;
  if (!Number.isInteger(version)) return ErrorClass.NOT_A_CONNECTOR;
  if (version < SUPPORTED_CONNECTOR_VERSIONS.min) return ErrorClass.CONNECTOR_OUTDATED;
  if (version > SUPPORTED_CONNECTOR_VERSIONS.max) return ErrorClass.EXTENSION_OUTDATED;
  if (!Array.isArray(payload.sheets)) return ErrorClass.NOT_A_CONNECTOR;
  const sheetsOk = payload.sheets.every(
    (sheet) =>
      sheet &&
      typeof sheet.name === "string" &&
      Array.isArray(sheet.values) &&
      sheet.values.every((row) => Array.isArray(row) && row.every((c) => typeof c === "string")),
  );
  return sheetsOk ? null : ErrorClass.NOT_A_CONNECTOR;
}

/* Classifies a completed HTTP response.
   Returns { ok: true, payload } or { ok: false, errorClass }. */
export function classifyResponse({ status, finalUrl, bodyText }) {
  /* A redirect to Google sign-in (T3). Only visible when the browser lets
     the extension read the final response. */
  if (SIGN_IN_HOSTS.has(hostOf(finalUrl))) {
    return { ok: false, errorClass: ErrorClass.NOT_SIGNED_IN };
  }
  if (status === 401 || status === 403) return { ok: false, errorClass: ErrorClass.NO_ACCESS };
  if (status === 404) return { ok: false, errorClass: ErrorClass.NOT_FOUND };
  if (status < 200 || status > 299) return { ok: false, errorClass: ErrorClass.UNKNOWN };

  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    /* Google shows an HTML page when the account has no access (T2, T5). */
    if (NO_ACCESS_TEXT.some((pattern) => pattern.test(bodyText))) {
      return { ok: false, errorClass: ErrorClass.NO_ACCESS };
    }
    return { ok: false, errorClass: ErrorClass.NOT_A_CONNECTOR };
  }
  const problem = checkPayload(payload);
  return problem ? { ok: false, errorClass: problem } : { ok: true, payload };
}

/* Classifies a fetch() that threw before any response.
   Offline: the browser reports no network.
   Otherwise: the request most likely followed a redirect to Google
   sign-in. The extension has no host permission for accounts.google.com,
   so the browser blocks that response and fetch() throws a TypeError.
   To confirm in spike test T3. */
export function classifyFetchError(error, online) {
  if (online === false) return ErrorClass.OFFLINE;
  if (error && error.name === "AbortError") return ErrorClass.UNKNOWN;
  if (error && error.name === "TypeError") return ErrorClass.NOT_SIGNED_IN;
  return ErrorClass.UNKNOWN;
}

function utf8Length(text) {
  return new TextEncoder().encode(text).length;
}

/* Fetches the connector and returns
     { ok: true, payload, info } or { ok: false, errorClass, info }.
   `info` holds technical detail for Diagnostics only:
     { status, finalUrl, redirected, contentType, bytes, ms, errorText, bodyStart }. */
export async function fetchContent(url, options = {}) {
  const {
    fetchImpl = globalThis.fetch.bind(globalThis),
    isOnline = () => globalThis.navigator?.onLine !== false,
    now = () => globalThis.performance.now(),
    timeoutMs = FETCH_TIMEOUT_MS,
  } = options;
  const info = {
    status: 0,
    finalUrl: "",
    redirected: false,
    contentType: "",
    bytes: 0,
    ms: 0,
    errorText: "",
    bodyStart: "",
  };
  if (!url) return { ok: false, errorClass: ErrorClass.NOT_CONNECTED, info };

  const started = now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      credentials: "include",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });
    const bodyText = await response.text();
    info.status = response.status;
    info.finalUrl = response.url || "";
    info.redirected = Boolean(response.redirected);
    info.contentType = response.headers.get("content-type") || "";
    info.bytes = utf8Length(bodyText);
    info.bodyStart = bodyText.slice(0, BODY_START_CHARS);
    info.ms = Math.round(now() - started);
    return {
      ...classifyResponse({ status: response.status, finalUrl: info.finalUrl, bodyText }),
      info,
    };
  } catch (error) {
    info.ms = Math.round(now() - started);
    info.errorText = `${error?.name || "Error"}: ${error?.message || String(error)}`;
    return { ok: false, errorClass: classifyFetchError(error, isOnline()), info };
  } finally {
    clearTimeout(timer);
  }
}
