/**
 * Pull whatever IDX Broker exposes for this account (featured, sold/pending,
 * supplemental) into a private Google Sheet tab for internal use.
 *
 * Script properties:
 *   IDX_ACCESS_KEY     — required (IDX control panel → API access key)
 *   IDX_API_VERSION    — optional, default 1.8 (match IDX control panel)
 *   IDX_ANCILLARY_KEY  — optional (partner ancillary key)
 *   IDX_SYNC_SHEET_NAME — optional, default IdxListings
 *   IDX_SAVED_LINK_IDS — optional comma-separated saved link IDs (see ?view=idxprobe)
 *   IDX_SAVED_LINK_TITLE — optional; match one saved link by title (e.g. office active)
 *   LISTINGS_SPREADSHEET_ID — same workbook as Listing Hub
 *
 * Run once: installIdxSyncTrigger()  (every 15 minutes)
 * Manual:   syncIdxListingsToSheet() or POST { action: "syncidx", secret }
 */

var IDX_SYNC_DEFAULT_SHEET = 'IdxListings';
var IDX_OPENHOUSES_DEFAULT_SHEET = 'IdxOpenHouses';
var IDX_API_BASE = 'https://api.idxbroker.com/clients/';
var IDX_API_META_KEYS = {
  data: true,
  total: true,
  next: true,
  page: true,
  disclaimers: true,
  courtesy: true,
  lastupdate: true,
  count: true
};

function getIdxSyncSheetName_() {
  var name = trim_(
    PropertiesService.getScriptProperties().getProperty('IDX_SYNC_SHEET_NAME') || IDX_SYNC_DEFAULT_SHEET
  );
  return name || IDX_SYNC_DEFAULT_SHEET;
}

function getIdxAccessKey_() {
  var key = trim_(PropertiesService.getScriptProperties().getProperty('IDX_ACCESS_KEY'));
  if (!key) {
    throw new Error(
      'Missing script property IDX_ACCESS_KEY. Create an API key in the Elm Street / IDX control panel (Access Control).'
    );
  }
  return key;
}

function idxApiRequest_(methodPath) {
  var url = IDX_API_BASE + String(methodPath || '').replace(/^\//, '');
  var version = trim_(PropertiesService.getScriptProperties().getProperty('IDX_API_VERSION')) || '1.8';
  var ancillary = trim_(PropertiesService.getScriptProperties().getProperty('IDX_ANCILLARY_KEY'));
  var headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    accesskey: getIdxAccessKey_(),
    outputtype: 'json',
    apiversion: version
  };
  if (ancillary) headers.ancillarykey = ancillary;

  var res = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: headers
  });
  var code = res.getResponseCode();
  var text = res.getContentText() || '';
  if (code === 401) throw new Error('IDX API unauthorized (check IDX_ACCESS_KEY).');
  if (code === 412) throw new Error('IDX API hourly rate limit exceeded. Try again later.');
  if (code >= 400) throw new Error('IDX API HTTP ' + code + ': ' + text.slice(0, 400));

  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('IDX API returned non-JSON: ' + text.slice(0, 200));
  }
}

/** Normalize IDX JSON (array, {data:[]}, {data:{key:row}}, or legacy keyed map). */
function idxExtractListingsFromBody_(body) {
  if (!body) return [];
  if (Object.prototype.toString.call(body) === '[object Array]') return body;

  if (body.data && typeof body.data === 'object') {
    if (Object.prototype.toString.call(body.data) === '[object Array]') return body.data;
    var fromDataObj = [];
    var dk;
    for (dk in body.data) {
      if (!body.data.hasOwnProperty(dk)) continue;
      if (body.data[dk] && typeof body.data[dk] === 'object' && !Array.isArray(body.data[dk])) {
        fromDataObj.push(body.data[dk]);
      }
    }
    if (fromDataObj.length) return fromDataObj;
  }

  var out = [];
  var k;
  for (k in body) {
    if (!body.hasOwnProperty(k)) continue;
    if (IDX_API_META_KEYS[String(k).toLowerCase()]) continue;
    var item = body[k];
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    if (item.listingID || item.listingId || item.address || item.streetName || item.listingPrice) {
      out.push(item);
    }
  }
  return out;
}

