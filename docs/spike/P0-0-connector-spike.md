# P0-0 connector spike

**Goal:** prove that the Apps Script connector can send private sheet content to the extension, with no Google Cloud project and no OAuth setup.

**Time:** about 60 minutes.

**Decision rule (stop point S1):**

- T1, T2 (with the `/a/macros/<domain>/` URL form) and T8 must pass.
- If one of them fails, the connector path stops. The fallback is Option B (a central, verified OAuth app). Option B is not built until the maintainer approves it.

---

## What you need

- A Google Workspace account on the company domain (the "work account").
- A personal Google account (for example a Gmail account). Needed for T2 and T5.
- A second work account on the same domain. Needed for T4. A colleague can do T4 on their own computer.
- Chrome 120 or later.
- This repo on your computer (`git clone` or download the ZIP from GitHub).

**Note:** "signed in" in this document means signed in to Google on the web (for example at gmail.com) in the Chrome profile that runs the test. Chrome Sync does not matter.

---

## Part A: Set up the connector (once)

1. Sign in to Google with the work account.
2. Create a new Google Sheet. Name it "Go2Market spike".
3. In the sheet, click **Extensions > Apps Script**.
4. In the Apps Script editor, click **Project Settings** (gear icon). Select **Show "appsscript.json" manifest file in editor**.
5. Click **Editor** (`< >` icon).
6. Open `appsscript.json`. Replace all text with the text of `connector/appsscript.json` from this repo.
7. Open `Code.gs`. Replace all text with the text of `connector/Code.gs` from this repo.
8. Click **Save** (disk icon).
9. Go back to the sheet tab. Reload the page. A **Go2Market** menu shows after a few seconds.
10. Click **Go2Market > Set up template tabs**. Google asks for authorization. Accept it.
    - If Google shows "Google hasn't verified this app", click **Advanced > Go to (project name)**. This is normal for your own script.
11. Click **Go2Market > Check sheet**. The sidebar must show no "Fix" lines.
12. In the Apps Script editor, click **Deploy > New deployment**.
13. Click the gear icon next to **Select type**. Select **Web app**.
14. Set **Execute as** to **Me**.
15. Set **Who has access** to **Anyone within (your domain)**.
16. Click **Deploy**. Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy.../exec`.
17. Make the domain form of the same URL. Insert `a/macros/<your domain>/` in place of `macros/`:
    - Plain form: `https://script.google.com/macros/s/AKfy.../exec`
    - Domain form: `https://script.google.com/a/macros/your-domain.com/s/AKfy.../exec`
18. Keep both URLs in a note. **Do not post them in public places.**

## Part B: Load the dev extension (once per Chrome profile)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**. Select the `extension` folder of this repo.
4. Make sure that the extension ID is `oiceifkieliajphhhfnclagbjaniojgk`. (The development key in `manifest.json` fixes this ID.)
5. Open this address in a new tab:
   `chrome-extension://oiceifkieliajphhhfnclagbjaniojgk/dev/test-connection.html`
6. Keep that tab open for the tests.

## How to run one test

1. Paste the URL into the **Connector web app URL** field.
2. Click **Test connection**.
3. Read the **Classifier result**.
4. Click **Copy** under "Result for the spike table". Paste the text under the test in your notes.
5. If the result is not OK: right-click the page, click **Inspect**, open the **Console** tab and copy the red error lines too. They tell us where a redirect went.

---

## Part C: The tests

### T1: Work account only

- **Setup:** a Chrome profile that is signed in to the work account only.
- **Do:** run the test with the plain URL. Then run it with the domain URL.
- **Expected:** `OK` for both. The payload line lists the template tabs.

### T2: Personal and work accounts, work account not first

- **Setup:** in the same Chrome profile, sign out of all Google accounts. Sign in to the **personal** account first. Then add the **work** account (Google avatar > **Add another account**). The personal account is now the default account.
- **Do:** run the test with the plain URL. Then run it with the domain URL.
- **Expected:** the domain URL gives `OK`. The plain URL can fail (`NO_ACCESS` or `NOT_SIGNED_IN`). Record both.

### T3: Signed out

- **Setup:** sign out of all Google accounts in this Chrome profile.
- **Do:** run the test with the domain URL.
- **Expected:** `NOT_SIGNED_IN`. Also copy the Console error. It must name `accounts.google.com`. This confirms the classifier rule for a blocked redirect.

### T4: Second user in the same domain

- **Setup:** a colleague on the same domain. They do Part B on their own computer and sign in to their work account only. Send them the domain URL in a private message.
- **Do:** they run the test with the domain URL.
- **Expected:** `OK`. They do not need edit access to the sheet.

### T5: User outside the domain

- **Setup:** a Chrome profile that is signed in to the personal account only.
- **Do:** run the test with the domain URL. Then run it with the plain URL.
- **Expected:** `NO_ACCESS` or `NOT_SIGNED_IN`. The response must not contain sheet content. Record the classifier result and the start of the response.

### T6: "Anyone" access, signed out

- **Setup:**
  1. In the Apps Script editor, click **Deploy > Manage deployments**.
  2. Click the pencil icon. Set **Version** to **New version**. Set **Who has access** to **Anyone**. Click **Deploy**. The URL stays the same.
  3. Sign out of all Google accounts in the test Chrome profile.
