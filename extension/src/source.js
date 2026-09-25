/* Content source helpers.

   The only accepted source is a deployed Apps Script web app URL (the
   connector). Two URL forms exist:
     https://script.google.com/macros/s/<deployment id>/exec
     https://script.google.com/a/macros/<domain>/s/<deployment id>/exec
   Anything else is refused. */

export const SOURCE_URL_PATTERN =
  /^https:\/\/script\.google\.com\/(a\/macros\/[A-Za-z0-9.-]+\/|macros\/)s\/[A-Za-z0-9_-]+\/exec$/;

export function isSourceUrl(url) {
  return typeof url === "string" && SOURCE_URL_PATTERN.test(url);
}

/* Shortens the deployment id so a URL can go into a shared report without
   giving away the full link. */
export function redactSourceUrl(url) {
  if (typeof url !== "string") return "";
  return url.replace(/\/s\/([A-Za-z0-9_-]+)\/exec$/, (match, id) =>
    id.length > 10 ? `/s/${id.slice(0, 6)}...${id.slice(-4)}/exec` : match,
  );
}