/**
 * Paginate IDX client listing feeds ({ data, total, next } or legacy keyed map).
 */
function idxFetchClientFeed_(feedType) {
  var type = String(feedType || 'featured').toLowerCase();
  var out = [];
  var path = type + '?disclaimers=true';
  var guard = 0;

  while (path && guard < 200) {
    guard++;
    var body = idxApiRequest_(path);
    if (!body) break;

    var chunk = idxExtractListingsFromBody_(body);
    var i;
    for (i = 0; i < chunk.length; i++) {
      out.push({ feed: type, listing: chunk[i], idxKey: idxDeriveListingKey_(chunk[i], type, out.length) });
    }

    if (body.next) {
      path = idxPathFromNextUrl_(body.next);
      continue;
    }
    var offset = out.length;
    var total = Number(body.total || 0);
    if (total > offset) {
      path = type + '?disclaimers=true&offset=' + offset;
      continue;
    }
    break;
  }

  return out;
}

function idxPathFromNextUrl_(nextUrl) {
  var u = String(nextUrl || '');
  var marker = '/clients/';
  var i = u.indexOf(marker);
  if (i < 0) return '';
  var tail = u.slice(i + marker.length);
  if (tail.indexOf('disclaimers=') < 0) {
    tail += (tail.indexOf('?') >= 0 ? '&' : '?') + 'disclaimers=true';
  }
  return tail;
}

function idxDeriveListingKey_(listing, feed, index) {
  if (!listing || typeof listing !== 'object') return feed + '|row|' + index;
  var lid = trim_(listing.listingID || listing.listingId || listing.mlsNumber || listing.mls_number || '');
  var idxId = trim_(listing.idxID || listing.idxId || '');
  if (idxId && lid) return idxId + '|' + lid;
  if (lid) return feed + '|' + lid;
  var addr = trim_(listing.address || listing.displayAddress || '');
  if (addr) return feed + '|' + addr;
  return feed + '|row|' + index;
}

function idxFetchSupplementalFeed_() {
  var body = idxApiRequest_('supplemental');
  var out = [];
  if (!body) return out;
  var chunk = idxExtractListingsFromBody_(body);
  var i;
  for (i = 0; i < chunk.length; i++) {
    out.push({
      feed: 'supplemental',
      listing: chunk[i],
      idxKey: idxDeriveListingKey_(chunk[i], 'supplemental', i)
    });
  }
  return out;
}

/** List saved links configured in IDX (for matching Active / office searches). */
function idxListSavedLinks_() {
  var body = idxApiRequest_('savedlinks');
  if (!body) return [];
  if (Object.prototype.toString.call(body) === '[object Array]') return body;
  var out = [];
  var k;
  for (k in body) {
    if (!body.hasOwnProperty(k)) continue;
    if (body[k] && typeof body[k] === 'object') out.push(body[k]);
  }
  return out;
}

function idxResolveSavedLinkIds_() {
  var props = PropertiesService.getScriptProperties();
  var raw = trim_(props.getProperty('IDX_SAVED_LINK_IDS'));
  if (raw) {
    return raw
      .split(',')
      .map(function (s) {
        return trim_(s);
      })
      .filter(Boolean);
  }
  var titleNeedle = trim_(props.getProperty('IDX_SAVED_LINK_TITLE')).toLowerCase();
  if (!titleNeedle) return [];
  var links = idxListSavedLinks_();
  var ids = [];
  var i;
  for (i = 0; i < links.length; i++) {
    var title = String(links[i].linkTitle || links[i].linkName || links[i].name || '').toLowerCase();
    if (title.indexOf(titleNeedle) >= 0) ids.push(String(links[i].id || links[i].savedLinkID || links[i].savedLinkId || ''));
  }
  return ids.filter(Boolean);
}

/** MLS search results for a saved link (often closest to control-panel inventory). */
function idxFetchSavedLinkFeed_(linkId) {
  var id = trim_(linkId);
  if (!id) return [];
  var type = 'savedlink:' + id;
  var out = [];
  var path = 'savedlinks/' + encodeURIComponent(id) + '/results?disclaimers=true';
  var guard = 0;
  while (path && guard < 200) {
    guard++;
    var body = idxApiRequest_(path);
    if (!body) break;
    var chunk = idxExtractListingsFromBody_(body);
    var i;
    for (i = 0; i < chunk.length; i++) {
      out.push({
        feed: type,
        listing: chunk[i],
        idxKey: idxDeriveListingKey_(chunk[i], type, out.length)
      });
    }
    if (body.next) {
      path = idxPathFromNextUrl_(body.next);
      continue;
    }
    break;
  }
  return out;
}

