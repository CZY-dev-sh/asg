/**
 * ═══════════════════════════════════════════════════════════
 *  ASG Admin Dashboard — Google Apps Script API
 * ═══════════════════════════════════════════════════════════
 *
 * Query params:
 *   ?period=allTime   -> "All Time Closed"
 *   ?period=ytd2026   -> "YTD Summary" (default)
 *   ?view=pipeline    -> raw rows from "YTD Closed" + "YTD Pending" (for TV pipeline view)
 */

// ── CONFIG ────────────────────────────────────────────────
var PERIOD_SHEETS = {
  ytd2026: "YTD Summary",
  allTime: "All Time Closed"
};
var DEFAULT_PERIOD = "ytd2026";
// ──────────────────────────────────────────────────────────

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var view = e && e.parameter && e.parameter.view
      ? String(e.parameter.view).trim().toLowerCase()
      : "";
    if (view === "pipeline") {
      return _jsonResponse(_readPipeline_(ss));
    }
    if (
      view === "alltimeclosedrows" ||
      view === "alltimecloseddeals" ||
      view === "alltimetransactions" ||
      view === "alltimeclosed"
    ) {
      return _jsonResponse(_readAllTimeClosedRows_(ss));
    }

    var period = _resolvePeriod_(e && e.parameter ? e.parameter.period : "");
    var sheetName = PERIOD_SHEETS[period];
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return _jsonResponse({
        success: false,
        error: 'Sheet not found: "' + sheetName + '". Check tab names in PERIOD_SHEETS.'
      });
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    if (lastRow < 4 || lastCol < 2) {
      return _jsonResponse({
        success: false,
        error: "Sheet appears empty or too small."
      });
    }

    var allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var layout = _detectLayout_(allData);
    if (!layout) {
      return _jsonResponse({
        success: false,
        error: 'Could not detect header row with required "Agent" column.'
      });
    }

    var totalsRow = layout.totalsRow;
    var headersRow = layout.headersRow;
    var col = layout.col;

    if (col.agent === undefined) {
      return _jsonResponse({
        success: false,
        error: 'Could not find required "Agent" column in row 3.'
      });
    }

    var metrics;
    if (_isDealsLayout_(col)) {
      metrics = _buildMetricsFromDeals_(allData, layout, col);
    } else {
      metrics = _buildMetricsFromSummary_(allData, layout, col);
    }

    var summary = metrics.summary;
    var agents = metrics.agents;

    agents.sort(function(a, b) { return b.grandTotal - a.grandTotal; });

    var includeRows = _wantsRows_(e && e.parameter ? e.parameter : null);
    var allTimeRows = [];
    if (includeRows && period === "allTime") {
      allTimeRows = _readDealRows_(sheet).map(function(r) {
        return {
          rowNumber: r.rowNumber,
          address: r.address,
          type: r.type,
          closeDate: r.closeDate,
          closeDateMs: r.closeDateMs,
          price: r.price,
          agent: r.agent,
          status: r.status || "Closed",
          source: r.source
        };
      });
    }

    return _jsonResponse({
      success: true,
      meta: {
        period: period,
        sheetName: sheet.getName(),
        generatedAt: new Date().toISOString(),
        rowsIncluded: includeRows && period === "allTime"
      },
      summary: summary,
      agents: agents,
      allTimeClosed: allTimeRows
    });

  } catch (err) {
    return _jsonResponse({
      success: false,
      error: err && err.message ? err.message : String(err)
    });
  }
}

function _wantsRows_(params) {
  if (!params) return false;
  var raw = params.rows || params.includeRows || params.details || "";
  var v = String(raw).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "y";
}

function _resolvePeriod_(raw) {
  var p = String(raw || "").trim().toLowerCase();

  if (
    p === "alltime" ||
    p === "all_time" ||
    p === "all-time" ||
    p === "all time"
  ) return "allTime";

  if (
    p === "ytd" ||
    p === "ytd2026" ||
    p === "2026" ||
    p === "ytd-summary" ||
    p === "ytd summary"
  ) return "ytd2026";

  return DEFAULT_PERIOD;
}

