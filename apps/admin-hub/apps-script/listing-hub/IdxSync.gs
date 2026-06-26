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
 *   IDX_COLIST_SCRAPE_BATCH — optional; detail pages to scrape per sync for co-list (default 60; 0=off)
 *   IDX_COLIST_API_BATCH — optional; per-listing IDX API detail fetches per sync (default 40; 0=off)
 *   IDX_COLIST_SCRAPE_RESET — optional; set true once to restart scrape cursor from row 0
 *   IDX_COLIST_OVERRIDES_SHEET — optional; manual co-list tab name (default IdxCoList)
 *   IDX_DETAILS_BASE_URL — optional; base for relative fullDetailsURL (default search.alexstoykovgroup.com)
 *   LISTINGS_SPREADSHEET_ID — same workbook as Listing Hub
 *
 * Run once: installIdxFastSyncTrigger()
 *   - every 1 minute: checkIdxForUpdates() (cheap signature check, syncs only on change)
 *   - every 1 hour:   syncIdxListingsToSheet() (forced full sync, safety net)
 *
 * Legacy: installIdxSyncTrigger() installs a single 15-minute full-sync trigger.
 *
 * Manual:
 *   syncIdxListingsToSheet()  or POST { action: "syncidx",  secret }
 *   checkIdxForUpdates()      or POST { action: "checkidx", secret }
 */

var IDX_SYNC_DEFAULT_SHEET = 'IdxListings';
var IDX_OPENHOUSES_DEFAULT_SHEET = 'IdxOpenHouses';
var IDX_COLIST_OVERRIDES_DEFAULT_SHEET = 'IdxCoList';
var IDX_API_BASE = 'https://api.idxbroker.com/clients/';
var IDX_MLS_API_BASE = 'https://api.idxbroker.com/mls/';
var IDX_SHEET_JSON_MAX_CHARS = 49000;
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

function idxApiHeaders_() {
  var version = trim_(PropertiesService.getScriptProperties().getProperty('IDX_API_VERSION')) || '1.8';
  var ancillary = trim_(PropertiesService.getScriptProperties().getProperty('IDX_ANCILLARY_KEY'));
  var headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    accesskey: getIdxAccessKey_(),
    outputtype: 'json',
    apiversion: version
  };
  if (ancillary) headers.ancillarykey = ancillary;
  return headers;
}

