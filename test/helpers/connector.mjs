/* Loads connector/Code.gs into a fresh vm context. Apps Script has no
   modules, so the file's top-level `var` and `function` names become
   properties of the context. Apps Script services are not defined here:
   the tests call only the plain functions. */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

export const CODE_GS_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "connector",
  "Code.gs",
);

export function loadConnector() {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(CODE_GS_PATH, "utf8"), context, { filename: "Code.gs" });
  return context;
}

/* Values from the vm context have other realm prototypes. JSON round trip
   makes them comparable with deepStrictEqual. */
export function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

/* In-memory stand-in for CacheService.getScriptCache(). */
export function memoryCache({ failPut = false } = {}) {
  const store = new Map();
  return {
    store,
    get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    getAll(keys) {
      const out = {};
      for (const key of keys) if (store.has(key)) out[key] = store.get(key);
      return out;
    },
    put(key, value) {
      if (failPut) throw new Error("put refused");
      store.set(key, value);
    },
    putAll(values) {
      if (failPut) throw new Error("putAll refused");
      for (const [key, value] of Object.entries(values)) store.set(key, value);
    },
  };
}

/* Minimal stand-in for a Spreadsheet: getSheets() with getName() and
   getDataRange().getDisplayValues(). Counts value reads. */
export function fakeSpreadsheet(sheets) {
  const reads = [];
  return {
    reads,
    getSheets() {
      return sheets.map((sheet) => ({
        getName: () => sheet.name,
        getDataRange: () => ({
          getDisplayValues: () => {
            reads.push(sheet.name);
            return sheet.values;
          },
        }),
      }));
    },
  };
}