function _detectLayout_(allData) {
  var scanLimit = Math.min(allData.length, 12);
  for (var i = 0; i < scanLimit; i++) {
    var row = allData[i] || [];
    var col = _buildColumnMap(row);
    if (col.agent !== undefined) {
      var totalsIndex = i > 0 ? i - 1 : i;
      var totalsRow = allData[totalsIndex] || [];
      return {
        headersRow: row,
        totalsRow: totalsRow,
        dataStartRow: i + 1,
        col: col
      };
    }
  }
  return null;
}

function _isDealsLayout_(col) {
  return col.agent !== undefined &&
    col.price !== undefined &&
    col.status !== undefined &&
    col.totalClosed === undefined &&
    col.grandTotal === undefined;
}

function _buildMetricsFromSummary_(allData, layout, col) {
  var totalsRow = layout.totalsRow;
  var summaryClosedVolume = _getNum(totalsRow, col.totalClosed);
  var summaryPendingVolume = _getNum(totalsRow, col.totalPending);
  var summaryGrandTotal = col.grandTotal !== undefined
    ? _getNum(totalsRow, col.grandTotal)
    : (summaryClosedVolume + summaryPendingVolume);

  var summaryTotalDeals = _getNum(totalsRow, col.totalDeals);
  var summaryClosedDeals = _getNum(totalsRow, col.closedDeals);
  var summaryPendingDeals = _getNum(totalsRow, col.pendingDeals);
  if (!summaryTotalDeals) summaryTotalDeals = summaryClosedDeals + summaryPendingDeals;

  var summary = {
    closedVolume: summaryClosedVolume,
    closedDeals: summaryClosedDeals,
    pendingVolume: summaryPendingVolume,
    pendingDeals: summaryPendingDeals,
    grandTotal: summaryGrandTotal,
    totalDeals: summaryTotalDeals,
    buyPct: _getPct(totalsRow, col.buyPct),
    buyZillow: _getNum(totalsRow, col.buyZillow),
    sellZillow: _getNum(totalsRow, col.sellZillow),
    totalZillow: _getNum(totalsRow, col.totalZillow),
    zillowDeals: _getNum(totalsRow, col.zillowDeals),
    zillowPct: _getPct(totalsRow, col.zillowPct)
  };
  summary.totalVolume = summary.closedVolume + summary.pendingVolume;
  summary.totalTransactions = summary.closedDeals + summary.pendingDeals;

  var agents = [];
  for (var r = layout.dataStartRow; r < allData.length; r++) {
    var row = allData[r];
    var name = _cleanString(row[col.agent]);
    if (!name) continue;

    var closedVolume = _getNum(row, col.totalClosed);
    var pendingVolume = _getNum(row, col.totalPending);
    var grandTotal = col.grandTotal !== undefined ? _getNum(row, col.grandTotal) : (closedVolume + pendingVolume);
    var closedDeals = _getNum(row, col.closedDeals);
    var pendingDeals = _getNum(row, col.pendingDeals);
    var totalDeals = _getNum(row, col.totalDeals);
    if (!totalDeals) totalDeals = closedDeals + pendingDeals;

    var agent = {
      name: name,
      closedVolume: closedVolume,
      closedDeals: closedDeals,
      pendingVolume: pendingVolume,
      pendingDeals: pendingDeals,
      grandTotal: grandTotal,
      totalDeals: totalDeals,
      buyPct: _getPct(row, col.buyPct),
      buyZillow: _getNum(row, col.buyZillow),
      sellZillow: _getNum(row, col.sellZillow),
      totalZillow: _getNum(row, col.totalZillow),
      zillowDeals: _getNum(row, col.zillowDeals),
      zillowPct: _getPct(row, col.zillowPct)
    };
    agent.totalVolume = agent.closedVolume + agent.pendingVolume;
    agent.totalTransactions = agent.closedDeals + agent.pendingDeals;

    if (agent.totalVolume === 0 && agent.totalTransactions === 0 && !agent.name) continue;
    agents.push(agent);
  }

  return { summary: summary, agents: agents };
}