function idxApiRequest_(methodPath) {
  var url = IDX_API_BASE + String(methodPath || '').replace(/^\//, '');
  return idxHttpJson_(url);
}

function idxMlsApiRequest_(methodPath) {
  var url = IDX_MLS_API_BASE + String(methodPath || '').replace(/^\//, '');
  return idxHttpJson_(url);
}

function idxHttpJson_(url) {
  var res = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: idxApiHeaders_()
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

/** Compact listing JSON for sheet cells (Google Sheets caps ~50k chars/cell). */
function idxCompactListingJsonForSheet_(L) {
  if (!L || typeof L !== 'object') return '{}';
  var copy = JSON.parse(JSON.stringify(L));
  if (copy.image && typeof copy.image === 'object') {
    copy.image = { totalCount: copy.image.totalCount || '' };
  }
  if (copy.mediaData) delete copy.mediaData;
  var s = JSON.stringify(copy);
  if (s.length <= IDX_SHEET_JSON_MAX_CHARS) return s;
  var slim = {
    listingID: copy.listingID || copy.listingId || '',
    idxID: copy.idxID || copy.idxId || '',
    address: copy.address || copy.displayAddress || '',
    listingAgentID: copy.listingAgentID || '',
    coListAgentID: copy.coListAgentID || '',
    coListAgentName: copy.coListAgentName || '',
    propStatus: copy.propStatus || copy.idxStatus || '',
    listingPrice: copy.listingPrice || copy.price || '',
    fullDetailsURL: copy.fullDetailsURL || copy.detailsURL || '',
    advanced: copy.advanced || {}
  };
  s = JSON.stringify(slim);
  if (s.length <= IDX_SHEET_JSON_MAX_CHARS) return s;
  return s.slice(0, IDX_SHEET_JSON_MAX_CHARS) + '…';
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

// ---------------------------------------------------------------------------
// Flatten IDX listing JSON into one-column-per-field so the IdxListings sheet
// is human-browsable. Object trees become dot-notation keys (e.g.
// `advanced.subdivisionName`). Arrays of scalars are joined; arrays of objects
// are JSON-stringified (truncated). `image` and `mediaData` are huge / opaque,
// so we summarize them instead of exploding every photo into a column.
// ---------------------------------------------------------------------------

var IDX_FLAT_CORE_HEADERS = [
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
  'Co List Agent ID',
  'Co List Agent Name'
];

// Surfaced first (in this order) when present in the data.
var IDX_FLAT_PRIORITY_KEYS = [
  'idxID',
  'listingID',
  'mlsNumber',
  'propStatus',
  'idxStatus',
  'listingPrice',
  'price',
  'propType',
  'propertyType',
  'propSubType',
  'bedrooms',
  'totalBaths',
  'fullBaths',
  'partialBaths',
  'sqFt',
  'acres',
  'yearBuilt',
  'address',
  'displayAddress',
  'streetNumber',
  'streetDirection',
  'streetName',
  'streetSuffix',
  'unitNumber',
  'cityName',
  'county',
  'state',
  'zipcode',
  'latitude',
  'longitude',
  'listingAgentID',
  'listingAgentName',
  'listingAgentEmail',
  'coListAgentID',
  'coListAgentId',
  'coListingAgentID',
  'coListAgentName',
  'coListingAgentName',
  'CoListAgentMlsId',
  'CoListAgentFullName',
  'listingOfficeName',
  'listingOfficeID',
  'listDate',
  'listingDate',
  'soldDate',
  'daysOnMarket',
  'cumulativeDaysOnMarket',
  'remarksConcat',
  'fullDetailsURL',
  'detailsURL',
  'ohCount',
  'image.totalCount',
  'image.firstUrl',
  'mediaData.vt.url'
];

var IDX_FLAT_MAX_CELL_CHARS = 5000;

function idxFlattenValue_(out, key, val) {
  if (val === null || val === undefined) return;
  var t = typeof val;
  if (t === 'string' || t === 'number' || t === 'boolean') {
    var s = String(val);
    if (s.length > IDX_FLAT_MAX_CELL_CHARS) s = s.slice(0, IDX_FLAT_MAX_CELL_CHARS) + '…';
    out[key] = s;
    return;
  }
  if (Object.prototype.toString.call(val) === '[object Array]') {
    if (!val.length) return;
    var allScalar = true;
    var i;
    for (i = 0; i < val.length; i++) {
      var et = typeof val[i];
      if (et !== 'string' && et !== 'number' && et !== 'boolean') {
        allScalar = false;
        break;
      }
    }
    if (allScalar) {
      var joined = val.join('; ');
      if (joined.length > IDX_FLAT_MAX_CELL_CHARS) joined = joined.slice(0, IDX_FLAT_MAX_CELL_CHARS) + '…';
      out[key] = joined;
    } else {
      var j = JSON.stringify(val);
      if (j.length > IDX_FLAT_MAX_CELL_CHARS) j = j.slice(0, IDX_FLAT_MAX_CELL_CHARS) + '…';
      out[key] = j;
    }
    return;
  }
  if (t === 'object') {
    var k;
    for (k in val) {
      if (!val.hasOwnProperty(k)) continue;
      idxFlattenValue_(out, key + '.' + k, val[k]);
    }
  }
}

function idxSummarizeImageField_(out, image) {
  if (!image || typeof image !== 'object') return;
  var count = 0;
  var firstUrl = '';
  var k;
  for (k in image) {
    if (!image.hasOwnProperty(k)) continue;
    if (k === 'totalCount') {
      out['image.totalCount'] = String(image[k]);
      continue;
    }
    var entry = image[k];
    if (entry && entry.url) {
      count++;
      if (!firstUrl) firstUrl = String(entry.url);
    }
  }
  if (count && out['image.totalCount'] === undefined) out['image.totalCount'] = String(count);
  if (firstUrl) out['image.firstUrl'] = firstUrl;
}

function idxSummarizeMediaDataField_(out, mediaData) {
  if (!mediaData || typeof mediaData !== 'object') return;
  if (mediaData.vt) {
    var vt = mediaData.vt;
    var url = '';
    if (Object.prototype.toString.call(vt) === '[object Array]' && vt[0]) url = vt[0].url || '';
    else if (typeof vt === 'object') url = vt.url || '';
    if (url) out['mediaData.vt.url'] = String(url);
  }
}

function idxFlattenListing_(L) {
  var out = {};
  if (!L || typeof L !== 'object') return out;
  var k;
  for (k in L) {
    if (!L.hasOwnProperty(k)) continue;
    if (k === 'image') {
      idxSummarizeImageField_(out, L[k]);
      continue;
    }
    if (k === 'mediaData') {
      idxSummarizeMediaDataField_(out, L[k]);
      continue;
    }
    idxFlattenValue_(out, k, L[k]);
  }
  return out;
}

/**
 * Build the ordered list of flat-JSON column headers seen across all listings.
 * Priority keys come first, then `advanced.*` (MRED extras) alphabetically,
 * then everything else alphabetically.
 */
function idxBuildFlatHeaderList_(flatRows) {
  var seen = {};
  var all = {};
  var i, k;
  for (i = 0; i < flatRows.length; i++) {
    for (k in flatRows[i]) {
      if (flatRows[i].hasOwnProperty(k)) all[k] = true;
    }
  }
  var ordered = [];
  var p;
  for (p = 0; p < IDX_FLAT_PRIORITY_KEYS.length; p++) {
    var pk = IDX_FLAT_PRIORITY_KEYS[p];
    if (all[pk] && !seen[pk]) {
      ordered.push(pk);
      seen[pk] = true;
    }
  }
  var advanced = [];
  var other = [];
  for (k in all) {
    if (!all.hasOwnProperty(k) || seen[k]) continue;
    if (k.indexOf('advanced.') === 0) advanced.push(k);
    else other.push(k);
  }
  advanced.sort();
  other.sort();
  return ordered.concat(other).concat(advanced);
}

function idxBuildCoreRowValues_(entry, syncedAt, flat) {
  var L = entry.listing || {};
  var address =
    trim_(L.address) ||
    [trim_(L.streetNumber), trim_(L.streetName), trim_(L.cityName), trim_(L.state), trim_(L.zipcode)]
      .filter(Boolean)
      .join(' ');
  var oh = idxExtractOpenHouseInfo_(L);
  var co = idxExtractCoListAgent_(L, flat);
  if (co.id && !co.name) {
    try {
      var mredMap = buildDirectoryMredToNameMap_();
      if (mredMap[co.id]) co.name = mredMap[co.id];
    } catch (eDir) {}
  }
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
    co.id,
    co.name
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

var IDX_MARKETING_SHEET_NAME = 'Marketing';
var IDX_MICROSITES_SHEET_NAME = 'Microsites';
var IDX_MARKETING_HEADERS = [
  'idx_key',
  'feed',
  'listing_id',
  'mls_number',
  'address',
  'address_key',
  'status',
  'price',
  'agent_name',
  'co_list_agent',
  'deal_stage',
  'listing_type',
  'photos_status',
  'photos_url',
  'photos_delivered_at',
  'matterport_status',
  'matterport_url',
  'matterport_delivered_at',
  'floor_plan_status',
  'floor_plan_url',
  'floor_plan_delivered_at',
  'video_status',
  'video_url',
  'video_delivered_at',
  'fact_sheet_status',
  'fact_sheet_url',
  'fact_sheet_requested_at',
  'fact_sheet_delivered_at',
  'open_house_materials_status',
  'open_house_materials_url',
  'open_house_materials_requested_at',
  'open_house_materials_delivered_at',
  'seller_questionnaire_status',
  'seller_questionnaire_sent_at',
  'seller_questionnaire_received_at',
  'seller_questionnaire_content',
  'seller_questionnaire_answers',
  'seller_questionnaire_form_id',
  'seller_questionnaire_message_id',
  'seller_questionnaire_last_sync_at',
  'seller_name',
  'seller_email',
  'seller_phone',
  'seller_questionnaire_fields_json',
  'seller_first_name',
  'seller_last_name',
  'property_type',
  'unit_number',
  'bedrooms',
  'bathrooms',
  'parking',
  'storage',
  'hoa_assessment',
  'rental_restrictions',
  'lockbox_info',
  'showing_instructions',
  'preferred_timing',
  'marketing_status',
  'marketing_requests',
  'notes',
  'last_updated_at',
  'last_updated_by',
  'synced_at'
];
var IDX_MICROSITE_HEADERS = [
  'idx_key',
  'feed',
  'listing_id',
  'mls_number',
  'address',
  'address_key',
  'status',
  'price',
  'agent_name',
  'co_list_agent',
  'microsite_slug',
  'microsite_status',
  'microsite_template',
  'published_url',
  'squarespace_page_url',
  'squarespace_embed_html',
  'microsite_headline',
  'microsite_subheadline',
  'microsite_overview',
  'microsite_neighborhood',
  'microsite_lat',
  'microsite_lng',
  'hero_image_url',
  'gallery_source',
  'gallery_folder_url',
  'gallery_json',
  'video_url',
  'matterport_url',
  'floor_plan_url',
  'compass_link',
  'microsite_highlights_json',
  'microsite_details_json',
  'microsite_curated_places_json',
  'microsite_seo_title',
  'microsite_seo_description',
  'microsite_og_image_url',
  'publish_ready',
  'missing_assets',
  'last_previewed_at',
  'last_published_at',
  'synced_at'
];
var IDX_OVERLAY_SYNC_FIELDS = {
  idx_key: true,
  feed: true,
  listing_id: true,
  mls_number: true,
  address: true,
  address_key: true,
  status: true,
  price: true,
  agent_name: true,
  co_list_agent: true,
  synced_at: true
};

function idxEnsureOverlaySheet_(name, headers) {
  var ss = getListingsSpreadsheet_();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  var lastCol = Math.max(1, sh.getLastColumn());
  var existing = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h || '').trim();
  });
  var headerSet = {};
  var i;
  for (i = 0; i < existing.length; i++) {
    if (existing[i]) headerSet[existing[i].toLowerCase()] = true;
  }

  if (!existing.some(function (h) { return !!h; })) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  } else {
    var missing = [];
    for (i = 0; i < headers.length; i++) {
      if (!headerSet[String(headers[i]).toLowerCase()]) missing.push(headers[i]);
    }
    if (missing.length) {
      sh.getRange(1, sh.getLastColumn() + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
    }
  }
  sh.setFrozenRows(1);
  return sh;
}

function idxOverlayHeaderIndex_(headers) {
  var out = {};
  var i;
  for (i = 0; i < headers.length; i++) {
    out[String(headers[i] || '').trim().toLowerCase()] = i;
  }
  return out;
}

function idxOverlayValue_(row, idx, key) {
  var i = idx[String(key || '').toLowerCase()];
  return i == null ? '' : trim_(row[i]);
}

function idxOverlayRowKeyCandidates_(row, idx) {
  var identityKeys = [
    'idx_key|' + idxOverlayValue_(row, idx, 'idx_key'),
    'listing_id|' + idxOverlayValue_(row, idx, 'listing_id'),
    'mls_number|' + idxOverlayValue_(row, idx, 'mls_number')
  ].filter(function (key) {
    return !/\|$/.test(key);
  });
  if (identityKeys.length) return identityKeys;
  return ['address_key|' + idxOverlayValue_(row, idx, 'address_key')].filter(function (key) {
    return !/\|$/.test(key);
  });
}

function idxBuildOverlayRowMap_(values, idx) {
  var map = {};
  var r, keys, k;
  for (r = 1; r < values.length; r++) {
    keys = idxOverlayRowKeyCandidates_(values[r], idx);
    for (k = 0; k < keys.length; k++) {
      if (!map[keys[k]]) map[keys[k]] = r;
    }
  }
  return map;
}

function idxOverlayEntryKeyCandidates_(entry, base) {
  return [
    'idx_key|' + trim_(base.idx_key),
    'listing_id|' + trim_(base.listing_id),
    'mls_number|' + trim_(base.mls_number),
    'address_key|' + trim_(base.address_key)
  ].filter(function (key) {
    return !/\|$/.test(key);
  });
}

function idxFindOverlayRow_(rowMap, entry, base) {
  var keys = [
    'idx_key|' + trim_(base.idx_key),
    'listing_id|' + trim_(base.listing_id),
    'mls_number|' + trim_(base.mls_number)
  ].filter(function (key) {
    return !/\|$/.test(key);
  });
  var i, addressKey;
  for (i = 0; i < keys.length; i++) {
    if (rowMap[keys[i]] != null) return rowMap[keys[i]];
  }
  if (idxSheetStatusLooksClosed_(base.status)) return -1;
  addressKey = 'address_key|' + trim_(base.address_key);
  if (!/\|$/.test(addressKey) && rowMap[addressKey] != null) return rowMap[addressKey];
  return -1;
}

function idxSlugify_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/#/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function idxDefaultDealStage_(status) {
  var key = normalizeStatusKey_(status);
  if (!key) return 'Live';
  if (key.indexOf('sold') >= 0 || key.indexOf('closed') >= 0) return 'Closed';
  if (key.indexOf('under') >= 0 && key.indexOf('contract') >= 0) return 'Under Contract';
  if (key.indexOf('pending') >= 0) return 'Under Contract';
  if (key.indexOf('cancel') >= 0 || key.indexOf('withdraw') >= 0 || key.indexOf('expired') >= 0) return 'Closed';
  return 'Live';
}

function idxDefaultListingType_(listing) {
  var type = String(
    (listing && (listing.propSubType || listing.propertySubType || listing.propType || listing.propertyType)) || ''
  ).toLowerCase();
  return type.indexOf('rent') >= 0 || type.indexOf('lease') >= 0 ? 'Rental' : 'Sale';
}

function idxBuildOverlayBase_(entry, flat, syncedAt, mredMap) {
  var L = entry.listing || {};
  var address =
    trim_(L.address) ||
    [trim_(L.streetNumber), trim_(L.streetName), trim_(L.cityName), trim_(L.state), trim_(L.zipcode)]
      .filter(Boolean)
      .join(' ');
  var co = idxExtractCoListAgent_(L, flat || {});
  if (co.id && !co.name && mredMap && mredMap[co.id]) co.name = mredMap[co.id];
  var primaryAgentId = trim_(L.listingAgentID || L.listingAgentId || L.agentID || '');
  var primaryAgentName = trim_(L.listingAgentName || L.agentName || '');
  var agentName = (primaryAgentId && mredMap && mredMap[primaryAgentId]) || co.name || primaryAgentName;
  var status = trim_(L.propStatus || L.idxStatus || L.status || '');
  var listingId = trim_(L.listingID || L.listingId || '');
  var mlsNumber = trim_(L.mlsNumber || L.mls_number || listingId);

  return {
    idx_key: trim_(entry.idxKey),
    feed: trim_(entry.feed),
    listing_id: listingId,
    mls_number: mlsNumber,
    address: address,
    address_key: idxNormalizeAddressForMatch_(address) || normalizeAddress_(address),
    status: status,
    price: trim_(L.listingPrice || L.price || ''),
    agent_name: agentName,
    co_list_agent: co.name,
    synced_at: syncedAt
  };
}

function idxBuildMarketingDefaults_(base, entry) {
  return {
    deal_stage: idxDefaultDealStage_(base.status),
    listing_type: idxDefaultListingType_((entry && entry.listing) || {}),
    photos_status: 'Not Booked',
    matterport_status: 'Not Booked',
    floor_plan_status: 'Not Booked',
    video_status: 'Not Booked',
    fact_sheet_status: 'Not Requested',
    open_house_materials_status: 'Not Requested',
    seller_questionnaire_status: 'Pending',
    marketing_status: 'Not Started'
  };
}

function idxBuildMicrositeDefaults_(base, entry) {
  var L = (entry && entry.listing) || {};
  var hero = '';
  if (L.image && typeof L.image === 'object') {
    hero = trim_(L.image.url || L.image.firstUrl || L.image[0] && L.image[0].url || '');
  }
  return {
    microsite_slug: idxSlugify_(base.address || base.listing_id || base.idx_key),
    microsite_status: 'Draft',
    microsite_template: 'default',
    microsite_headline: base.address,
    microsite_neighborhood: trim_(L.neighborhood || L.subdivisionName || L.community || ''),
    microsite_lat: trim_(L.latitude || L.lat || ''),
    microsite_lng: trim_(L.longitude || L.lng || L.lon || ''),
    hero_image_url: hero,
    gallery_source: 'Drive',
    compass_link: trim_(L.fullDetailsURL || L.detailsURL || L.listingURL || ''),
    publish_ready: 'No',
    missing_assets: 'Needs review'
  };
}

function idxUpsertOverlaySheet_(sheetName, headers, items, flatRows, syncedAt, defaultsFactory) {
  var sh = idxEnsureOverlaySheet_(sheetName, headers);
  var values = sh.getDataRange().getValues();
  var existingHeaders = values[0].map(function (h) { return String(h || '').trim(); });
  var idx = idxOverlayHeaderIndex_(existingHeaders);
  var rowMap = idxBuildOverlayRowMap_(values, idx);
  var mredMap = {};
  try {
    mredMap = buildDirectoryMredToNameMap_();
  } catch (e) {}

  var created = 0;
  var updated = 0;
  var appended = [];
  var i, base, targetRow, row, defaults, h, key, col;

  for (i = 0; i < items.length; i++) {
    base = idxBuildOverlayBase_(items[i], flatRows[i], syncedAt, mredMap);
    if (!base.idx_key && !base.listing_id && !base.address_key) continue;

    targetRow = idxFindOverlayRow_(rowMap, items[i], base);
    if (targetRow >= 0) {
      for (key in IDX_OVERLAY_SYNC_FIELDS) {
        if (!IDX_OVERLAY_SYNC_FIELDS.hasOwnProperty(key)) continue;
        col = idx[key];
        if (col == null) continue;
        if (String(values[targetRow][col] || '') !== String(base[key] || '')) {
          sh.getRange(targetRow + 1, col + 1).setValue(base[key] || '');
        }
      }
      updated++;
      continue;
    }

    defaults = defaultsFactory(base, items[i]) || {};
    row = new Array(existingHeaders.length);
    for (h = 0; h < existingHeaders.length; h++) {
      key = String(existingHeaders[h] || '').trim();
      row[h] = base[key] != null ? base[key] : (defaults[key] != null ? defaults[key] : '');
    }
    appended.push(row);
    created++;
  }

  if (appended.length) {
    sh.getRange(sh.getLastRow() + 1, 1, appended.length, existingHeaders.length).setValues(appended);
  }

  return { sheet: sheetName, created: created, updated: updated };
}

/** Listings-tab asset URLs → Marketing tab columns (address-matched). */
var LISTINGS_TO_MARKETING_LINK_FIELDS_ = [
  { listingKey: 'photos', marketingKey: 'photos_url' },
  { listingKey: 'matterport', marketingKey: 'matterport_url' },
  { listingKey: 'floorPlan', marketingKey: 'floor_plan_url' },
  { listingKey: 'video', marketingKey: 'video_url' },
  { listingKey: 'factSheet', marketingKey: 'fact_sheet_url' },
  { listingKey: 'openHouseMaterialsUrl', marketingKey: 'open_house_materials_url' }
];
var LISTINGS_TO_MARKETING_STATUS_FIELDS_ = [
  { listingKey: 'photosStatus', marketingKey: 'photos_status' },
  { listingKey: 'photosDeliveredAt', marketingKey: 'photos_delivered_at' },
  { listingKey: 'matterportStatus', marketingKey: 'matterport_status' },
  { listingKey: 'matterportDeliveredAt', marketingKey: 'matterport_delivered_at' },
  { listingKey: 'floorPlanStatus', marketingKey: 'floor_plan_status' },
  { listingKey: 'floorPlanDeliveredAt', marketingKey: 'floor_plan_delivered_at' },
  { listingKey: 'videoStatus', marketingKey: 'video_status' },
  { listingKey: 'videoDeliveredAt', marketingKey: 'video_delivered_at' },
  { listingKey: 'factSheetStatus', marketingKey: 'fact_sheet_status' },
  { listingKey: 'factSheetRequestedAt', marketingKey: 'fact_sheet_requested_at' },
  { listingKey: 'factSheetDeliveredAt', marketingKey: 'fact_sheet_delivered_at' },
  { listingKey: 'openHouseMaterialsStatus', marketingKey: 'open_house_materials_status' },
  { listingKey: 'openHouseMaterialsRequestedAt', marketingKey: 'open_house_materials_requested_at' },
  { listingKey: 'openHouseMaterialsDeliveredAt', marketingKey: 'open_house_materials_delivered_at' }
];

function idxListingMarketingLinkValues_(listing) {
  var out = {};
  var i, spec, val;
  for (i = 0; i < LISTINGS_TO_MARKETING_LINK_FIELDS_.length; i++) {
    spec = LISTINGS_TO_MARKETING_LINK_FIELDS_[i];
    val = trim_(listing[spec.listingKey]);
    if (val) out[spec.marketingKey] = val;
  }
  return out;
}

function idxListingHasMarketingLinks_(listing) {
  var links = idxListingMarketingLinkValues_(listing);
  var k;
  for (k in links) {
    if (links.hasOwnProperty(k)) return true;
  }
  return false;
}

function idxFindMarketingRowForListing_(marketingValues, marketingIdx, listing) {
  if (!marketingValues || marketingValues.length < 2 || !listing) return -1;

  var rowMap = idxBuildOverlayRowMap_(marketingValues, marketingIdx);
  var fakeBase = {
    idx_key: trim_(listing.idxKey),
    listing_id: trim_(listing.listingId),
    mls_number: trim_(listing.mlsNumber),
    address_key: trim_(listing.addressKey) || idxNormalizeAddressForMatch_(listing.address)
  };
  var targetRow = idxFindOverlayRow_(rowMap, { listing: {} }, fakeBase);
  if (targetRow >= 0) return targetRow;

  var target = idxNormalizeAddressForMatch_(listing.address);
  var legacy = normalizeAddress_(listing.address);
  var addressCol = marketingIdx['address'];
  var bestRow = -1;
  var bestScore = 0;
  var r, addr, score;
  for (r = 1; r < marketingValues.length; r++) {
    if (addressCol == null) break;
    addr = trim_(marketingValues[r][addressCol]);
    if (!addr) continue;
    score = Math.max(
      idxAddressMatchScore_(target, idxNormalizeAddressForMatch_(addr)),
      idxAddressMatchScore_(legacy, normalizeAddress_(addr))
    );
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }
  return bestScore >= 0.78 ? bestRow : -1;
}

/**
 * Copy marketing asset links from the Listings tab into matching Marketing rows.
 *
 * @param {Object=} options
 * @param {boolean=} options.onlyEmpty When true, only fill blank Marketing cells (default).
 * @param {boolean=} options.includeStatus Also copy status / delivered timestamps (default true).
 */
function syncListingsLinksToMarketingTab_(options) {
  options = options || {};
  var onlyEmpty = options.onlyEmpty !== false;
  var includeStatus = options.includeStatus !== false;

  var listingsSh = getListingsSheet_();
  var marketingSh = getOptionalOverlaySheet_(IDX_MARKETING_SHEET_NAME);
  if (!listingsSh) throw new Error('Listings sheet not found');
  if (!marketingSh) throw new Error('Marketing sheet not found');

  var listingValues = listingsSh.getDataRange().getValues();
  var marketingValues = marketingSh.getDataRange().getValues();
  if (listingValues.length < 2) {
    return { scanned: 0, withLinks: 0, matched: 0, updated: 0, cellsWritten: 0, unmatched: [] };
  }
  if (marketingValues.length < 2) {
    return { scanned: 0, withLinks: 0, matched: 0, updated: 0, cellsWritten: 0, unmatched: [], warning: 'Marketing tab has no data rows yet — run syncIdxListingsToSheet() first.' };
  }

  var listingHeaders = listingValues[0];
  var marketingHeaders = marketingValues[0].map(function (h) { return String(h || '').trim(); });
  var marketingIdx = idxOverlayHeaderIndex_(marketingHeaders);
  var now = new Date().toISOString();
  var lastUpdatedCol = marketingIdx['last_updated_at'];
  var lastUpdatedByCol = marketingIdx['last_updated_by'];

  var scanned = 0;
  var withLinks = 0;
  var matched = 0;
  var updated = 0;
  var cellsWritten = 0;
  var unmatched = [];
  var r, c, row, has, rec, listing, targetRow, links, fields, i, spec, col, current, nextVal, rowUpdated;

  for (r = 1; r < listingValues.length; r++) {
    row = listingValues[r];
    has = false;
    for (c = 0; c < row.length; c++) {
      if (String(row[c] || '').trim()) { has = true; break; }
    }
    if (!has) continue;
    scanned++;

    rec = {};
    for (c = 0; c < listingHeaders.length; c++) {
      rec[String(listingHeaders[c] || '').trim()] = row[c];
    }
    listing = mapRecordToListing_(rec);
    if (!trim_(listing.address)) continue;
    if (!idxListingHasMarketingLinks_(listing)) continue;
    withLinks++;

    links = idxListingMarketingLinkValues_(listing);
    targetRow = idxFindMarketingRowForListing_(marketingValues, marketingIdx, listing);
    if (targetRow < 0) {
      unmatched.push({
        address: listing.address,
        links: links
      });
      continue;
    }
    matched++;
    rowUpdated = false;
    fields = LISTINGS_TO_MARKETING_LINK_FIELDS_.slice(0);
    if (includeStatus) {
      fields = fields.concat(LISTINGS_TO_MARKETING_STATUS_FIELDS_);
    }

    for (i = 0; i < fields.length; i++) {
      spec = fields[i];
      nextVal = trim_(listing[spec.listingKey]);
      if (!nextVal) continue;
      col = marketingIdx[String(spec.marketingKey).toLowerCase()];
      if (col == null) continue;
      current = trim_(marketingValues[targetRow][col]);
      if (onlyEmpty && current) continue;
      if (current === nextVal) continue;
      marketingSh.getRange(targetRow + 1, col + 1).setValue(nextVal);
      marketingValues[targetRow][col] = nextVal;
      cellsWritten++;
      rowUpdated = true;
    }

    if (rowUpdated) {
      if (lastUpdatedCol != null) {
        marketingSh.getRange(targetRow + 1, lastUpdatedCol + 1).setValue(now);
        marketingValues[targetRow][lastUpdatedCol] = now;
      }
      if (lastUpdatedByCol != null) {
        marketingSh.getRange(targetRow + 1, lastUpdatedByCol + 1).setValue('Listings tab link sync');
        marketingValues[targetRow][lastUpdatedByCol] = 'Listings tab link sync';
      }
      updated++;
    }
  }

  if (cellsWritten) invalidateListingsActiveCache_();

  return {
    scanned: scanned,
    withLinks: withLinks,
    matched: matched,
    updated: updated,
    cellsWritten: cellsWritten,
    onlyEmpty: onlyEmpty,
    unmatched: unmatched
  };
}

/** Run once from the Apps Script editor to migrate all Listings links into Marketing. */
function migrateListingsLinksToMarketingTab() {
  var result = syncListingsLinksToMarketingTab_({ onlyEmpty: false, includeStatus: true });
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function syncIdxOverlayTabs_(items, flatRows, syncedAt) {
  var marketing = idxUpsertOverlaySheet_(
    IDX_MARKETING_SHEET_NAME,
    IDX_MARKETING_HEADERS,
    items,
    flatRows,
    syncedAt,
    idxBuildMarketingDefaults_
  );
  var microsites = idxUpsertOverlaySheet_(
    IDX_MICROSITES_SHEET_NAME,
    IDX_MICROSITE_HEADERS,
    items,
    flatRows,
    syncedAt,
    idxBuildMicrositeDefaults_
  );
  var listingsLinks = syncListingsLinksToMarketingTab_({ onlyEmpty: true, includeStatus: true });
  return {
    marketing: marketing,
    microsites: microsites,
    listingsLinks: listingsLinks
  };
}

/**
 * Pull featured + sold/pending + supplemental from IDX into the IdxListings tab.
 *
 * Every field in each listing's MLS JSON is exploded into its own column
 * (dot-notation for nested objects, e.g. `advanced.subdivisionName`). The
 * column set is rebuilt on every sync from the union of fields seen across
 * all listings, so new MRED fields surface automatically. A final `Raw JSON`
 * column preserves the untouched source so downstream enrichment still works.
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
  var syncedAt = started.toISOString();

  var coListOverrides = idxApplyCoListOverridesToItems_(items);
  var coListWorkflow = idxApplyWorkflowCoListToItems_(items);
  var coListApi = idxEnrichCoListFromApiDetails_(items);
  var coListEnrich = idxEnrichCoListFromDetailPages_(items);
  var flatRows = [];
  var i;
  for (i = 0; i < items.length; i++) {
    flatRows.push(idxFlattenListing_(items[i].listing || {}));
  }
  var flatHeaders = idxBuildFlatHeaderList_(flatRows);
  var headers = IDX_FLAT_CORE_HEADERS.concat(flatHeaders).concat(['Raw JSON']);

  var ss = getListingsSpreadsheet_();
  var sheetName = getIdxSyncSheetName_();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);

  // Column count is dynamic run-to-run, so wipe everything and rewrite headers.
  sh.clear();
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);

  var rows = [];
  for (i = 0; i < items.length; i++) {
    var row = idxBuildCoreRowValues_(items[i], syncedAt, flatRows[i]);
    var flat = flatRows[i];
    var h;
    for (h = 0; h < flatHeaders.length; h++) {
      var v = flat[flatHeaders[h]];
      row.push(v === undefined ? '' : v);
    }
    row.push(idxCompactListingJsonForSheet_(items[i].listing || {}));
    rows.push(row);
  }
  if (rows.length) {
    sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  var openHouseRows = syncIdxOpenHousesSheet_(items, syncedAt);
  var overlayTabs = syncIdxOverlayTabs_(items, flatRows, syncedAt);

  PropertiesService.getScriptProperties().setProperty('IDX_SYNC_LAST_AT', syncedAt);
  PropertiesService.getScriptProperties().setProperty('IDX_SYNC_LAST_COUNT', String(rows.length));
  PropertiesService.getScriptProperties().setProperty('IDX_OPENHOUSES_LAST_COUNT', String(openHouseRows));
  // Rebuild the list caches now (instead of leaving them cold for the next
  // site visitor to recompute, which used to cost that visitor ~5s).
  try {
    warmListingsCaches();
  } catch (eWarm) {
    invalidateListingsActiveCache_();
  }

  return {
    success: true,
    sheet: sh.getName(),
    openHousesSheet: getIdxOpenHousesSheetName_(),
    openHouseRows: openHouseRows,
    overlayTabs: overlayTabs,
    count: rows.length,
    syncedAt: syncedAt,
    feeds: ['featured', 'soldpending', 'supplemental', 'savedlinks'],
    feedStats: feedStats,
    durationMs: new Date().getTime() - started.getTime(),
    coListOverrides: coListOverrides,
    coListWorkflowFill: coListWorkflow,
    coListApiEnrich: coListApi,
    coListDetailEnrich: coListEnrich,
    hint:
      rows.length === 0
        ? 'IDX API connected but returned 0 listings. Run testIdxSyncProbe() and confirm Featured IDs + active listings on search.alexstoykovgroup.com.'
        : coListEnrich && coListEnrich.remaining > 0
          ? 'Co-list columns may still be filling: run sync again, add rows to IdxCoList tab (MRED/Compass), or enrichIdxCoListFromDetails() (' +
            coListEnrich.remaining +
            ' left). Overrides applied ' +
            (coListOverrides && coListOverrides.applied ? coListOverrides.applied : 0) +
            '; workflow filled ' +
            (coListWorkflow && coListWorkflow.filled ? coListWorkflow.filled : 0) +
            ' from Listings tab + Directory.'
          : (coListOverrides && coListOverrides.applied
              ? 'Co-list overrides applied from IdxCoList: ' + coListOverrides.applied + ' listing(s).'
              : '')
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
    coListAgentId: idx['co list agent id'],
    coListAgentName: idx['co list agent name'],
    rawJson: idx['raw json'],
    imageFirstUrl: idx['image.firsturl'],
    listingAgentId: idx['listingagentid'] !== undefined ? idx['listingagentid'] :
      (idx['listing agent id'] !== undefined ? idx['listing agent id'] : idx['listingagentmlsid'])
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
 * Parse one IdxListings sheet row into an IDX entry object.
 */
function idxBuildEntryFromSheetRow_(row, col) {
  var addr = trim_(idxCell_(row, col.address));
  if (!addr) return null;
  var norm = idxNormalizeAddressForMatch_(addr);
  if (!norm) return null;
  var L = idxParseListingJson_(idxCell_(row, col.rawJson));
  return {
    norm: norm,
    coreKey: idxAddressCoreKey_(addr),
    address: addr,
    feed: trim_(idxCell_(row, col.feed)),
    listingId: trim_(idxCell_(row, col.listingId)),
    sheetStatus: trim_(idxCell_(row, col.status)),
    sheetPrice: trim_(idxCell_(row, col.price)),
    ohCount: trim_(idxCell_(row, col.ohCount)),
    nextOhDate: trim_(idxCell_(row, col.nextOhDate)),
    nextOhStart: trim_(idxCell_(row, col.nextOhStart)),
    nextOhEnd: trim_(idxCell_(row, col.nextOhEnd)),
    syncedAt: trim_(idxCell_(row, col.syncedAt)),
    sheetListingAgentId: trim_(idxCell_(row, col.listingAgentId)),
    sheetCoListAgentId: trim_(idxCell_(row, col.coListAgentId)),
    sheetCoListAgentName: trim_(idxCell_(row, col.coListAgentName)),
    sheetImageFirstUrl: trim_(idxCell_(row, col.imageFirstUrl)),
    listing: L
  };
}

/** True when IdxListings sheet status column indicates closed/sold (skip JSON parse). */
function idxSheetStatusLooksClosed_(status) {
  return isClosedListing_({ status: status, archived: false });
}

/**
 * All IDX listings from the IdxListings tab (deduped by MLS/listing id, then
 * normalized address). This is the canonical inventory for the dashboard API.
 *
 * options.activeOnly — skip sold/pending feed rows and closed sheet statuses
 *   (fast path for dashboard view=active; avoids parsing ~1k Raw JSON cells).
 */
function readAllIdxListingEntries_(options) {
  options = options || {};
  var sh = getIdxListingsSheetReadOnly_();
  if (!sh || sh.getLastRow() < 2) return [];

  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var col = idxSheetHeaderIndex_(headers);
  if (col.address === undefined) return [];

  var byKey = {};
  var r, row, entry, dedupeKey, existing, feed, sheetStatus;
  for (r = 1; r < values.length; r++) {
    row = values[r];
    if (options.activeOnly) {
      if (col.feed !== undefined && col.feed >= 0) {
        feed = String(row[col.feed] || '').toLowerCase();
        if (feed === 'soldpending') continue;
      }
      if (col.status !== undefined && col.status >= 0) {
        sheetStatus = trim_(row[col.status]);
        if (sheetStatus && idxSheetStatusLooksClosed_(sheetStatus)) continue;
      }
    }
    entry = idxBuildEntryFromSheetRow_(row, col);
    if (!entry) continue;
    dedupeKey = trim_(entry.listingId).replace(/\D/g, '') || entry.norm;
    if (!dedupeKey) continue;
    existing = byKey[dedupeKey];
    if (!existing || idxFeedPriority_(entry.feed) > idxFeedPriority_(existing.feed)) {
      byKey[dedupeKey] = entry;
    }
  }
  var out = [];
  for (var k in byKey) {
    if (byKey.hasOwnProperty(k)) out.push(byKey[k]);
  }
  return out;
}

/**
 * Build address → best IDX row (prefers featured over sold/pending for same address).
 */
function buildIdxListingsAddressMap_() {
  var map = {};
  var list = readAllIdxListingEntries_();
  var i, entry;
  for (i = 0; i < list.length; i++) {
    entry = list[i];
    if (!entry || !entry.norm) continue;
    map[entry.norm] = entry;
  }
  return map;
}

/**
 * Full normalized address for matching (includes unit, street type).
 * Unit forms: #15A, Unit #1612, unit 1612, apt 3, trailing ", 2A".
 */
function idxNormalizeAddressForMatch_(address) {
  var s = String(address || '')
    .toLowerCase()
    .trim()
    .replace(/\bmilwuakee\b/g, 'milwaukee');
  if (!s) return '';

  var unit = '';
  var parts = s.split(',');
  var main = parts[0].trim();
  var tail, um, i;

  if (parts.length > 1) {
    tail = parts[parts.length - 1].trim();
    um = tail.match(/^(?:unit|apt|apartment|suite|ste)?\s*#?\s*([a-z0-9][-a-z0-9]*)\s*$/i);
    if (um) {
      unit = um[1];
      if (parts.length === 2) main = parts[0].trim();
      else main = parts.slice(0, -1).join(',').trim();
    }
  }

  if (!unit) {
    um = main.match(/\b(?:unit|apt|apartment|suite|ste)\s*#?\s*([a-z0-9][-a-z0-9]*)\b/i);
    if (um) unit = um[1];
  }
  if (!unit) {
    um = main.match(/#\s*([a-z0-9][-a-z0-9]*)\b/);
    if (um) unit = um[1];
  }
  if (!unit) {
    um = main.match(/\s([0-9]+[a-z])\s*$/);
    if (um) unit = um[1];
  }

  main = main.replace(/\b(?:unit|apt|apartment|suite|ste)\s*#?\s*[a-z0-9][-a-z0-9]*/gi, ' ');
  main = main.replace(/#\s*[a-z0-9][-a-z0-9]*/g, ' ');
  main = main.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  var dirMap = { north: 'n', south: 's', east: 'e', west: 'w', n: 'n', s: 's', e: 'e', w: 'w' };
  var typeMap = {
    st: 'st',
    street: 'st',
    ave: 'ave',
    av: 'ave',
    avenue: 'ave',
    dr: 'dr',
    drive: 'dr',
    pl: 'pl',
    place: 'pl',
    ln: 'ln',
    lane: 'ln',
    ct: 'ct',
    court: 'ct',
    rd: 'rd',
    road: 'rd',
    blvd: 'blvd',
    boulevard: 'blvd',
    pkwy: 'pkwy',
    parkway: 'pkwy',
    way: 'way',
    cir: 'cir',
    circle: 'cir',
    ter: 'ter',
    terrace: 'ter',
    hwy: 'hwy',
    highway: 'hwy'
  };
  var skip = {
    chicago: true,
    il: true,
    illinois: true,
    wi: true,
    wisconsin: true,
    downers: true,
    grove: true,
    unit: true,
    apt: true,
    apartment: true,
    suite: true,
    ste: true
  };

  var tokens = main.split(' ').filter(Boolean);
  var out = [];
  for (i = 0; i < tokens.length; i++) {
    var t = tokens[i];
    if (skip[t]) continue;
    if (dirMap[t]) {
      out.push(dirMap[t]);
      continue;
    }
    if (typeMap[t]) {
      out.push(typeMap[t]);
      continue;
    }
    if (/^#?\d+[a-z0-9-]*$/.test(t)) continue;
    out.push(t);
  }

  if (unit) {
    unit = String(unit).replace(/[^a-z0-9]/g, '');
    if (unit) out.push('unit', unit);
  }
  return out.join(' ');
}

function idxExtractUnitFromNorm_(norm) {
  var m = String(norm || '').match(/\bunit\s+([a-z0-9]+)\b/);
  return m ? m[1] : '';
}

/**
 * Compare two full normalized addresses; early tokens (number, dir, street) weigh more.
 */
function idxAddressMatchScore_(normA, normB) {
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  var numA = (normA.match(/^(\d+)/) || [])[1];
  var numB = (normB.match(/^(\d+)/) || [])[1];
  if (numA && numB && numA !== numB) return 0;

  var unitA = idxExtractUnitFromNorm_(normA);
  var unitB = idxExtractUnitFromNorm_(normB);
  if (unitA && unitB && unitA !== unitB) return 0;

  var at = normA.split(' ');
  var bt = normB.split(' ');
  var hits = 0;
  var total = 0;
  var i, j, w, matched;

  for (i = 0; i < at.length; i++) {
    w = i < 4 ? 4 : i < 7 ? 2 : 1;
    total += w;
    matched = false;
    for (j = 0; j < bt.length; j++) {
      if (at[i] === bt[j]) {
        hits += w;
        matched = true;
        break;
      }
    }
    if (!matched && i < 3) hits -= w * 0.25;
  }

  var score = total ? Math.max(0, hits / total) : 0;

  var coreA = idxAddressCoreKey_(normA);
  var coreB = idxAddressCoreKey_(normB);
  if (coreA && coreB) {
    if (coreA === coreB) score = Math.max(score, 0.9);
    else {
      var cs = scoreMatch_(coreA, coreB);
      if (cs >= 0.85) score = Math.max(score, cs * 0.92);
    }
  }

  if (unitA && unitB && unitA === unitB) score = Math.max(score, 0.95);
  return Math.min(1, score);
}

/** Core key: street number + N/S/E/W + street name (used to emphasize prefix in scoring). */
function idxAddressCoreKey_(address) {
  var s = String(address || '')
    .toLowerCase()
    .trim()
    .replace(/\bmilwuakee\b/g, 'milwaukee');
  if (!s) return '';

  s = s.split(',')[0];
  s = s.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  var skip = {
    st: true,
    street: true,
    ave: true,
    avenue: true,
    av: true,
    dr: true,
    drive: true,
    pl: true,
    place: true,
    ln: true,
    lane: true,
    ct: true,
    court: true,
    rd: true,
    road: true,
    blvd: true,
    boulevard: true,
    pkwy: true,
    parkway: true,
    way: true,
    cir: true,
    circle: true,
    ter: true,
    terrace: true,
    hwy: true,
    highway: true,
    unit: true,
    apt: true,
    apartment: true,
    suite: true,
    ste: true,
    fl: true,
    floor: true,
    bldg: true,
    building: true,
    chicago: true,
    il: true,
    illinois: true,
    wi: true,
    wisconsin: true,
    downers: true
  };

  var dirMap = { north: 'n', south: 's', east: 'e', west: 'w', n: 'n', s: 's', e: 'e', w: 'w' };
  var tokens = s.split(' ').filter(Boolean);
  var num = '';
  var dir = '';
  var name = [];
  var i, t;

  for (i = 0; i < tokens.length; i++) {
    t = tokens[i];
    if (!num && /^\d+$/.test(t)) {
      num = t;
      continue;
    }
    if (!dir && dirMap[t]) {
      dir = dirMap[t];
      continue;
    }
    if (skip[t]) continue;
    if (/^#?\d+[a-z0-9-]*$/.test(t)) continue;
    name.push(t);
  }

  return [num, dir].concat(name).filter(Boolean).join(' ');
}

function findIdxEntryForAddress_(address, map) {
  if (!map || !address) return null;
  var norm = idxNormalizeAddressForMatch_(address);
  if (!norm) return null;
  if (map[norm]) return map[norm];

  var best = null;
  var bestScore = 0;
  var k, sc;
  for (k in map) {
    if (!map.hasOwnProperty(k)) continue;
    sc = idxAddressMatchScore_(norm, k);
    if (sc > bestScore) {
      bestScore = sc;
      best = map[k];
    }
  }
  return bestScore >= 0.78 ? best : null;
}

/** listingId (MLS #) → IDX entry for secondary match. */
function buildIdxListingsMlsMap_(addressMap) {
  var mlsMap = {};
  var k, entry, lid;
  for (k in addressMap) {
    if (!addressMap.hasOwnProperty(k)) continue;
    entry = addressMap[k];
    lid = trim_(entry.listingId || (entry.listing && (entry.listing.listingID || entry.listing.listingId)) || '');
    lid = lid.replace(/\D/g, '');
    if (lid) mlsMap[lid] = entry;
  }
  return mlsMap;
}

function findIdxEntryForListing_(listing, addressMap, mlsMap) {
  var hit = findIdxEntryForAddress_(listing && listing.address, addressMap);
  if (hit) return hit;
  var mls = trim_(listing && listing.mlsNumber).replace(/\D/g, '');
  if (mls && mlsMap && mlsMap[mls]) return mlsMap[mls];
  return null;
}

/**
 * Find one listing object in an IDX API response by MLS listing ID.
 */
function idxExtractSingleListingFromBody_(body, listingId) {
  var needle = String(listingId || '').replace(/\D/g, '');
  if (!needle) return null;
  var list = idxExtractListingsFromBody_(body);
  var i, lid;
  for (i = 0; i < list.length; i++) {
    lid = String(list[i].listingID || list[i].listingId || '').replace(/\D/g, '');
    if (lid === needle) return list[i];
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    lid = String(body.listingID || body.listingId || '').replace(/\D/g, '');
    if (lid === needle) return body;
  }
  return list.length === 1 ? list[0] : null;
}

/** Merge supplemental IDX detail payload into a feed listing. */
function idxMergeListingDetail_(L, detail) {
  if (!L || !detail) return L;
  var k;
  for (k in detail) {
    if (!detail.hasOwnProperty(k)) continue;
    if (k === 'image' || k === 'mediaData') continue;
    if (detail[k] === null || detail[k] === undefined) continue;
    if (typeof detail[k] === 'object' && k !== 'advanced') continue;
    L[k] = detail[k];
  }
  if (detail.advanced && typeof detail.advanced === 'object') {
    L.advanced = L.advanced || {};
    for (k in detail.advanced) {
      if (detail.advanced.hasOwnProperty(k)) L.advanced[k] = detail.advanced[k];
    }
  }
  return L;
}

/**
 * MLS searchfields: discover co-list field names configured for this MLS (e.g. c019 MRED).
 */
function idxDiscoverMlsCoListFieldNames_(idxID) {
  var id = trim_(idxID || 'c019');
  var hits = [];
  try {
    var body = idxMlsApiRequest_('searchfields/' + encodeURIComponent(id));
    var fields = [];
    if (Object.prototype.toString.call(body) === '[object Array]') fields = body;
    else if (body && typeof body === 'object') {
      var k;
      for (k in body) {
        if (body.hasOwnProperty(k) && typeof body[k] === 'object') fields.push(body[k]);
      }
    }
    var i, name, norm;
    for (i = 0; i < fields.length; i++) {
      name = String(
        fields[i].name || fields[i].fieldName || fields[i].label || fields[i].id || ''
      );
      norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (idxKeyLooksLikeCoList_(norm)) hits.push(name);
    }
  } catch (errSf) {
    Logger.log('idxDiscoverMlsCoListFieldNames_: ' + errorText_(errSf));
  }
  return hits;
}

/**
 * Try IDX client/MLS endpoints for full listing detail (MRED Co-Listing Broker ID lives here).
 */
function idxFetchListingFullDetailFromApi_(idxID, listingID) {
  var mls = trim_(idxID || 'c019');
  var lid = trim_(listingID);
  if (!lid) return null;
  var paths = [
    'listings/' + encodeURIComponent(mls) + '/' + encodeURIComponent(lid),
    'listings/' + encodeURIComponent(lid) + '?idxID=' + encodeURIComponent(mls),
    'properties/' + encodeURIComponent(mls) + '/' + encodeURIComponent(lid),
    'featured?disclaimers=true&listingID=' + encodeURIComponent(lid),
    'soldpending?disclaimers=true&listingID=' + encodeURIComponent(lid)
  ];
  var i, body, listing, co;
  for (i = 0; i < paths.length; i++) {
    try {
      body = idxApiRequest_(paths[i]);
      listing = idxExtractSingleListingFromBody_(body, lid);
      if (!listing) continue;
      co = idxExtractCoListAgent_(listing);
      if (co.id || co.name) return listing;
      if (listing.advanced && Object.keys(listing.advanced).length > 3) return listing;
    } catch (errPath) {
      /* try next path */
    }
  }
  return null;
}

/**
 * Per-listing API detail fetch for co-list (MRED Co-Listing Broker ID). Batched to respect rate limits.
 */
function idxEnrichCoListFromApiDetails_(items) {
  var batch = Number(PropertiesService.getScriptProperties().getProperty('IDX_COLIST_API_BATCH'));
  if (!batch && batch !== 0) batch = 40;
  if (batch <= 0) return { enriched: 0, skipped: true };
  var cursor = Number(PropertiesService.getScriptProperties().getProperty('IDX_COLIST_API_CURSOR') || '0');
  if (cursor < 0 || cursor >= items.length) cursor = 0;
  var enriched = 0;
  var processed = 0;
  var i, L, co, detail, idxId;
  for (i = cursor; i < items.length && processed < batch; i++) {
    L = items[i].listing;
    if (!L) continue;
    processed++;
    co = idxExtractCoListAgent_(L);
    if (co.id) continue;
    idxId = trim_(L.idxID || L.idxId || 'c019');
    detail = idxFetchListingFullDetailFromApi_(idxId, L.listingID || L.listingId || '');
    if (!detail) continue;
    idxMergeListingDetail_(L, detail);
    co = idxExtractCoListAgent_(L);
    if (co.id) {
      L.coListAgentID = co.id;
      enriched++;
    }
    if (co.name) L.coListAgentName = co.name;
    Utilities.sleep(80);
  }
  var nextCursor = i >= items.length ? 0 : i;
  PropertiesService.getScriptProperties().setProperty('IDX_COLIST_API_CURSOR', String(nextCursor));
  return { enriched: enriched, processed: processed, cursor: cursor, nextCursor: nextCursor };
}

/**
 * MRED co-listing agent (team listings often use Alex as primary, real agent as co-list).
 * Bulk IDX feeds often omit co-list; detail pages and flattened `advanced.*` columns may have it.
 */
function idxExtractCoListAgent_(L, flat) {
  if (!L) return { id: '', name: '' };
  var id = idxPickFromListing_(L, [
    'coListAgentID', 'coListAgentId', 'coListingAgentID', 'coListingAgentId',
    'coListingBrokerID', 'coListingBrokerId', 'CoListingBrokerID', 'CoListerID', 'coListerID',
    'CoListAgentMlsId', 'CoListAgentMlsID', 'CoListAgentKey',
    'Co List Agent MLS ID', 'Co-Listing Agent ID', 'Co-Listing Agent MLS ID',
    'Co-Listing Broker ID', 'Co Listing Broker ID', 'Co Listing Agent ID',
    'CoListingAgentMlsId', 'CoListingAgentID', 'Co-Lister ID',
    'advanced.mrdCoListAgentID', 'advanced.mrdCoListAgentId', 'mrdCoListAgentID',
    'advanced.mrdCoListingBrokerID', 'advanced.CoListAgentMlsId', 'advanced.Co-Listing Agent ID',
    'advanced.Co-Listing Broker ID', 'advanced.Co-Lister ID',
    'LA2UserCode', 'LA2 User Code', 'advanced.LA2UserCode'
  ]);
  var name = idxPickFromListing_(L, [
    'coListAgentName', 'coListingAgentName', 'CoListAgentFullName',
    'coListingBrokerName', 'CoListingBrokerName', 'CoListerName',
    'Co List Agent Full Name', 'CoList Agent Full Name', 'coListAgentFullName',
    'Co-Listing Agent', 'Co-Listing Agent Name', 'Co Listing Agent',
    'Co-Listing Broker', 'Co Listing Broker',
    'advanced.mrdCoListAgentName', 'mrdCoListAgentName', 'advanced.Co-Listing Agent',
    'advanced.Co-Listing Broker'
  ]);
  var walked = { id: '', name: '' };
  idxWalkListingForCoList_(L, 0, walked);
  if (!id) id = walked.id;
  if (!name) name = walked.name;
  var fromFlat = flat ? idxExtractCoListFromFlat_(flat) : { id: '', name: '' };
  if (!id) id = fromFlat.id;
  if (!name) name = fromFlat.name;
  id = idxNormalizeCoListAgentId_(id);
  return { id: trim_(id), name: trim_(name) };
}

/** Deep scan listing JSON for any co-list / LA2 agent keys (MRED uses many spellings). */
function idxWalkListingForCoList_(obj, depth, found) {
  if (!obj || depth > 10 || typeof obj !== 'object') return;
  if (Object.prototype.toString.call(obj) === '[object Array]') {
    var ai;
    for (ai = 0; ai < obj.length && ai < 80; ai++) idxWalkListingForCoList_(obj[ai], depth + 1, found);
    return;
  }
  var k, norm, v, digits;
  for (k in obj) {
    if (!obj.hasOwnProperty(k)) continue;
    v = obj[k];
    if (v && typeof v === 'object') {
      idxWalkListingForCoList_(v, depth + 1, found);
      continue;
    }
    if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') continue;
    v = trim_(v);
    if (!v) continue;
    norm = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!idxKeyLooksLikeCoList_(norm)) continue;
    if (!found.name && idxKeyLooksLikeCoListName_(norm) && idxValueLooksLikePersonName_(v)) {
      found.name = v;
    }
    if (!found.id && idxKeyLooksLikeCoListId_(norm)) {
      digits = idxNormalizeCoListAgentId_(v);
      if (digits) found.id = digits;
    }
  }
}

function idxKeyLooksLikeCoList_(norm) {
  if (!norm) return false;
  if (norm.indexOf('colist') >= 0 || norm.indexOf('colisting') >= 0) return true;
  if (norm.indexOf('colister') >= 0) return true;
  if (norm.indexOf('colistingbroker') >= 0) return true;
  if (norm.indexOf('colistingagent') >= 0 && norm.indexOf('listingagent') < 0) return true;
  if (norm.indexOf('la2') >= 0 && norm.indexOf('agent') >= 0) return true;
  if (norm.indexOf('la2') >= 0 && (norm.indexOf('usercode') >= 0 || norm.indexOf('mls') >= 0)) return true;
  return false;
}

function idxKeyLooksLikeCoListName_(norm) {
  if (norm.indexOf('office') >= 0 || norm.indexOf('broker') >= 0 || norm.indexOf('email') >= 0) return false;
  if (norm.indexOf('phone') >= 0 || norm.indexOf('fax') >= 0) return false;
  return norm.indexOf('name') >= 0 || norm.indexOf('fullname') >= 0 ||
    (norm.indexOf('agent') >= 0 && norm.indexOf('id') < 0 && norm.indexOf('mls') < 0);
}

function idxKeyLooksLikeCoListId_(norm) {
  if (norm.indexOf('office') >= 0 && norm.indexOf('agent') < 0) return false;
  if (norm.indexOf('email') >= 0 || norm.indexOf('phone') >= 0 || norm.indexOf('fax') >= 0) return false;
  if (norm.indexOf('colistingbroker') >= 0 && norm.indexOf('name') < 0) return true;
  if (norm.indexOf('colister') >= 0 && norm.indexOf('name') < 0) return true;
  return norm.indexOf('id') >= 0 || norm.indexOf('mls') >= 0 || norm.indexOf('key') >= 0 ||
    norm.indexOf('usercode') >= 0 || norm.indexOf('lister') >= 0;
}

function idxValueLooksLikePersonName_(v) {
  if (!v || !/[a-zA-Z]{2,}/.test(v)) return false;
  if (/^\d+$/.test(v)) return false;
  if (v.indexOf(' ') < 0 && v.length > 24) return false;
  return true;
}

function idxNormalizeCoListAgentId_(v) {
  var digits = String(v || '').replace(/\D/g, '');
  if (digits.length >= 5 && digits.length <= 10) return digits;
  return '';
}

/** Scan flattened IdxListings columns (e.g. advanced.Co-Listing Agent ID). */
function idxExtractCoListFromFlat_(flat) {
  var id = '';
  var name = '';
  var k, norm, v, digits;
  for (k in flat) {
    if (!flat.hasOwnProperty(k)) continue;
    v = trim_(flat[k]);
    if (!v) continue;
    norm = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!idxKeyLooksLikeCoList_(norm)) continue;
    if (!name && idxKeyLooksLikeCoListName_(norm) && idxValueLooksLikePersonName_(v)) name = v;
    if (!id && idxKeyLooksLikeCoListId_(norm)) {
      digits = idxNormalizeCoListAgentId_(v);
      if (digits) id = digits;
    }
  }
  return { id: id, name: name };
}

function idxGetDetailsBaseUrl_() {
  var base = trim_(PropertiesService.getScriptProperties().getProperty('IDX_DETAILS_BASE_URL'));
  if (!base) base = 'https://search.alexstoykovgroup.com';
  return base.replace(/\/$/, '');
}

/** IDX often returns relative paths like /idx/details/listing/a087/12345/... */
function idxResolveDetailsUrl_(url) {
  var u = trim_(url);
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  var base = idxGetDetailsBaseUrl_();
  if (u.indexOf('/') === 0) return base + u;
  return base + '/' + u;
}

function idxListingAddressKey_(L) {
  if (!L) return '';
  var addr = trim_(L.address || L.displayAddress || '');
  if (!addr) {
    addr = [trim_(L.streetNumber), trim_(L.streetName), trim_(L.cityName), trim_(L.state), trim_(L.zipcode)]
      .filter(Boolean)
      .join(' ');
  }
  return idxNormalizeAddressForMatch_(addr);
}

function getIdxCoListOverridesSheetName_() {
  var name = trim_(
    PropertiesService.getScriptProperties().getProperty('IDX_COLIST_OVERRIDES_SHEET') ||
      IDX_COLIST_OVERRIDES_DEFAULT_SHEET
  );
  return name || IDX_COLIST_OVERRIDES_DEFAULT_SHEET;
}

/**
 * Manual co-list overrides (MRED export, Compass, roster). Same workbook as Listings.
 * Headers: Listing ID | MLS Number | Co List Agent ID | Co List Agent Name | Source | Notes
 */
function ensureIdxCoListOverridesSheet_() {
  var ss = getListingsSpreadsheet_();
  var name = getIdxCoListOverridesSheetName_();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, 6).setValues([[
      'Listing ID',
      'MLS Number',
      'Co List Agent ID',
      'Co List Agent Name',
      'Source',
      'Notes'
    ]]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Build lookup maps from IdxCoList tab (listing ID digits + optional MLS number). */
function idxBuildCoListOverrideMap_() {
  var map = { byListingId: {}, byMls: {}, rowCount: 0 };
  var ss = getListingsSpreadsheet_();
  var sh = ss.getSheetByName(getIdxCoListOverridesSheetName_());
  if (!sh || sh.getLastRow() < 2) return map;
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var col = {};
  var i, h, norm;
  for (i = 0; i < headers.length; i++) {
    h = String(headers[i] || '').trim().toLowerCase();
    if (h.indexOf('listing') >= 0 && h.indexOf('id') >= 0) col.listingId = i;
    else if (h === 'mls number' || h === 'mlsnumber' || h === 'mls #') col.mls = i;
    else if (h.indexOf('co list') >= 0 && h.indexOf('id') >= 0) col.coId = i;
    else if (h.indexOf('co list') >= 0 && h.indexOf('name') >= 0) col.coName = i;
    else if (h === 'source') col.source = i;
    else if (h === 'notes') col.notes = i;
  }
  if (col.coId === undefined && col.coName === undefined) return map;
  var r, lid, mls, coId, coName, entry;
  for (r = 1; r < values.length; r++) {
    coId = col.coId !== undefined ? idxNormalizeCoListAgentId_(values[r][col.coId]) : '';
    coName = col.coName !== undefined ? trim_(values[r][col.coName]) : '';
    if (!coId && !coName) continue;
    entry = {
      id: coId,
      name: coName,
      source: col.source !== undefined ? trim_(values[r][col.source]) : '',
      notes: col.notes !== undefined ? trim_(values[r][col.notes]) : ''
    };
    lid = col.listingId !== undefined ? String(values[r][col.listingId] || '').replace(/\D/g, '') : '';
    mls = col.mls !== undefined ? String(values[r][col.mls] || '').replace(/\D/g, '') : '';
    if (lid) map.byListingId[lid] = entry;
    if (mls) map.byMls[mls] = entry;
    map.rowCount++;
  }
  return map;
}

function idxApplyCoListOverrideToListing_(L, overrideMap) {
  if (!L || !overrideMap) return false;
  var lid = String(L.listingID || L.listingId || '').replace(/\D/g, '');
  var mls = String(L.mlsNumber || L.mlsID || L.mlsId || '').replace(/\D/g, '');
  var entry = (lid && overrideMap.byListingId[lid]) || (mls && overrideMap.byMls[mls]) || null;
  if (!entry) return false;
  if (entry.id) {
    L.coListAgentID = entry.id;
    L.mlsCoListAgentId = entry.id;
  }
  if (entry.name) {
    L.coListAgentName = entry.name;
    L.mlsCoListAgentName = entry.name;
  }
  if (!L.coListAgentName && entry.id) {
    try {
      var mredMap = buildDirectoryMredToNameMap_();
      if (mredMap[entry.id]) L.coListAgentName = mredMap[entry.id];
    } catch (eDir) {}
  }
  L.coListSource = trim_(entry.source) || 'override';
  return !!(entry.id || entry.name);
}

/** Apply IdxCoList sheet rows (wins over workflow/API scrape when present). */
function idxApplyCoListOverridesToItems_(items) {
  var applied = 0;
  try {
    var overrideMap = idxBuildCoListOverrideMap_();
    if (!overrideMap.rowCount) return { applied: 0, overrideRows: 0 };
    var i, L;
    for (i = 0; i < items.length; i++) {
      L = items[i].listing;
      if (!L) continue;
      if (idxApplyCoListOverrideToListing_(L, overrideMap)) applied++;
    }
    return { applied: applied, overrideRows: overrideMap.rowCount };
  } catch (errOv) {
    Logger.log('idxApplyCoListOverridesToItems_: ' + errorText_(errOv));
    return { applied: 0, error: errorText_(errOv) };
  }
}

/**
 * Fields IDX actually exports on featured/soldpending/API detail (vs MLS searchfields catalog).
 */
function idxFetchListAllowedFields_(idxID) {
  var mls = trim_(idxID || 'c019');
  var paths = [
    'listallowedfields',
    'listallowedfields?idxID=' + encodeURIComponent(mls),
    'listallowedfields/' + encodeURIComponent(mls)
  ];
  var names = [];
  var tried = [];
  var i, body, k, arr, j, item, name;
  for (i = 0; i < paths.length; i++) {
    tried.push(paths[i]);
    try {
      body = idxApiRequest_(paths[i]);
      arr = [];
      if (Object.prototype.toString.call(body) === '[object Array]') arr = body;
      else if (body && typeof body === 'object') {
        for (k in body) {
          if (!body.hasOwnProperty(k)) continue;
          if (typeof body[k] === 'string') arr.push(body[k]);
          else if (body[k] && typeof body[k] === 'object') arr.push(body[k]);
        }
      }
      for (j = 0; j < arr.length; j++) {
        item = arr[j];
        if (typeof item === 'string') name = item;
        else if (item && typeof item === 'object') {
          name = String(item.name || item.fieldName || item.id || item.label || '');
        } else name = '';
        name = trim_(name);
        if (name) names.push(name);
      }
      if (names.length) break;
    } catch (errLa) {
      /* try next */
    }
  }
  var unique = {};
  var out = [];
  for (i = 0; i < names.length; i++) {
    if (!unique[names[i]]) {
      unique[names[i]] = true;
      out.push(names[i]);
    }
  }
  return { fields: out, tried: tried };
}

function idxListAllowedHasCoList_(fields) {
  var i, norm;
  for (i = 0; i < fields.length; i++) {
    norm = String(fields[i]).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (idxKeyLooksLikeCoList_(norm)) return fields[i];
  }
  return '';
}

/** One-off SearchQuery probe for a listing ID (often still omits co-list). */
function idxTrySearchQueryForListing_(idxID, listingID) {
  var mls = trim_(idxID || 'c019');
  var lid = trim_(listingID);
  var paths = [
    'searchquery?idxID=' + encodeURIComponent(mls) + '&listingID=' + encodeURIComponent(lid),
    'searchquery/' + encodeURIComponent(mls) + '?listingID=' + encodeURIComponent(lid)
  ];
  var i, body, listing, co;
  for (i = 0; i < paths.length; i++) {
    try {
      body = idxApiRequest_(paths[i]);
      listing = idxExtractSingleListingFromBody_(body, lid);
      if (!listing) continue;
      co = idxExtractCoListAgent_(listing);
      return { path: paths[i], extracted: co, agentKeys: Object.keys(listing).filter(function (k) {
        var n = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        return idxKeyLooksLikeCoList_(n) || n.indexOf('agent') >= 0;
      }) };
    } catch (errSq) {
      /* next */
    }
  }
  return null;
}

/**
 * Populate co-list from Listings-tab agent_name + Directory mred_number (when IDX JSON has none).
 */
function idxApplyWorkflowCoListToItems_(items) {
  var filled = 0;
  var withAgent = 0;
  try {
    var overlayByAddr = buildListingsWorkflowOverlayByAddress_();
    var nameToMred = buildDirectoryNameToMredMap_();
    var i, L, overlay, co;
    for (i = 0; i < items.length; i++) {
      L = items[i].listing;
      if (!L) continue;
      co = idxExtractCoListAgent_(L);
      if (co.id) continue;
      overlay = findListingsOverlayForAddress_(
        trim_(L.address || L.displayAddress || ''),
        overlayByAddr
      );
      if (!overlay || !trim_(overlay.agent || overlay.agentCanonical || '')) continue;
      withAgent++;
      if (fillCoListFromWorkflowOverlay_(L, overlay, nameToMred)) filled++;
    }
  } catch (errWf) {
    Logger.log('idxApplyWorkflowCoListToItems_: ' + errorText_(errWf));
  }
  return { filled: filled, withAgent: withAgent };
}

function idxStripHtml_(s) {
  return String(s || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** JSON keys sometimes appear in page source even when tables are client-rendered. */
function idxParseCoListFromEmbeddedJson_(html) {
  var id = '';
  var name = '';
  if (!html) return { id: id, name: name };
  var idRe = /"(?:CoListAgentMlsId|coListAgentID|coListAgentId|mrdCoListAgentID|mrdCoListAgentId)"\s*:\s*"([^"]+)"/gi;
  var nameRe = /"(?:CoListAgentFullName|coListAgentName|coListingAgentName|mrdCoListAgentName)"\s*:\s*"([^"]+)"/gi;
  var m;
  while ((m = idRe.exec(html)) !== null) {
    id = idxNormalizeCoListAgentId_(m[1]) || id;
    if (id) break;
  }
  while ((m = nameRe.exec(html)) !== null) {
    if (idxValueLooksLikePersonName_(m[1])) {
      name = trim_(m[1]);
      break;
    }
  }
  return { id: id, name: name };
}

function idxMergeCoListParse_(a, b) {
  return {
    id: (a && a.id) || (b && b.id) || '',
    name: (a && a.name) || (b && b.name) || ''
  };
}

/**
 * Parse IDX listing detail HTML (same tables as public detail pages).
 * MRED co-list is often only on the detail page, not in featured/soldpending JSON.
 */
/** Parse IDX detail page field blocks: <span class="IDX-label">…</span><span class="IDX-text">…</span> */
function idxParseIdxFieldBlocksFromHtml_(html) {
  var id = '';
  var name = '';
  if (!html) return { id: id, name: name };
  var re = /id="IDX-field-([^"]+)"[^>]*>\s*<span class="IDX-label">([\s\S]*?)<\/span>\s*<span class="IDX-text">([\s\S]*?)<\/span>/gi;
  var m, fieldId, lab, val, normLab;
  while ((m = re.exec(html)) !== null) {
    fieldId = String(m[1] || '').toLowerCase();
    lab = idxStripHtml_(m[2]);
    val = idxStripHtml_(m[3]);
    if (!val || /^n\/a$/i.test(val)) continue;
    normLab = lab.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!idxKeyLooksLikeCoList_(normLab) && fieldId.indexOf('colist') < 0 && fieldId.indexOf('colister') < 0 &&
        fieldId.indexOf('colisting') < 0 && fieldId.indexOf('la2') < 0) {
      continue;
    }
    if (/phone|mobile|cell|email|fax/i.test(lab)) continue;
    if (idxKeyLooksLikeCoListId_(normLab) || fieldId.indexOf('id') >= 0) {
      id = idxNormalizeCoListAgentId_(val) || id;
    } else if (idxValueLooksLikePersonName_(val)) {
      name = name || val;
    }
  }
  return { id: id, name: name };
}

function idxParseCoListFromDetailsHtml_(html) {
  var fromBlocks = idxParseIdxFieldBlocksFromHtml_(html);
  var fromJson = idxParseCoListFromEmbeddedJson_(html);
  var name = fromBlocks.name || fromJson.name;
  var id = fromBlocks.id || fromJson.id;
  if (!html) return { id: id, name: name };
  var trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  var m, tr, cellRe, cells, ci, lab, val, normLab;
  while ((m = trRe.exec(html)) !== null) {
    tr = m[1];
    cellRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
    cells = [];
    while ((ci = cellRe.exec(tr)) !== null) cells.push(ci[1]);
    if (cells.length < 2) continue;
    lab = idxStripHtml_(cells[0]);
    val = idxStripHtml_(cells[1]);
    if (!lab || !val || /^n\/a$/i.test(val)) continue;
    normLab = lab.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!idxKeyLooksLikeCoList_(normLab)) continue;
    if (/phone|mobile|cell|email|fax/i.test(lab)) continue;
    if (idxKeyLooksLikeCoListId_(normLab)) {
      id = idxNormalizeCoListAgentId_(val) || id;
    } else if (idxKeyLooksLikeCoListName_(normLab) && idxValueLooksLikePersonName_(val)) {
      name = val;
    } else if (!name && idxValueLooksLikePersonName_(val) && !/id|mls|#|number|office/i.test(lab)) {
      name = val;
    }
  }
  // IDX field label/value div pairs (non-table layouts).
  var pairRe = /(?:IDX-label|fieldLabel|detailsLabel)[^>]*>([^<]{2,80})<[\s\S]{0,120}?(?:IDX-field|fieldValue|detailsValue)[^>]*>([^<]{1,120})</gi;
  while ((m = pairRe.exec(html)) !== null) {
    lab = idxStripHtml_(m[1]);
    val = idxStripHtml_(m[2]);
    if (!lab || !val) continue;
    normLab = lab.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!idxKeyLooksLikeCoList_(normLab)) continue;
    if (idxKeyLooksLikeCoListId_(normLab)) id = idxNormalizeCoListAgentId_(val) || id;
    else if (idxValueLooksLikePersonName_(val)) name = name || val;
  }
  return { id: id, name: name };
}

function idxFetchCoListFromDetailsPage_(url) {
  var u = idxResolveDetailsUrl_(url);
  if (!u) return { id: '', name: '' };
  var res = UrlFetchApp.fetch(u, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ASG-ListingHub/1.0)' }
  });
  var code = res.getResponseCode();
  var body = res.getContentText() || '';
  if (code >= 400 && code !== 404) return { id: '', name: '' };
  return idxParseCoListFromDetailsHtml_(body);
}