/** Inspect raw IDX responses (run from editor as testIdxSyncProbe). */
function idxProbeFeeds_() {
  var feeds = ['featured', 'soldpending', 'supplemental'];
  var report = [];
  var f, body, listings, sampleKeys;
  var savedLinks = [];
  try {
    savedLinks = idxListSavedLinks_();
    report.push({
      feed: 'savedlinks (catalog)',
      ok: true,
      parsedCount: savedLinks.length,
      links: savedLinks.slice(0, 20).map(function (link) {
        return {
          id: link.id || link.savedLinkID || link.savedLinkId || '',
          title: link.linkTitle || link.linkName || link.name || '',
          url: link.url || ''
        };
      })
    });
  } catch (errSl) {
    report.push({ feed: 'savedlinks (catalog)', ok: false, error: errorText_(errSl) });
  }
  for (f = 0; f < feeds.length; f++) {
    var name = feeds[f];
    try {
      body = idxApiRequest_(name === 'supplemental' ? 'supplemental' : name + '?disclaimers=true');
      listings = idxExtractListingsFromBody_(body);
      sampleKeys = body && typeof body === 'object' ? Object.keys(body).slice(0, 12) : [];
      report.push({
        feed: name,
        ok: true,
        topLevelType: Object.prototype.toString.call(body),
        topLevelKeys: sampleKeys,
        dataIsArray: !!(body && body.data && Object.prototype.toString.call(body.data) === '[object Array]'),
        dataLength: body && body.data && body.data.length !== undefined ? body.data.length : null,
        total: body && body.total !== undefined ? body.total : null,
        parsedCount: listings.length,
        sampleListingId: listings[0] && (listings[0].listingID || listings[0].listingId || '')
      });
    } catch (err) {
      report.push({ feed: name, ok: false, error: errorText_(err) });
    }
  }
  return report;
}

function idxCollectAllListings_() {
  var merged = [];
  var seen = {};
  var feeds = ['featured', 'soldpending'];
  var f, i, row;

  for (f = 0; f < feeds.length; f++) {
    var chunk = idxFetchClientFeed_(feeds[f]);
    for (i = 0; i < chunk.length; i++) {
      row = chunk[i];
      if (seen[row.idxKey]) continue;
      seen[row.idxKey] = true;
      merged.push(row);
    }
  }

  var supp = idxFetchSupplementalFeed_();
  for (i = 0; i < supp.length; i++) {
    row = supp[i];
    var sk = 'supp:' + row.idxKey;
    if (seen[sk]) continue;
    seen[sk] = true;
    row.idxKey = sk;
    merged.push(row);
  }

  var linkIds = idxResolveSavedLinkIds_();
  var li;
  for (li = 0; li < linkIds.length; li++) {
    var slChunk = idxFetchSavedLinkFeed_(linkIds[li]);
    for (i = 0; i < slChunk.length; i++) {
      row = slChunk[i];
      if (seen[row.idxKey]) continue;
      seen[row.idxKey] = true;
      merged.push(row);
    }
  }

  return merged;
}

function getIdxOpenHousesSheetName_() {
  var name = trim_(
    PropertiesService.getScriptProperties().getProperty('IDX_OPENHOUSES_SHEET_NAME') ||
      IDX_OPENHOUSES_DEFAULT_SHEET
  );
  return name || IDX_OPENHOUSES_DEFAULT_SHEET;
}