- **Do:** run the test with the plain URL.
- **Expected:** `OK`.
- **After the test:** set **Who has access** back to **Anyone within (your domain)** and deploy again. Run T1 once more to confirm `OK`.

### T7: URL form from `ScriptApp.getService().getUrl()`

- **Do:** in the sheet, click **Go2Market > Get connect link**.
- **Record:**
  - The dialog text: "ready" (a link), "not deployed" (steps) or "not an /exec URL" (it shows the URL).
  - The URL form: plain `/macros/s/.../exec`, domain `/a/macros/<domain>/s/.../exec` or `/dev`.
  - Any error message. If Google asks for a new permission or says "You do not have permission to call ScriptApp.getService", copy the full message.

### T8: Load

- **Setup:** the same setup as T1 (work account only).
- **Do:**
  1. Paste the domain URL. Click **Load test: 50 parallel**. Wait until it shows 50 of 50. Copy the result.
  2. Wait two minutes (the connector cache lasts 120 seconds).
  3. Click **Load test: 200 in one minute**. Wait about 60 seconds until it shows 200 of 200. Copy the result.
- **Expected (pass):** no failed requests in either run. Record the p50, p90 and max latency.
- **Also record:** the time of the first request (a cold connector is slower).

### T9: `spreadsheets.currentonly` scope in `doGet`

- **Do:** look at the T1 result.
- **Pass:** T1 is `OK`. The web app reads the sheet with the narrow `spreadsheets.currentonly` scope.
- **Fail:** T1 gives `NOT_A_CONNECTOR` and the response start mentions a permission for `SpreadsheetApp`. Then do these steps and run T1 again:
  1. In `appsscript.json`, change `spreadsheets.currentonly` to `spreadsheets`.
  2. Save. Click **Deploy > Manage deployments**, pencil icon, **Version: New version**, **Deploy**. Authorize again.
  3. Write down the exact error text from the first run.

---

## Results table

Copy this table into your reply. Fill one row per run.

| Test | URL form | Classifier result | HTTP status | Final URL host | Time (ms) | Pass? | Notes |
| ---- | -------- | ----------------- | ----------- | -------------- | --------- | ----- | ----- |
| T1   | plain    |                   |             |                |           |       |       |
| T1   | domain   |                   |             |                |           |       |       |
| T2   | plain    |                   |             |                |           |       |       |
| T2   | domain   |                   |             |                |           |       |       |
| T3   | domain   |                   |             |                |           |       |       |
| T4   | domain   |                   |             |                |           |       |       |
| T5   | domain   |                   |             |                |           |       |       |
| T5   | plain    |                   |             |                |           |       |       |
| T6   | plain    |                   |             |                |           |       |       |
| T7   | n/a      | n/a               | n/a         | n/a            | n/a       |       |       |
| T9   | domain   |                   |             |                |           |       |       |

**T8 load results**

| Run               | OK  | Failed | Errors by class | p50 (ms) | p90 (ms) | max (ms) | First request (ms) |
| ----------------- | --- | ------ | --------------- | -------- | -------- | -------- | ------------------ |
| 50 parallel       |     |        |                 |          |          |          |                    |
| 200 in one minute |     |        |                 |          |          |          |                    |

**Environment**

- Chrome version (`chrome://version`):
- Operating system:
- Google Workspace edition (for example Business Starter):
- Does the company restrict third-party cookies or extensions by policy? (yes, no or unknown)

---

## What to send back

1. The filled results table and the T8 table.
2. The copied report text for each run that was not `OK`.
3. The Console error lines for T3 and for each run that was not `OK`.

## Clean up

- Delete the spike deployment when you are done: **Deploy > Manage deployments > Archive**.
- You can keep the sheet. Later milestones use the same template.

## Classifier rules under test

`extension/src/fetcher.js` holds the rules. The spike confirms or changes them.

| Rule                                                                                                   | Class                                        | Confirmed by       |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------- | ------------------ |
| Final URL host is `accounts.google.com`                                                                | `NOT_SIGNED_IN`                              | T3                 |
| `fetch()` throws a `TypeError` while the browser is online (a blocked redirect to sign-in)             | `NOT_SIGNED_IN`                              | T3                 |
| `fetch()` throws while the browser is offline                                                          | `OFFLINE`                                    | (no spike test)    |
| HTTP 401 or 403                                                                                        | `NO_ACCESS`                                  | T5                 |
| HTML that says "You need access", "You need permission", "Request access" or "unable to open the file" | `NO_ACCESS`                                  | T2 (plain URL), T5 |
| HTTP 404                                                                                               | `NOT_FOUND`                                  | (no spike test)    |
| Not JSON, or JSON without `format: "go2market-tab.content"`                                            | `NOT_A_CONNECTOR`                            | T9 (fail case)     |
| `connectorVersion` lower or higher than this extension reads                                           | `CONNECTOR_OUTDATED` or `EXTENSION_OUTDATED` | (unit tests)       |
| Timeout (30 s), HTTP 429, HTTP 5xx                                                                     | `UNKNOWN`                                    | T8                 |

**Known limit:** the extension has no host permission for `accounts.google.com`, so a redirect to sign-in and a network failure (for example a proxy that blocks Google) both throw the same `TypeError`. T3 shows how Chrome reports the redirect. The rules change if T3 shows a better signal.
