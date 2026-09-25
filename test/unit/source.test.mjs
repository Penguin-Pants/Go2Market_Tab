import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { SOURCE_URL_PATTERN, isSourceUrl, redactSourceUrl } from "../../extension/src/source.js";
import { loadConnector } from "../helpers/connector.mjs";

describe("isSourceUrl", () => {
  test("accepts both web app URL forms", () => {
    assert.equal(isSourceUrl("https://script.google.com/macros/s/AKfycbx_1-2/exec"), true);
    assert.equal(isSourceUrl("https://script.google.com/a/macros/acme.com/s/AKfycbx/exec"), true);
  });

  test("rejects other URLs and other types", () => {
    for (const value of [
      undefined,
      null,
      42,
      "",
      "https://script.google.com/macros/s/AKfycbx/dev",
      "https://script.google.com/macros/s/AKfycbx/exec/",
      "https://script.google.com/macros/s/AKfycbx/exec?a=1",
      "https://docs.google.com/spreadsheets/d/abc/gviz/tq?tqx=out:csv",
      "javascript:alert(1)//https://script.google.com/macros/s/A/exec",
    ]) {
      assert.equal(isSourceUrl(value), false, String(value));
    }
  });

  test("uses the same pattern as the connector", () => {
    assert.equal(SOURCE_URL_PATTERN.source, loadConnector().SOURCE_URL_PATTERN.source);
  });
});

describe("redactSourceUrl", () => {
  test("shortens the deployment id", () => {
    assert.equal(
      redactSourceUrl(
        "https://script.google.com/a/macros/acme.com/s/AKfycbxLongDeploymentId9876/exec",
      ),
      "https://script.google.com/a/macros/acme.com/s/AKfycb...9876/exec",
    );
  });

  test("keeps short ids and other text", () => {
    assert.equal(
      redactSourceUrl("https://script.google.com/macros/s/short/exec"),
      "https://script.google.com/macros/s/short/exec",
    );
    assert.equal(redactSourceUrl(undefined), "");
  });
});