function idxParseOhDate_(s) {
  s = trim_(s);
  if (!s) return null;
  var d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    var y = Number(m[3]);
    if (y < 100) y += 2000;
    d = new Date(y, Number(m[1]) - 1, Number(m[2]));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function idxCollectOpenHouseCandidates_(obj, depth, out) {
  if (!obj || depth > 10) return;
  if (Object.prototype.toString.call(obj) === '[object Array]') {
    var ai;
    for (ai = 0; ai < obj.length; ai++) idxCollectOpenHouseCandidates_(obj[ai], depth + 1, out);
    return;
  }
  if (typeof obj !== 'object') return;

  if (obj.openHouses && Object.prototype.toString.call(obj.openHouses) === '[object Array]') {
    var oi;
    for (oi = 0; oi < obj.openHouses.length; oi++) {
      var oh = obj.openHouses[oi] || {};
      out.push({
        date: trim_(oh.openHouseDate || oh.OpenHouseDate || oh.date || oh.startDate || ''),
        start: trim_(oh.openHouseStart || oh.OpenHouseStartTime || oh.startTime || oh.start || ''),
        end: trim_(oh.openHouseEnd || oh.OpenHouseEndTime || oh.endTime || oh.end || '')
      });
    }
  }

  var n;
  for (n = 1; n <= 12; n++) {
    var dN =
      obj['Open House ' + n + ' Date'] ||
      obj['Open House Date ' + n] ||
      obj['openHouseDate' + n] ||
      obj['openHouse' + n + 'Date'] ||
      '';
    if (dN) {
      out.push({
        date: trim_(dN),
        start: trim_(
          obj['Open House ' + n + ' Start Time'] ||
            obj['Open House ' + n + ' Start'] ||
            obj['openHouseStart' + n] ||
            ''
        ),
        end: trim_(
          obj['Open House ' + n + ' End Time'] ||
            obj['Open House ' + n + ' End'] ||
            obj['openHouseEnd' + n] ||
            ''
        )
      });
    }
  }

  var singleDate = trim_(
    obj.openHouseDate ||
      obj.OpenHouseDate ||
      obj.nextOpenHouseDate ||
      obj['Open House Date'] ||
      obj['Next Open House Date'] ||
      ''
  );
  if (singleDate) {
    out.push({
      date: singleDate,
      start: trim_(obj.openHouseStartTime || obj.OpenHouseStartTime || obj.openHouseStart || obj['Open House Start Time'] || ''),
      end: trim_(obj.openHouseEndTime || obj.OpenHouseEndTime || obj.openHouseEnd || obj['Open House End Time'] || '')
    });
  }

  var skipKeys = { image: true, mediaData: true, remarksConcat: true };
  var k;
  for (k in obj) {
    if (!obj.hasOwnProperty(k) || skipKeys[k]) continue;
    var child = obj[k];
    if (!child || typeof child !== 'object') continue;
    var norm = String(k)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    if (norm.indexOf('openhouse') >= 0 || (depth < 5 && norm === 'advanced')) {
      idxCollectOpenHouseCandidates_(child, depth + 1, out);
    }
  }
}

function idxDedupeOpenHouseCandidates_(list) {
  var seen = {};
  var out = [];
  var i, key;
  for (i = 0; i < list.length; i++) {
    var c = list[i] || {};
    key = [c.date, c.start, c.end].join('|');
    if (!c.date || seen[key]) continue;
    seen[key] = true;
    out.push(c);
  }
  return out;
}

function idxPickNextFutureOpenHouse_(candidates) {
  var best = null;
  var bestTime = null;
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  var i, c, d, t;
  for (i = 0; i < candidates.length; i++) {
    c = candidates[i];
    d = idxParseOhDate_(c.date);
    if (!d) continue;
    if (d.getTime() < now.getTime()) continue;
    t = d.getTime();
    if (!best || t < bestTime) {
      best = c;
      bestTime = t;
    }
  }
  if (best) return best;
  for (i = 0; i < candidates.length; i++) {
    c = candidates[i];
    if (!c.date) continue;
    d = idxParseOhDate_(c.date);
    t = d && !isNaN(d.getTime()) ? d.getTime() : 99999999999999;
    if (!best || t < bestTime) {
      best = c;
      bestTime = t;
    }
  }
  return best;
}

/** Flatten `advanced` (MRED) leaves and pull any open-house-like date/time fields. */
function idxCollectOpenHouseFromAdvanced_(adv, out) {
  if (!adv || typeof adv !== 'object') return;
  var stack = [{ obj: adv, path: '' }];
  var guard = 0;
  while (stack.length && guard < 5000) {
    guard++;
    var frame = stack.pop();
    var obj = frame.obj;
    var path = frame.path;
    var k, val, nk, full;
    for (k in obj) {
      if (!obj.hasOwnProperty(k)) continue;
      val = obj[k];
      nk = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
      full = (path + '.' + k).toLowerCase();
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        stack.push({ obj: val, path: path ? path + '.' + k : k });
        continue;
      }
      if (typeof val !== 'string' && typeof val !== 'number') continue;
      var s = trim_(val);
      if (!s) continue;
      if (
        nk.indexOf('openhouse') >= 0 ||
        nk.indexOf('ohdate') >= 0 ||
        nk.indexOf('ohstart') >= 0 ||
        nk.indexOf('ohend') >= 0 ||
        full.indexOf('open house') >= 0 ||
        full.indexOf('openhouse') >= 0
      ) {
        if (nk.indexOf('end') >= 0 || nk.indexOf('finish') >= 0) {
          out.push({ date: '', start: '', end: s, _path: full });
        } else if (nk.indexOf('start') >= 0 || nk.indexOf('begin') >= 0) {
          out.push({ date: '', start: s, end: '', _path: full });
        } else if (nk.indexOf('date') >= 0 || nk.indexOf('day') >= 0 || idxParseOhDate_(s)) {
          out.push({ date: s, start: '', end: '', _path: full });
        }
      }
    }
  }
  var merged = {};
  var i, row, lid;
  for (i = 0; i < out.length; i++) {
    row = out[i];
    lid = row._path || 'x';
    if (!merged[lid]) merged[lid] = { date: '', start: '', end: '' };
    if (row.date) merged[lid].date = row.date;
    if (row.start) merged[lid].start = row.start;
    if (row.end) merged[lid].end = row.end;
  }
  out.length = 0;
  for (lid in merged) {
    if (merged.hasOwnProperty(lid) && merged[lid].date) out.push(merged[lid]);
  }
}