/**
 * Fill co-list on listing objects from fullDetailsURL when JSON lacks it.
 * Script properties:
 *   IDX_COLIST_SCRAPE_BATCH — max detail pages per run (default 60; 0 = off)
 *   IDX_COLIST_SCRAPE_CURSOR — resume index (managed automatically)
 *   IDX_COLIST_SCRAPE_RESET — set true to restart cursor at 0 on next sync
 */
function idxEnrichCoListFromDetailPages_(items) {
  var batch = Number(PropertiesService.getScriptProperties().getProperty('IDX_COLIST_SCRAPE_BATCH'));
  if (!batch && batch !== 0) batch = 60;
  if (batch <= 0) return { scraped: 0, skipped: true, remaining: 0 };
  var props = PropertiesService.getScriptProperties();
  if (trim_(props.getProperty('IDX_COLIST_SCRAPE_RESET')).toLowerCase() === 'true') {
    props.deleteProperty('IDX_COLIST_SCRAPE_CURSOR');
    props.deleteProperty('IDX_COLIST_SCRAPE_RESET');
  }
  var cursor = Number(props.getProperty('IDX_COLIST_SCRAPE_CURSOR') || '0');
  if (cursor < 0 || cursor >= items.length) cursor = 0;
  var scraped = 0;
  var processed = 0;
  var i, L, co, url, htmlCo;
  for (i = cursor; i < items.length && processed < batch; i++) {
    L = items[i].listing;
    if (!L) continue;
    processed++;
    co = idxExtractCoListAgent_(L);
    if (co.id && co.name) continue;
    url = trim_(L.fullDetailsURL || L.detailsURL || '');
    if (!url) continue;
    try {
      htmlCo = idxFetchCoListFromDetailsPage_(url);
      if (htmlCo.id) L.coListAgentID = htmlCo.id;
      if (htmlCo.name) L.coListAgentName = htmlCo.name;
      if (htmlCo.id || htmlCo.name) scraped++;
    } catch (errHtml) {
      Logger.log('idxEnrichCoListFromDetailPages_ ' + (L.listingID || i) + ': ' + errorText_(errHtml));
    }
    Utilities.sleep(120);
  }
  var nextCursor = i >= items.length ? 0 : i;
  props.setProperty('IDX_COLIST_SCRAPE_CURSOR', String(nextCursor));
  var remaining = 0;
  for (var j = 0; j < items.length; j++) {
    L = items[j].listing;
    if (!L) continue;
    if (!idxExtractCoListAgent_(L).id && trim_(L.fullDetailsURL || L.detailsURL || '')) remaining++;
  }
  return { scraped: scraped, processed: processed, cursor: cursor, nextCursor: nextCursor, remaining: remaining };
}

