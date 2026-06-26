/**
 * ASG — "For rent" chip for listings priced under $20,000.
 * Paste into Squarespace → Settings → Advanced → Code Injection → Footer (once),
 * inside a <script> tag, or upload to Custom Files and reference the URL.
 *
 * Re-scans the DOM (debounced) for IDX showcase widgets, IDX results cards, and #idx-modal.
 */
(function () {
  var THRESHOLD = 20000;
  var NS = "data-asg-rent";
  var debounceTimer = null;

  function parsePriceUSD(text) {
    if (!text) return null;
    var t = String(text).replace(/\s/g, "");
    if (!/\d/.test(t)) return null;
    var m = t.match(/\$?\(?([\d,]+)(?:\.\d+)?\)?/);
    if (!m) return null;
    var n = parseInt(m[1].replace(/,/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }

  function needsChipForAmount(amount) {
    return amount !== null && amount < THRESHOLD;
  }

  function decorateShowcaseCell(cell) {
    var priceEl = cell.querySelector(".IDX-showcasePrice");
    if (!priceEl || !(priceEl.textContent || "").trim()) return;
    if (cell.querySelector(".asg-for-rent-chip")) return;

    var raw = (priceEl.textContent || "").trim();
    var amount = parsePriceUSD(raw);
    cell.setAttribute(NS + "-parsed", amount === null ? "x" : String(amount));

    if (!needsChipForAmount(amount)) {
      if (amount !== null || !/\d/.test(raw)) {
        cell.setAttribute(NS + "-done", "1");
      }
      return;
    }

    var chip = document.createElement("span");
    chip.className = "asg-for-rent-chip";
    chip.setAttribute("aria-label", "For rent");
    chip.textContent = "For rent";

    var statusEl = cell.querySelector(".IDX-showcaseStatus");
    if (statusEl && !cell.querySelector(".asg-showcase-badge-row")) {
      var row = document.createElement("div");
      row.className = "asg-showcase-badge-row";
      statusEl.parentNode.insertBefore(row, statusEl);
      row.appendChild(statusEl);
      row.appendChild(chip);
    } else if (statusEl) {
      statusEl.parentNode.appendChild(chip);
    } else {
      var link = cell.querySelector("a.IDX-showcaseLink");
      if (link) {
        if (getComputedStyle(link).position === "static") {
          link.style.position = "relative";
        }
        var rowOnly = document.createElement("div");
        rowOnly.className = "asg-showcase-badge-row";
        rowOnly.appendChild(chip);
        link.insertAdjacentElement("afterbegin", rowOnly);
      }
    }
    cell.setAttribute(NS + "-done", "1");
  }

  function decorateResultCard(card) {
    var priceEl = card.querySelector(".IDX-resultsPrice, .IDX-listingPrice");
    if (!priceEl || !(priceEl.textContent || "").trim()) return;
    if (card.querySelector(".asg-for-rent-chip")) return;

    var raw = (priceEl.textContent || "").trim();
    var amount = parsePriceUSD(raw);
    card.setAttribute(NS + "-parsed", amount === null ? "x" : String(amount));

    if (!needsChipForAmount(amount)) {
      if (amount !== null || !/\d/.test(raw)) {
        card.setAttribute(NS + "-done", "1");
      }
      return;
    }

    var chip = document.createElement("span");
    chip.className = "asg-for-rent-chip";
    chip.setAttribute("aria-label", "For rent");
    chip.textContent = "For rent";

    var statusEl = card.querySelector(".IDX-resultsStatus, .IDX-listingStatus");
    var photo = card.querySelector("a.IDX-photoLink, .IDX-resultsPhotoLink");

    if (statusEl && !card.querySelector(".asg-showcase-badge-row")) {
      var row = document.createElement("div");
      row.className = "asg-showcase-badge-row";
      statusEl.parentNode.insertBefore(row, statusEl);
      row.appendChild(statusEl);
      row.appendChild(chip);
    } else if (statusEl) {
      statusEl.parentNode.appendChild(chip);
    } else if (photo) {
      if (getComputedStyle(photo).position === "static") {
        photo.style.position = "relative";
      }
      var r = document.createElement("div");
      r.className = "asg-showcase-badge-row";
      r.appendChild(chip);
      photo.insertAdjacentElement("afterbegin", r);
    }
    card.setAttribute(NS + "-done", "1");
  }

  function decorateModal() {
    var modal = document.getElementById("idx-modal");
    if (!modal) return;
    modal.querySelectorAll(".asg-for-rent-chip--modal").forEach(function (n) {
      n.remove();
    });

    var priceEl = document.getElementById("idx-modal-price");
    if (!priceEl || !(priceEl.textContent || "").trim()) return;

    var amount = parsePriceUSD(priceEl.textContent);
    if (!needsChipForAmount(amount)) return;

    var chip = document.createElement("span");
    chip.className = "asg-for-rent-chip asg-for-rent-chip--modal";
    chip.setAttribute("aria-label", "For rent");
    chip.textContent = "For rent";

    var statusEl = document.getElementById("idx-modal-status");
    var body = document.getElementById("idx-modal-body");
    if (statusEl) {
      var par = statusEl.parentElement;
      var row = par && par.classList.contains("asg-modal-badge-row") ? par : null;
      if (!row) {
        row = document.createElement("div");
        row.className = "asg-modal-badge-row";
        statusEl.parentNode.insertBefore(row, statusEl);
        row.appendChild(statusEl);
      }
      row.appendChild(chip);
    } else if (body) {
      body.insertAdjacentElement("afterbegin", chip);
    }
  }

  function runAll() {
    document
      .querySelectorAll(
        '[id^="IDX-showcaseGallery-"] .IDX-showcaseCell, [id^="IDX-showcaseGallery-"] td.IDX-showcaseCell,' +
          "#IDX-similarListings .IDX-showcaseCell, #IDX-detailsSimilar .IDX-showcaseCell"
      )
      .forEach(function (cell) {
        if (cell.getAttribute(NS + "-done") === "1") return;
        decorateShowcaseCell(cell);
      });

    document.querySelectorAll("#IDX-main .IDX-resultsCell, #IDX-main .IDX-listingCard, #IDX-main .IDX-resultCard").forEach(function (card) {
      if (card.getAttribute(NS + "-done") === "1") return;
      decorateResultCard(card);
    });

    decorateModal();
  }

  function schedule() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      debounceTimer = null;
      try {
        runAll();
      } catch (e) {
        console.warn("[asg-for-rent-chip]", e);
      }
    }, 120);
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
