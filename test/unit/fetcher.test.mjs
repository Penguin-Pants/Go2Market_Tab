import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  ErrorClass,
  checkPayload,
  classifyFetchError,
  classifyResponse,
  fetchContent,
} from "../../extension/src/fetcher.js";

const EXEC_URL = "https://script.google.com/a/macros/acme.com/s/AKfycbx123/exec";
const ECHO_URL = "https://script.googleusercontent.com/macros/echo?user_content_key=abc&lib=x";

function payload(overrides = {}) {
  return {
    format: "go2market-tab.content",
    connectorVersion: 1,
    generatedAt: "2026-09-24T12:00:00.000Z",
    sheets: [{ name: "Config", values: [["key", "value"]] }],
    ...overrides,
  };
}

function fakeResponse({ status = 200, url = ECHO_URL, body = "", type = "application/json" }) {
  return {
    status,
    url,
    redirected: url !== EXEC_URL,
    headers: new Headers({ "content-type": type }),
    text: async () => body,
  };
}

describe("checkPayload", () => {
  test("accepts a valid v1 payload", () => assert.equal(checkPayload(payload()), null));

  test("rejects other JSON", () => {
    assert.equal(checkPayload(null), ErrorClass.NOT_A_CONNECTOR);
    assert.equal(checkPayload([]), ErrorClass.NOT_A_CONNECTOR);
    assert.equal(checkPayload(payload({ format: "other" })), ErrorClass.NOT_A_CONNECTOR);
    assert.equal(checkPayload(payload({ connectorVersion: "1" })), ErrorClass.NOT_A_CONNECTOR);
    assert.equal(checkPayload(payload({ sheets: {} })), ErrorClass.NOT_A_CONNECTOR);
    assert.equal(
      checkPayload(payload({ sheets: [{ name: "A", values: [[1]] }] })),
      ErrorClass.NOT_A_CONNECTOR,
    );
  });

  test("compares the connector version", () => {
    assert.equal(checkPayload(payload({ connectorVersion: 0 })), ErrorClass.CONNECTOR_OUTDATED);
    assert.equal(checkPayload(payload({ connectorVersion: 2 })), ErrorClass.EXTENSION_OUTDATED);
  });
});

describe("classifyResponse", () => {
  const ok = (body) => classifyResponse({ status: 200, finalUrl: ECHO_URL, bodyText: body });

  test("returns the payload for valid JSON", () => {
    const result = ok(JSON.stringify(payload()));
    assert.equal(result.ok, true);
    assert.equal(result.payload.sheets[0].name, "Config");
  });

  test("detects a final URL on Google sign-in", () => {
    const result = classifyResponse({
      status: 200,
      finalUrl: "https://accounts.google.com/v3/signin/identifier?continue=x",
      bodyText: "<html>Sign in</html>",
    });
    assert.equal(result.errorClass, ErrorClass.NOT_SIGNED_IN);
  });

  test("maps HTTP status codes", () => {
    const at = (status) =>
      classifyResponse({ status, finalUrl: EXEC_URL, bodyText: "" }).errorClass;
    assert.equal(at(401), ErrorClass.NO_ACCESS);
    assert.equal(at(403), ErrorClass.NO_ACCESS);
    assert.equal(at(404), ErrorClass.NOT_FOUND);
    assert.equal(at(429), ErrorClass.UNKNOWN);
    assert.equal(at(500), ErrorClass.UNKNOWN);
  });

  test("reads Google access pages as NO_ACCESS", () => {
    assert.equal(ok("<html>You need access</html>").errorClass, ErrorClass.NO_ACCESS);
    assert.equal(
      ok("<html>Sorry, unable to open the file at this time.</html>").errorClass,
      ErrorClass.NO_ACCESS,
    );
  });

  test("reads other HTML as NOT_A_CONNECTOR", () => {
    assert.equal(
      ok("<html>Script function not found: doGet</html>").errorClass,
      ErrorClass.NOT_A_CONNECTOR,
    );
    assert.equal(ok("").errorClass, ErrorClass.NOT_A_CONNECTOR);
  });
});

describe("classifyFetchError", () => {
  test("offline wins", () => {
    assert.equal(classifyFetchError(new TypeError("Failed to fetch"), false), ErrorClass.OFFLINE);
  });

  test("a blocked cross-origin redirect reads as NOT_SIGNED_IN", () => {
    assert.equal(
      classifyFetchError(new TypeError("Failed to fetch"), true),
      ErrorClass.NOT_SIGNED_IN,
    );
  });

  test("a timeout and other errors read as UNKNOWN", () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    assert.equal(classifyFetchError(abort, true), ErrorClass.UNKNOWN);
    assert.equal(classifyFetchError(new RangeError("x"), true), ErrorClass.UNKNOWN);
  });
});

describe("fetchContent", () => {
  const clock = () => {
    let t = 0;
    return () => (t += 25);
  };

  test("returns NOT_CONNECTED without a URL", async () => {
    const result = await fetchContent("", { fetchImpl: () => assert.fail("no fetch") });
    assert.equal(result.errorClass, ErrorClass.NOT_CONNECTED);
  });

  test("sends credentials, follows redirects and skips the HTTP cache", async () => {
    let seen;
    const body = JSON.stringify(payload());
    const result = await fetchContent(EXEC_URL, {
      fetchImpl: async (url, init) => {
        seen = { url, init };
        return fakeResponse({ body });
      },
      now: clock(),
    });
    assert.equal(seen.url, EXEC_URL);
    assert.equal(seen.init.credentials, "include");
    assert.equal(seen.init.redirect, "follow");
    assert.equal(seen.init.cache, "no-store");
    assert.equal(result.ok, true);
    assert.deepEqual(
      { ...result.info, bodyStart: result.info.bodyStart.length },
      {
        status: 200,
        finalUrl: ECHO_URL,
        redirected: true,
        contentType: "application/json",
        bytes: Buffer.byteLength(body),
        ms: 25,
        errorText: "",
        bodyStart: Math.min(600, body.length),
      },
    );
  });

  test("counts bytes in UTF-8", async () => {
    const body = JSON.stringify(payload({ sheets: [{ name: "Config", values: [["é€"]] }] }));
    const result = await fetchContent(EXEC_URL, {
      fetchImpl: async () => fakeResponse({ body }),
    });
    assert.equal(result.info.bytes, Buffer.byteLength(body));
  });

  test("classifies a thrown fetch and keeps the error text", async () => {
    const result = await fetchContent(EXEC_URL, {
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
      isOnline: () => true,
    });
    assert.equal(result.errorClass, ErrorClass.NOT_SIGNED_IN);
    assert.equal(result.info.errorText, "TypeError: Failed to fetch");
  });

  test("aborts after the timeout", async () => {
    const result = await fetchContent(EXEC_URL, {
      timeoutMs: 10,
      fetchImpl: (url, init) =>
        new Promise((resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            const error = new Error("The operation was aborted.");
            error.name = "AbortError";
            reject(error);
          });
        }),
    });
    assert.equal(result.errorClass, ErrorClass.UNKNOWN);
    assert.match(result.info.errorText, /^AbortError/);
  });
});