/** Editor / manual — scrape co-list from IDX detail pages and patch IdxListings (no API re-fetch). */
function enrichIdxCoListFromDetails() {
  var sh = getIdxListingsSheetReadOnly_();
  if (!sh || sh.getLastRow() < 2) throw new Error('IdxListings sheet is empty. Run syncIdxListingsToSheet() first.');
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var col = idxSheetHeaderIndex_(headers);
  if (col.coListAgentId === undefined && col.coListAgentName === undefined) {
    throw new Error('IdxListings is missing Co List Agent ID / Name columns. Run a full IDX sync first.');
  }
  var items = [];
  var rowByItem = [];
  var r, L, url;
  for (r = 1; r < values.length; r++) {
    L = idxParseListingJson_(idxCell_(values[r], col.rawJson));
    if (!L) continue;
    url = trim_(L.fullDetailsURL || L.detailsURL || '');
    if (!url) continue;
    items.push({ feed: 'sheet', listing: L, idxKey: 'sheet|' + r });
    rowByItem.push(r);
  }
  var overrideFill = idxApplyCoListOverridesToItems_(items);
  var workflowFill = idxApplyWorkflowCoListToItems_(items);
  var result = idxEnrichCoListFromDetailPages_(items);
  result.overrideFilled = overrideFill.applied;
  result.workflowFilled = workflowFill.filled;
  var rowsUpdated = idxWriteCoListBackToSheet_(sh, values, col, items, rowByItem);
  Logger.log(JSON.stringify({ enrich: result, rowsUpdated: rowsUpdated }, null, 2));
  return { success: true, enrich: result, rowsUpdated: rowsUpdated };
}