function _buildMetricsFromDeals_(allData, layout, col) {
  var byAgent = {};
  var totals = {
    closedVolume: 0, closedDeals: 0,
    pendingVolume: 0, pendingDeals: 0,
    buyDeals: 0,
    buyZillow: 0, sellZillow: 0, zillowDeals: 0
  };

  for (var r = layout.dataStartRow; r < allData.length; r++) {
    var row = allData[r];
    var name = _cleanString(row[col.agent]);
    if (!name) continue;

    var price = _getNum(row, col.price);
    var status = _normalizeHeader(row[col.status]);
    var side = col.type !== undefined ? _normalizeHeader(row[col.type]) : "";
    var source = col.source !== undefined ? _normalizeHeader(row[col.source]) : "";
    var isPending = /pending|under contract|a\/i|ai/.test(status);
    var isBuy = /buy/.test(side);
    var isZillow = /zillow/.test(source);

    if (!byAgent[name]) {
      byAgent[name] = {
        name: name,
        closedVolume: 0, closedDeals: 0,
        pendingVolume: 0, pendingDeals: 0,
        grandTotal: 0, totalDeals: 0, buyDeals: 0, buyPct: 0,
        buyZillow: 0, sellZillow: 0, totalZillow: 0, zillowDeals: 0, zillowPct: 0
      };
    }
    var a = byAgent[name];

    if (isPending) {
      a.pendingVolume += price;
      a.pendingDeals += 1;
      totals.pendingVolume += price;
      totals.pendingDeals += 1;
    } else {
      a.closedVolume += price;
      a.closedDeals += 1;
      totals.closedVolume += price;
      totals.closedDeals += 1;
    }
    a.totalDeals += 1;
    a.buyDeals += isBuy ? 1 : 0;
    a.grandTotal += price;
    totals.buyDeals += isBuy ? 1 : 0;

    if (isZillow) {
      if (isBuy) {
        a.buyZillow += price;
        totals.buyZillow += price;
      } else {
        a.sellZillow += price;
        totals.sellZillow += price;
      }
      a.totalZillow += 1;
      a.zillowDeals += 1;
      totals.zillowDeals += 1;
    }
  }

  var agents = Object.keys(byAgent).map(function(name) {
    var a = byAgent[name];
    a.totalVolume = a.closedVolume + a.pendingVolume;
    a.totalTransactions = a.closedDeals + a.pendingDeals;
    a.buyPct = a.totalDeals ? Math.round((a.buyDeals / a.totalDeals) * 100) : 0;
    a.zillowPct = a.totalDeals ? Math.round((a.zillowDeals / a.totalDeals) * 100) : 0;
    delete a.buyDeals;
    return a;
  });

  agents.sort(function(a, b) { return b.grandTotal - a.grandTotal; });

  var totalDeals = totals.closedDeals + totals.pendingDeals;
  var summary = {
    closedVolume: totals.closedVolume,
    closedDeals: totals.closedDeals,
    pendingVolume: totals.pendingVolume,
    pendingDeals: totals.pendingDeals,
    grandTotal: totals.closedVolume + totals.pendingVolume,
    totalDeals: totalDeals,
    buyPct: totalDeals ? Math.round((totals.buyDeals / totalDeals) * 100) : 0,
    buyZillow: totals.buyZillow,
    sellZillow: totals.sellZillow,
    totalZillow: totals.zillowDeals,
    zillowDeals: totals.zillowDeals,
    zillowPct: totalDeals ? Math.round((totals.zillowDeals / totalDeals) * 100) : 0
  };
  summary.totalVolume = summary.closedVolume + summary.pendingVolume;
  summary.totalTransactions = summary.closedDeals + summary.pendingDeals;

  return { summary: summary, agents: agents };
}

