/**
 * ASG Usage Beacon — drop-in snippet for hub pages
 * ============================================================
 * Posts page-view + click events to the Usage Log Apps Script
 * web app so the Command Center can compute adoption metrics
 * (who logs in, what they click, who's cold, etc.).
 *
 * USAGE
 * ------------------------------------------------------------
 * Include after the rest of your page <script> tags:
 *
 *   <script>
 *     window.ASG_USAGE_LOG_API = "https://script.google.com/macros/s/.../exec";
 *     window.ASG_HUB_PAGE = "agent-hub-sam-abadi";
 *     window.ASG_AGENT_EMAIL = "sam@asg.com"; // optional
 *     window.ASG_AGENT_NAME  = "Sam Abadi";   // optional
 *   </script>
 *   <script src=".../shared/usage-beacon.js"></script>
 *
 * The beacon will:
 *   1. Send a "view" event on page load.
 *   2. Send a "click" event when any element with
 *      [data-track] or .asg-track is clicked. The label is the
 *      element's data-track attribute, aria-label, or text.
 *   3. Tag every event with a stable visitor_id (localStorage)
 *      and a per-tab session_id.
 *
 * Failures are silent — beacons are best-effort instrumentation.
 */
(function(){
  "use strict";

  if (window.__ASG_BEACON_INITIALIZED__) return;
  window.__ASG_BEACON_INITIALIZED__ = true;

  var endpoint = String(window.ASG_USAGE_LOG_API || "").trim();
  if (!endpoint) return; // Nothing to do without an endpoint.

  var page = String(window.ASG_HUB_PAGE || document.title || location.pathname || "unknown").trim();
  var agentEmail = String(window.ASG_AGENT_EMAIL || "").trim().toLowerCase();
  var agentName  = String(window.ASG_AGENT_NAME  || "").trim();

  function getOrCreate(storage, key, generator) {
    try {
      var existing = storage.getItem(key);
      if (existing) return existing;
      var fresh = generator();
      storage.setItem(key, fresh);
      return fresh;
    } catch (err) {
      return generator();
    }
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  var visitorId = getOrCreate(localStorage, "asg.visitor_id", uuid);
  var sessionId = getOrCreate(sessionStorage, "asg.session_id", uuid);

  function send(payload) {
    if (!endpoint) return;
    payload.timestamp = new Date().toISOString();
    payload.page = page;
    payload.url = location.href;
    payload.referrer = document.referrer || "";
    payload.user_agent = navigator.userAgent;
    payload.visitor_id = visitorId;
    payload.session_id = sessionId;
    if (agentEmail) payload.agent_email = agentEmail;
    if (agentName)  payload.agent_name  = agentName;

    var body = JSON.stringify(payload);

    // sendBeacon works during unload; fall back to fetch otherwise.
    try {
      if (navigator.sendBeacon && payload.type !== "view") {
        var blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(endpoint, blob)) return;
      }
    } catch (errBeacon) {}

    try {
      fetch(endpoint, {
        method: "POST",
        mode: "no-cors",
        body: body,
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        keepalive: true
      }).catch(function(){});
    } catch (errFetch) {}
  }

  // Initial page view
  function trackView() {
    send({ type: "view", label: page });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", trackView, { once: true });
  } else {
    trackView();
  }

  // Click delegation — handles both [data-track] and .asg-track
  document.addEventListener("click", function(ev){
    var el = ev.target && ev.target.closest ? ev.target.closest("[data-track], .asg-track, a[href]") : null;
    if (!el) return;
    var label =
      el.getAttribute("data-track") ||
      el.getAttribute("aria-label") ||
      (el.textContent || "").trim().slice(0, 80);
    if (!label) return;

    var meta = {};
    if (el.tagName === "A" && el.href) meta.href = el.href;
    if (el.dataset && el.dataset.kind) meta.kind = el.dataset.kind;

    send({
      type: "click",
      label: label,
      meta: meta
    });
  }, true);

  // Hide-on-blur ping — useful for "session length" estimation
  window.addEventListener("pagehide", function(){
    send({ type: "session_end", label: page });
  });

  // Expose a manual hook for hubs to log custom events:
  //   window.asgTrack("video_play", "Q1 Team Meeting")
  window.asgTrack = function(type, label, meta) {
    send({ type: String(type || "custom"), label: String(label || ""), meta: meta || null });
  };
})();