/** After detail-page scrape, update Co List columns (+ Raw JSON) on IdxListings. */
function idxWriteCoListBackToSheet_(sh, values, col, items, rowByItem) {
  var updated = 0;
  var i, r, co, L, row;
  for (i = 0; i < items.length; i++) {
    co = idxExtractCoListAgent_(items[i].listing);
    if (!co.id && !co.name) continue;
    r = rowByItem[i];
    row = values[r];
    if (col.coListAgentId !== undefined && col.coListAgentId >= 0) row[col.coListAgentId] = co.id;
    if (col.coListAgentName !== undefined && col.coListAgentName >= 0) row[col.coListAgentName] = co.name;
    L = items[i].listing;
    if (co.id) L.coListAgentID = co.id;
    if (co.name) L.coListAgentName = co.name;
    if (col.rawJson !== undefined && col.rawJson >= 0) row[col.rawJson] = idxCompactListingJsonForSheet_(L);
    values[r] = row;
    updated++;
  }
  if (updated) {
    var dataRows = values.slice(1);
    sh.getRange(2, 1, dataRows.length, values[0].length).setValues(dataRows);
  }
  return updated;
}

/**
 * Look up a value on a listing JSON object by trying multiple candidate keys
 * (covers IDX top-level snake/camel case AND `advanced.*` MRED-style spaced
 * Title Case keys, all matched case-insensitively as a final fallback).
 */
