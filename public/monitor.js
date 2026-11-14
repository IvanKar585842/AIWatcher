/* Owner-installed Watchflowing script.
   Sends the public page text after removing forms, then reports errors and named pieces.
   It does not read cookies, storage, form values, or who visited. */
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
  var reportedPage = false;

  function post(body) {
    var payload = JSON.stringify(body);
    if (navigator.sendBeacon && payload.length < 60000) {
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

  function send(body) {
    if (sent >= 8) return;
    sent += 1;
    post(body);
  }

  function publicText() {
    var root = document.querySelector("main") || document.body;
    if (!root) return "";
    var clone = root.cloneNode(true);
    var nodes = clone.querySelectorAll("script,style,noscript,iframe,svg,form,input,textarea,select,option,[contenteditable]");
    var index = nodes.length;
    while (index--) {
      if (nodes[index].parentNode) nodes[index].parentNode.removeChild(nodes[index]);
    }
    return String(clone.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
      .slice(0, 50000);
  }

  function reportPage() {
    if (reportedPage) return;
    var text = publicText();
    if (text.length < 20) return;
    reportedPage = true;
    post({ siteKey: key, kind: "page", text: text });
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

  window.addEventListener("load", function () {
    reportPage();
    checkSelectors();
  });
})();