/** Parse open house dates/times from an IDX listing object (incl. advanced / MRED fields). */
function idxExtractOpenHouseInfo_(listing) {
  var L = listing || {};
  var candidates = [];
  idxCollectOpenHouseCandidates_(L, 0, candidates);
  if (L.advanced) idxCollectOpenHouseFromAdvanced_(L.advanced, candidates);
  candidates = idxDedupeOpenHouseCandidates_(candidates);
  var ohCount = Number(L.ohCount || L.ohcount || L.openHouseCount || 0) || candidates.length;
  var next = idxPickNextFutureOpenHouse_(candidates);
  return {
    ohCount: ohCount,
    nextDate: next ? next.date : '',
    nextStart: next ? next.start : '',
    nextEnd: next ? next.end : '',
    all: candidates
  };
}

function ensureIdxListingsSheet_() {
  var ss = getListingsSpreadsheet_();
  var name = getIdxSyncSheetName_();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  var headers = [
    'Idx Key',
    'Feed',
    'Listing ID',
    'Address',
    'Status',
    'Price',
    'OH Count',
    'Next OH Date',
    'Next OH Start',
    'Next OH End',
    'All OH JSON',
    'Synced At',
    'Raw JSON'
  ];
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  } else {
    var existing = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    var match = true;
    var c;
    for (c = 0; c < headers.length; c++) {
      if (String(existing[c] || '').trim() !== headers[c]) {
        match = false;
        break;
      }
    }
    if (!match) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sh;
}

function idxRowFromListing_(entry, syncedAt) {
  var L = entry.listing || {};
  var address =
    trim_(L.address) ||
    [trim_(L.streetNumber), trim_(L.streetName), trim_(L.cityName), trim_(L.state), trim_(L.zipcode)]
      .filter(Boolean)
      .join(' ');
  var oh = idxExtractOpenHouseInfo_(L);
  return [
    entry.idxKey,
    entry.feed,
    trim_(L.listingID || L.listingId || ''),
    address,
    trim_(L.propStatus || L.idxStatus || L.status || ''),
    trim_(L.listingPrice || L.price || ''),
    oh.ohCount ? String(oh.ohCount) : '0',
    oh.nextDate,
    oh.nextStart,
    oh.nextEnd,
    oh.all.length ? JSON.stringify(oh.all) : '',
    syncedAt,
    JSON.stringify(L)
  ];
}