function idxPickFromListing_(L, candidates) {
  if (!L || !candidates || !candidates.length) return '';
  var i, k, v;
  for (i = 0; i < candidates.length; i++) {
    k = candidates[i];
    v = L[k];
    if (v !== undefined && v !== null && String(v) !== '') return String(v);
  }
  var adv = L.advanced || {};
  for (i = 0; i < candidates.length; i++) {
    k = candidates[i];
    v = adv[k];
    if (v !== undefined && v !== null && String(v) !== '') return String(v);
  }
  var normMap = null;
  for (i = 0; i < candidates.length; i++) {
    if (!normMap) {
      normMap = {};
      var ak, nk, sv;
      for (ak in L) {
        if (!L.hasOwnProperty(ak)) continue;
        sv = L[ak];
        if (sv === null || sv === undefined) continue;
        if (typeof sv === 'object') continue;
        nk = String(ak).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normMap[nk] === undefined) normMap[nk] = sv;
      }
      for (ak in adv) {
        if (!adv.hasOwnProperty(ak)) continue;
        nk = String(ak).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normMap[nk] === undefined) normMap[nk] = adv[ak];
      }
    }
    var needle = String(candidates[i]).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normMap[needle] !== undefined && String(normMap[needle]) !== '') return String(normMap[needle]);
  }
  return '';
}

/** Ordered array of every photo URL on a listing (IDX `image` map). */
function idxBuildPhotoGallery_(L) {
  if (!L || !L.image || typeof L.image !== 'object') return [];
  var out = [];
  var k;
  for (k in L.image) {
    if (!L.image.hasOwnProperty(k) || k === 'totalCount') continue;
    var entry = L.image[k];
    if (!entry || !entry.url) continue;
    out.push({
      url: trim_(entry.url),
      caption: trim_(entry.caption || entry.description || ''),
      order: Number(k) || 0
    });
  }
  out.sort(function (a, b) { return a.order - b.order; });
  return out;
}

