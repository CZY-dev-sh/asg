/**
 * ASG — Listing details: co-listing contact preference, hero action pills, text-style links.
 *
 * Paste into IDX Broker → Designs → **Footer** (or global custom JS / wrapper where your account
 * allows site-wide scripts). Runs on `#IDX-main.IDX-category-details` only.
 *
 * Behavior:
 * - Reads MLS detail tables for co-listing agent (name + optional phone). If present, updates
 *   the sidebar `#IDX-contactInfo` name (and phone line when found). If absent, sets **Alex Stoykov**
 *   as the displayed contact name. Does not swap headshots unless IDX exposes a URL in-page.
 * - Adds `asg-details-text-action` to "More Information" and "Get Directions" for CSS text links.
 * - Adds `asg-details-pill-action` to "Calculate … Payment" controls if IDX omits pill classes.
 */
(function () {
  var NS = "data-asg-details";
  var DEBOUNCE_MS = 140;
  var timer = null;

  var FALLBACK = {
    name: "Alex Stoykov",
    title: "CEO / Real Estate Broker",
  };

  function norm(s) {
    return String(s || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function cleanValue(s) {
    var v = String(s || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!v || /^n\/a$/i.test(v) || /^none$/i.test(v) || /^--+$/.test(v)) return "";
    return v.split(/\n|;|\|/)[0].trim();
  }

  function parseCoListAgent(scope) {
    var name = "";
    var phone = "";
    var rows = scope.querySelectorAll("tr");

    for (var i = 0; i < rows.length; i++) {
      var tr = rows[i];
      var cells = tr.querySelectorAll("td, th");
      if (cells.length < 2) continue;
      var lab = norm(cells[0].textContent);
      var rawVal = cells[1].textContent || "";
      var val = cleanValue(rawVal);
      if (!lab || !val) continue;

      var hasCo = /\bco[\s\-_]*list(ing)?\b/.test(lab) || lab.indexOf("colist") !== -1;
      if (!hasCo) continue;

      if (/phone|mobile|cell|direct|tel\b/i.test(lab)) {
        phone = val;
        continue;
      }
      if (/email|fax|office|mls|license|state id|nrds/i.test(lab)) continue;

      if (/\bagent\b/.test(lab) || /name/i.test(lab) || lab.replace(/\s/g, "") === "colistingagent") {
        if (/name/i.test(lab) || (/\bagent\b/.test(lab) && !/assistant|transaction|tc\b/i.test(lab))) {
          name = val;
        }
      } else if (
        !name &&
        /\bco[\s\-_]*list(ing)?\b/.test(lab) &&
        /\s/.test(val) &&
        val.length < 80 &&
        !/\b(id|mls|#|number|office|brokerage|firm)\b/i.test(lab) &&
        !/^\d+$/.test(val) &&
        !/\b(llc|inc\.?|corp|realty|properties)\b/i.test(val)
      ) {
        name = val;
      }
    }

    return { name: name, phone: phone };
  }

  function markHeroActionClasses(scope) {
    var sel =
      ".IDX-detailsPage-main a, .IDX-detailsPage-main button, .IDX-detailsPage-main input[type='button'], .IDX-detailsPage-main input[type='submit']";
    var els = scope.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var label = (el.textContent || el.value || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!label) continue;

      if (label === "more information" || label === "get directions") {
        el.classList.add("asg-details-text-action");
        continue;
      }

      if (label.indexOf("calculate") !== -1 && label.indexOf("payment") !== -1) {
        el.classList.add("asg-details-pill-action");
      }
    }
  }

  function applyPreferredContact(scope) {
    var info = scope.querySelector("#IDX-contactInfo");
    if (!info) return;

    var co = parseCoListAgent(scope);
    var useName = co.name && co.name.length > 1 ? co.name : FALLBACK.name;
    var useTitle = co.name && co.name.length > 1 ? "" : FALLBACK.title;

    var nameEl =
      info.querySelector("h1, h2, h3, .IDX-agentName, [class*='agentName'], [class*='AgentName']") ||
      info.children[0];
    if (nameEl && nameEl.textContent !== undefined) {
      nameEl.textContent = useName;
    }

    if (useTitle) {
      for (var k = 1; k < info.children.length; k++) {
        var ch = info.children[k];
        var tx = (ch.textContent || "").trim();
        if (!tx || /^phone\s*:/i.test(tx) || /^mobile\s*:/i.test(tx) || /^email\s*:/i.test(tx)) continue;
        ch.textContent = useTitle;
        break;
      }
    }

    if (co.phone) {
      var walk = info.querySelectorAll("p, div, span, li");
      for (var j = 0; j < walk.length; j++) {
        var node = walk[j];
        var txt = (node.textContent || "").trim();
        if (/^phone\s*:/i.test(txt) || /^mobile\s*:/i.test(txt) || /^direct\s*:/i.test(txt)) {
          var lab = txt.split(":")[0];
          node.textContent = lab + ": " + co.phone;
          break;
        }
      }
    }

    info.setAttribute(NS + "-contact", co.name ? "co" : "fallback");
  }

  function run() {
    var scope = document.querySelector("#IDX-main.IDX-category-details");
    if (!scope) return;
    try {
      markHeroActionClasses(scope);
      applyPreferredContact(scope);
    } catch (e) {
      console.warn("[asg-details-enhancements]", e);
    }
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      run();
    }, DEBOUNCE_MS);
  }

  var mo = new MutationObserver(function () {
    schedule();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule);
  } else {
    schedule();
  }
  window.addEventListener("load", schedule);
})();
