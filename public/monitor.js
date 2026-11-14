/* Owner-installed Watchflowing script.
   Reports JavaScript errors and whether data-watch selectors exist.
   It does not read forms, cookies, storage, or page text. */
(function () {
  var script = document.currentScript;
  if (!script || !script.src) return;
  var key = script.getAttribute("data-site-key");
  if (!key) return;
  var endpoint = new URL("/api/ingest/site", script.src).toString();
  var watch = (script.getAttribute("data-watch") || "")
    .split(",")
    .map(function (item) { return item.trim(); })
    .filter(Boolean)
    .slice(0, 8);
  var sent = 0;

  function send(body) {
    if (sent >= 8) return;
    sent += 1;
    var payload = JSON.stringify(body);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([payload], { type: "text/plain" }));
      return;
    }
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: payload,
      keepalive: true,
      credentials: "omit",
    }).catch(function () {});
  }

  function reportError(message) {
    send({ siteKey: key, kind: "js_error", message: String(message || "error").slice(0, 180) });
  }

  function checkSelectors() {
    watch.forEach(function (selector) {
      var found = false;
      try {
        found = Boolean(document.querySelector(selector));
      } catch (error) {
        return;
      }
      send({
        siteKey: key,
        kind: found ? "element_present" : "element_missing",
        selector: selector.slice(0, 120),
      });
    });
  }

  window.addEventListener("error", function (event) {
    reportError(event && event.message);
  });
  window.addEventListener("unhandledrejection", function (event) {
    var reason = event && event.reason;
    reportError(reason && reason.message ? reason.message : "unhandled rejection");
  });

  if (watch.length === 0) return;
  window.addEventListener("load", checkSelectors);
  if (!window.MutationObserver || !document.documentElement) return;
  var observer = new MutationObserver(function () {
    observer.disconnect();
    checkSelectors();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(function () { observer.disconnect(); }, 4000);
})();