/** All future (today-or-later) open houses, sorted ascending by date. */
function idxBuildUpcomingOpenHouses_(L) {
  var info = idxExtractOpenHouseInfo_(L);
  var all = (info.all || []).slice();
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var future = [];
  var i;
  for (i = 0; i < all.length; i++) {
    var d = idxParseOhDate_(all[i].date);
    if (d && d.getTime() >= today.getTime()) future.push(all[i]);
  }
  future.sort(function (a, b) {
    var da = idxParseOhDate_(a.date), db = idxParseOhDate_(b.date);
    return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
  });
  return future;
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
  // IDX is now the source of truth for status/price/beds/baths/sqft.
  var idxStatusValue = trim_(L.propStatus || L.idxStatus || idxEntry.sheetStatus || '');
  listing.idxMlsStatus = idxStatusValue;
  if (idxStatusValue) {
    listing.status = idxStatusValue;
    listing.phaseKey = normalizeStatusKey_(idxStatusValue);
  }
  listing.idx = L;

  if (listing.idxListingId) listing.mlsNumber = listing.idxListingId;
  listing.listPrice = trim_(L.listingPrice || (L.price ? '$' + L.price : '') || idxEntry.sheetPrice || listing.listPrice || '');
  if (L.bedrooms !== undefined && L.bedrooms !== '') listing.beds = String(L.bedrooms);

  // Compute total baths from fullBaths + 0.5 * partialBaths.
  // (e.g. 4 full + 1 partial = 4.5). Falls back to L.totalBaths only when
  // neither full nor partial is available, so the computed value wins.
  var fullBathsRaw = idxPickFromListing_(L, ['fullBaths', 'FullBaths', 'Full Baths']);
  var partialBathsRaw = idxPickFromListing_(L, ['partialBaths', 'PartialBaths', 'HalfBaths', 'Half Baths', 'Partial Baths']);
  var fullBathsNum = Number(fullBathsRaw);
  var partialBathsNum = Number(partialBathsRaw);
  if (!isFinite(fullBathsNum)) fullBathsNum = 0;
  if (!isFinite(partialBathsNum)) partialBathsNum = 0;
  if (fullBathsRaw !== '' || partialBathsRaw !== '') {
    var totalBaths = fullBathsNum + 0.5 * partialBathsNum;
    listing.baths = String(totalBaths);
    listing.mlsFullBaths = String(fullBathsNum);
    listing.mlsPartialBaths = String(partialBathsNum);
  } else if (L.totalBaths !== undefined && L.totalBaths !== '') {
    listing.baths = String(L.totalBaths);
  }
  if (L.sqFt) listing.sqFt = trim_(L.sqFt);

  // Derive listingType bucket from MRED propType so the dashboard filters and
  // chips can show Sale / Lease / Land / Commercial without per-row mapping.
  var propTypeRaw = String(idxPickFromListing_(L, ['propType', 'propertyType', 'PropertyType', 'Property Type']) || '').toLowerCase();
  if (propTypeRaw) {
    if (propTypeRaw.indexOf('lease') >= 0 || propTypeRaw.indexOf('rental') >= 0) {
      listing.listingType = 'Lease';
    } else if (propTypeRaw.indexOf('land') >= 0 || propTypeRaw.indexOf('lot') >= 0) {
      listing.listingType = 'Land';
    } else if (propTypeRaw.indexOf('commercial') >= 0) {
      listing.listingType = 'Commercial Sale';
    } else if (propTypeRaw.indexOf('residential') >= 0 || propTypeRaw.indexOf('single') >= 0 || propTypeRaw.indexOf('condo') >= 0 || propTypeRaw.indexOf('townhouse') >= 0 || propTypeRaw.indexOf('multi') >= 0) {
      listing.listingType = 'Sale';
    }
  }

  // Cover image: prefer the IDX CDN photo (image.firstUrl column mirrors the
  // MLS S3 asset, loads fast and needs no auth). Raw JSON strips image URLs,
  // so the flat sheet column is the reliable source for sheet-built entries.
  var photo = idxFirstPhotoUrl_(L) || trim_(idxEntry.sheetImageFirstUrl || '');
  listing.idxCoverImage = photo;
  if (photo) listing.coverImage = photo;

  var mp = idxMatterportUrl_(L);
  if (!trim_(listing.matterport) && mp) listing.matterport = mp;
  listing.ohCount = oh.ohCount ? String(oh.ohCount) : trim_(idxEntry.ohCount || '0');
  listing.nextOpenHouseDate = oh.nextDate || idxEntry.nextOhDate || '';
  listing.nextOpenHouseStart = oh.nextStart || idxEntry.nextOhStart || '';
  listing.nextOpenHouseEnd = oh.nextEnd || idxEntry.nextOhEnd || '';

  listing.mlsAreaMajor = idxPickFromListing_(L, ['advanced.mlsareamajor', 'mlsareamajor', 'MlsAreaMajor', 'MLS Area Major']);
  listing.mlsTownship = idxPickFromListing_(L, ['advanced.township', 'township', 'Township', 'TownshipName', 'Township Name']);
  if (!trim_(listing.neighborhood) && listing.mlsAreaMajor) {
    listing.neighborhood = trim_(String(listing.mlsAreaMajor).replace(/^CHI\s*-\s*/i, ''));
  }

  // ── MRED snapshot fields surfaced for the dashboard listing detail view ──
  // Read from the IDX `listing` JSON (including `advanced.*` MRED extras).
  // Names cover common IDX and MRED variants so we don't lose data when
  // either side renames a column.
  listing.mlsListAgentName     = idxPickFromListing_(L, ['listingAgentName', 'listAgentName', 'ListAgentFullName', 'List Agent Full Name', 'List Agent Name']);
  listing.mlsListAgentEmail    = idxPickFromListing_(L, ['listingAgentEmail', 'ListAgentEmail', 'List Agent Email']);
  listing.mlsListAgentPhone    = idxPickFromListing_(L, ['listingAgentPhone', 'ListAgentPreferredPhone', 'ListAgentDirectPhone', 'List Agent Phone']);
  listing.mlsListOffice        = idxPickFromListing_(L, ['listingOfficeName', 'ListOfficeName', 'List Office Name']);
  listing.mlsListOfficeId      = idxPickFromListing_(L, ['listingOfficeID', 'ListOfficeMlsId', 'List Office MLS ID']);
  listing.mlsPropType          = idxPickFromListing_(L, ['propType', 'propertyType', 'PropertyType', 'Property Type']);
  listing.mlsPropSubType       = idxPickFromListing_(L, ['propSubType', 'PropertySubType', 'Property Sub Type']);
  listing.mlsYearBuilt         = idxPickFromListing_(L, ['yearBuilt', 'YearBuilt', 'Year Built']);
  listing.mlsAcres             = idxPickFromListing_(L, ['acres', 'Acres', 'LotSizeAcres', 'Lot Size Acres']);
  listing.mlsLotSize           = idxPickFromListing_(L, ['lotSize', 'LotSize', 'Lot Size Square Feet', 'LotSizeSquareFeet', 'LotSizeArea', 'Lot Size Dimensions', 'Lot Dimensions']);
  listing.mlsDaysOnMarket      = idxPickFromListing_(L, ['daysOnMarket', 'DaysOnMarket', 'Days On Market']);
  listing.mlsCumulativeDom     = idxPickFromListing_(L, ['cumulativeDaysOnMarket', 'CumulativeDaysOnMarket', 'Cumulative Days On Market']);
  listing.mlsListDate          = idxPickFromListing_(L, ['listDate', 'listingDate', 'ListingContractDate', 'OriginalEntryTimestamp', 'OnMarketDate']);
  if (listing.mlsListDate) listing.listDate = listing.mlsListDate;
  listing.mlsSoldDate          = idxPickFromListing_(L, ['soldDate', 'CloseDate', 'ClosingDate']);
  listing.mlsRemarks           = idxPickFromListing_(L, ['remarksConcat', 'PublicRemarks', 'Public Remarks', 'remarks']);
  listing.mlsTaxes             = idxPickFromListing_(L, ['TaxAnnualAmount', 'Tax Annual Amount', 'taxAnnualAmount', 'annualTaxAmount', 'Annual Tax Amount']);
  listing.mlsHoaDues           = idxPickFromListing_(L, ['AssociationFee', 'Association Fee', 'HOA Dues', 'hoaDues', 'MonthlyAssessment', 'Monthly Assessment', 'Master Association Fee']);
  listing.mlsSchoolDistrict    = idxPickFromListing_(L, ['HighSchoolDistrict', 'High School District', 'ElementarySchoolDistrict', 'Elementary School District', 'School District', 'schoolDistrict']);
  listing.mlsElementarySchool  = idxPickFromListing_(L, ['ElementarySchool', 'Elementary School']);
  listing.mlsMiddleSchool      = idxPickFromListing_(L, ['MiddleOrJuniorSchool', 'Middle School', 'Middle Or Junior School']);
  listing.mlsHighSchool        = idxPickFromListing_(L, ['HighSchool', 'High School']);
  listing.mlsParking           = idxPickFromListing_(L, ['ParkingTotal', 'Parking Total', 'parkingTotal']);
  listing.mlsGarageSpaces      = idxPickFromListing_(L, ['GarageSpaces', 'Garage Spaces', 'garageSpaces']);
  listing.mlsStories           = idxPickFromListing_(L, ['Stories', 'StoriesTotal', 'Total Stories']);
  listing.mlsTotalRooms        = idxPickFromListing_(L, ['RoomsTotal', 'Rooms Total', 'Total Rooms']);
  listing.mlsAreaMajor         = listing.mlsAreaMajor || idxPickFromListing_(L, ['advanced.mlsareamajor', 'mlsareamajor', 'MlsAreaMajor', 'MLS Area Major']);
  listing.mlsTownship          = listing.mlsTownship || idxPickFromListing_(L, ['advanced.township', 'township', 'Township', 'TownshipName', 'Township Name']);
  listing.mlsCity              = idxPickFromListing_(L, ['cityName', 'City']);
  listing.mlsCounty            = idxPickFromListing_(L, ['county', 'County', 'CountyOrParish']);
  listing.mlsZip               = idxPickFromListing_(L, ['zipcode', 'Zipcode', 'PostalCode', 'Postal Code']);
  listing.mlsLat               = idxPickFromListing_(L, ['latitude', 'Latitude']);
  listing.mlsLng               = idxPickFromListing_(L, ['longitude', 'Longitude']);
  listing.mlsFullDetailsUrl    = trim_(L.fullDetailsURL || L.detailsURL || listing.idxDetailsUrl || '');
  listing.mlsPhotos            = idxBuildPhotoGallery_(L);
  listing.openHouses           = idxBuildUpcomingOpenHouses_(L);

  // ── Extended IDX passthrough (agent ID, price history, sold price, etc.) ──
  // These power the dashboard's directory-driven agent matching, price-drop
  // chips, sold-vs-ask calculations, and map view (lat/lng).
  // MRED member # — matches Directory tab `mred_number` (same as IDX listingAgentID).
  listing.mlsListingAgentId        = idxPickFromListing_(L, [
    'listingAgentID', 'listingAgentId', 'ListAgentKey', 'List Agent ID',
    'advanced.mrdListingAgentID', 'advanced.mrdListAgentID', 'mrdListingAgentID'
  ]) || trim_(idxEntry.sheetListingAgentId || '');
  listing.listingAgentID           = listing.mlsListingAgentId;
  listing.mlsListingAgentMlsId     = idxPickFromListing_(L, ['listAgentMlsId', 'ListAgentMlsId', 'List Agent MLS ID']);

  var coList = idxExtractCoListAgent_(L);
  listing.mlsCoListAgentId         = coList.id || trim_(idxEntry.sheetCoListAgentId || '');
  listing.mlsCoListAgentName       = coList.name || trim_(idxEntry.sheetCoListAgentName || '');
  if (!listing.mlsCoListAgentId && !listing.mlsCoListAgentName && L.coListAgentName) {
    listing.mlsCoListAgentName = trim_(L.coListAgentName);
    listing.coListAgentName = listing.mlsCoListAgentName;
  }
  if (!listing.mlsCoListAgentId && L.coListAgentID) {
    listing.mlsCoListAgentId = trim_(L.coListAgentID);
    listing.coListAgentID = listing.mlsCoListAgentId;
  }
  listing.coListAgentID            = listing.mlsCoListAgentId;
  listing.coListAgentName          = listing.mlsCoListAgentName;
  listing.mlsOhCount               = oh.ohCount ? String(oh.ohCount) : trim_(idxEntry.ohCount || '0');
  listing.mlsPriceBeforeReduction  = idxPickFromListing_(L, ['priceBeforeReduction', 'PriceBeforeReduction', 'OriginalListPrice', 'Original List Price']);
  listing.mlsPriceReductionDate    = idxPickFromListing_(L, ['priceReductionDate', 'PriceReductionDate', 'PriceChangeTimestamp']);
  listing.mlsSoldPrice             = idxPickFromListing_(L, ['soldPrice', 'SoldPrice', 'ClosePrice', 'Close Price']);
  listing.mlsRehabYear             = idxPickFromListing_(L, ['advanced.mrdRehabYear', 'mrdRehabYear', 'rehabYear', 'RehabYear']);
  listing.mlsHomeType              = idxPickFromListing_(L, ['advanced.mrdTpc', 'mrdTpc', 'homeType', 'HomeType']);

  // Expose the full `advanced.*` object so the UI can pull taxes, schools,
  // location detail, and any other MRED extras without a per-field whitelist.
  listing.mlsAdvanced = (L && L.advanced && typeof L.advanced === 'object') ? L.advanced : {};

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
    hasAccessKey: !!trim_(props.getProperty('IDX_ACCESS_KEY')),
    watch: {
      lastCheckedAt: trim_(props.getProperty('IDX_WATCH_LAST_CHECK_AT')),
      lastChangedAt: trim_(props.getProperty('IDX_WATCH_LAST_CHANGE_AT')),
      signature: trim_(props.getProperty('IDX_WATCH_SIGNATURE')),
      lastCheckStatus: trim_(props.getProperty('IDX_WATCH_LAST_STATUS'))
    }
  };
}

// ---------------------------------------------------------------------------
// Near-real-time change detection
//
// IDX Broker doesn't push webhooks. The `clients/listcomponents` endpoint
// returns a per-component `componentLastUpdated` timestamp that flips whenever
// MRED data behind that feed changes. We poll it every minute (one cheap
// request), build a signature from the timestamps we care about, and only
// invoke the heavy `syncIdxListingsToSheet()` when the signature actually
// changes. A separate hourly safety-net trigger does a forced full sync in
// case listcomponents ever lags or is unavailable on the account tier.
// ---------------------------------------------------------------------------

var IDX_WATCH_COMPONENTS = ['featured', 'soldpending', 'supplemental'];

