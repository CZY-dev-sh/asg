/* AUTO-GENERATED from admin-master-dashboard — listing sell detail */
(function(){

/* constants */
            '<label class="amd-lh-edit-chip is-type" title="Listing type">' +
              '<select data-sell-edit-field="type" data-sell-edit-address="' + esc(addr) + '" aria-label="Listing type">' +
                buildOptionList(LISTING_TYPE_OPTIONS, typeValue, formatListingTypeDisplay) +
                typePlaceholder +
              "</select>" +
            "</label>" +
          "</div>" +
        "</div>"
      );
    }

    function listingDetailPageUrl(addr) {
      var a = String(addr || "").trim();
      if (!a) return "#";
      var sep = LISTINGS_API.indexOf("?") >= 0 ? "&" : "?";
      return LISTINGS_API + sep + "view=detailpage&address=" + encodeURIComponent(a);
    }

    function normalizeListingAgent(row) {
      return String((row && (row.agentCanonical || row.agent)) || "").trim();
    }
    function normalizeText(v) {
      return String(v || "").toLowerCase().trim();
    }
    function listingIsClosed(row) {
      if (!row) return false;
      if (row.archived === true || String(row.archived).toLowerCase() === "true") return true;
      var key = normalizeText(row.phaseKey || row.status || row.phase || "");
      return key.indexOf("closed") > -1;
    }
    function resolveCompassListingLink(row) {
      if (!row) return "";
      return String(
        row.compassLink ||
          row.compass_link ||
          row.compassUrl ||
          row.compass_url ||
          row.listingUrl ||
          row.listing_url ||
          ""
      ).trim();
    }
    function isListingLiveForCompass(row) {
      var key = normalizeText((row && (row.status || row.phaseKey || row.phase)) || "");
      return key.indexOf("live") >= 0;
    }
    function formatNextOpenHouseLabel(row) {
      if (!row) return "";
      var d = String(row.nextOpenHouseDate || row.next_open_house_date || "").trim();
      if (!d) return "";
      var start = String(row.nextOpenHouseStart || row.next_open_house_start || "").trim();
      var end = String(row.nextOpenHouseEnd || row.next_open_house_end || "").trim();
      var time = start && end ? start + " – " + end : start || end;
      return time ? d + " · " + time : d;
    }
    function formatListPriceLabel(raw) {
      var s = String(raw || "").replace(/[^0-9.]/g, "");
      if (!s) return "";
      var n = Number(s);
      if (!n || isNaN(n)) return String(raw || "").trim();
      try {
        return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
      } catch (_fmt) {
        return "$" + String(Math.round(n));
      }
    }
    function propertyDetailMissingHtml(note) {
      return '<span class="is-muted">' + esc(note || "Not provided") + "</span>";
    }
    function propertyDetailItem(label, valueHtml) {
      return (
        '<div class="amd-lh-property-item">' +
          '<div class="amd-lh-property-k">' + esc(label) + "</div>" +
          '<div class="amd-lh-property-v">' + valueHtml + "</div>" +
        "</div>"
      );
    }
    function formatListingLongDate(raw) {
      var s = String(raw || "").trim();
      if (!s) return "";
      var d = parseDate(s);
      if (!d || isNaN(d.getTime())) return s;
      try {
        return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      } catch (e) {
        return d.toDateString();
      }
    }
    function renderListingPropertyOverviewBento(row, specsText) {
      row = row || {};
      var hoodRaw = String(row.neighborhood || "").trim();
      var specsRaw = String(specsText || "").trim();
      var mlsRaw = String(row.mlsNumber || "").trim();
      var price = formatListPriceLabel(row.listPrice);
      var listDateRaw = String(formatListingLongDate(row.listDate) || "").trim();
      var compassLink = resolveCompassListingLink(row);
      var compassVal = compassLink
        ? '<a class="amd-lh-property-link" href="' + esc(compassLink) + '" target="_blank" rel="noopener">View on Compass</a>'
        : propertyDetailMissingHtml("Link not added");
      var rows = [
        propertyDetailItem("Neighborhood", hoodRaw ? esc(hoodRaw) : propertyDetailMissingHtml()),
        propertyDetailItem("Specs", specsRaw ? esc(specsRaw) : propertyDetailMissingHtml("No bed/bath/sqft yet")),
        propertyDetailItem("Compass listing", compassVal),
        propertyDetailItem("List price", price ? esc(price) : propertyDetailMissingHtml()),
        propertyDetailItem("MLS #", mlsRaw ? esc(mlsRaw) : propertyDetailMissingHtml()),
        propertyDetailItem("List date", listDateRaw ? esc(listDateRaw) : propertyDetailMissingHtml())
      ];
      var nextOh = formatNextOpenHouseLabel(row);
      if (nextOh) {
        rows.push(propertyDetailItem("Next open house", esc(nextOh)));
      }
      return (
        '<div class="amd-lh-stat is-property-overview">' +
          '<div class="amd-lh-stat-k">Property details</div>' +
          '<div class="amd-lh-property-grid">' +
          rows.join("") +
          "</div>" +
        "</div>"
      );
    }

    function buildSellCarouselSlideImgHtml(item, addr, className) {
      if (!item || !item.url) return "";
      var cls = "amd-sell-carousel-slide" + (className ? " " + className : "");
      return (
        '<img class="' + cls + '" src="' +
        esc(item.url) +
        '" data-backup="' +
        esc(item.backupUrl || "") +
        '" alt="' +
        esc(item.name || addr || "Listing photo") +
        '" loading="lazy" onerror="if(this.dataset.backup && this.src!==this.dataset.backup){this.src=this.dataset.backup;return;} this.onerror=null;">'
      );
    }
    function buildSellCarouselStageHtml(item, addr, emptyMsg) {
      if (item && item.url) {

/* postListing */


/* renderHelpers */


/* sqAndPhotos */



function buildLhSellDetailPageHtml(active,address){
  // paste render block manually
}
window.ASG_LH_SELL_DETAIL={buildLhSellDetailPageHtml,fetchLhSellPhotosForAddress,wireLhSellWorkspace};
})();