// ── Column Mapping ────────────────────────────────────────
function _buildColumnMap(headersRow) {
  var col = {};

  for (var c = 0; c < headersRow.length; c++) {
    var raw = headersRow[c];
    var h = _normalizeHeader(raw);
    if (!h) continue;

    // Agent / Name
    if (
      h === "agent" ||
      h === "name" ||
      /agent name/.test(h) ||
      (/agent/.test(h) && !/zillow|acknowledg|mls|status|source|type/.test(h))
    ) {
      col.agent = c;
      continue;
    }

    // Closed volume
    if (
      /^total closed$/.test(h) ||
      (/total closed/.test(h) && !/#/.test(h) && !/deal/.test(h)) ||
      /closed volume/.test(h) ||
      /all time closed/.test(h)
    ) {
      col.totalClosed = c;
      continue;
    }

    // Closed deals
    if (
      (/total closed/.test(h) && /#/.test(h) && /deal/.test(h)) ||
      (/closed/.test(h) && /deal/.test(h) && (/#|count|num|number/.test(h)))
    ) {
      col.closedDeals = c;
      continue;
    }

    // Buy vs Sell %
    if (/% buy/.test(h) || /buy vs sell/.test(h)) {
      col.buyPct = c;
      continue;
    }

    // Deals-table columns
    if (h === "price" || /sale price/.test(h) || /list price/.test(h)) {
      col.price = c;
      continue;
    }
    if (h === "status" || /deal status/.test(h)) {
      col.status = c;
      continue;
    }
    if (h === "type" || /side/.test(h)) {
      col.type = c;
      continue;
    }
    if (h === "source") {
      col.source = c;
      continue;
    }

    // Pending volume
    if (
      /^total pending$/.test(h) ||
      (/total pending/.test(h) && !/#/.test(h) && !/deal/.test(h)) ||
      /pending volume/.test(h)
    ) {
      col.totalPending = c;
      continue;
    }

    // Pending deals
    if (
      (/total pending/.test(h) && /#/.test(h) && /deal/.test(h)) ||
      (/pending/.test(h) && /deal/.test(h) && (/#|count|num|number/.test(h)))
    ) {
      col.pendingDeals = c;
      continue;
    }

    // Grand total
    if (/grand total/.test(h) || /total volume/.test(h) || /all time total/.test(h) || /volume total/.test(h)) {
      col.grandTotal = c;
      continue;
    }

    // Total deals
    if (
      (
        (/total/.test(h) && /#/.test(h) && /deal/.test(h)) ||
        /total deals/.test(h) ||
        /deal count/.test(h)
      ) &&
      !/closed/.test(h) &&
      !/pending/.test(h) &&
      !/zillow/.test(h)
    ) {
      col.totalDeals = c;
      continue;
    }

    // Buy - Zillow
    if (/buy/.test(h) && /zillow/.test(h)) {
      col.buyZillow = c;
      continue;
    }

    // Sell - Zillow
    if (/sell/.test(h) && /zillow/.test(h)) {
      col.sellZillow = c;
      continue;
    }

    // Total Zillow
    if (/total zillow/.test(h)) {
      col.totalZillow = c;
      continue;
    }

    // Total Zillow - # of Deals
    if (/zillow/.test(h) && /#/.test(h) && /deal/.test(h)) {
      col.zillowDeals = c;
      continue;
    }

    // Zillow Volume %
    if (/zillow/.test(h) && /%/.test(h)) {
      col.zillowPct = c;
      continue;
    }
  }

  return col;
}

// ── Helpers ───────────────────────────────────────────────
function _normalizeHeader(v) {
  return String(v || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function _cleanString(v) {
  return String(v || "").replace(/\s+/g, " ").trim();
}

function _getNum(row, index) {
  if (index === undefined || index === null) return 0;
  return _num(row[index]);
}

function _getPct(row, index) {
  if (index === undefined || index === null) return 0;
  return _pct(row[index]);
}

function _num(v) {
  if (v === null || v === undefined || v === "" || v === "-") return 0;

  if (typeof v === "number") return v;

  var s = String(v)
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .trim();

  if (!s || s === "-") return 0;

  var n = Number(s);
  return isNaN(n) ? 0 : n;
}

function _pct(v) {
  if (v === null || v === undefined || v === "" || v === "-") return 0;

  if (typeof v === "number") {
    if (v > 0 && v <= 1) return Math.round(v * 100);
    return Math.round(v);
  }

  var s = String(v).replace(/[%\s]/g, "").trim();
  if (!s || s === "-") return 0;

  var n = Number(s);
  if (isNaN(n)) return 0;

  if (n > 0 && n <= 1) return Math.round(n * 100);
  return Math.round(n);
}

function _jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Pipeline: YTD Closed + YTD Pending deal rows (TV dashboard) ──
var PIPELINE_SHEETS = {
  ytdClosed: "YTD Closed",
  ytdPending: "YTD Pending"
};

function _readPipeline_(ss) {
  var closedSh = ss.getSheetByName(PIPELINE_SHEETS.ytdClosed);
  var pendingSh = ss.getSheetByName(PIPELINE_SHEETS.ytdPending);
  var ytdClosed = closedSh ? _readDealRows_(closedSh) : [];
  var ytdPending = pendingSh ? _readDealRows_(pendingSh) : [];

  ytdClosed.sort(function(a, b) {
    return (b.closeDateMs || 0) - (a.closeDateMs || 0);
  });

  return {
    success: true,
    meta: {
      view: "pipeline",
      generatedAt: new Date().toISOString(),
      closedSheet: PIPELINE_SHEETS.ytdClosed,
      pendingSheet: PIPELINE_SHEETS.ytdPending,
      closedCount: ytdClosed.length,
      pendingCount: ytdPending.length
    },
    ytdClosed: ytdClosed,
    ytdPending: ytdPending
  };
}

function _readAllTimeClosedRows_(ss) {
  var sheet = ss.getSheetByName(PERIOD_SHEETS.allTime);
  var rows = sheet ? _readDealRows_(sheet) : [];
  rows.sort(function(a, b) {
    return (b.closeDateMs || 0) - (a.closeDateMs || 0);
  });
  return {
    success: true,
    meta: {
      view: "allTimeClosedRows",
      sheetName: PERIOD_SHEETS.allTime,
      generatedAt: new Date().toISOString(),
      count: rows.length
    },
    allTimeClosed: rows
  };
}

function _readDealRows_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var col = _mapDealHeaders_(headers);
  if (col.address === undefined) {
    return [];
  }

  var rows = [];
  var tz = Session.getScriptTimeZone();
  var dataRows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  for (var i = 0; i < dataRows.length; i++) {
    var row = dataRows[i];
    var r = i + 2;
    var address = col.address !== undefined ? _cleanString(row[col.address]) : "";
    if (!address) continue;

    var rawDate = col.closeDate !== undefined ? row[col.closeDate] : "";
    var closeDateMs = _dealDateMs_(rawDate);
    var closeDateDisplay = _formatDealCellDate_(rawDate, tz);

    var price = col.price !== undefined ? _num(row[col.price]) : 0;

    rows.push({
      rowNumber: r,
      address: address,
      type: col.type !== undefined ? _cleanString(row[col.type]) : "",
      closeDate: closeDateDisplay,
      closeDateMs: closeDateMs,
      price: price,
      agent: col.agent !== undefined ? _cleanString(row[col.agent]) : "",
      status: col.status !== undefined ? _cleanString(row[col.status]) : "",
      source: col.source !== undefined ? _cleanString(row[col.source]) : "",
      zillowAck: col.zillowAck !== undefined ? _cleanString(row[col.zillowAck]) : "",
      mlsStatus: col.mlsStatus !== undefined ? _cleanString(row[col.mlsStatus]) : ""
    });
  }
  return rows;
}

function _mapDealHeaders_(headersRow) {
  var col = {};
  for (var c = 0; c < headersRow.length; c++) {
    var h = _normalizeHeader(headersRow[c]);
    if (!h) continue;

    if (h === "address" || /^address/.test(h) || /property address/.test(h)) {
      col.address = c;
      continue;
    }
    if (h === "type" || h === "side") {
      col.type = c;
      continue;
    }
    if (
      /close date/.test(h) ||
      h === "closing date" ||
      (h.indexOf("close") !== -1 && h.indexOf("date") !== -1 && !/review/.test(h))
    ) {
      col.closeDate = c;
      continue;
    }
    if (
      h === "price" ||
      /contract price|sale price|purchase price/.test(h)
    ) {
      col.price = c;
      continue;
    }
    if (h === "agent") {
      col.agent = c;
      continue;
    }
    if (h === "status" || /deal status|transaction status/.test(h)) {
      col.status = c;
      continue;
    }
    if (h === "source" || /lead source/.test(h)) {
      col.source = c;
      continue;
    }
    if (/zillow/.test(h) && (/ack/.test(h) || /premier/.test(h))) {
      col.zillowAck = c;
      continue;
    }
    if (/mls/.test(h) && /status/.test(h)) {
      col.mlsStatus = c;
      continue;
    }
  }
  return col;
}

function _dealDateMs_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v.getTime();
  return 0;
}

function _formatDealCellDate_(v, tz) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, tz, "M/d/yyyy");
  }
  var s = String(v || "").trim();
  return s;
}