function ensureIdxOpenHousesSheet_() {
  var ss = getListingsSpreadsheet_();
  var name = getIdxOpenHousesSheetName_();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  var headers = [
    'Listing ID',
    'Address',
    'Feed',
    'OH Date',
    'OH Start',
    'OH End',
    'Idx Key',
    'Synced At'
  ];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  return sh;
}

function syncIdxOpenHousesSheet_(items, syncedAt) {
  var sh = ensureIdxOpenHousesSheet_();
  var rows = [];
  var i, j, oh, L, address;
  for (i = 0; i < items.length; i++) {
    L = items[i].listing || {};
    oh = idxExtractOpenHouseInfo_(L);
    if (!oh.all.length) continue;
    address =
      trim_(L.address) ||
      [trim_(L.streetNumber), trim_(L.streetName), trim_(L.cityName), trim_(L.state), trim_(L.zipcode)]
        .filter(Boolean)
        .join(' ');
    for (j = 0; j < oh.all.length; j++) {
      rows.push([
        trim_(L.listingID || L.listingId || ''),
        address,
        items[i].feed,
        oh.all[j].date,
        oh.all[j].start,
        oh.all[j].end,
        items[i].idxKey,
        syncedAt
      ]);
    }
  }
  var last = sh.getLastRow();
  if (last > 1) sh.deleteRows(2, last - 1);
  if (rows.length) sh.getRange(2, 1, rows.length, 8).setValues(rows);
  return rows.length;
}

/**
 * Pull featured + sold/pending + supplemental from IDX into the IdxListings tab.
 */
function syncIdxListingsToSheet() {
  var started = new Date();
  var items = idxCollectAllListings_();
  var feedStats = { featured: 0, soldpending: 0, supplemental: 0, savedlinks: 0 };
  var si;
  for (si = 0; si < items.length; si++) {
    var ft = items[si].feed;
    if (feedStats[ft] !== undefined) feedStats[ft]++;
    else if (String(ft).indexOf('savedlink:') === 0) feedStats.savedlinks++;
  }
  var sh = ensureIdxListingsSheet_();
  var syncedAt = started.toISOString();
  var rows = [];
  var i;
  for (i = 0; i < items.length; i++) rows.push(idxRowFromListing_(items[i], syncedAt));

  var last = sh.getLastRow();
  if (last > 1) sh.deleteRows(2, last - 1);
  if (rows.length) {
    // getRange(row, col, numRows, numColumns) — 3rd arg is row COUNT, not last row index
    sh.getRange(2, 1, rows.length, 13).setValues(rows);
  }

  var openHouseRows = syncIdxOpenHousesSheet_(items, syncedAt);

  PropertiesService.getScriptProperties().setProperty('IDX_SYNC_LAST_AT', syncedAt);
  PropertiesService.getScriptProperties().setProperty('IDX_SYNC_LAST_COUNT', String(rows.length));
  PropertiesService.getScriptProperties().setProperty('IDX_OPENHOUSES_LAST_COUNT', String(openHouseRows));

  return {
    success: true,
    sheet: sh.getName(),
    openHousesSheet: getIdxOpenHousesSheetName_(),
    openHouseRows: openHouseRows,
    count: rows.length,
    syncedAt: syncedAt,
    feeds: ['featured', 'soldpending', 'supplemental', 'savedlinks'],
    feedStats: feedStats,
    durationMs: new Date().getTime() - started.getTime(),
    hint:
      rows.length === 0
        ? 'IDX API connected but returned 0 listings. Run testIdxSyncProbe() and confirm Featured IDs + active listings on search.alexstoykovgroup.com.'
        : ''
  };
}

function idxFeedPriority_(feed) {
  var f = String(feed || '').toLowerCase();
  if (f === 'featured') return 3;
  if (f.indexOf('savedlink') === 0) return 2;
  if (f === 'supplemental') return 2;
  if (f === 'soldpending') return 1;
  return 0;
}

function getIdxListingsSheetReadOnly_() {
  var ss = getListingsSpreadsheet_();
  return ss.getSheetByName(getIdxSyncSheetName_());
}

