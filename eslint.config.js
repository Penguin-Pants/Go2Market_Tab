import js from "@eslint/js";
import globals from "globals";

/* Apps Script services that connector/Code.gs uses. Apps Script has no
   modules, so these are plain globals at run time. */
const appsScriptGlobals = {
  CacheService: "readonly",
  ContentService: "readonly",
  HtmlService: "readonly",
  PropertiesService: "readonly",
  ScriptApp: "readonly",
  SpreadsheetApp: "readonly",
};

export default [
  {
    ignores: ["node_modules/", "dist/", "test-results/", "playwright-report/", "extension/vendor/"],
  },
  js.configs.recommended,
  {
    files: ["extension/**/*.js", "site/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.browser, ...globals.webextensions },
    },
  },
  {
    files: ["connector/**/*.gs"],
    languageOptions: {
      sourceType: "script",
      globals: appsScriptGlobals,
    },
    rules: {
      /* Top-level functions are entry points that Apps Script calls by name
         (doGet, onOpen, menu handlers), so only local unused names count. */
      "no-unused-vars": ["error", { vars: "local" }],
    },
  },
  {
    files: ["**/*.mjs", "*.config.js", "scripts/**/*.js", "test/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
];