function idxFetchComponentTimestamps_() {
  var body = idxApiRequest_('listcomponents');
  var out = {};
  if (!body) return out;
  var arr = Object.prototype.toString.call(body) === '[object Array]'
    ? body
    : (body.data && Object.prototype.toString.call(body.data) === '[object Array]' ? body.data : null);
  if (!arr) {
    var k;
    for (k in body) {
      if (!body.hasOwnProperty(k)) continue;
      var v = body[k];
      if (v && typeof v === 'object' && (v.componentName || v.name)) {
        if (!arr) arr = [];
        arr.push(v);
      }
    }
  }
  if (!arr) return out;
  var i;
  for (i = 0; i < arr.length; i++) {
    var c = arr[i] || {};
    var name = String(c.componentName || c.name || '').toLowerCase();
    var when = c.componentLastUpdated || c.lastUpdated || c.lastupdate || '';
    if (name && when) out[name] = String(when);
  }
  return out;
}

function idxBuildWatchSignature_(timestamps) {
  var parts = [];
  var i;
  for (i = 0; i < IDX_WATCH_COMPONENTS.length; i++) {
    var k = IDX_WATCH_COMPONENTS[i];
    parts.push(k + '=' + (timestamps[k] || ''));
  }
  return parts.join('|');
}

/**
 * Trigger-driven (every 1 minute). Cheap signature check; full sync only on change.
 * Also callable manually from the editor or via POST { action: "checkidx", secret }.
 */
function checkIdxForUpdates() {
  var props = PropertiesService.getScriptProperties();
  var now = new Date();
  var timestamps, sig;
  try {
    timestamps = idxFetchComponentTimestamps_();
    sig = idxBuildWatchSignature_(timestamps);
  } catch (err) {
    props.setProperty('IDX_WATCH_LAST_CHECK_AT', now.toISOString());
    props.setProperty('IDX_WATCH_LAST_STATUS', 'error: ' + errorText_(err).slice(0, 180));
    return { success: false, changed: false, error: errorText_(err) };
  }

  props.setProperty('IDX_WATCH_LAST_CHECK_AT', now.toISOString());

  // No usable signature (e.g. listcomponents empty on this account tier).
  // Hourly safety-net trigger handles full refresh, so we no-op here.
  if (!sig || sig.replace(/[a-z]+=\|?/g, '').replace(/\|/g, '') === '') {
    props.setProperty('IDX_WATCH_LAST_STATUS', 'no-signature');
    return { success: true, changed: false, reason: 'no signature available', timestamps: timestamps };
  }

  var prevSig = trim_(props.getProperty('IDX_WATCH_SIGNATURE'));
  if (sig === prevSig) {
    props.setProperty('IDX_WATCH_LAST_STATUS', 'unchanged');
    return { success: true, changed: false, signature: sig };
  }

  var syncResult = syncIdxListingsToSheet();
  props.setProperty('IDX_WATCH_SIGNATURE', sig);
  props.setProperty('IDX_WATCH_LAST_CHANGE_AT', now.toISOString());
  props.setProperty('IDX_WATCH_LAST_STATUS', 'synced');

  return {
    success: true,
    changed: true,
    signature: sig,
    previousSignature: prevSig,
    timestamps: timestamps,
    sync: syncResult
  };
}

/**
 * Install the near-real-time pipeline:
 *   - 1-minute lightweight change detector (checkIdxForUpdates)
 *   - hourly forced full sync as safety net (syncIdxListingsToSheet)
 * Removes any older single 15-minute trigger.
 */
function installIdxFastSyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var i, fn;
  for (i = 0; i < triggers.length; i++) {
    fn = triggers[i].getHandlerFunction();
    if (fn === 'syncIdxListingsToSheet' || fn === 'checkIdxForUpdates') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('checkIdxForUpdates').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('syncIdxListingsToSheet').timeBased().everyHours(1).create();
  return {
    success: true,
    message: 'Installed 1-minute IDX change detector + hourly safety-net full sync.'
  };
}

/** Editor test — exercises the change detector once and logs the result. */
function testIdxCheckForUpdates() {
  var result = checkIdxForUpdates();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
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
  var sh = getListingsSheet_();
  if (!sh) throw new Error('Listings sheet not found');
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var idxMap = buildIdxListingsAddressMap_();
  var mlsMap = buildIdxListingsMlsMap_(idxMap);
  var listingsTab = 0;
  var idxMatched = 0;
  var r, c, rec, listing, row;
  for (r = 1; r < values.length; r++) {
    row = values[r];
    var has = false;
    for (c = 0; c < row.length; c++) if (String(row[c] || '').trim()) { has = true; break; }
    if (!has) continue;
    listingsTab++;
    rec = {};
    for (c = 0; c < headers.length; c++) rec[String(headers[c] || '').trim()] = row[c];
    listing = mapRecordToListing_(rec);
    listing = enrichListingFromIdx_(listing, findIdxEntryForListing_(listing, idxMap, mlsMap));
    if (listing.idxMatched) idxMatched++;
  }
  var summary = {
    listingsTab: listingsTab,
    idxMatched: idxMatched,
    unmatched: listingsTab - idxMatched,
    idxAddressKeys: (function () {
      var n = 0;
      var k;
      for (k in idxMap) if (idxMap.hasOwnProperty(k)) n++;
      return n;
    })()
  };
  Logger.log(JSON.stringify(summary, null, 2));
  return summary;
}

/** Log sample unmatched Listings addresses (for fixing typos / format). */
function testIdxListingMergeUnmatched() {
  var sh = getListingsSheet_();
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var idxMap = buildIdxListingsAddressMap_();
  var mlsMap = buildIdxListingsMlsMap_(idxMap);
  var unmatched = [];
  var r, c, rec, listing, row;
  for (r = 1; r < values.length; r++) {
    row = values[r];
    var has = false;
    for (c = 0; c < row.length; c++) if (String(row[c] || '').trim()) { has = true; break; }
    if (!has) continue;
    rec = {};
    for (c = 0; c < headers.length; c++) rec[String(headers[c] || '').trim()] = row[c];
    listing = mapRecordToListing_(rec);
    if (findIdxEntryForListing_(listing, idxMap, mlsMap)) continue;
    unmatched.push({
      address: listing.address,
      mlsNumber: listing.mlsNumber || '',
      status: listing.status || '',
      agent: listing.agent || ''
    });
  }
  Logger.log(
    JSON.stringify(
      { count: unmatched.length, sample: unmatched.slice(0, 40) },
      null,
      2
    )
  );
  return { count: unmatched.length, sample: unmatched.slice(0, 40) };
}

/** Editor diagnostic — shows what each IDX feed returns before sync. */
function testIdxSyncProbe() {
  var probe = idxProbeFeeds_();
  Logger.log(JSON.stringify(probe, null, 2));
  return { success: true, probe: probe };
}

/**
 * Discover where co-list fields live in IDX JSON (run before changing extractors).
 * Logs flat column names containing "colist" and sample values.
 */
/**
 * Editor test — API + HTML co-list discovery for one listing (e.g. 12657784 / Layne Zagorin).
 */
function testIdxCoListFromApi(listingID, idxID) {
  var lid = trim_(listingID || '12657784');
  var mls = trim_(idxID || 'c019');
  var allowed = idxFetchListAllowedFields_(mls);
  var coListInAllowed = idxListAllowedHasCoList_(allowed.fields || []);
  var report = {
    listingID: lid,
    idxID: mls,
    mlsCoListFieldNames: idxDiscoverMlsCoListFieldNames_(mls),
    listAllowedFieldsCount: (allowed.fields || []).length,
    coListInListAllowedFields: coListInAllowed || null,
    listAllowedFieldsSample: (allowed.fields || []).slice(0, 30),
    feedListingKeys: [],
    apiDetail: null,
    extractedFromFeed: null,
    extractedFromApi: null,
    searchQuery: null,
    diagnosis: ''
  };
  var chunk = idxFetchClientFeed_('featured').concat(idxFetchClientFeed_('soldpending'));
  var i, L, lidDigits;
  for (i = 0; i < chunk.length; i++) {
    L = chunk[i].listing;
    if (!L) continue;
    lidDigits = String(L.listingID || L.listingId || '').replace(/\D/g, '');
    if (lidDigits !== lid.replace(/\D/g, '')) continue;
    report.feedListingKeys = Object.keys(L).filter(function (k) {
      var n = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      return idxKeyLooksLikeCoList_(n) || n.indexOf('agent') >= 0 || n.indexOf('broker') >= 0;
    });
    report.extractedFromFeed = idxExtractCoListAgent_(L);
    if (L.advanced) {
      report.advancedCoKeys = Object.keys(L.advanced).filter(function (ak) {
        return idxKeyLooksLikeCoList_(String(ak).toLowerCase().replace(/[^a-z0-9]/g, ''));
      });
    }
    break;
  }
  var detail = idxFetchListingFullDetailFromApi_(mls, lid);
  if (detail) {
    report.apiDetail = {
      topKeys: Object.keys(detail).filter(function (k) {
        var n = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        return idxKeyLooksLikeCoList_(n) || n.indexOf('agent') >= 0 || n.indexOf('broker') >= 0;
      }),
      advancedCoKeys: detail.advanced ? Object.keys(detail.advanced).filter(function (ak) {
        return idxKeyLooksLikeCoList_(String(ak).toLowerCase().replace(/[^a-z0-9]/g, ''));
      }) : [],
      extracted: idxExtractCoListAgent_(detail)
    };
    report.extractedFromApi = report.apiDetail.extracted;
  }
  report.searchQuery = idxTrySearchQueryForListing_(mls, lid);
  if (!(report.extractedFromFeed && (report.extractedFromFeed.id || report.extractedFromFeed.name)) &&
      !(report.extractedFromApi && (report.extractedFromApi.id || report.extractedFromApi.name))) {
    if (report.mlsCoListFieldNames && report.mlsCoListFieldNames.length && !coListInAllowed) {
      report.diagnosis =
        'MLS searchfields includes co-list field names, but listallowedfields does not — IDX is not exporting ' +
        'co-list on featured/soldpending/API for this account. Fix: IDX Control Panel → MLS Settings → add ' +
        'Co-Listing Agent to the property details layout (displayable), or maintain the IdxCoList sheet tab ' +
        '(run ensureIdxCoListOverridesSheet()).';
    } else if (report.mlsCoListFieldNames && report.mlsCoListFieldNames.length && coListInAllowed) {
      report.diagnosis =
        'Co-list is in listallowedfields but this listing payload is still empty — ask IDX/Elm Street to verify ' +
        'MRED feed mapping for listing ' + lid + ', or use IdxCoList overrides.';
    } else {
      report.diagnosis =
        'No co-list values in IDX feed/API for this listing. Use IdxCoList overrides or Listings tab + Directory.';
    }
  } else {
    report.diagnosis = 'Co-list found in IDX payload.';
  }
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

/** Create IdxCoList tab with headers (safe to run from editor). */
function ensureIdxCoListSheet() {
  var sh = ensureIdxCoListOverridesSheet_();
  return { success: true, sheet: sh.getName() };
}

/** Editor test — fetch one listing detail URL from sheet and log parse results. */
function testIdxCoListScrapeOne() {
  var sh = getIdxListingsSheetReadOnly_();
  if (!sh || sh.getLastRow() < 2) throw new Error('IdxListings empty');
  var values = sh.getDataRange().getValues();
  var col = idxSheetHeaderIndex_(values[0]);
  var r, L, url, resolved, htmlCo, co;
  for (r = 1; r < values.length; r++) {
    L = idxParseListingJson_(idxCell_(values[r], col.rawJson));
    if (!L) continue;
    url = trim_(L.fullDetailsURL || L.detailsURL || '');
    if (!url) continue;
    resolved = idxResolveDetailsUrl_(url);
    htmlCo = idxFetchCoListFromDetailsPage_(url);
    co = idxExtractCoListAgent_(L);
    var apiDetail = idxFetchListingFullDetailFromApi_(trim_(L.idxID || L.idxId || 'c019'), L.listingID || L.listingId || '');
    var report = {
      listingID: L.listingID || L.listingId || '',
      address: L.address || '',
      rawUrl: url,
      resolvedUrl: resolved,
      existingFromJson: co,
      fromDetailPage: htmlCo,
      fromApiDetail: apiDetail ? idxExtractCoListAgent_(apiDetail) : null,
      mlsCoListFieldNames: idxDiscoverMlsCoListFieldNames_(trim_(L.idxID || L.idxId || 'c019'))
    };
    Logger.log(JSON.stringify(report, null, 2));
    return report;
  }
  throw new Error('No fullDetailsURL found on IdxListings rows');
}

function testIdxDiscoverCoListFields() {
  var items = idxCollectAllListings_();
  var flatKeyHits = {};
  var advKeyHits = {};
  var withCo = 0;
  var samples = [];
  var i, L, flat, co, k, norm;
  for (i = 0; i < items.length; i++) {
    L = items[i].listing || {};
    flat = idxFlattenListing_(L);
    co = idxExtractCoListAgent_(L, flat);
    if (co.id || co.name) withCo++;
    for (k in flat) {
      if (!flat.hasOwnProperty(k)) continue;
      norm = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (norm.indexOf('colist') < 0 && !(norm.indexOf('la2') >= 0 && norm.indexOf('agent') >= 0)) continue;
      flatKeyHits[k] = (flatKeyHits[k] || 0) + 1;
      if (samples.length < 8 && trim_(flat[k])) {
        samples.push({
          listingID: L.listingID || L.listingId || '',
          key: k,
          value: String(flat[k]).slice(0, 100)
        });
      }
    }
    var adv = L.advanced || {};
    for (k in adv) {
      if (!adv.hasOwnProperty(k)) continue;
      norm = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (norm.indexOf('colist') >= 0) advKeyHits[k] = (advKeyHits[k] || 0) + 1;
    }
  }
  var report = {
    total: items.length,
    extractedCoList: withCo,
    flatKeysMatching: flatKeyHits,
    advancedKeysMatching: advKeyHits,
    samples: samples
  };
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