function idxSheetHeaderIndex_(headers) {
  var idx = {};
  var i;
  for (i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '')
      .trim()
      .toLowerCase();
    if (h) idx[h] = i;
  }
  return {
    idxKey: idx['idx key'],
    feed: idx['feed'],
    listingId: idx['listing id'],
    address: idx['address'],
    status: idx['status'],
    price: idx['price'],
    ohCount: idx['oh count'],
    nextOhDate: idx['next oh date'],
    nextOhStart: idx['next oh start'],
    nextOhEnd: idx['next oh end'],
    allOhJson: idx['all oh json'],
    syncedAt: idx['synced at'],
    rawJson: idx['raw json']
  };
}

function idxCell_(row, col) {
  if (col === undefined || col === null || col < 0) return '';
  return row[col];
}

function idxParseListingJson_(raw) {
  var s = trim_(raw);
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

function idxFirstPhotoUrl_(L) {
  if (!L || !L.image) return '';
  if (L.image.url) return trim_(L.image.url);
  var k;
  for (k in L.image) {
    if (!L.image.hasOwnProperty(k) || k === 'totalCount') continue;
    if (L.image[k] && L.image[k].url) return trim_(L.image[k].url);
  }
  return '';
}

function idxMatterportUrl_(L) {
  if (!L || !L.mediaData || !L.mediaData.vt) return '';
  var vt = L.mediaData.vt;
  if (Object.prototype.toString.call(vt) === '[object Array]' && vt[0] && vt[0].url) return trim_(vt[0].url);
  if (vt.url) return trim_(vt.url);
  return '';
}

/**
 * Build address → best IDX row (prefers featured over sold/pending for same address).
 */
function buildIdxListingsAddressMap_() {
  var sh = getIdxListingsSheetReadOnly_();
  var map = {};
  if (!sh || sh.getLastRow() < 2) return map;

  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var col = idxSheetHeaderIndex_(headers);
  if (col.address === undefined) return map;

  var r, row, addr, norm, feed, entry, existing, L;
  for (r = 1; r < values.length; r++) {
    row = values[r];
    addr = trim_(idxCell_(row, col.address));
    if (!addr) continue;
    norm = normalizeAddress_(addr);
    if (!norm) continue;
    L = idxParseListingJson_(idxCell_(row, col.rawJson));
    feed = trim_(idxCell_(row, col.feed));
    entry = {
      norm: norm,
      address: addr,
      feed: feed,
      listingId: trim_(idxCell_(row, col.listingId)),
      sheetStatus: trim_(idxCell_(row, col.status)),
      sheetPrice: trim_(idxCell_(row, col.price)),
      ohCount: trim_(idxCell_(row, col.ohCount)),
      nextOhDate: trim_(idxCell_(row, col.nextOhDate)),
      nextOhStart: trim_(idxCell_(row, col.nextOhStart)),
      nextOhEnd: trim_(idxCell_(row, col.nextOhEnd)),
      syncedAt: trim_(idxCell_(row, col.syncedAt)),
      listing: L
    };
    existing = map[norm];
    if (!existing || idxFeedPriority_(feed) > idxFeedPriority_(existing.feed)) {
      map[norm] = entry;
    }
  }
  return map;
}

function findIdxEntryForAddress_(address, map) {
  if (!map || !address) return null;
  var norm = normalizeAddress_(address);
  if (!norm) return null;
  if (map[norm]) return map[norm];
  var best = null;
  var bestScore = 0;
  var k;
  for (k in map) {
    if (!map.hasOwnProperty(k)) continue;
    var sc = scoreMatch_(norm, k);
    if (sc > bestScore && sc >= 0.72) {
      bestScore = sc;
      best = map[k];
    }
  }
  return best;
}

/**
 * Merge IDX MLS fields into a Listings-tab listing (sheet workflow fields unchanged).
 */
function enrichListingFromIdx_(listing, idxEntry) {
  if (!listing) return listing;
  if (!idxEntry) {
    listing.idxMatched = false;
    return listing;
  }
  var L = idxEntry.listing || {};
  var oh = idxExtractOpenHouseInfo_(L);

  listing.idxMatched = true;
  listing.idxFeed = idxEntry.feed || '';
  listing.idxListingId = trim_(L.listingID || L.listingId || idxEntry.listingId || '');
  listing.idxSyncedAt = idxEntry.syncedAt || '';
  listing.idxDetailsUrl = trim_(L.fullDetailsURL || L.detailsURL || '');
  listing.idxMlsStatus = trim_(L.propStatus || L.idxStatus || idxEntry.sheetStatus || '');
  listing.idx = L;

  if (listing.idxListingId) listing.mlsNumber = listing.idxListingId;
  listing.listPrice = trim_(L.listingPrice || (L.price ? '$' + L.price : '') || idxEntry.sheetPrice || listing.listPrice || '');
  if (L.bedrooms !== undefined && L.bedrooms !== '') listing.beds = String(L.bedrooms);
  if (L.totalBaths !== undefined && L.totalBaths !== '') listing.baths = String(L.totalBaths);
  if (L.sqFt) listing.sqFt = trim_(L.sqFt);

  var photo = idxFirstPhotoUrl_(L);
  if (!trim_(listing.coverImage) && photo) listing.coverImage = photo;

  var mp = idxMatterportUrl_(L);
  if (!trim_(listing.matterport) && mp) listing.matterport = mp;
  listing.ohCount = oh.ohCount ? String(oh.ohCount) : trim_(idxEntry.ohCount || '0');
  listing.nextOpenHouseDate = oh.nextDate || idxEntry.nextOhDate || '';
  listing.nextOpenHouseStart = oh.nextStart || idxEntry.nextOhStart || '';
  listing.nextOpenHouseEnd = oh.nextEnd || idxEntry.nextOhEnd || '';

  if (!trim_(listing.neighborhood) && L.cityName) {
    listing.neighborhood = trim_([L.cityName, L.state].filter(Boolean).join(', '));
  }

  return listing;
}

function idxSyncStatusPayload_() {
  var props = PropertiesService.getScriptProperties();
  return {
    sheet: getIdxSyncSheetName_(),
    openHousesSheet: getIdxOpenHousesSheetName_(),
    lastSyncedAt: trim_(props.getProperty('IDX_SYNC_LAST_AT')),
    lastCount: Number(props.getProperty('IDX_SYNC_LAST_COUNT') || '0'),
    openHouseRows: Number(props.getProperty('IDX_OPENHOUSES_LAST_COUNT') || '0'),
    hasAccessKey: !!trim_(props.getProperty('IDX_ACCESS_KEY'))
  };
}

/** Log open-house fields found on first featured listing with ohCount > 0. */
function testIdxOpenHouseFields() {
  var chunk = idxFetchClientFeed_('featured');
  var i, oh;
  for (i = 0; i < chunk.length; i++) {
    oh = idxExtractOpenHouseInfo_(chunk[i].listing);
    if (oh.ohCount > 0 || oh.all.length) {
      Logger.log(
        JSON.stringify(
          {
            listingID: chunk[i].listing.listingID,
            address: chunk[i].listing.address,
            oh: oh,
            advancedKeys: chunk[i].listing.advanced ? Object.keys(chunk[i].listing.advanced).slice(0, 40) : []
          },
          null,
          2
        )
      );
      return oh;
    }
  }
  Logger.log('No open houses found in featured feed JSON. Check OH column overrides in IDX Active Listings.');
  return { ohCount: 0, all: [] };
}

/** Run from Apps Script editor to enable automatic sync every 15 minutes. */
function installIdxSyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var i;
  for (i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncIdxListingsToSheet') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('syncIdxListingsToSheet').timeBased().everyMinutes(15).create();
  return { success: true, message: 'Installed 15-minute IDX → sheet sync trigger.' };
}

/** Editor test — requires IDX_ACCESS_KEY. */
function testIdxSync() {
  var result = syncIdxListingsToSheet();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/** Log how many Listings rows match IdxListings by address. */
function testIdxListingMerge() {
  var listings = getListings_();
  var matched = 0;
  var i;
  for (i = 0; i < listings.length; i++) if (listings[i].idxMatched) matched++;
  var summary = {
    listingsTab: listings.length,
    idxMatched: matched,
    unmatched: listings.length - matched
  };
  Logger.log(JSON.stringify(summary, null, 2));
  return summary;
}

/** Editor diagnostic — shows what each IDX feed returns before sync. */
function testIdxSyncProbe() {
  var probe = idxProbeFeeds_();
  Logger.log(JSON.stringify(probe, null, 2));
  return { success: true, probe: probe };
}
