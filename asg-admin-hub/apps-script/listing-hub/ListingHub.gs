function debugListingsCounts() {
  var listings = getListings_();
  var active = 0, closed = 0, sample = null, firstActive = null;
  for (var i = 0; i < listings.length; i++) {
    var l = listings[i];
    if (isClosedListing_(l)) closed++;
    else { active++; if (!firstActive) firstActive = l; }
    if (i === 0) sample = l;
  }
  Logger.log(JSON.stringify({
    total: listings.length,
    active: active,
    closed: closed,
    sampleFirst: sample && { address: sample.address, status: sample.status, phaseKey: sample.phaseKey, dealStage: sample.dealStage, archived: sample.archived },
    sampleFirstActive: firstActive && { address: firstActive.address }
  }, null, 2));
}

/**
 * Editor test — confirms Listings-tab Address + Agent reach the dashboard API.
 * Run after assigning agents on the Listings tab (no IdxCoList sheet required).
 */
function testListingsAgentOverlay() {
  var overlayByAddr = buildListingsWorkflowOverlayByAddress_();
  var overlayRows = 0;
  var overlayWithAgent = 0;
  var k, ov;
  for (k in overlayByAddr) {
    if (!overlayByAddr.hasOwnProperty(k)) continue;
    overlayRows++;
    ov = overlayByAddr[k];
    if (trim_(ov.agent || ov.agentCanonical || '')) overlayWithAgent++;
  }
  var listings = getListings_();
  var withAgent = 0;
  var addressMismatchSamples = [];
  var i, l, key, agent;
  for (i = 0; i < listings.length; i++) {
    l = listings[i];
    agent = trim_(l.agent || l.agentCanonical || '');
    if (agent) {
      withAgent++;
      continue;
    }
    ov = findListingsOverlayForAddress_(l.address || '', overlayByAddr);
    if (ov && trim_(ov.agent || ov.agentCanonical || '') && addressMismatchSamples.length < 20) {
      addressMismatchSamples.push({
        idxAddress: l.address,
        listingsTabAgent: trim_(ov.agent || ov.agentCanonical || ''),
        hint: 'Listings row exists but address keys did not match — align Address text with IdxListings'
      });
    }
  }
  var listingsMatched = 0;
  for (i = 0; i < listings.length; i++) {
    if (listings[i].listingsMatched) listingsMatched++;
  }
  var summary = {
    listingsTabAddresses: overlayRows,
    listingsTabWithAgent: overlayWithAgent,
    idxInventoryRows: listings.length,
    listingsMatched: listingsMatched,
    dashboardRowsWithAgent: withAgent,
    addressMismatchSamples: addressMismatchSamples
  };
  Logger.log(JSON.stringify(summary, null, 2));
  return summary;
}
var SHEET_NAME = 'Listings';
var MARKETING_SHEET_NAME = 'Marketing';
var MICROSITES_SHEET_NAME = 'Microsites';
var DEFAULT_LISTINGS_SPREADSHEET_ID = '1DtyZsOi17q04rf3uoz72Cm9bgshuMza20p-GM9jKb1U';
var DEFAULT_DIRECTORY_SHEET_ID = '1gHZFkVGDyLgU_6Umb0O2U1kb6rUk9249jC04k9PW0ho';
var STATUS_CLOSED = { closed: true };
var LH_DEFAULTS = { asanaApiBaseUrl: 'https://app.asana.com/api/1.0', asanaMaxPages: 0 };
var QUESTIONNAIRE_SIGNATURE_PREFIX = 'this task was submitted through';
var QUESTIONNAIRE_SIGNATURE_KEY = 'seller questionnaire';
var AGENT_CANONICAL_FROM_SHEET_ALIAS = { 'alex 2.0': 'Alex Valladares' };
var AGENT_EMAILS = {
  'Alex Stoykov': 'alex.stoykov@compass.com',
  'Sam Abadi': 'sam.abadi@compass.com',
  'Shelly Channey': 'shelly.kapoor@compass.com',
  'Nicolas Gamboa Wills': 'nicolas.gamboawills@compass.com',
  'Julian Levit': 'julianlevit@compass.com',
  'Mino Conenna': 'mino.conenna@compass.com',
  'Angela Engelbrecht': 'angela.engelbrecht@compass.com',
  'Layne Zagorin': 'layne.zagorin@compass.com',
  'Barbara Laken': 'barbara.laken@compass.com',
  'Alex Valladares': 'alex.valladares@compass.com',
  'Gabriel Rendon': 'gabriel.rendon@compass.com',
  'Matthew Clevenger': 'matthew.clevenger@compass.com'
};
var CC_EMAILS = ['ellie.ngassa@compass.com', 'seph.gagon@compass.com', 'tim.urmanczy@compass.com', 'ellyn.andree@compass.com'];
var LISTING_ASSETS_EMAIL_DEFAULT_NOTE = 'I will send the floor plan as soon as Matterport delivers it to us.';
var SELLER_QUESTIONNAIRE_IMPORTED_LABEL = 'ASG/Questionnaire Imported';
var SELLER_QUESTIONNAIRE_DEFAULT_GMAIL_QUERY = 'newer_than:30d ("seller questionnaire" OR "listing questionnaire")';

function doGet(e) {
  try {
    var p = e && e.parameter ? e.parameter : {};
    var view = String(p.view || 'active').toLowerCase();
    if (view === 'diag') return jsonResponse_(diagnosticsPayload_());
    if (view === 'detailpage') return serveListingDetailPage_(p);
    if (view === 'microsite') return serveListingMicrositePage_(p);
    if (view === 'listing') return jsonResponse_(findSingleListingPayload_(p));
    if (view === 'listingphotos') return jsonResponse_(listingPhotosPayload_(p));
    if (view === 'listingops') return jsonResponse_(listingOpsPayload_(p));
    if (view === 'embedsnippet') return jsonResponse_(embedSnippetPayload_(p));
    if (view === 'micrositeembed') return jsonResponse_(micrositeEmbedSnippetPayload_(p));
    if (view === 'findlistingdebug') return jsonResponse_(findListingDebugPayload_(p));
    if (view === 'idxsync') return jsonResponse_({ success: true, idx: idxSyncStatusPayload_() });
    if (view === 'idxprobe') return jsonResponse_({ success: true, probe: idxProbeFeeds_() });
    var slim = String(p.slim || '').toLowerCase() !== '0';
    var listings;
    var out = [];
    var i;
    if (view === 'all') {
      listings = getListings_();
      if (slim) listings = listings.map(slimListingForApi_);
      out = listings;
    } else if (view === 'archive' || view === 'closed') {
      listings = getListings_();
      for (i = 0; i < listings.length; i++) {
        if (isClosedListing_(listings[i])) out.push(slim ? slimListingForApi_(listings[i]) : listings[i]);
      }
    } else {
      listings = getActiveListingsForApi_();
      out = listings;
    }
    return jsonResponse_({
      success: true,
      view: view,
      count: out.length,
      listings: out,
      meta: { webAppUrl: getPublicWebAppUrl_(), slim: slim || view === 'active' }
    });
  } catch (err) {
    return jsonResponse_({ success: false, error: errorText_(err) });
  }
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var data = JSON.parse(raw);
    var action = String(data.action || '').toLowerCase();
    if (action === 'sendlistingemail') return jsonResponse_(sendListingEmail_(data));
    if (action === 'requestopenhouse') {
      verifyWebhookSecret_(data.secret);
      return jsonResponse_(notifyOpenHouseRequest_(data));
    }
    if (action === 'questionnairecomplete') {
      verifyWebhookSecret_(data.secret);
      return jsonResponse_(handleQuestionnaireComplete_(data));
    }
    if (action === 'ingestquestionnaireemails') {
      verifyWebhookSecret_(data.secret);
      return jsonResponse_(ingestSellerQuestionnaireEmails());
    }
    if (action === 'createmarketingkickoff') {
      verifyWebhookSecret_(data.secret);
      return jsonResponse_(createMarketingKickoffTask_(data));
    }
    if (action === 'acuityupsert') {
      verifyWebhookSecret_(data.secret);
      return jsonResponse_(upsertAcuityBookingToSheet_(data));
    }
    if (action === 'asanaupsert') {
      verifyWebhookSecret_(data.secret);
      return jsonResponse_(upsertAsanaToSheet_(data));
    }
    if (action === 'syncasana') {
      verifyWebhookSecret_(data.secret);
      return jsonResponse_(syncAsanaToListingsSheet());
    }
    if (action === 'syncidx') {
      verifyWebhookSecret_(data.secret);
      return jsonResponse_(syncIdxListingsToSheet());
    }
    if (action === 'checkidx') {
      verifyWebhookSecret_(data.secret);
      return jsonResponse_(checkIdxForUpdates());
    }
    if (action === 'updatelisting') {
      // Lightweight inline edit from the admin dashboard. We intentionally
      // skip verifyWebhookSecret_ here so trusted admins on the platform can
      // post directly without juggling a secret; the endpoint only touches
      // the listings sheet for the matching address and only for fields the
      // sheet already declares as headers.
      var addr = String(data.address || '').trim();
      if (!addr) return jsonResponse_({ success: false, error: 'Missing address' });
      var updates = data.updates && typeof data.updates === 'object' ? data.updates : null;
      if (!updates) return jsonResponse_({ success: false, error: 'Missing updates' });
      // Only allow updates to whitelisted columns to keep this endpoint
      // narrow. Add more fields here if/when we expand inline editing.
      var allowed = {
        'Phase': true,
        'Status': true,
        'Listing Type': true,
        'notes': true,
        // Capture-service statuses + delivery timestamps.
        'photos_status': true,
        'photos_delivered_at': true,
        'matterport_status': true,
        'matterport_delivered_at': true,
        'floor_plan_status': true,
        'floor_plan_delivered_at': true,
        'video_status': true,
        'video_delivered_at': true,
        // Marketing materials roll-up + per-material status.
        'marketing_status': true,
        'marketing_requests': true,
        'fact_sheet_status': true,
        'fact_sheet_requested_at': true,
        'fact_sheet_delivered_at': true,
        'open_house_materials_status': true,
        'open_house_materials_requested_at': true,
        'open_house_materials_delivered_at': true,
        // Seller-questionnaire send state. seller_questionnaire_sent is a
        // boolean flag flipped to true when the agent copies the seller
        // questionnaire link from the action plan; seller_questionnaire_sent_at
        // captures the moment for auditing.
        'seller_questionnaire_sent': true,
        'seller_questionnaire_sent_at': true,
        'seller_questionnaire_received_at': true,
        // Workflow + audit.
        'marketing_action_plan_completed_at': true,
        'last_updated_at': true,
        'last_updated_by': true
      };
      var safeUpdates = {}, k;
      for (k in updates) {
        if (!updates.hasOwnProperty(k)) continue;
        if (allowed[k]) safeUpdates[k] = updates[k];
      }
      if (!Object.keys(safeUpdates).length) {
        return jsonResponse_({ success: false, error: 'No allowed fields in updates' });
      }
      return jsonResponse_(updateListingRowByAddress_(addr, safeUpdates));
    }
    return jsonResponse_({ success: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse_({ success: false, error: errorText_(err) });
  }
}

function getListingsSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var id =
    trim_(props.getProperty('LISTINGS_SPREADSHEET_ID')) ||
    trim_(props.getProperty('ASG_LISTINGS_SPREADSHEET_ID')) ||
    trim_(props.getProperty('LISTINGS_SHEET_SPREADSHEET_ID')) ||
    trim_(DEFAULT_LISTINGS_SPREADSHEET_ID);
  if (!id) {
    throw new Error(
      'Missing script property LISTINGS_SPREADSHEET_ID. Set it to the Listing Hub spreadsheet ID to avoid reading the wrong bound spreadsheet.'
    );
  }
  return SpreadsheetApp.openById(id);
}
function getListingsSheetName_() {
  var props = PropertiesService.getScriptProperties();
  return (
    trim_(props.getProperty('LISTINGS_SHEET_NAME')) ||
    trim_(props.getProperty('ASG_LISTINGS_SHEET_NAME')) ||
    SHEET_NAME
  );
}
function sheetListingsHeaderCheck_(sh) {
  if (!sh) return { ok: false, reason: 'sheet missing' };
  if (sh.getLastRow() < 2) return { ok: false, reason: 'no data rows (lastRow < 2)', lastRow: sh.getLastRow() };
  var headers = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
  var lowered = {};
  var headerList = [];
  var i;
  for (i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').trim();
    if (h) headerList.push(h);
    var key = h.toLowerCase();
    if (key) lowered[key] = true;
  }
  var hasAddress = !!lowered['address'];
  var hasAgent = !!lowered['agent'] || !!lowered['agent name'];
  var hasStatus =
    !!lowered['status'] ||
    !!lowered['deal_stage'] ||
    !!lowered['listing phase'] ||
    !!lowered['phase'];
  if (!hasAddress) {
    return { ok: false, reason: 'missing Address column in row 1', headers: headerList, lastRow: sh.getLastRow() };
  }
  if (!hasAgent && !hasStatus) {
    return {
      ok: false,
      reason: 'need Agent (or Agent Name) and/or Status (or Phase / deal_stage) in row 1',
      headers: headerList,
      lastRow: sh.getLastRow()
    };
  }
  return { ok: true, headers: headerList, lastRow: sh.getLastRow() };
}

function sheetLooksLikeListings_(sh) {
  return sheetListingsHeaderCheck_(sh).ok;
}
function getListingsSheet_() {
  var ss = getListingsSpreadsheet_();
  var wanted = getListingsSheetName_();
  var sh = ss.getSheetByName(wanted);
  if (sheetLooksLikeListings_(sh)) return sh;
  if (wanted !== SHEET_NAME) {
    var fallback = ss.getSheetByName(SHEET_NAME);
    if (sheetLooksLikeListings_(fallback)) return fallback;
  }
  var sheets = ss.getSheets();
  var i;
  for (i = 0; i < sheets.length; i++) {
    if (sheetLooksLikeListings_(sheets[i])) return sheets[i];
  }
  return null;
}
/**
 * Listings tab rows keyed by normalized address (workflow/marketing overlay only).
 */
function buildListingsWorkflowOverlayByAddress_() {
  var map = {};
  var sh = getListingsSheet_();
  if (!sh) return map;
  return buildListingOverlayByAddressFromSheet_(sh);
}

function getOptionalOverlaySheet_(name) {
  try {
    return getListingsSpreadsheet_().getSheetByName(name);
  } catch (e) {
    return null;
  }
}

function buildListingOverlayByAddressFromSheet_(sh) {
  var map = {};
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return map;
  var headers = values[0];
  var r, c, row, has, rec, listing, addrKey;
  for (r = 1; r < values.length; r++) {
    row = values[r];
    has = false;
    for (c = 0; c < row.length; c++) {
      if (String(row[c] || '').trim()) { has = true; break; }
    }
    if (!has) continue;
    rec = {};
    for (c = 0; c < headers.length; c++) rec[String(headers[c] || '').trim()] = row[c];
    listing = mapRecordToListing_(rec);
    addrKey = listingAddressMatchKey_(listing.address || '');
    if (!addrKey) continue;
    map[addrKey] = listing;
    var legacyKey = normalizeAddress_(listing.address || '');
    if (legacyKey && legacyKey !== addrKey) map[legacyKey] = listing;
  }
  return map;
}

function buildMarketingOverlayByAddress_() {
  var sh = getOptionalOverlaySheet_(MARKETING_SHEET_NAME);
  return sh ? buildListingOverlayByAddressFromSheet_(sh) : {};
}

function buildMicrositeOverlayByAddress_() {
  var sh = getOptionalOverlaySheet_(MICROSITES_SHEET_NAME);
  return sh ? buildListingOverlayByAddressFromSheet_(sh) : {};
}

function overlayIdentityKeysForListing_(listing) {
  var keys = [];
  var pairs = [
    ['idx_key', listing && listing.idxKey],
    ['listing_id', listing && listing.listingId],
    ['mls_number', listing && listing.mlsNumber]
  ];
  var i, v;
  for (i = 0; i < pairs.length; i++) {
    v = trim_(pairs[i][1]);
    if (v) keys.push(pairs[i][0] + '|' + (pairs[i][0] === 'idx_key' ? v : (v.replace(/\D/g, '') || v)));
  }
  return keys;
}

function overlayIdentityKeysForIdxEntry_(entry) {
  var L = (entry && entry.listing) || {};
  var keys = [];
  var vals = [
    ['idx_key', entry && entry.idxKey],
    ['listing_id', entry && (entry.listingId || L.listingID || L.listingId)],
    ['mls_number', entry && (entry.listingId || L.mlsNumber || L.mls_number || L.listingID || L.listingId)]
  ];
  var i, v;
  for (i = 0; i < vals.length; i++) {
    v = trim_(vals[i][1]);
    if (v) keys.push(vals[i][0] + '|' + (vals[i][0] === 'idx_key' ? v : v.replace(/\D/g, '')));
  }
  return keys;
}

function buildListingOverlayIndexFromSheet_(sh) {
  var index = { byId: {}, byAddr: {}, rows: [] };
  if (!sh) return index;
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return index;
  var headers = values[0];
  var r, c, row, has, rec, listing, keys, k, addrKey, legacyKey;
  for (r = 1; r < values.length; r++) {
    row = values[r];
    has = false;
    for (c = 0; c < row.length; c++) {
      if (String(row[c] || '').trim()) { has = true; break; }
    }
    if (!has) continue;
    rec = {};
    for (c = 0; c < headers.length; c++) rec[String(headers[c] || '').trim()] = row[c];
    listing = mapRecordToListing_(rec);
    index.rows.push(listing);
    keys = overlayIdentityKeysForListing_(listing);
    for (k = 0; k < keys.length; k++) {
      if (keys[k] && !/\|$/.test(keys[k])) index.byId[keys[k]] = listing;
    }
    addrKey = listingAddressMatchKey_(listing.address || '');
    if (addrKey) {
      if (!index.byAddr[addrKey]) index.byAddr[addrKey] = [];
      index.byAddr[addrKey].push(listing);
    }
    legacyKey = normalizeAddress_(listing.address || '');
    if (legacyKey && legacyKey !== addrKey) {
      if (!index.byAddr[legacyKey]) index.byAddr[legacyKey] = [];
      index.byAddr[legacyKey].push(listing);
    }
  }
  return index;
}

function buildListingsWorkflowOverlayIndex_() {
  return buildListingOverlayIndexFromSheet_(getListingsSheet_());
}

function buildMarketingOverlayIndex_() {
  return buildListingOverlayIndexFromSheet_(getOptionalOverlaySheet_(MARKETING_SHEET_NAME));
}

function buildMicrositeOverlayIndex_() {
  return buildListingOverlayIndexFromSheet_(getOptionalOverlaySheet_(MICROSITES_SHEET_NAME));
}

function findListingOverlayForIdxEntry_(entry, index) {
  if (!entry || !index) return null;
  var keys = overlayIdentityKeysForIdxEntry_(entry);
  var i, hit, addrKey, list, legacyKey;
  for (i = 0; i < keys.length; i++) {
    hit = index.byId && index.byId[keys[i]];
    if (hit) return hit;
  }
  addrKey = listingAddressMatchKey_(entry.address || '');
  list = addrKey && index.byAddr ? index.byAddr[addrKey] : null;
  if (list && list.length === 1) return list[0];
  legacyKey = normalizeAddress_(entry.address || '');
  list = legacyKey && index.byAddr ? index.byAddr[legacyKey] : null;
  return list && list.length === 1 ? list[0] : null;
}

/** Same normalized address key as IdxListings matching (unit-aware). */
function listingAddressMatchKey_(address) {
  return idxNormalizeAddressForMatch_(address);
}

/** Find Listings-tab overlay row for an IDX address (exact + fuzzy). */
function findListingsOverlayForAddress_(address, overlayByAddr) {
  if (!overlayByAddr || !address) return null;
  var norm = listingAddressMatchKey_(address);
  if (norm && overlayByAddr[norm]) return overlayByAddr[norm];
  var legacy = normalizeAddress_(address);
  if (legacy && overlayByAddr[legacy]) return overlayByAddr[legacy];

  var best = null;
  var bestScore = 0;
  var k, sc;
  for (k in overlayByAddr) {
    if (!overlayByAddr.hasOwnProperty(k)) continue;
    sc = idxAddressMatchScore_(norm || legacy, k);
    if (sc > bestScore) {
      bestScore = sc;
      best = overlayByAddr[k];
    }
  }
  return bestScore >= 0.78 ? best : null;
}

/**
 * After IDX enrich, re-apply Listings-tab workflow labels for dashboard chips
 * (Phase/Status on sheet) while keeping idxMlsStatus as MLS truth.
 */
function applyListingsWorkflowDisplay_(listing, overlay) {
  if (!listing || !overlay) return;
  listing.listingsMatched = true;
  var wfStatus = trim_(overlay.status || overlay.phase || overlay.dealStage || '');
  if (wfStatus) {
    listing.workflowStatus = wfStatus;
    listing.status = wfStatus;
    listing.phaseKey = normalizeStatusKey_(wfStatus) || listing.phaseKey;
    listing.phase = wfStatus;
  }
  if (trim_(overlay.listingType)) listing.listingType = trim_(overlay.listingType);
}

/** Copy workflow/marketing/integration fields from overlay; IDX owns property facts. */
var LISTING_WORKFLOW_OVERLAY_KEYS_ = [
  'agent', 'agentCanonical', 'agentSlug', 'agentQuestionnaireUrl', 'agentBookingUrl',
  'status', 'phaseKey', 'phase', 'dealStage', 'listingType', 'listPrice', 'listDate', 'mlsNumber',
  'archived', 'emailSent', 'coverImage', 'notes', 'compassLink', 'compass_link',
  'photos', 'matterport', 'floorPlan', 'video',
  'photosStatus', 'photosDatetime', 'photosBookingId', 'photosBookingUrl', 'photosDeliveredAt',
  'matterportStatus', 'matterportDeliveredAt', 'floorPlanStatus', 'floorPlanDeliveredAt',
  'videoStatus', 'videoDeliveredAt',
  'servicesBooked', 'acuityAppointmentType', 'acuityAppointmentDescription', 'acuityAddons',
  'acuityCalendarId', 'acuityLastSyncAt',
  'factSheet', 'factSheetStatus', 'factSheetRequestedAt', 'factSheetDeliveredAt',
  'openHouseMaterialsUrl', 'openHouseMaterialsStatus', 'openHouseMaterialsRequestedAt',
  'openHouseMaterialsDeliveredAt', 'openHouses', 'nextOpenHouseDate', 'nextOpenHouseStart',
  'nextOpenHouseEnd', 'marketingRequests', 'marketingStatus',
  'sellerName', 'sellerEmail', 'sellerPhone', 'sellerQuestionnaireContent',
  'sellerQuestionnaireAnswers', 'seller_questionnaire_answers', 'sellerQuestionnaireFormId',
  'sellerQuestionnaireLastSyncAt', 'sellerQuestionnaireReceivedAt', 'sellerQuestionnaireSent',
  'sellerQuestionnaireSentAt',
  'marketingActionPlanCompletedAt', 'lastUpdatedAt', 'lastUpdatedBy',
  'asanaTaskId', 'asanaProjectGid', 'asanaLastSyncAt', 'asanaOpenTasksCount', 'asanaDoneTasksCount',
  'fubDealId', 'integrationHealth', 'fubStage', 'fubOpenTaskCount', 'fubLastSyncAt'
];
var LISTING_MARKETING_OVERLAY_KEYS_ = [
  'agent', 'agentCanonical', 'coListAgentName', 'co_list_agent', 'mlsCoListAgentName', 'dealStage', 'listingType',
  'photos', 'matterport', 'floorPlan', 'video',
  'photosStatus', 'photosDeliveredAt',
  'matterportStatus', 'matterportDeliveredAt',
  'floorPlanStatus', 'floorPlanDeliveredAt',
  'videoStatus', 'videoDeliveredAt',
  'factSheet', 'factSheetStatus', 'factSheetRequestedAt', 'factSheetDeliveredAt',
  'openHouseMaterialsUrl', 'openHouseMaterialsStatus', 'openHouseMaterialsRequestedAt',
  'openHouseMaterialsDeliveredAt', 'marketingRequests', 'marketingStatus',
  'sellerQuestionnaireContent', 'sellerQuestionnaireAnswers', 'sellerQuestionnaireStatus',
  'sellerQuestionnaireFieldsJson', 'sellerQuestionnaireReceivedAt',
  'sellerName', 'sellerEmail', 'sellerPhone', 'sellerFirstName', 'sellerLastName',
  'propertyType', 'unitNumber', 'bedrooms', 'bathrooms', 'parking', 'storage',
  'hoaAssessment', 'rentalRestrictions', 'lockboxInfo', 'showingInstructions', 'preferredTiming',
  'lastUpdatedAt', 'lastUpdatedBy', 'notes'
];
var LISTING_MICROSITE_OVERLAY_KEYS_ = [
  'micrositeSlug', 'micrositeStatus', 'micrositeTemplate',
  'publishedUrl', 'squarespacePageUrl', 'squarespaceEmbedHtml',
  'micrositeHeadline', 'micrositeSubheadline', 'micrositeOverview',
  'micrositeNeighborhood', 'micrositeLat', 'micrositeLng',
  'heroImageUrl', 'gallerySource', 'galleryFolderUrl', 'galleryJson',
  'micrositeHighlightsJson', 'micrositeDetailsJson', 'micrositeCuratedPlacesJson',
  'micrositeSeoTitle', 'micrositeSeoDescription', 'micrositeOgImageUrl',
  'publishReady', 'missingAssets', 'lastPreviewedAt', 'lastPublishedAt', 'micrositeSyncedAt',
  'compassLink', 'compass_link', 'video', 'matterport', 'floorPlan'
];

function mergeListingFieldOverlay_(listing, overlay, keys) {
  if (!listing || !overlay) return listing;
  var i, k, v;
  keys = keys || [];
  for (i = 0; i < keys.length; i++) {
    k = keys[i];
    v = overlay[k];
    if (v === '' || v == null) continue;
    if (k === 'archived' || k === 'emailSent') {
      listing[k] = v;
      continue;
    }
    if (Array.isArray(v) && !v.length) continue;
    listing[k] = v;
  }
  return listing;
}

function mergeListingWorkflowOverlay_(listing, overlay) {
  return mergeListingFieldOverlay_(listing, overlay, LISTING_WORKFLOW_OVERLAY_KEYS_);
}

/** Digits-only key for MRED member # (Directory `mred_number` = IDX `listingAgentID`). */
function normalizeMredDigits_(v) {
  return String(v || '').replace(/\D/g, '').trim();
}

/**
 * Build mred_number → agent name from Directory tab(s).
 * Tries the listings spreadsheet first, then DIRECTORY_SHEET_ID if set.
 */
function buildDirectoryMredToNameMap_() {
  var map = {};
  var spreadsheets = [];
  var seenIds = {};
  var props = PropertiesService.getScriptProperties();
  var dirId = trim_(props.getProperty('DIRECTORY_SHEET_ID')) || DEFAULT_DIRECTORY_SHEET_ID;

  function addSpreadsheet_(ss) {
    if (!ss) return;
    var id = '';
    try { id = ss.getId(); } catch (e) { id = ''; }
    if (id && seenIds[id]) return;
    if (id) seenIds[id] = true;
    spreadsheets.push(ss);
  }

  try { addSpreadsheet_(getListingsSpreadsheet_()); } catch (e) {}
  if (dirId) {
    try { addSpreadsheet_(SpreadsheetApp.openById(dirId)); } catch (e) {}
  }

  var tabNames = ['Directory', 'Team Directory', 'team_directory'];
  var si, ss, ti, sh, values, headers, idxMred, idxName, r, mredKey, name;
  for (si = 0; si < spreadsheets.length; si++) {
    ss = spreadsheets[si];
    for (ti = 0; ti < tabNames.length; ti++) {
      sh = ss.getSheetByName(tabNames[ti]);
      if (!sh || sh.getLastRow() < 2) continue;
      values = sh.getDataRange().getValues();
      headers = values[0];
      idxMred = indexOfHeader_(headers, 'mred_number');
      if (idxMred === -1) idxMred = indexOfHeader_(headers, 'mred number');
      idxName = indexOfHeader_(headers, 'name');
      if (idxMred === -1 || idxName === -1) continue;
      for (r = 1; r < values.length; r++) {
        mredKey = normalizeMredDigits_(values[r][idxMred]);
        name = trim_(values[r][idxName]);
        if (!mredKey || !name) continue;
        map[mredKey] = name;
      }
    }
  }
  return map;
}

/** Canonical agent name → MRED # (inverse of buildDirectoryMredToNameMap_). */
function buildDirectoryNameToMredMap_() {
  var mredToName = buildDirectoryMredToNameMap_();
  var byName = {};
  var k, name, canon, lower;
  for (k in mredToName) {
    if (!mredToName.hasOwnProperty(k)) continue;
    name = trim_(mredToName[k]);
    if (!name) continue;
    canon = canonicalAgentName_(name);
    lower = String(name).toLowerCase();
    if (canon) byName[String(canon).toLowerCase()] = k;
    if (lower) byName[lower] = k;
  }
  return byName;
}

/**
 * When IDX omits co-list, use Listings-tab agent + Directory mred_number.
 * Returns true if co-list fields were set on listing.
 */
function fillCoListFromWorkflowOverlay_(listing, overlay, nameToMred) {
  if (!listing) return false;
  if (!overlay || !nameToMred) return false;
  var explicitCoList = trim_(overlay.coListAgentName || overlay.co_list_agent || overlay.mlsCoListAgentName || '');
  if (!explicitCoList && normalizeMredDigits_(listing.coListAgentID || listing.mlsCoListAgentId || '')) return false;
  var agent = explicitCoList || trim_(overlay.agent || overlay.agentCanonical || '');
  if (!agent) return false;
  var canon = canonicalAgentName_(agent);
  var mred = nameToMred[String(canon).toLowerCase()] || nameToMred[String(agent).toLowerCase()] || '';
  listing.coListAgentName = agent;
  listing.mlsCoListAgentName = agent;
  if (mred) {
    listing.coListAgentID = mred;
    listing.mlsCoListAgentId = mred;
  }
  listing.coListSource = explicitCoList ? 'overlay' : 'workflow';
  return true;
}

/** Resolve team agent from Directory when Listings tab has no agent_name. */
function applyDirectoryAgentFromMred_(listing, mredMap) {
  if (!listing || !mredMap) return listing;
  if (trim_(listing.agent)) return listing;

  var primary = normalizeMredDigits_(listing.listingAgentID || listing.mlsListingAgentId || '');
  var coId = normalizeMredDigits_(listing.coListAgentID || listing.mlsCoListAgentId || '');
  var chosen = '';
  var source = '';

  // Team listings: primary is often the broker of record; co-list is the roster agent.
  if (coId && mredMap[coId]) {
    chosen = mredMap[coId];
    source = 'co-list';
  } else if (primary && mredMap[primary]) {
    chosen = mredMap[primary];
    source = 'primary';
  } else if (coId && trim_(listing.mlsCoListAgentName || listing.coListAgentName)) {
    chosen = trim_(listing.mlsCoListAgentName || listing.coListAgentName);
    source = 'co-list-name';
  }

  if (!chosen) return listing;
  listing.agent = chosen;
  listing.agentCanonical = canonicalAgentName_(chosen);
  listing.agentMredSource = source;
  listing.agentMredId = source.indexOf('co') === 0 ? coId : primary;
  return listing;
}

/**
 * Dashboard inventory = every listing in IdxListings, enriched with MLS facts
 * and optional workflow data from the Listings tab (matched by address).
 *
 * options.activeOnly — fast path: skip sold/pending sheet rows + closed statuses.
 */
function getListings_(options) {
  options = options || {};
  var entries = readAllIdxListingEntries_(options);
  var overlayIndex = buildListingsWorkflowOverlayIndex_();
  var marketingIndex = buildMarketingOverlayIndex_();
  var micrositeIndex = buildMicrositeOverlayIndex_();
  var idxOpenHouseMap = buildIdxOpenHousesAddressMap_();
  var mredMap = buildDirectoryMredToNameMap_();
  var nameToMred = buildDirectoryNameToMredMap_();
  var out = [];
  var i, entry, listing, addrKey, overlay, marketingOverlay, micrositeOverlay, ohRows;
  for (i = 0; i < entries.length; i++) {
    entry = entries[i];
    listing = mapRecordToListing_({ Address: entry.address });
    overlay = findListingOverlayForIdxEntry_(entry, overlayIndex);
    marketingOverlay = findListingOverlayForIdxEntry_(entry, marketingIndex);
    micrositeOverlay = findListingOverlayForIdxEntry_(entry, micrositeIndex);
    if (options.activeOnly && overlay && overlay.archived) continue;
    if (overlay) listing = mergeListingWorkflowOverlay_(listing, overlay);
    if (marketingOverlay) listing = mergeListingFieldOverlay_(listing, marketingOverlay, LISTING_MARKETING_OVERLAY_KEYS_);
    if (micrositeOverlay) listing = mergeListingFieldOverlay_(listing, micrositeOverlay, LISTING_MICROSITE_OVERLAY_KEYS_);
    listing = enrichListingFromIdx_(listing, entry);
    if (overlay) {
      applyListingsWorkflowDisplay_(listing, overlay);
      fillCoListFromWorkflowOverlay_(listing, overlay, nameToMred);
    } else if (marketingOverlay) {
      applyListingsWorkflowDisplay_(listing, marketingOverlay);
      fillCoListFromWorkflowOverlay_(listing, marketingOverlay, nameToMred);
    } else {
      listing.listingsMatched = false;
    }
    if (options.activeOnly && isClosedListing_(listing)) continue;
    listing = applyDirectoryAgentFromMred_(listing, mredMap);
    addrKey = listingAddressMatchKey_(entry.address || '') || normalizeAddress_(entry.address || '');
    ohRows = idxOpenHouseMap[addrKey];
    if (!ohRows && addrKey) {
      ohRows = idxOpenHouseMap[normalizeAddress_(entry.address || '')];
    }
    if (ohRows && ohRows.length) {
      listing.openHouses = ohRows.slice();
      listing.nextOpenHouseDate = trim_(ohRows[0].date || listing.nextOpenHouseDate || '');
      listing.nextOpenHouseStart = trim_(ohRows[0].start || listing.nextOpenHouseStart || '');
      listing.nextOpenHouseEnd = trim_(ohRows[0].end || listing.nextOpenHouseEnd || '');
    }
    out.push(listing);
  }
  appendMarketingOnlyListings_(out, marketingIndex, options, nameToMred, mredMap);
  return out;
}

function appendMarketingOnlyListings_(out, marketingIndex, options, nameToMred, mredMap) {
  var rows = marketingIndex && marketingIndex.rows ? marketingIndex.rows : [];
  var i, listing;
  for (i = 0; i < rows.length; i++) {
    listing = rows[i];
    if (!listing || !trim_(listing.address)) continue;
    if (trim_(listing.idxKey || listing.listingId || listing.mlsNumber)) continue;
    if (listing.archived) continue;
    listing.idxMatched = false;
    listing.listingsMatched = true;
    listing.preMls = true;
    listing.status = trim_(listing.status || listing.dealStage || 'Pre Listing');
    listing.phaseKey = trim_(listing.phaseKey || 'prelisting');
    listing.phase = trim_(listing.phase || 'Pre-Listing');
    fillCoListFromWorkflowOverlay_(listing, listing, nameToMred);
    listing = applyDirectoryAgentFromMred_(listing, mredMap);
    if (options && options.activeOnly && isClosedListing_(listing)) continue;
    out.push(listing);
  }
}

/** Active inventory only (featured/supplemental + non-closed), for dashboard list API. */
function getActiveListings_() {
  return getListings_({ activeOnly: true });
}

/** Drop huge IDX blobs from list API responses (detail view can fetch full listing). */
function slimListingForApi_(listing) {
  if (!listing || typeof listing !== 'object') return listing;
  var copy = JSON.parse(JSON.stringify(listing));
  delete copy.idx;
  delete copy.mlsAdvanced;
  return copy;
}

function listingsActiveCacheKey_() {
  return 'listings_active_v4_' + getListingsSpreadsheet_().getId();
}

function invalidateListingsActiveCache_() {
  try {
    CacheService.getScriptCache().remove(listingsActiveCacheKey_());
  } catch (e) {}
}

/** Cached active listings for view=active (slim JSON). */
function getActiveListingsForApi_() {
  var props = PropertiesService.getScriptProperties();
  var sec = Number(props.getProperty('LISTINGS_ACTIVE_CACHE_SEC'));
  if (!sec && sec !== 0) sec = 120;
  var cache = CacheService.getScriptCache();
  var key = listingsActiveCacheKey_();
  if (sec > 0) {
    try {
      var hit = cache.get(key);
      if (hit) return JSON.parse(hit);
    } catch (eCache) {}
  }
  var listings = getActiveListings_();
  var slim = [];
  var i;
  for (i = 0; i < listings.length; i++) slim.push(slimListingForApi_(listings[i]));
  if (sec > 0) {
    try {
      var blob = JSON.stringify(slim);
      if (blob.length < 90000) cache.put(key, blob, Math.min(sec, 21600));
    } catch (ePut) {}
  }
  return slim;
}

/**
 * Read the dedicated IDX Open Houses tab and index by normalized address.
 * This lets the dashboard surface manual/test entries in that tab immediately
 * (and not only the open-house fields merged into IdxListings JSON).
 */
function buildIdxOpenHousesAddressMap_() {
  var out = {};
  var ss = getListingsSpreadsheet_();
  var name = (typeof getIdxOpenHousesSheetName_ === 'function')
    ? getIdxOpenHousesSheetName_()
    : 'Idx Open Houses';
  var sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return out;
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var idxAddress = indexOfHeader_(headers, 'Address');
  var idxDate = indexOfHeader_(headers, 'OH Date');
  var idxStart = indexOfHeader_(headers, 'OH Start');
  var idxEnd = indexOfHeader_(headers, 'OH End');
  if (idxAddress === -1 || idxDate === -1) return out;
  var r;
  for (r = 1; r < values.length; r++) {
    var row = values[r] || [];
    var addr = trim_(row[idxAddress]);
    var date = trim_(row[idxDate]);
    if (!addr || !date) continue;
    var key = listingAddressMatchKey_(addr);
    if (!key) continue;
    var legacyOh = normalizeAddress_(addr);
    if (!out[key]) out[key] = [];
    if (legacyOh && legacyOh !== key && !out[legacyOh]) out[legacyOh] = out[key];
    out[key].push({
      date: date,
      start: idxStart >= 0 ? trim_(row[idxStart]) : '',
      end: idxEnd >= 0 ? trim_(row[idxEnd]) : '',
      // Keep generic keys for UI parsers that expect open_house_*.
      open_house_date: date,
      open_house_start: idxStart >= 0 ? trim_(row[idxStart]) : '',
      open_house_end: idxEnd >= 0 ? trim_(row[idxEnd]) : ''
    });
  }
  for (var k in out) {
    if (!out.hasOwnProperty(k)) continue;
    out[k].sort(function (a, b) {
      var da = parseDate_(a.date);
      var db = parseDate_(b.date);
      var ta = da ? da.getTime() : 0;
      var tb = db ? db.getTime() : 0;
      if (ta !== tb) return ta - tb;
      return String(a.start || '').localeCompare(String(b.start || ''));
    });
  }
  return out;
}

function parseDate_(raw) {
  var s = trim_(raw);
  if (!s) return null;
  var d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null;
  var mm = Number(m[1]), dd = Number(m[2]), yy = Number(m[3]);
  if (yy < 100) yy += 2000;
  d = new Date(yy, mm - 1, dd);
  return isNaN(d.getTime()) ? null : d;
}
function diagnosticsPayload_() {
  var props = PropertiesService.getScriptProperties();
  var ss = getListingsSpreadsheet_();
  var sheets = ss.getSheets();
  var all = [];
  var sheetChecks = [];
  var i;
  for (i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    var check = sheetListingsHeaderCheck_(sh);
    all.push({ name: sh.getName(), rows: sh.getLastRow(), cols: sh.getLastColumn() });
    sheetChecks.push({
      name: sh.getName(),
      rows: sh.getLastRow(),
      cols: sh.getLastColumn(),
      validListingsTab: check.ok,
      reason: check.ok ? 'ok' : check.reason,
      headers: check.headers || []
    });
  }
  var chosen = getListingsSheet_();
  var listings = [];
  var parseError = '';
  try {
    listings = getListings_();
  } catch (err) {
    parseError = errorText_(err);
  }
  var active = 0;
  var closed = 0;
  for (i = 0; i < listings.length; i++) {
    if (isClosedListing_(listings[i])) closed++;
    else active++;
  }
  var dataRows = 0;
  var nonemptyRows = 0;
  if (chosen && chosen.getLastRow() >= 2) {
    dataRows = chosen.getLastRow() - 1;
    var vals = chosen.getRange(2, 1, chosen.getLastRow(), chosen.getLastColumn()).getValues();
    var r, c;
    for (r = 0; r < vals.length; r++) {
      var has = false;
      for (c = 0; c < vals[r].length; c++) {
        if (String(vals[r][c] || '').trim()) {
          has = true;
          break;
        }
      }
      if (has) nonemptyRows++;
    }
  }
  return {
    success: true,
    spreadsheetIdResolved:
      trim_(props.getProperty('LISTINGS_SPREADSHEET_ID')) ||
      trim_(props.getProperty('ASG_LISTINGS_SPREADSHEET_ID')) ||
      trim_(props.getProperty('LISTINGS_SHEET_SPREADSHEET_ID')) ||
      DEFAULT_LISTINGS_SPREADSHEET_ID,
    spreadsheetName: ss.getName(),
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/edit',
    configuredSheetName:
      trim_(props.getProperty('LISTINGS_SHEET_NAME')) ||
      trim_(props.getProperty('ASG_LISTINGS_SHEET_NAME')) ||
      SHEET_NAME,
    chosenSheetName: chosen ? chosen.getName() : '',
    chosenSheetLastRow: chosen ? chosen.getLastRow() : 0,
    dataRowsOnChosenSheet: dataRows,
    nonemptyDataRows: nonemptyRows,
    parsedListingsCount: listings.length,
    idxAddressKeys: (function () {
      var m = buildIdxListingsAddressMap_();
      var n = 0;
      var k;
      for (k in m) if (m.hasOwnProperty(k)) n++;
      return n;
    })(),
    idxMergedCount: (function () {
      var i, c = 0;
      for (i = 0; i < listings.length; i++) if (listings[i].idxMatched) c++;
      return c;
    })(),
    listingsTabMatched: (function () {
      var i, c = 0;
      for (i = 0; i < listings.length; i++) if (listings[i].listingsMatched) c++;
      return c;
    })(),
    activeListingsCount: active,
    closedOrArchivedCount: closed,
    parseError: parseError,
    sampleListing: listings[0]
      ? {
          address: listings[0].address,
          status: listings[0].status,
          phaseKey: listings[0].phaseKey,
          archived: listings[0].archived
        }
      : null,
    hint:
      !chosen
        ? 'No tab matched Listings rules. Fix row-1 headers on your data tab (Address + Agent + Status).'
        : nonemptyRows === 0
          ? 'Tab found but all data rows are empty. Add listing rows or check you opened the correct spreadsheet ID.'
          : listings.length === 0
            ? 'Rows exist on sheet but none parsed — check for hidden empty rows.'
            : active === 0
              ? 'Listings parse OK but view=active is 0. Try ?view=all or clear Archived / Closed status.'
              : 'Sheet read OK. If hubs still empty, update LISTINGS_API URL to this deployment.',
    sheets: all,
    sheetChecks: sheetChecks
  };
}
function mapRecordToListing_(rec) {
  // The Listings tab is now a workflow/marketing overlay. Property facts
  // (status, price, beds, baths, sqft, listingType, MLS#, list/close dates,
  // neighborhood) come from IDX via enrichListingFromIdx_(). We still read
  // Address (join key), Archived flag, agent name, and notes from Listings.
  var agentRaw = pick_(rec, ['Agent Name', 'agent_name', 'Agent']);
  var statusRaw = trim_(
    pick_(rec, ['Status', 'Phase', 'deal_stage', 'Deal Stage', 'Listing Phase', 'listing phase'])
  );
  return {
    // ── Core identity / lifecycle ──────────────────────────────────────────
    idxKey: trim_(pick_(rec, ['idx_key', 'Idx Key'])),
    feed: trim_(pick_(rec, ['feed', 'Feed'])),
    listingId: trim_(pick_(rec, ['listing_id', 'Listing ID'])),
    addressKey: trim_(pick_(rec, ['address_key', 'Address Key'])),
    address: trim_(pick_(rec, ['Address'])),
    agent: trim_(agentRaw),
    agentCanonical: canonicalAgentName_(agentRaw),
    coListAgentName: trim_(pick_(rec, ['co_list_agent', 'Co List Agent', 'coListAgentName', 'mlsCoListAgentName'])),
    co_list_agent: trim_(pick_(rec, ['co_list_agent', 'Co List Agent'])),
    mlsCoListAgentName: trim_(pick_(rec, ['mlsCoListAgentName', 'co_list_agent', 'Co List Agent'])),
    agentSlug: trim_(pick_(rec, ['agent_slug'])),
    agentQuestionnaireUrl: trim_(pick_(rec, ['agent_questionnaire_url'])),
    agentBookingUrl: trim_(pick_(rec, ['agent_booking_url'])),
    status: statusRaw,
    phaseKey: normalizeStatusKey_(statusRaw),
    phase: statusRaw,
    dealStage: trim_(pick_(rec, ['deal_stage', 'Deal Stage'])),
    listingType: trim_(pick_(rec, ['Listing Type', 'listing_type', 'Listing type'])),
    listPrice: trim_(pick_(rec, ['list_price', 'List Price'])),
    listDate: trim_(pick_(rec, ['list_date', 'List Date'])),
    mlsNumber: trim_(pick_(rec, ['mls_number', 'MLS Number', 'MLS #'])),
    archived: normalizeCheckbox_(pick_(rec, ['Archived'])),
    emailSent: normalizeCheckbox_(pick_(rec, ['Email Sent'])),

    // ── Listing metadata (workflow-only; property facts come from IDX) ────
    coverImage: trim_(pick_(rec, ['cover_image_url', 'Cover Image'])),
    notes: trim_(pick_(rec, ['notes'])),
    compassLink: trim_(pick_(rec, [
      'compass_link',
      'Compass Link',
      'compass_url',
      'Compass URL',
      'listing_url',
      'Listing URL',
      'listing_link',
      'Listing Link'
    ])),
    compass_link: trim_(pick_(rec, ['compass_link'])),

    // ── Capture assets (URLs) ─────────────────────────────────────────────
    photos: trim_(pick_(rec, ['photos_url', 'Photos', 'Photos URL'])),
    matterport: trim_(pick_(rec, ['matterport_url', 'Matterport', 'Matterport URL'])),
    floorPlan: trim_(pick_(rec, ['floor_plan_url', 'Floor Plan', 'Floor Plan URL'])),
    video: trim_(pick_(rec, ['video_url', 'Video', 'Listing Video Url', 'Listing Video URL'])),

    // ── Capture services: status + datetime + delivered timestamp ─────────
    photosStatus: trim_(pick_(rec, ['photos_status'])),
    photosDatetime: trim_(pick_(rec, ['photos_datetime'])),
    photosBookingId: trim_(pick_(rec, ['photos_booking_id'])),
    photosBookingUrl: trim_(pick_(rec, ['photos_booking_url'])),
    photosDeliveredAt: trim_(pick_(rec, ['photos_delivered_at'])),
    matterportStatus: trim_(pick_(rec, ['matterport_status'])),
    matterportDeliveredAt: trim_(pick_(rec, ['matterport_delivered_at'])),
    floorPlanStatus: trim_(pick_(rec, ['floor_plan_status'])),
    floorPlanDeliveredAt: trim_(pick_(rec, ['floor_plan_delivered_at'])),
    videoStatus: trim_(pick_(rec, ['video_status'])),
    videoDeliveredAt: trim_(pick_(rec, ['video_delivered_at'])),

    // ── Acuity booking detail (drives services_booked parsing) ────────────
    servicesBooked: parseServicesBookedField_(pick_(rec, ['services_booked'])),
    acuityAppointmentType: trim_(pick_(rec, ['acuity_appointment_type'])),
    acuityAppointmentDescription: trim_(pick_(rec, ['acuity_appointment_description'])),
    acuityAddons: safeJsonParseArray_(pick_(rec, ['acuity_addons'])),
    acuityCalendarId: trim_(pick_(rec, ['acuity_calendar_id'])),
    acuityLastSyncAt: trim_(pick_(rec, ['acuity_last_sync_at'])),

    // ── Marketing materials (Fact Sheet + Open House) ─────────────────────
    factSheet: trim_(pick_(rec, ['fact_sheet_url', 'Fact Sheet', 'Fact Sheet URL'])),
    factSheetStatus: trim_(pick_(rec, ['fact_sheet_status'])),
    factSheetRequestedAt: trim_(pick_(rec, ['fact_sheet_requested_at'])),
    factSheetDeliveredAt: trim_(pick_(rec, ['fact_sheet_delivered_at'])),
    openHouseMaterialsUrl: trim_(pick_(rec, ['open_house_materials_url', 'Open House Materials Url', 'Open House Materials URL'])),
    openHouseMaterialsStatus: trim_(pick_(rec, ['open_house_materials_status'])),
    openHouseMaterialsRequestedAt: trim_(pick_(rec, ['open_house_materials_requested_at'])),
    openHouseMaterialsDeliveredAt: trim_(pick_(rec, ['open_house_materials_delivered_at'])),
    openHouses: safeJsonParseArray_(pick_(rec, ['open_houses', 'idx_open_houses', 'idx_open_house_schedule'])),
    nextOpenHouseDate: trim_(pick_(rec, ['next_open_house_date', 'nextOpenHouseDate', 'idx_next_open_house_date'])),
    nextOpenHouseStart: trim_(pick_(rec, ['next_open_house_start', 'nextOpenHouseStart', 'idx_next_open_house_start'])),
    nextOpenHouseEnd: trim_(pick_(rec, ['next_open_house_end', 'nextOpenHouseEnd', 'idx_next_open_house_end'])),
    marketingRequests: safeJsonParseArray_(pick_(rec, ['marketing_requests'])),
    marketingStatus: trim_(pick_(rec, ['marketing_status'])),

    // ── Seller questionnaire ──────────────────────────────────────────────
    sellerName: trim_(pick_(rec, ['seller_name', 'Seller Name', 'Seller'])),
    sellerEmail: trim_(pick_(rec, ['seller_email', 'Seller Email'])),
    sellerPhone: trim_(pick_(rec, ['seller_phone', 'Seller Phone'])),
    sellerQuestionnaireContent: trim_(pick_(rec, [
      'seller_questionnaire_content',
      'seller_questionnaire',
      'Seller Questionnaire',
      'questionnaire_content'
    ])),
    sellerQuestionnaireAnswers: trim_(pick_(rec, [
      'seller_questionnaire_answers',
      'questionnaire_answers',
      'Seller Questionnaire Answers'
    ])),
    seller_questionnaire_answers: trim_(pick_(rec, ['seller_questionnaire_answers'])),
    sellerQuestionnaireStatus: trim_(pick_(rec, ['seller_questionnaire_status'])),
    sellerQuestionnaireFormId: trim_(pick_(rec, ['seller_questionnaire_form_id'])),
    sellerQuestionnaireFieldsJson: trim_(pick_(rec, ['seller_questionnaire_fields_json'])),
    sellerQuestionnaireLastSyncAt: trim_(pick_(rec, ['seller_questionnaire_last_sync_at'])),
    sellerQuestionnaireReceivedAt: trim_(pick_(rec, ['seller_questionnaire_received_at'])),
    sellerQuestionnaireSent: trim_(pick_(rec, ['seller_questionnaire_sent'])),
    sellerQuestionnaireSentAt: trim_(pick_(rec, ['seller_questionnaire_sent_at'])),
    sellerFirstName: trim_(pick_(rec, ['seller_first_name'])),
    sellerLastName: trim_(pick_(rec, ['seller_last_name'])),
    propertyType: trim_(pick_(rec, ['property_type'])),
    unitNumber: trim_(pick_(rec, ['unit_number'])),
    bedrooms: trim_(pick_(rec, ['bedrooms'])),
    bathrooms: trim_(pick_(rec, ['bathrooms'])),
    parking: trim_(pick_(rec, ['parking'])),
    storage: trim_(pick_(rec, ['storage'])),
    hoaAssessment: trim_(pick_(rec, ['hoa_assessment'])),
    rentalRestrictions: trim_(pick_(rec, ['rental_restrictions'])),
    lockboxInfo: trim_(pick_(rec, ['lockbox_info'])),
    showingInstructions: trim_(pick_(rec, ['showing_instructions'])),
    preferredTiming: trim_(pick_(rec, ['preferred_timing'])),

    // ── Workflow + audit ──────────────────────────────────────────────────
    marketingActionPlanCompletedAt: trim_(pick_(rec, ['marketing_action_plan_completed_at'])),
    lastUpdatedAt: trim_(pick_(rec, ['last_updated_at'])),
    lastUpdatedBy: trim_(pick_(rec, ['last_updated_by'])),

    // ── Integrations: Asana / FUB ─────────────────────────────────────────
    asanaTaskId: trim_(pick_(rec, ['asana_task_id'])),
    asanaProjectGid: trim_(pick_(rec, ['asana_project_gid'])),
    asanaLastSyncAt: trim_(pick_(rec, ['asana_last_sync_at'])),
    asanaOpenTasksCount: trim_(pick_(rec, ['asana_open_tasks_count'])),
    asanaDoneTasksCount: trim_(pick_(rec, ['asana_done_tasks_count'])),
    fubDealId: trim_(pick_(rec, ['fub_deal_id'])),
    integrationHealth: trim_(pick_(rec, ['intergation_health', 'integration_health'])),
    fubStage: trim_(pick_(rec, ['fub_stage'])),
    fubOpenTaskCount: trim_(pick_(rec, ['fub_open_task_count'])),
    fubLastSyncAt: trim_(pick_(rec, ['fub_last_sync_at'])),

    // ── Public microsite overlay ───────────────────────────────────────────
    micrositeSlug: trim_(pick_(rec, ['microsite_slug'])),
    micrositeStatus: trim_(pick_(rec, ['microsite_status'])),
    micrositeTemplate: trim_(pick_(rec, ['microsite_template'])),
    publishedUrl: trim_(pick_(rec, ['published_url'])),
    squarespacePageUrl: trim_(pick_(rec, ['squarespace_page_url'])),
    squarespaceEmbedHtml: trim_(pick_(rec, ['squarespace_embed_html'])),
    micrositeHeadline: trim_(pick_(rec, ['microsite_headline'])),
    micrositeSubheadline: trim_(pick_(rec, ['microsite_subheadline'])),
    micrositeOverview: trim_(pick_(rec, ['microsite_overview'])),
    micrositeNeighborhood: trim_(pick_(rec, ['microsite_neighborhood'])),
    micrositeLat: trim_(pick_(rec, ['microsite_lat'])),
    micrositeLng: trim_(pick_(rec, ['microsite_lng'])),
    heroImageUrl: trim_(pick_(rec, ['hero_image_url'])),
    gallerySource: trim_(pick_(rec, ['gallery_source'])),
    galleryFolderUrl: trim_(pick_(rec, ['gallery_folder_url'])),
    galleryJson: trim_(pick_(rec, ['gallery_json'])),
    micrositeHighlightsJson: trim_(pick_(rec, ['microsite_highlights_json'])),
    micrositeDetailsJson: trim_(pick_(rec, ['microsite_details_json'])),
    micrositeCuratedPlacesJson: trim_(pick_(rec, ['microsite_curated_places_json'])),
    micrositeSeoTitle: trim_(pick_(rec, ['microsite_seo_title'])),
    micrositeSeoDescription: trim_(pick_(rec, ['microsite_seo_description'])),
    micrositeOgImageUrl: trim_(pick_(rec, ['microsite_og_image_url'])),
    publishReady: trim_(pick_(rec, ['publish_ready'])),
    missingAssets: trim_(pick_(rec, ['missing_assets'])),
    lastPreviewedAt: trim_(pick_(rec, ['last_previewed_at'])),
    lastPublishedAt: trim_(pick_(rec, ['last_published_at'])),
    micrositeSyncedAt: trim_(pick_(rec, ['synced_at']))
  };
}

/**
 * Parse the `services_booked` cell into an array. Accepts a CSV
 * ("photos,matterport,floor_plan,video") or a JSON array. Returns [] on
 * empty / unparseable input. Used by the dashboard's `listingHasService`.
 */
function parseServicesBookedField_(raw) {
  var v = trim_(raw);
  if (!v) return [];
  if (v.charAt(0) === '[') {
    try { var arr = JSON.parse(v); return Array.isArray(arr) ? arr.map(function (x) { return String(x || '').toLowerCase().replace(/\s+/g, '_'); }) : []; } catch (e) { /* fall through */ }
  }
  return v.split(',').map(function (s) { return trim_(s).toLowerCase().replace(/\s+/g, '_'); }).filter(function (s) { return !!s; });
}

/**
 * Defensive JSON.parse that always returns an array. Used for the
 * `marketing_requests` and `acuity_addons` columns which store JSON arrays
 * as text inside a single cell.
 */
function safeJsonParseArray_(raw) {
  var v = trim_(raw);
  if (!v) return [];
  try {
    var parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function lhSlugify_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/#/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function lhSlugWithoutUnitWords_(value) {
  return lhSlugify_(value)
    .replace(/-(unit|apt|apartment|suite|ste)-/g, '-')
    .replace(/-(unit|apt|apartment|suite|ste)-?$/g, '')
    .replace(/^-+|-+$/g, '');
}

function listingSlugMatches_(listing, slug) {
  var target = lhSlugify_(slug);
  var targetLoose = lhSlugWithoutUnitWords_(slug);
  var candidates;
  var i;
  if (!listing || !target) return false;
  candidates = [
    listing.micrositeSlug,
    listing.address,
    listing.address + ' ' + (listing.mlsUnitNumber || '')
  ];
  for (i = 0; i < candidates.length; i++) {
    if (lhSlugify_(candidates[i]) === target) return true;
    if (targetLoose && lhSlugWithoutUnitWords_(candidates[i]) === targetLoose) return true;
  }
  return false;
}

function findListingByParams_(p) {
  var slug = trim_(p && p.slug);
  var address = trim_(p && p.address);
  if (!address && !slug) return null;
  if (slug) {
    var allForSlug = getListings_();
    for (var si = 0; si < allForSlug.length; si++) {
      if (listingSlugMatches_(allForSlug[si], slug)) return allForSlug[si];
    }
  }
  if (!address) return null;
  var norm = listingAddressMatchKey_(address) || normalizeAddress_(address);
  var all = getListings_();
  var i, rowNorm, legacy, rowLegacy, best, bestScore, score;
  for (i = 0; i < all.length; i++) {
    rowNorm = listingAddressMatchKey_(all[i].address) || normalizeAddress_(all[i].address);
    if (rowNorm === norm) return all[i];
  }
  legacy = normalizeAddress_(address);
  best = null;
  bestScore = 0;
  for (i = 0; i < all.length; i++) {
    rowNorm = listingAddressMatchKey_(all[i].address) || '';
    rowLegacy = normalizeAddress_(all[i].address);
    score = Math.max(
      idxAddressMatchScore_(norm, rowNorm),
      idxAddressMatchScore_(legacy, rowLegacy)
    );
    if (score > bestScore) {
      bestScore = score;
      best = all[i];
    }
  }
  return bestScore >= 0.78 ? best : null;
}
function findSingleListingPayload_(p) { var l = findListingByParams_(p || {}); return l ? { success: true, listing: l } : { success: false, error: 'Listing not found' }; }

function findListingDebugPayload_(p) {
  var slug = trim_(p && p.slug);
  var address = trim_(p && p.address);
  var all = getListings_();
  var match = findListingByParams_(p || {});
  var needle = listingAddressMatchKey_(address) || normalizeAddress_(address || slug);
  var legacy = normalizeAddress_(address || slug);
  var candidates = [];
  var i, rowNorm, rowLegacy, score;
  for (i = 0; i < all.length; i++) {
    rowNorm = listingAddressMatchKey_(all[i].address) || '';
    rowLegacy = normalizeAddress_(all[i].address);
    score = Math.max(
      idxAddressMatchScore_(needle, rowNorm),
      idxAddressMatchScore_(legacy, rowLegacy),
      listingSlugMatches_(all[i], slug) ? 1 : 0
    );
    if (score >= 0.45) {
      candidates.push({
        address: all[i].address,
        slug: all[i].micrositeSlug || lhSlugify_(all[i].address),
        status: all[i].status || all[i].idxMlsStatus || '',
        score: score
      });
    }
  }
  candidates.sort(function (a, b) { return b.score - a.score; });
  return {
    success: !!match,
    query: { slug: slug, address: address, normalizedAddress: needle },
    match: match ? {
      address: match.address,
      slug: match.micrositeSlug || lhSlugify_(match.address),
      status: match.status || match.idxMlsStatus || ''
    } : null,
    candidates: candidates.slice(0, 20)
  };
}
function listingPhotosPayload_(p) {
  var l = findListingByParams_(p || {});
  if (!l) return { success: false, error: 'Listing not found', photos: [] };
  var folderId = extractDriveFolderId_(l.galleryFolderUrl || l.photos), photos = [];
  if (folderId) try {
    var folder = DriveApp.getFolderById(folderId), files = folder.getFiles();
    while (files.hasNext() && photos.length < 100) {
      var f = files.next();
      if (String(f.getMimeType() || '').indexOf('image/') === 0) photos.push({ id: f.getId(), name: f.getName(), url: 'https://drive.google.com/uc?export=view&id=' + f.getId() });
    }
  } catch (err) {}
  return { success: true, address: l.address, photos: photos };
}
function listingOpsPayload_(p) {
  var l = findListingByParams_(p || {});
  if (!l) return { success: false, error: 'Listing not found' };
  return { success: true, listing: l, statusRoadmap: [{ key: 'prelisting', label: 'Pre-Listing', tasks: [{ key: 'photos', label: 'Photos', state: l.photosStatus || 'Not scheduled' }, { key: 'marketing', label: 'Marketing', state: l.marketingStatus || 'Not started' }, { key: 'questionnaire', label: 'Seller Questionnaire', state: l.sellerQuestionnaireContent ? 'Received' : 'Pending' }] }, { key: 'live', label: 'Live', tasks: [] }, { key: 'undercontract', label: 'Under Contract', tasks: [] }, { key: 'closed', label: 'Closed', tasks: [] }] };
}
function embedSnippetPayload_(p) { var l = findListingByParams_(p || {}); if (!l) return { success: false, error: 'Listing not found' }; var url = buildListingDetailUrl_(l.address); return { success: true, address: l.address, url: url, html: '<iframe src="' + htmlEsc_(url) + '" style="width:100%;min-height:980px;border:0;" loading="lazy"></iframe>' }; }
function micrositeEmbedSnippetPayload_(p) {
  var l = findListingByParams_(p || {});
  if (!l) return { success: false, error: 'Listing not found' };
  var url = buildListingMicrositeUrl_(l);
  return {
    success: true,
    address: l.address,
    slug: l.micrositeSlug || lhSlugify_(l.address),
    url: url,
    html: '<iframe src="' + htmlEsc_(url) + '" style="width:100%;min-height:1400px;border:0;" loading="lazy"></iframe>'
  };
}
function serveListingDetailPage_(p) {
  var one = findSingleListingPayload_(p || {});
  if (!one.success) return framedHtmlOutput_('Listing not found');
  var l = one.listing, t = HtmlService.createTemplateFromFile('ListingDetailPage');
  t.listingJson = JSON.stringify(l);
  t.opsJson = JSON.stringify(listingOpsPayload_({ address: l.address }));
  t.photosJson = JSON.stringify(listingPhotosPayload_({ address: l.address }).photos || []);
  t.useVisualMock = shouldUseVisualMock_(p);
  t.detailUrl = buildListingDetailUrl_(l.address);
  t.agentsJson = getAgentDirectoryJson_();
  t.defaultShareNote = LISTING_ASSETS_EMAIL_DEFAULT_NOTE;
  return allowFrame_(t.evaluate().setTitle(l.address || 'Listing HQ'));
}

function serveListingMicrositePage_(p) {
  var one = findSingleListingPayload_(p || {});
  if (!one.success) return framedHtmlOutput_('Listing not found');
  var l = one.listing;
  var status = normalizeStatusKey_(l.micrositeStatus || '');
  if (status === 'paused' || status === 'archived') {
    return framedHtmlOutput_('This listing microsite is not currently available.');
  }
  var t = HtmlService.createTemplateFromFile('ListingMicrositePage');
  t.listingJson = JSON.stringify(l);
  t.opsJson = JSON.stringify(listingOpsPayload_({ address: l.address }));
  t.photosJson = JSON.stringify(listingPhotosPayload_({ address: l.address }).photos || []);
  t.agentsJson = getAgentDirectoryJson_();
  t.micrositeUrl = buildListingMicrositeUrl_(l);
  t.defaultListingsApi = getPublicWebAppUrl_();
  return allowFrame_(t.evaluate()
    .setTitle(l.micrositeSeoTitle || l.micrositeHeadline || l.address || 'Listing')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1'));
}

function allowFrame_(output) {
  return output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function framedHtmlOutput_(html) {
  return allowFrame_(HtmlService.createHtmlOutput(html));
}

function sendListingEmail_(d) {
  var address = trim_(d.address), l = findListingByParams_({ address: address }) || {}, agent = trim_(d.agent || l.agentCanonical || l.agent), to = AGENT_EMAILS[agent] || '';
  if (!to) return { success: false, error: 'No email found for agent: ' + agent };
  var listingDetailUrl = buildListingDetailUrl_(address);
  var photosUrl = trim_(d.photos || l.photos);
  var walkthroughUrl = trim_(d.matterport || l.matterport);
  var videoUrl = trim_(d.video || l.video);
  var hi = firstNameFromAgent_(agent);
  var plainText = buildListingAssetsEmailPlainText_(hi, address, photosUrl, walkthroughUrl, listingDetailUrl, videoUrl);
  var html = buildListingAssetsEmailHtml_(hi, address, photosUrl, walkthroughUrl, listingDetailUrl, videoUrl, undefined, agent);
  var subject = address ? (address + ' - Photos, 3D Walkthrough & Floor Plan (New Listing)') : 'Listing assets ready';
  GmailApp.sendEmail(to, subject, plainText, { htmlBody: html, cc: CC_EMAILS.join(','), name: trim_(d.sentBy || 'ASG Marketing Team') });
  markEmailAsSent_(address);
  return { success: true, to: to, address: address };
}

/** Called from Listing HQ share UI via google.script.run — returns composed email without sending. */
function previewListingShareEmail(payload) {
  try {
    var r = composeListingShareEmail_(payload || {});
    if (!r.success) return r;
    return { success: true, html: r.html, plainText: r.plainText, subject: r.subject, to: r.to, address: r.address };
  } catch (err) {
    return { success: false, error: errorText_(err) };
  }
}

/** Called from Listing HQ share UI — sends from the account that owns the script deployment. */
function sendListingShareEmail(payload) {
  try {
    var r = composeListingShareEmail_(payload || {});
    if (!r.success) return r;
    var p = payload || {};
    GmailApp.sendEmail(r.to, r.subject, r.plainText, {
      htmlBody: r.html,
      cc: CC_EMAILS.join(','),
      name: trim_(p.sentBy || 'ASG Marketing Team')
    });
    markEmailAsSent_(r.address);
    return { success: true, to: r.to, subject: r.subject, address: r.address };
  } catch (err) {
    return { success: false, error: errorText_(err) };
  }
}
function createShellyListingEmailDraftNow() {
  var to = AGENT_EMAILS['Shelly Channey'] || 'shelly.kapoor@compass.com';
  var address = '1235 S Prairie Ave, #1307';
  var photosUrl = 'https://drive.google.com/drive/folders/1nwlokLO6E5sol2Rx7NaOhk7QtQ78nPex?usp=sharing';
  var walkthroughUrl = 'https://my.matterport.com/show/?m=RHRMcFsTcV3';
  var videoUrl = 'https://drive.google.com/file/d/1o3dYB4YqP8vHblRXNbYiUTU2oIPXtBcn/view?usp=sharing';
  var subject = '1235 S Prairie Ave, #1307 - Photos, 3D Walkthrough & Floor Plan (New Listing)';
  var plainText = buildListingAssetsEmailPlainText_('Shelly', address, photosUrl, walkthroughUrl, '', videoUrl);
  var htmlBody = buildListingAssetsEmailHtml_('Shelly', address, photosUrl, walkthroughUrl, '', videoUrl, undefined, 'Shelly Channey');

  var draft = GmailApp.createDraft(to, subject, plainText, {
    htmlBody: htmlBody,
    cc: CC_EMAILS.join(','),
    name: 'ASG Marketing Team'
  });
  return { success: true, draftId: draft.getId(), to: to, subject: subject };
}
function firstNameFromAgent_(fullName) {
  var parts = trim_(fullName).split(/\s+/).filter(function (x) {
    return x;
  });
  return parts.length ? parts[0] : 'there';
}
function getAgentDirectoryJson_() {
  var names = Object.keys(AGENT_EMAILS);
  names.sort(function (a, b) {
    return a.localeCompare(b);
  });
  var i,
    out = [];
  for (i = 0; i < names.length; i++) out.push({ name: names[i], email: AGENT_EMAILS[names[i]] });
  return JSON.stringify(out);
}
function composeListingShareEmail_(payload) {
  var address = trim_(payload.address);
  if (!address) return { success: false, error: 'Address required' };
  var l = findListingByParams_({ address: address }) || {};
  var agent = trim_(payload.agent || l.agentCanonical || l.agent);
  if (!agent) return { success: false, error: 'Agent required' };
  var to = AGENT_EMAILS[agent] || '';
  if (!to) return { success: false, error: 'No email found for agent: ' + agent };
  var listingDetailUrl = buildListingDetailUrl_(address);
  var photosUrl = trim_(payload.photos || l.photos);
  var walkthroughUrl = trim_(payload.matterport || l.matterport);
  var videoUrl = trim_(payload.video || l.video);
  var hiName = trim_(payload.hiName);
  if (!hiName) hiName = firstNameFromAgent_(agent);
  var notePlain = payload.note;
  var subject = trim_(payload.subject);
  if (!subject) subject = address ? address + ' - Photos, 3D Walkthrough & Floor Plan (New Listing)' : 'Listing assets ready';
  var plainText = buildListingAssetsEmailPlainText_(hiName, address, photosUrl, walkthroughUrl, listingDetailUrl, videoUrl, notePlain);
  var html = buildListingAssetsEmailHtml_(hiName, address, photosUrl, walkthroughUrl, listingDetailUrl, videoUrl, notePlain, agent);
  return { success: true, plainText: plainText, html: html, subject: subject, to: to, address: address };
}
function buildListingAssetsEmailNoteHtml_(notePlain) {
  var raw = notePlain === undefined || notePlain === null ? LISTING_ASSETS_EMAIL_DEFAULT_NOTE : String(notePlain);
  raw = trim_(raw);
  if (!raw) return '';
  var esc = htmlEsc_(raw)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .join('<br>');
  return '<p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#4b5360;">' + esc + '</p>';
}
function buildListingAssetsEmailPlainText_(hiName, address, photosUrl, walkthroughUrl, listingDetailUrl, videoUrl, notePlain) {
  var lines = [];
  lines.push('Hi ' + (trim_(hiName) || 'there') + ',');
  lines.push('');
  lines.push('Your listing photos are ready for ' + address + '.');
  lines.push('');
  if (photosUrl) lines.push('Download Photos: ' + photosUrl);
  if (walkthroughUrl) lines.push('View 3D Walkthrough: ' + walkthroughUrl);
  if (videoUrl) lines.push('View Social Media Video: ' + videoUrl);
  if (listingDetailUrl) lines.push('Open Listing HQ: ' + listingDetailUrl);
  var raw = notePlain === undefined || notePlain === null ? LISTING_ASSETS_EMAIL_DEFAULT_NOTE : String(notePlain);
  raw = trim_(raw);
  if (raw) {
    lines.push('');
    lines.push(raw);
    lines.push('');
  }
  lines.push('Best,');
  lines.push('Tim Urmanczy');
  lines.push('Creative Director');
  return lines.join('\n');
}
function buildListingAssetsEmailHtml_(hiName, address, photosUrl, walkthroughUrl, listingDetailUrl, videoUrl, notePlain, iconSourceName) {
  var safeHi = htmlEsc_(trim_(hiName) || 'there');
  var safeAddress = htmlEsc_(address || 'this listing');
  var safePhotosUrl = htmlEsc_(photosUrl);
  var safeWalkthroughUrl = htmlEsc_(walkthroughUrl);
  var safeListingDetailUrl = htmlEsc_(listingDetailUrl);
  var safeVideoUrl = htmlEsc_(videoUrl);
  var shellyIconUrl = 'https://images.squarespace-cdn.com/content/v1/645525ddf33bc2091db5603a/bb353046-c2fb-469d-a044-86717a6e95f0/ShellyDetail-SS26.jpg?format=1500w';
  var timIconUrl = 'https://images.squarespace-cdn.com/content/v1/645525ddf33bc2091db5603a/2a8918dd-61d9-46db-abd1-f145bd3c2e5a/TimDetail-SS26.jpg?format=1500w';
  var alexGroupLogoUrl = 'https://images.squarespace-cdn.com/content/v1/645525ddf33bc2091db5603a/fab4526a-3108-47f6-88fb-cc55decbef88/Logo.png?format=1500w';
  var iconKey = iconSourceName != null && String(iconSourceName) !== '' ? iconSourceName : hiName;
  var showShellyIcon = /shelly/i.test(String(iconKey || ''));
  var noteBlock = buildListingAssetsEmailNoteHtml_(notePlain);

  var headerSubline = 'New Listing - ' + safeAddress;
  var buttonBaseStyle = 'display:block;width:100%;max-width:260px;text-align:center;background:#111111;color:#ffffff !important;text-decoration:none;font-size:14px;font-weight:700;padding:10px 16px;border-radius:999px;margin:0 0 8px 0;';
  var photosButton = photosUrl
    ? '<a href="' + safePhotosUrl + '" target="_blank" rel="noopener" style="' + buttonBaseStyle + '">Download Photos</a>'
    : '';
  var walkthroughButton = walkthroughUrl
    ? '<a href="' + safeWalkthroughUrl + '" target="_blank" rel="noopener" style="' + buttonBaseStyle + '">View 3D Walkthrough</a>'
    : '';
  var videoButton = videoUrl
    ? '<a href="' + safeVideoUrl + '" target="_blank" rel="noopener" style="' + buttonBaseStyle + '">Video</a>'
    : '';
  var listingHQButton = listingDetailUrl
    ? '<a href="' + safeListingDetailUrl + '" target="_blank" rel="noopener" style="display:block;width:100%;max-width:260px;text-align:center;background:#ffffff;color:#111111 !important;text-decoration:none;font-size:14px;font-weight:700;padding:10px 16px;border-radius:999px;border:1px solid #d7dae0;margin:0 0 8px 0;">Open Listing HQ</a>'
    : '';

  return (
    '<div style="margin:0;padding:0;background:transparent;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#121212;">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;background-color:#ffffff;border:1px solid #e7e8eb;border-radius:14px;overflow:hidden;">' +
        '<tr>' +
          '<td style="padding:20px 20px 16px;background:#ffffff;background-color:#ffffff;color:#111111;">' +
            '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>' +
              '<td style="vertical-align:top;">' +
                '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
                  '<td style="vertical-align:middle;padding-right:10px;">' +
                    '<img src="' + htmlEsc_(alexGroupLogoUrl) + '" alt="Alex Stoykov Group" width="44" height="44" style="display:block;width:44px;height:44px;border-radius:999px;object-fit:cover;border:1px solid #d6dae2;">' +
                  '</td>' +
                  '<td style="vertical-align:middle;height:44px;">' +
                    '<div style="font-size:12px;line-height:1.2;letter-spacing:0.12em;text-transform:uppercase;color:#111111;white-space:nowrap;">ASG Marketing</div>' +
                    '<div style="font-size:12px;line-height:1.2;letter-spacing:0.12em;text-transform:uppercase;color:#111111;white-space:nowrap;">' + headerSubline + '</div>' +
                  '</td>' +
                '</tr></table>' +
              '</td>' +
              '<td style="text-align:right;vertical-align:top;">' +
                (showShellyIcon ? '<img src="' + htmlEsc_(shellyIconUrl) + '" alt="Shelly" width="44" height="44" style="display:inline-block;width:44px;height:44px;border-radius:999px;object-fit:cover;border:1px solid #d6dae2;">' : '') +
              '</td>' +
            '</tr></table>' +
            '<h1 style="margin:12px 0 0;font-size:40px;line-height:1.06;font-weight:750;letter-spacing:-0.02em;color:#111111;">Listing Assets Are Ready</h1>' +
          '</td>' +
        '</tr>' +
        '<tr>' +
          '<td style="padding:24px;color:#121212;background:#ffffff;background-color:#ffffff;">' +
            '<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#121212;">Hi ' + safeHi + ',</p>' +
            '<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#2d2d2d;">Your assets for <strong>' + safeAddress + '</strong> are ready.</p>' +
            noteBlock +
            '<div style="margin:0 0 22px;">' +
              photosButton +
              walkthroughButton +
              videoButton +
              listingHQButton +
            '</div>' +
            '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">' +
              '<tr>' +
                '<td style="vertical-align:top;padding-right:12px;">' +
                  '<img src="' + htmlEsc_(timIconUrl) + '" alt="Tim Urmanczy" width="56" height="56" style="display:block;width:56px;height:56px;border-radius:999px;object-fit:cover;border:1px solid #e6e8ec;">' +
                '</td>' +
                '<td style="vertical-align:top;">' +
                  '<div style="font-size:14px;line-height:1.35;color:#111111;font-weight:700;">Tim Urmanczy</div>' +
                  '<div style="font-size:13px;line-height:1.35;color:#5a6270;">Creative Director</div>' +
                  '<div style="font-size:12px;line-height:1.35;color:#7b8392;">ASG Marketing Team</div>' +
                '</td>' +
              '</tr>' +
            '</table>' +
          '</td>' +
        '</tr>' +
        '<tr>' +
          '<td style="padding:14px 24px;border-top:1px solid #eceef2;background:#ffffff;background-color:#ffffff;color:#666e7a;font-size:12px;line-height:1.5;">Sent by ASG Marketing Team</td>' +
        '</tr>' +
      '</table>' +
    '</div>'
  );
}
function notifyOpenHouseRequest_(d) { var a = trim_(d.address), r = gatherRecipients_([]); GmailApp.sendEmail(r[0], 'Open house requested: ' + a, '', { htmlBody: '<p>Open house requested for <strong>' + htmlEsc_(a) + '</strong>.</p>', cc: r.slice(1).join(',') }); return { success: true, address: a }; }
function handleQuestionnaireComplete_(d) {
  var nowIso = new Date().toISOString();
  var payload = questionnairePayloadFromData_(d || {}, nowIso);
  var marketing = upsertMarketingQuestionnaireRow_(payload);
  var listings = updateListingRowByAddress_(payload.address, {
    seller_questionnaire_content: payload.content,
    seller_questionnaire_received_at: payload.receivedAt,
    seller_questionnaire_last_sync_at: nowIso
  });
  return {
    success: marketing.success,
    address: payload.address,
    marketingRow: marketing.row,
    marketingCreated: !!marketing.created,
    listingsUpdated: !!listings.success,
    listingsMessage: listings.success ? '' : listings.error
  };
}
function questionnairePayloadFromData_(d, nowIso) {
  var content = trim_(d.content || d.seller_questionnaire_content || d.seller_questionnaire_answers || '');
  var contact = extractSellerContact_(content);
  var fields = questionnaireFieldsFromText_(content);
  var address = formatQuestionnaireMarketingAddress_(d.address || d.property_address || d.listing_address || extractQuestionnaireAddress_(content));
  return {
    address: address,
    content: content,
    answers: trim_(d.answers || d.seller_questionnaire_answers || content),
    fields: fields,
    agentName: trim_(d.agent_name || d.agentName || extractQuestionnaireAgent_(content)),
    sellerName: trim_(d.seller_name || d.sellerName || contact.name || [fields.seller_first_name, fields.seller_last_name].filter(Boolean).join(' ')),
    sellerEmail: trim_(d.seller_email || d.sellerEmail || contact.email),
    sellerPhone: trim_(d.seller_phone || d.sellerPhone || contact.phone),
    formId: trim_(d.form_id || d.seller_questionnaire_form_id),
    messageId: trim_(d.message_id || d.gmail_message_id),
    receivedAt: trim_(d.received_at || d.seller_questionnaire_received_at || nowIso),
    source: trim_(d.source || 'webhook')
  };
}
function upsertMarketingQuestionnaireRow_(payload) {
  payload = payload || {};
  var address = formatQuestionnaireMarketingAddress_(payload.address);
  if (!address) return { success: false, error: 'Missing questionnaire address' };
  var fields = payload.fields || questionnaireFieldsFromText_(payload.content || payload.answers || '');
  var sh = idxEnsureOverlaySheet_(MARKETING_SHEET_NAME, IDX_MARKETING_HEADERS);
  var values = sh.getDataRange().getValues();
  var headers = values[0].map(function (h) { return String(h || '').trim(); });
  var idx = idxOverlayHeaderIndex_(headers);
  var addressKey = idxNormalizeAddressForMatch_(address) || normalizeAddress_(address);
  var rowNum = findPreMlsMarketingRowByAddressKey_(values, idx, addressKey);
  var firstClosedRow = firstClosedMarketingRow_(values, idx);
  var created = false;
  if (rowNum < 0) {
    rowNum = firstClosedRow;
    if (rowNum > 1) sh.insertRowBefore(rowNum);
    else {
      rowNum = sh.getLastRow() + 1;
      sh.insertRowAfter(Math.max(1, sh.getLastRow()));
    }
    created = true;
  } else if (firstClosedRow > 1 && rowNum > firstClosedRow) {
    rowNum = moveMarketingRowBefore_(sh, rowNum, firstClosedRow);
  }
  var nowIso = new Date().toISOString();
  var updates = {
    address: address,
    address_key: addressKey,
    status: 'Pre Listing',
    agent_name: trim_(payload.agentName),
    deal_stage: 'Pre Listing',
    seller_questionnaire_status: 'Received',
    seller_questionnaire_received_at: trim_(payload.receivedAt) || nowIso,
    seller_questionnaire_content: trim_(payload.content),
    seller_questionnaire_answers: trim_(payload.answers || payload.content),
    seller_questionnaire_form_id: trim_(payload.formId),
    seller_questionnaire_message_id: trim_(payload.messageId),
    seller_questionnaire_last_sync_at: nowIso,
    seller_name: trim_(payload.sellerName),
    seller_email: trim_(payload.sellerEmail),
    seller_phone: trim_(payload.sellerPhone),
    seller_questionnaire_fields_json: JSON.stringify(fields),
    seller_first_name: trim_(fields.seller_first_name),
    seller_last_name: trim_(fields.seller_last_name),
    property_type: trim_(fields.property_type),
    unit_number: trim_(fields.unit_number),
    bedrooms: trim_(fields.bedrooms),
    bathrooms: trim_(fields.bathrooms),
    parking: trim_(fields.parking),
    storage: trim_(fields.storage),
    hoa_assessment: trim_(fields.hoa_assessment),
    rental_restrictions: trim_(fields.rental_restrictions),
    lockbox_info: trim_(fields.lockbox_info),
    showing_instructions: trim_(fields.showing_instructions),
    preferred_timing: trim_(fields.preferred_timing),
    marketing_status: 'Pre Listing',
    last_updated_at: nowIso,
    last_updated_by: trim_(payload.source) || 'seller_questionnaire_email'
  };
  writeMarketingRowUpdates_(sh, headers, rowNum, updates, created);
  SpreadsheetApp.flush();
  return { success: true, row: rowNum, created: created, address: address, fields: fields };
}
function moveMarketingRowBefore_(sh, sourceRow, beforeRow) {
  if (!sh || sourceRow <= 1 || beforeRow <= 1 || sourceRow <= beforeRow) return sourceRow;
  var lastCol = sh.getLastColumn();
  var rowValues = sh.getRange(sourceRow, 1, 1, lastCol).getValues();
  sh.insertRowBefore(beforeRow);
  sh.getRange(beforeRow, 1, 1, lastCol).setValues(rowValues);
  sh.deleteRow(sourceRow + 1);
  return beforeRow;
}
function firstClosedMarketingRow_(values, idx) {
  if (!values || values.length < 2) return -1;
  var feedCol = idx.feed;
  var statusCol = idx.status;
  var dealCol = idx.deal_stage;
  var marketingCol = idx.marketing_status;
  var r, statusText;
  for (r = 1; r < values.length; r++) {
    statusText = [
      feedCol == null ? '' : values[r][feedCol],
      statusCol == null ? '' : values[r][statusCol],
      dealCol == null ? '' : values[r][dealCol],
      marketingCol == null ? '' : values[r][marketingCol]
    ].join(' ');
    if (marketingStatusLooksClosed_(statusText)) return r + 1;
  }
  return -1;
}
function marketingStatusLooksClosed_(statusText) {
  var key = normalizeStatusKey_(statusText);
  if (!key) return false;
  if (idxSheetStatusLooksClosed_(statusText)) return true;
  return /soldpending|sold|closed|clsd|cancel|withdraw|expired|offmarket/.test(key);
}
function findPreMlsMarketingRowByAddressKey_(values, idx, addressKey) {
  if (!addressKey || !values || values.length < 2) return -1;
  var addressKeyCol = idx.address_key;
  var addressCol = idx.address;
  var idCols = [idx.idx_key, idx.listing_id, idx.mls_number];
  var r, i, hasIdentity, rowKey;
  for (r = 1; r < values.length; r++) {
    hasIdentity = false;
    for (i = 0; i < idCols.length; i++) {
      if (idCols[i] != null && trim_(values[r][idCols[i]])) {
        hasIdentity = true;
        break;
      }
    }
    if (hasIdentity) continue;
    rowKey = addressKeyCol == null ? '' : trim_(values[r][addressKeyCol]);
    if (!rowKey && addressCol != null) rowKey = idxNormalizeAddressForMatch_(values[r][addressCol]) || normalizeAddress_(values[r][addressCol]);
    if (rowKey === addressKey) return r + 1;
  }
  return -1;
}
function writeMarketingRowUpdates_(sh, headers, rowNum, updates, fillDefaults) {
  var idx = idxOverlayHeaderIndex_(headers);
  var defaults = fillDefaults ? idxBuildMarketingDefaults_({}, {}) : {};
  var key, col, value;
  for (key in defaults) {
    if (!defaults.hasOwnProperty(key)) continue;
    col = idx[key];
    if (col != null && trim_(sh.getRange(rowNum, col + 1).getValue()) === '') sh.getRange(rowNum, col + 1).setValue(defaults[key]);
  }
  for (key in updates) {
    if (!updates.hasOwnProperty(key)) continue;
    col = idx[key];
    if (col == null) continue;
    value = updates[key];
    if (value !== null && value !== undefined && String(value) !== '') sh.getRange(rowNum, col + 1).setValue(value);
  }
}
function extractQuestionnaireAddress_(text) {
  var s = String(text || '');
  return formatQuestionnaireMarketingAddress_(questionnaireLabeledValue_(s, [
    'property address',
    'listing address',
    'address',
    'home address'
  ]));
}
function extractQuestionnaireAddressFromSubject_(subject) {
  var s = trim_(subject);
  if (!s) return '';
  var m = s.match(/\]\s*(.+)$/);
  if (m && m[1]) return formatQuestionnaireMarketingAddress_(m[1]);
  m = s.match(/seller\s+questionnaire\s+(.+)$/i);
  return m && m[1] ? formatQuestionnaireMarketingAddress_(m[1]) : '';
}
function formatQuestionnaireMarketingAddress_(address) {
  var s = trim_(address);
  if (!s) return '';
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/,\s*(?:Chicago|CHICAGO)\s*,?\s*(?:IL|Illinois)?\s*\d{5}(?:-\d{4})?\s*$/i, '');
  s = s.replace(/,\s*(?:IL|Illinois)\s*\d{5}(?:-\d{4})?\s*$/i, '');
  s = s.replace(/\s+(?:Chicago|CHICAGO)\s*,?\s*(?:IL|Illinois)?\s*\d{5}(?:-\d{4})?\s*$/i, '');
  s = s.replace(/,\s*(?:Chicago|CHICAGO)\s*$/i, '');
  s = s.replace(/\b(unit|apt|apartment|suite|ste)\s*#?\s*([A-Za-z0-9-]+)\b/i, '#$2');
  s = s.replace(/\s+#/g, ', #');
  s = s.replace(/,\s*,+/g, ', ');
  s = s.replace(/\s+,/g, ',');
  s = s.replace(/,\s*$/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}
function extractQuestionnaireAgent_(text) {
  var s = String(text || '');
  var m = s.match(/submitted\s+through\s+(.+?)\s*-\s*seller\s+questionnaire/i);
  if (m && m[1]) return trim_(m[1]);
  m = s.match(/submitted\s+through\s+(.+?)\s+seller\s+questionnaire/i);
  return m && m[1] ? trim_(m[1]) : '';
}
function questionnaireLabeledValue_(text, labels) {
  var lines = String(text || '').split(/\r?\n/);
  var i, j, k, line, next, label, rgx, m;
  for (i = 0; i < lines.length; i++) {
    line = String(lines[i] || '').replace(/\s+/g, ' ').trim();
    if (!line) continue;
    for (j = 0; j < labels.length; j++) {
      label = labels[j].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      rgx = new RegExp('^' + label + '\\s*[:\\-]\\s*(.+)$', 'i');
      m = line.match(rgx);
      if (m && m[1]) return trim_(m[1]);
      rgx = new RegExp('^' + label + '\\s*[:\\-]?\\s*$', 'i');
      if (rgx.test(line)) {
        for (k = i + 1; k < Math.min(lines.length, i + 4); k++) {
          next = String(lines[k] || '').replace(/\s+/g, ' ').trim();
          if (next) return next;
        }
      }
    }
  }
  return '';
}
function questionnaireFieldsFromText_(text) {
  var s = String(text || '');
  var specs = [
    { key: 'seller_first_name', labels: ['seller firstname', 'seller first name', 'first name'] },
    { key: 'seller_last_name', labels: ['seller lastname', 'seller last name', 'last name'] },
    { key: 'agent_name', labels: ['agent name', 'listing agent', 'agent'] },
    { key: 'property_address', labels: ['property address', 'listing address', 'address', 'home address'] },
    { key: 'property_type', labels: ['property type', 'type of property', 'what type of property is this'] },
    { key: 'unit_number', labels: ['unit number', 'unit #', 'unit'] },
    { key: 'bedrooms', labels: ['bedrooms', 'beds', 'number of bedrooms'] },
    { key: 'bathrooms', labels: ['bathrooms', 'baths', 'number of bathrooms'] },
    { key: 'parking', labels: ['parking', 'parking information', 'parking info', 'garage parking'] },
    { key: 'storage', labels: ['storage', 'storage information', 'storage info'] },
    { key: 'hoa_assessment', labels: ['hoa', 'hoa assessment', 'monthly assessment', 'assessment', 'assessments'] },
    { key: 'rental_restrictions', labels: ['rental restrictions', 'rental restriction', 'rentals allowed', 'rental cap'] },
    { key: 'lockbox_info', labels: ['lockbox', 'lockbox info', 'lockbox information', 'lock box'] },
    { key: 'showing_instructions', labels: ['showing instructions', 'access instructions', 'access info'] },
    { key: 'preferred_timing', labels: ['preferred timing', 'preferred timeline', 'when would you like to go live', 'go live', 'timeline'] }
  ];
  var out = {};
  var i, val;
  for (i = 0; i < specs.length; i++) {
    val = questionnaireLabeledValue_(s, specs[i].labels);
    if (val) out[specs[i].key] = val;
  }
  return out;
}
function installSellerQuestionnaireEmailTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var i;
  for (i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'ingestSellerQuestionnaireEmails') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('ingestSellerQuestionnaireEmails').timeBased().everyMinutes(5).create();
  return { success: true, message: 'Installed 5-minute seller questionnaire email importer.' };
}
function ingestSellerQuestionnaireEmails() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { success: false, error: 'Questionnaire email import already running' };
  try {
    var props = PropertiesService.getScriptProperties();
    var query = trim_(props.getProperty('SELLER_QUESTIONNAIRE_GMAIL_QUERY')) || SELLER_QUESTIONNAIRE_DEFAULT_GMAIL_QUERY;
    var maxThreads = Number(props.getProperty('SELLER_QUESTIONNAIRE_MAX_THREADS') || '25');
    var label = GmailApp.getUserLabelByName(SELLER_QUESTIONNAIRE_IMPORTED_LABEL) || GmailApp.createLabel(SELLER_QUESTIONNAIRE_IMPORTED_LABEL);
    var threads = GmailApp.search(query, 0, Math.max(1, Math.min(maxThreads, 100)));
    var imported = 0;
    var skipped = 0;
    var errors = [];
    var importedRows = [];
    var scannedSubjects = [];
    var messagesSeen = 0;
    var noAddress = 0;
    var t, messages, m, parsed, res, threadImported, subject;
    for (t = 0; t < threads.length; t++) {
      threadImported = false;
      messages = threads[t].getMessages();
      for (m = 0; m < messages.length; m++) {
        messagesSeen++;
        subject = trim_(messages[m].getSubject && messages[m].getSubject());
        if (subject && scannedSubjects.length < 10) scannedSubjects.push(subject);
        parsed = questionnairePayloadFromGmailMessage_(messages[m]);
        if (!parsed.address) {
          noAddress++;
          skipped++;
          continue;
        }
        res = upsertMarketingQuestionnaireRow_(parsed);
        if (res.success) {
          imported++;
          threadImported = true;
          importedRows.push({ row: res.row, address: res.address, created: res.created });
        }
        else errors.push(res.error || ('Failed to import ' + messages[m].getId()));
      }
      if (threadImported) threads[t].addLabel(label);
    }
    return {
      success: errors.length === 0,
      query: query,
      scannedThreads: threads.length,
      messagesSeen: messagesSeen,
      imported: imported,
      skipped: skipped,
      noAddress: noAddress,
      importedRows: importedRows,
      scannedSubjects: scannedSubjects,
      errors: errors.slice(0, 10)
    };
  } finally {
    lock.releaseLock();
  }
}
function debugMarketingQuestionnaireRows() {
  var sh = idxEnsureOverlaySheet_(MARKETING_SHEET_NAME, IDX_MARKETING_HEADERS);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return { success: true, rows: [] };
  var headers = values[0].map(function (h) { return String(h || '').trim(); });
  var idx = idxOverlayHeaderIndex_(headers);
  var out = [];
  var r, address, status, questionnaireStatus, updated;
  for (r = 1; r < values.length; r++) {
    questionnaireStatus = idx.seller_questionnaire_status == null ? '' : trim_(values[r][idx.seller_questionnaire_status]);
    if (!questionnaireStatus) continue;
    address = idx.address == null ? '' : trim_(values[r][idx.address]);
    status = idx.status == null ? '' : trim_(values[r][idx.status]);
    updated = idx.last_updated_at == null ? '' : trim_(values[r][idx.last_updated_at]);
    out.push({ row: r + 1, address: address, status: status, questionnaireStatus: questionnaireStatus, lastUpdatedAt: updated });
  }
  return { success: true, count: out.length, rows: out.slice(-25) };
}
function questionnairePayloadFromGmailMessage_(msg) {
  var plain = trim_(msg.getPlainBody && msg.getPlainBody()) || stripHtml_(msg.getBody && msg.getBody());
  var subject = trim_(msg.getSubject && msg.getSubject());
  var from = trim_(msg.getFrom && msg.getFrom());
  var contact = extractSellerContact_(plain);
  var fields = questionnaireFieldsFromText_(plain);
  var agentName = extractQuestionnaireAgent_(plain) || fields.agent_name;
  var address = formatQuestionnaireMarketingAddress_(
    extractQuestionnaireAddress_(plain) ||
    extractQuestionnaireAddress_(subject) ||
    extractQuestionnaireAddressFromSubject_(subject)
  );
  return {
    address: address,
    content: plain,
    answers: plain,
    fields: fields,
    agentName: agentName,
    sellerName: contact.name || trim_([fields.seller_first_name, fields.seller_last_name].filter(Boolean).join(' ')),
    sellerEmail: contact.email || extractEmailFromHeader_(from),
    sellerPhone: contact.phone,
    messageId: msg.getId(),
    receivedAt: msg.getDate() ? msg.getDate().toISOString() : new Date().toISOString(),
    source: 'seller_questionnaire_email'
  };
}
function extractEmailFromHeader_(value) {
  var m = String(value || '').match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/);
  return m ? m[0] : '';
}
function createMarketingKickoffTask_(d) { return { success: true, queued: true, address: trim_(d.address) }; }
function upsertAcuityBookingToSheet_(d) { return updateListingRowByAddress_(trim_(d.address), { photos_status: trim_(d.photos_status || d.status || 'Scheduled'), photos_datetime: trim_(d.photos_datetime || d.datetime), photos_booking_id: trim_(d.photos_booking_id || d.booking_id), photos_booking_url: trim_(d.photos_booking_url || d.booking_url) }); }
function upsertAsanaToSheet_(d) { return updateListingRowByAddress_(trim_(d.address), { asana_task_id: trim_(d.asana_task_id || d.task_gid), asana_project_gid: trim_(d.asana_project_gid || d.project_gid), asana_open_tasks_count: numOrBlank_(d.asana_open_tasks_count), asana_done_tasks_count: numOrBlank_(d.asana_done_tasks_count), marketing_status: trim_(d.marketing_status), seller_questionnaire_content: trim_(d.seller_questionnaire_content), seller_questionnaire_last_sync_at: trim_(d.seller_questionnaire_content ? new Date().toISOString() : ''), asana_last_sync_at: new Date().toISOString() }); }

function syncAsanaToListingsSheet() {
  try {
    var token = trim_(PropertiesService.getScriptProperties().getProperty('ASANA_TOKEN'));
    var workspace = trim_(PropertiesService.getScriptProperties().getProperty('ASANA_WORKSPACE_GID'));
    if (!token || !workspace) return { success: false, error: 'ASANA_TOKEN and ASANA_WORKSPACE_GID are required' };
    var sh = getListingsSheet_();
    if (!sh) return { success: false, error: 'Listings sheet not found' };
    var values = sh.getDataRange().getValues();
    if (values.length < 2) return { success: true, syncedRows: 0, skippedRows: 0 };
    var h = values[0];
    var idxAddress = requireHeader_(h, 'Address'), idxTask = requireHeader_(h, 'asana_task_id'), idxProj = indexOfHeader_(h, 'asana_project_gid'), idxOpen = requireHeader_(h, 'asana_open_tasks_count'), idxDone = requireHeader_(h, 'asana_done_tasks_count'), idxMark = requireHeader_(h, 'marketing_status'), idxSync = requireHeader_(h, 'asana_last_sync_at'), idxQ = indexOfHeader_(h, 'seller_questionnaire_content'), idxQSync = indexOfHeader_(h, 'seller_questionnaire_last_sync_at'), idxHealth = indexOfHeader_(h, 'intergation_health');
    // Optional seller-contact columns. Populated when present so the admin
    // dashboard can surface seller name / email / phone above the questionnaire
    // "More details" pop-up without re-parsing the description client-side.
    var idxSellerName = indexOfHeader_(h, 'seller_name');
    var idxSellerEmail = indexOfHeader_(h, 'seller_email');
    var idxSellerPhone = indexOfHeader_(h, 'seller_phone');
    var projects = fetchAsanaProjectsByWorkspace_(token, workspace), nowIso = new Date().toISOString(), synced = 0, skipped = 0, r;
    for (r = 1; r < values.length; r++) {
      var row = r + 1, addr = trim_(values[r][idxAddress]);
      if (!addr) { skipped++; continue; }
      try {
        var proj = idxProj !== -1 ? trim_(values[r][idxProj]) : '';
        if (!proj) { var m = resolveAsanaProjectForAddress_(normalizeAddress_(addr), projects); if (m) { proj = m.gid; if (idxProj !== -1) sh.getRange(row, idxProj + 1).setValue(proj); } }
        if (!proj) { if (idxHealth !== -1) sh.getRange(row, idxHealth + 1).setValue('Asana sync: no matching project'); sh.getRange(row, idxSync + 1).setValue(nowIso); skipped++; continue; }
        var stats = fetchAsanaProjectTaskStats_(token, proj);
        var existing = trim_(values[r][idxTask]);
        var addressTask = findAddressTaskForProject_(token, proj, addr);
        var addressTaskId = addressTask ? trim_(addressTask.gid) : '';
        var anchor = addressTaskId || existing || stats.firstOpenTaskId || stats.firstTaskId || '';
        var q = fetchAsanaQuestionnaireFromTaskId_(token, addressTaskId || existing);
        if (anchor) sh.getRange(row, idxTask + 1).setValue(anchor);
        sh.getRange(row, idxOpen + 1).setValue(stats.openCount);
        sh.getRange(row, idxDone + 1).setValue(stats.doneCount);
        sh.getRange(row, idxMark + 1).setValue(stats.openCount > 0 ? 'In Progress' : 'Done');
        sh.getRange(row, idxSync + 1).setValue(nowIso);
        if (idxQ !== -1 && q) sh.getRange(row, idxQ + 1).setValue(q);
        if (idxQSync !== -1 && q) sh.getRange(row, idxQSync + 1).setValue(nowIso);
        if (q) {
          var contact = extractSellerContact_(q);
          if (idxSellerName !== -1 && contact.name) sh.getRange(row, idxSellerName + 1).setValue(contact.name);
          if (idxSellerEmail !== -1 && contact.email) sh.getRange(row, idxSellerEmail + 1).setValue(contact.email);
          if (idxSellerPhone !== -1 && contact.phone) sh.getRange(row, idxSellerPhone + 1).setValue(contact.phone);
        }
        if (idxHealth !== -1) {
          if (!addressTaskId) {
            sh.getRange(row, idxHealth + 1).setValue('Asana synced but address task not found');
          } else if (!q) {
            sh.getRange(row, idxHealth + 1).setValue('Asana synced; address task found but questionnaire signature missing in description: ' + truncate_(addressTask.name, 80));
          } else {
            sh.getRange(row, idxHealth + 1).setValue('Asana synced ' + nowIso);
          }
        }
        synced++;
      } catch (rowErr) {
        if (idxHealth !== -1) sh.getRange(row, idxHealth + 1).setValue('Asana row error: ' + truncate_(errorText_(rowErr), 220));
        sh.getRange(row, idxSync + 1).setValue(nowIso);
        skipped++;
      }
    }
    return { success: true, scannedRows: values.length - 1, syncedRows: synced, skippedRows: skipped, projectCount: projects.length, syncedAt: nowIso };
  } catch (err) { return { success: false, error: errorText_(err) }; }
}

function fetchAsanaProjectsByWorkspace_(token, workspace) { return fetchAsanaAllPages_(token, '/workspaces/' + encodeURIComponent(workspace) + '/projects?archived=false&limit=100&opt_fields=gid,name', 'data', LH_DEFAULTS.asanaMaxPages); }
function resolveAsanaProjectForAddress_(addr, projects) { if (!addr) return null; var best = null, bestScore = 0, i; for (i = 0; i < projects.length; i++) { var p = projects[i] || {}, score = scoreMatch_(addr, normalizeAddress_(p.name || '')); if (score > bestScore) { bestScore = score; best = p; } } return bestScore >= 0.55 ? best : null; }
function fetchAsanaProjectTaskStats_(token, project) { var open = fetchAsanaAllPages_(token, '/projects/' + encodeURIComponent(project) + '/tasks?completed_since=now&opt_fields=gid,completed,name,memberships.section.name', 'data', 0), all = fetchAsanaAllPages_(token, '/projects/' + encodeURIComponent(project) + '/tasks?completed_since=1970-01-01T00:00:00Z&opt_fields=gid,completed,name,memberships.section.name', 'data', 0), o = filterMarketingTasks_(open), a = filterMarketingTasks_(all); return { openCount: o.length, doneCount: Math.max(0, a.length - o.length), firstOpenTaskId: o.length ? trim_(o[0].gid) : '', firstTaskId: a.length ? trim_(a[0].gid) : '' }; }
function filterMarketingTasks_(tasks) { var out = [], i; for (i = 0; i < tasks.length; i++) if (isMarketingTask_(tasks[i])) out.push(tasks[i]); return out; }
function isMarketingTask_(t) { var n = String((t && t.name) || '').toLowerCase(); if (n.indexOf('marketing') >= 0) return true; var m = t && t.memberships ? t.memberships : [], i; for (i = 0; i < m.length; i++) { var sec = m[i] && m[i].section ? m[i].section : null; if (String((sec && sec.name) || '').toLowerCase().indexOf('marketing') >= 0) return true; } return false; }
function findAddressTaskForProject_(token, project, address) {
  var tasks = fetchAsanaAllPages_(token, '/projects/' + encodeURIComponent(project) + '/tasks?completed_since=1970-01-01T00:00:00Z&opt_fields=gid,name', 'data', 0);
  var addrNorm = normalizeAddress_(address || '');
  if (!addrNorm) return null;

  var i;
  // Pass 1: exact normalized title match
  for (i = 0; i < tasks.length; i++) {
    var t1 = tasks[i] || {};
    if (normalizeAddress_(t1.name || '') === addrNorm) return t1;
  }
  // Pass 2: title contains full normalized address
  for (i = 0; i < tasks.length; i++) {
    var t2 = tasks[i] || {};
    var n2 = normalizeAddress_(t2.name || '');
    if (n2 && n2.indexOf(addrNorm) >= 0) return t2;
  }
  // Pass 3: best fuzzy match, but require decent score
  var best = null;
  var bestScore = 0;
  for (i = 0; i < tasks.length; i++) {
    var t3 = tasks[i] || {};
    var s = scoreMatch_(addrNorm, normalizeAddress_(t3.name || ''));
    if (s > bestScore) {
      bestScore = s;
      best = t3;
    }
  }
  return bestScore >= 0.72 ? best : null;
}
function fetchAsanaQuestionnaireFromTaskId_(token, task) {
  var gid = trim_(task);
  if (!gid) return '';
  var url = LH_DEFAULTS.asanaApiBaseUrl + '/tasks/' + encodeURIComponent(gid) + '?opt_fields=gid,name,description,notes,html_notes,custom_fields.name,custom_fields.display_value';
  var res = UrlFetchApp.fetch(url, { method: 'get', headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }, muteHttpExceptions: true });
  if (res.getResponseCode() >= 300) return '';
  var body = JSON.parse(res.getContentText() || '{}');
  var t = body && body.data ? body.data : null;
  if (!t) return '';
  var txt = trim_(t.description) || trim_(t.notes) || stripHtml_(t.html_notes);
  if (!hasQuestionnaireSignature_(txt)) return '';
  if (!txt && t.custom_fields && t.custom_fields.length) {
    var parts = [];
    var i;
    for (i = 0; i < t.custom_fields.length; i++) {
      var cf = t.custom_fields[i] || {};
      var nn = trim_(cf.name);
      var vv = trim_(cf.display_value);
      if (nn && vv) parts.push(nn + ': ' + vv);
    }
    txt = parts.join('\n');
  }
  return txt;
}
/**
 * Best-effort extraction of seller contact info from a free-form questionnaire
 * description (Asana task description). Returns {name, email, phone} where any
 * field may be ''. Designed to be tolerant of casing and prefix labels.
 */
function extractSellerContact_(text) {
  var s = String(text || '');
  var out = { name: '', email: '', phone: '' };
  if (!s) return out;
  function findLabeled(rgx) {
    var m = s.match(rgx);
    return m && m[1] ? trim_(m[1]).replace(/[\r\n].*$/, '') : '';
  }
  out.name = findLabeled(/(?:seller(?:'s)?\s*name|owner\s*name|full\s*name|^name)\s*[:\-]\s*([^\r\n]+)/i);
  if (!out.name) {
    var first = questionnaireLabeledValue_(s, ['seller first name', 'seller firstname']);
    var last = questionnaireLabeledValue_(s, ['seller last name', 'seller lastname']);
    out.name = trim_([first, last].filter(Boolean).join(' '));
  }
  out.email = findLabeled(/email(?:\s*address)?\s*[:\-]\s*([^\s,;]+@[^\s,;]+)/i) || questionnaireLabeledValue_(s, ['email address', 'email']);
  out.phone = findLabeled(/(?:phone|mobile|cell)(?:\s*number)?\s*[:\-]\s*([+\d][\d\s().\-]{6,})/i) || questionnaireLabeledValue_(s, ['phone number', 'phone', 'mobile', 'cell']);
  if (!out.email) {
    var em = s.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/);
    if (em) out.email = em[0];
  }
  if (!out.phone) {
    var ph = s.match(/(?:\+?1[\s.\-]*)?\(?\d{3}\)?[\s.\-]*\d{3}[\s.\-]*\d{4}/);
    if (ph) out.phone = ph[0];
  }
  return out;
}

function hasQuestionnaireSignature_(txt) {
  var s = String(txt || '').toLowerCase();
  if (!s) return false;
  return s.indexOf(QUESTIONNAIRE_SIGNATURE_PREFIX) >= 0 && s.indexOf(QUESTIONNAIRE_SIGNATURE_KEY) >= 0;
}
function fetchAsanaAllPages_(token, path, key, maxPages) {
  var out = [];
  var next = LH_DEFAULTS.asanaApiBaseUrl + path;
  var pages = 0;
  var cap = Number(maxPages || 0);
  // cap <= 0 means "no practical page cap"
  if (!cap || cap < 1) cap = 1000;
  while (next && pages < cap) {
    pages++;
    var res = UrlFetchApp.fetch(next, { method: 'get', headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }, muteHttpExceptions: true });
    if (res.getResponseCode() >= 300) throw new Error('Asana request failed (' + res.getResponseCode() + '): ' + shortBody_(res));
    var body = JSON.parse(res.getContentText() || '{}');
    var list = body[key || 'data'] || [];
    var i;
    for (i = 0; i < list.length; i++) out.push(list[i]);
    next = body && body.next_page && body.next_page.uri ? String(body.next_page.uri) : '';
  }
  return out;
}

function sweepListingSheetForNewRows() { var props = PropertiesService.getScriptProperties(), sh = getListingsSheet_(); if (!sh) return; var last = sh.getLastRow(), prev = Number(props.getProperty('LISTINGS_LAST_ROW_NOTIFIED') || String(last - 1)); if (last <= prev) return; var rec = gatherRecipients_([]); GmailApp.sendEmail(rec[0], 'New listing row(s) in ASG Listings sheet (' + last + ' rows)', '', { htmlBody: '<p>Previous row marker: ' + prev + '<br>Current last row: ' + last + '</p>', cc: rec.slice(1).join(',') }); props.setProperty('LISTINGS_LAST_ROW_NOTIFIED', String(last)); }
function verifyWebhookSecret_(provided) { var expected = trim_(PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET')); if (expected && trim_(provided) !== expected) throw new Error('Unauthorized webhook secret'); }
function gatherRecipients_(arr) { var x = CC_EMAILS.slice(0), extra = String(PropertiesService.getScriptProperties().getProperty('LISTING_NOTIFY_EMAILS') || '').split(','), i; for (i = 0; i < extra.length; i++) { var e = trim_(extra[i]); if (e) x.push(e); } return uniqueStrings_(x.concat(arr || [])); }
function updateListingRowByAddress_(address, updates) { var sh = getListingsSheet_(); if (!sh) return { success: false, error: 'Listings sheet not found' }; var values = sh.getDataRange().getValues(); if (values.length < 2) return { success: false, error: 'Listings empty' }; var h = values[0], idxAddress = indexOfHeader_(h, 'Address'); if (idxAddress === -1) return { success: false, error: 'Address column not found' }; var target = normalizeAddress_(address), r, key; for (r = 1; r < values.length; r++) { if (normalizeAddress_(values[r][idxAddress]) !== target) continue; for (key in updates) if (updates.hasOwnProperty(key)) { var idx = indexOfHeader_(h, key); if (idx !== -1 && String(updates[key]) !== '') sh.getRange(r + 1, idx + 1).setValue(updates[key]); } return { success: true, row: r + 1 }; } return { success: false, error: 'Address not found: ' + address }; }
function markEmailAsSent_(address) { updateListingRowByAddress_(address, { 'Email Sent': true }); }
function isClosedListing_(item) {
  if (!item) return true;
  if (item.archived) return true;
  var st = normalizeStatusKey_(item.status || item.phaseKey || item.idxMlsStatus || '');
  if (!st) return false;
  if (STATUS_CLOSED[st]) return true;
  if (st.indexOf('sold') >= 0) return true;
  if (st.indexOf('closed') >= 0) return true;
  if (st.indexOf('withdraw') >= 0) return true;
  if (st.indexOf('expired') >= 0) return true;
  if (st.indexOf('cancel') >= 0) return true;
  if (st.indexOf('offmarket') >= 0) return true;
  return false;
}
function isUnderContractListing_(item) {
  if (!item || isClosedListing_(item)) return false;
  var st = normalizeStatusKey_(item.status || item.phaseKey || item.idxMlsStatus || '');
  return st.indexOf('undercontract') >= 0 || (st.indexOf('under') >= 0 && st.indexOf('contract') >= 0);
}
function normalizeCheckbox_(v) { if (v === true) return true; if (v === false) return false; v = String(v || '').toLowerCase(); return v === 'true' || v === 'yes' || v === '1'; }
function normalizeStatusKey_(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function normalizeAddress_(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim(); }
function canonicalAgentName_(name) { var n = String(name || '').trim(), key = n.toLowerCase(); return AGENT_CANONICAL_FROM_SHEET_ALIAS[key] || n; }
function scoreMatch_(a, b) { if (!a || !b) return 0; if (a === b) return 1; var at = a.split(' '), bt = b.split(' '), hits = 0, i, j; for (i = 0; i < at.length; i++) for (j = 0; j < bt.length; j++) if (at[i] && at[i] === bt[j]) { hits++; break; } return hits / Math.max(1, at.length); }
function shouldUseVisualMock_(p) { var q = String((p && p.mock) || '').toLowerCase(); if (q === '1' || q === 'true' || q === 'yes') return true; var prop = String(PropertiesService.getScriptProperties().getProperty('LISTING_DETAIL_VISUAL_MOCK') || '').toLowerCase(); return prop === '1' || prop === 'true' || prop === 'yes'; }
function getPublicWebAppUrl_() { var u = trim_(PropertiesService.getScriptProperties().getProperty('LISTING_WEB_APP_URL')); if (u) return u; try { var s = ScriptApp.getService(); return s ? String(s.getUrl() || '') : ''; } catch (err) { return ''; } }
function buildListingDetailUrl_(address) { var base = getPublicWebAppUrl_(); return base ? base + '?view=detailpage&address=' + encodeURIComponent(address || '') : ''; }
function buildListingMicrositeUrl_(listingOrAddress) {
  var base = getPublicWebAppUrl_();
  if (!base) return '';
  if (listingOrAddress && typeof listingOrAddress === 'object') {
    var slug = trim_(listingOrAddress.micrositeSlug) || lhSlugify_(listingOrAddress.address || '');
    if (slug) return base + '?view=microsite&slug=' + encodeURIComponent(slug);
    return base + '?view=microsite&address=' + encodeURIComponent(listingOrAddress.address || '');
  }
  return base + '?view=microsite&address=' + encodeURIComponent(listingOrAddress || '');
}
function extractDriveFolderId_(url) { var s = String(url || ''), m = s.match(/\/folders\/([a-zA-Z0-9_-]+)/); if (m && m[1]) return m[1]; m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/); return m && m[1] ? m[1] : ''; }
function pick_(obj, keys) {
  // Build a case-insensitive index of the record's keys once so the caller
  // can pass any casing variant (e.g. `Address` matches `address`,
  // `Agent Name` matches `agent_name`'s family of aliases).
  if (!obj.__ciIndex_) {
    var idx = {};
    var ok;
    for (ok in obj) {
      if (!obj.hasOwnProperty(ok) || ok === '__ciIndex_') continue;
      idx[String(ok).trim().toLowerCase()] = ok;
    }
    try { Object.defineProperty(obj, '__ciIndex_', { value: idx, enumerable: false }); }
    catch (e) { obj.__ciIndex_ = idx; }
  }
  var i, target, real, val;
  for (i = 0; i < keys.length; i++) {
    target = String(keys[i] || '').trim().toLowerCase();
    real = obj.__ciIndex_[target];
    if (!real) continue;
    val = obj[real];
    if (val !== '' && val != null) return val;
  }
  return '';
}
function requireHeader_(headers, name) { var i = indexOfHeader_(headers, name); if (i === -1) throw new Error('Missing required column: ' + name); return i; }
function indexOfHeader_(headers, name) { var t = String(name || '').trim().toLowerCase(), i; for (i = 0; i < headers.length; i++) if (String(headers[i] || '').trim().toLowerCase() === t) return i; return -1; }
function trim_(v) { return String(v || '').trim(); }
function numOrBlank_(v) { if (v === null || v === undefined || v === '') return ''; var n = Number(v); return isNaN(n) ? '' : n; }
function uniqueStrings_(arr) { var out = [], seen = {}, i; for (i = 0; i < arr.length; i++) { var s = trim_(arr[i]); if (!s) continue; if (seen[s]) continue; seen[s] = true; out.push(s); } return out; }
function shortBody_(res) { return truncate_(String(res.getContentText() || ''), 260); }
function truncate_(s, max) { s = String(s || ''); return s.length <= max ? s : s.slice(0, max); }
function stripHtml_(html) { return String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim(); }
function errorText_(err) { return String(err && err.message ? err.message : err); }
function htmlEsc_(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function jsonResponse_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function asanaSmokeCheck() {
  try {
    var token = trim_(PropertiesService.getScriptProperties().getProperty('ASANA_TOKEN'));
    var workspace = trim_(PropertiesService.getScriptProperties().getProperty('ASANA_WORKSPACE_GID'));
    if (!token || !workspace) return { success: false, error: 'Missing ASANA_TOKEN or ASANA_WORKSPACE_GID' };
    var projects = fetchAsanaProjectsByWorkspace_(token, workspace);
    return { success: true, projectCount: projects.length, sampleProject: projects.length ? projects[0] : null };
  } catch (err) {
    return { success: false, error: errorText_(err) };
  }
}

function syncAsanaSingleAddress(address) {
  try {
    var addr = trim_(address);
    if (!addr) return { success: false, error: 'Address required' };
    var token = trim_(PropertiesService.getScriptProperties().getProperty('ASANA_TOKEN'));
    var workspace = trim_(PropertiesService.getScriptProperties().getProperty('ASANA_WORKSPACE_GID'));
    if (!token || !workspace) return { success: false, error: 'Missing ASANA_TOKEN or ASANA_WORKSPACE_GID' };

    var sh = getListingsSheet_();
    if (!sh) return { success: false, error: 'Listings sheet not found' };
    var values = sh.getDataRange().getValues();
    if (values.length < 2) return { success: false, error: 'Listings empty' };
    var h = values[0];

    var idxAddress = requireHeader_(h, 'Address');
    var idxTask = requireHeader_(h, 'asana_task_id');
    var idxProj = indexOfHeader_(h, 'asana_project_gid');
    var idxOpen = requireHeader_(h, 'asana_open_tasks_count');
    var idxDone = requireHeader_(h, 'asana_done_tasks_count');
    var idxMark = requireHeader_(h, 'marketing_status');
    var idxSync = requireHeader_(h, 'asana_last_sync_at');
    var idxQ = indexOfHeader_(h, 'seller_questionnaire_content');
    var idxQSync = indexOfHeader_(h, 'seller_questionnaire_last_sync_at');
    var idxHealth = indexOfHeader_(h, 'intergation_health');
    var idxSellerName = indexOfHeader_(h, 'seller_name');
    var idxSellerEmail = indexOfHeader_(h, 'seller_email');
    var idxSellerPhone = indexOfHeader_(h, 'seller_phone');

    var target = normalizeAddress_(addr);
    var rowNum = -1;
    var r;
    for (r = 1; r < values.length; r++) {
      if (normalizeAddress_(values[r][idxAddress]) === target) {
        rowNum = r + 1;
        break;
      }
    }
    if (rowNum === -1) return { success: false, error: 'Address not found: ' + addr };

    var projects = fetchAsanaProjectsByWorkspace_(token, workspace);
    var row = values[rowNum - 1];
    var proj = idxProj !== -1 ? trim_(row[idxProj]) : '';
    if (!proj) {
      var m = resolveAsanaProjectForAddress_(target, projects);
      if (m) {
        proj = m.gid;
        if (idxProj !== -1) sh.getRange(rowNum, idxProj + 1).setValue(proj);
      }
    }
    if (!proj) {
      if (idxHealth !== -1) sh.getRange(rowNum, idxHealth + 1).setValue('Asana sync: no matching project');
      return { success: false, error: 'No matching Asana project', address: addr };
    }

    var nowIso = new Date().toISOString();
    var stats = fetchAsanaProjectTaskStats_(token, proj);
    var existing = trim_(row[idxTask]);
    var addressTask = findAddressTaskForProject_(token, proj, addr);
    var addressTaskId = addressTask ? trim_(addressTask.gid) : '';
    var anchor = addressTaskId || existing || stats.firstOpenTaskId || stats.firstTaskId || '';
    var q = fetchAsanaQuestionnaireFromTaskId_(token, addressTaskId || existing);

    if (anchor) sh.getRange(rowNum, idxTask + 1).setValue(anchor);
    sh.getRange(rowNum, idxOpen + 1).setValue(stats.openCount);
    sh.getRange(rowNum, idxDone + 1).setValue(stats.doneCount);
    sh.getRange(rowNum, idxMark + 1).setValue(stats.openCount > 0 ? 'In Progress' : 'Done');
    sh.getRange(rowNum, idxSync + 1).setValue(nowIso);
    if (idxQ !== -1 && q) sh.getRange(rowNum, idxQ + 1).setValue(q);
    if (idxQSync !== -1 && q) sh.getRange(rowNum, idxQSync + 1).setValue(nowIso);
    if (q) {
      var contactSingle = extractSellerContact_(q);
      if (idxSellerName !== -1 && contactSingle.name) sh.getRange(rowNum, idxSellerName + 1).setValue(contactSingle.name);
      if (idxSellerEmail !== -1 && contactSingle.email) sh.getRange(rowNum, idxSellerEmail + 1).setValue(contactSingle.email);
      if (idxSellerPhone !== -1 && contactSingle.phone) sh.getRange(rowNum, idxSellerPhone + 1).setValue(contactSingle.phone);
    }
    if (idxHealth !== -1) {
      if (!addressTaskId) {
        sh.getRange(rowNum, idxHealth + 1).setValue('Asana single sync: address task not found');
      } else if (!q) {
        sh.getRange(rowNum, idxHealth + 1).setValue('Asana single sync: address task found but questionnaire signature missing in description: ' + truncate_(addressTask.name, 80));
      } else {
        sh.getRange(rowNum, idxHealth + 1).setValue('Asana synced ' + nowIso);
      }
    }

    return {
      success: true,
      address: addr,
      row: rowNum,
      projectGid: proj,
      openCount: stats.openCount,
      doneCount: stats.doneCount,
      wroteQuestionnaire: !!q
    };
  } catch (err) {
    return { success: false, error: errorText_(err) };
  }
}

var DEFAULT_LISTING_PHOTOS_PARENT_FOLDER_ID = '1FY64_Fe-jVDUIb6hWzwPFdo6fotm7Ztn';

function getListingPhotosParentFolderId_(override) {
  var direct = extractDriveFolderId_(override) || trim_(override);
  if (direct) return direct;
  var props = PropertiesService.getScriptProperties();
  return (
    trim_(props.getProperty('MARKETING_PHOTOS_PARENT_FOLDER_ID')) ||
    trim_(props.getProperty('LISTING_PHOTOS_PARENT_FOLDER_ID')) ||
    DEFAULT_LISTING_PHOTOS_PARENT_FOLDER_ID
  );
}

/** Collect address-named photo folders under a Drive parent (scans nested folders). */
function collectDrivePhotoFolders_(parentFolderId, maxDepth) {
  maxDepth = maxDepth == null ? 3 : Number(maxDepth);
  var parent = DriveApp.getFolderById(parentFolderId);
  var out = [];
  var seen = {};

  function walk(folder, depth, path) {
    var subfolders = folder.getFolders();
    while (subfolders.hasNext()) {
      var sub = subfolders.next();
      var name = trim_(sub.getName());
      var nextPath = path ? path + ' / ' + name : name;
      if (name && (looksLikeAddress_(name) || idxNormalizeAddressForMatch_(name))) {
        if (!seen[sub.getId()]) {
          seen[sub.getId()] = true;
          out.push({
            name: name,
            path: nextPath,
            folderId: sub.getId(),
            url: sub.getUrl()
          });
        }
      } else if (depth < maxDepth) {
        walk(sub, depth + 1, nextPath);
      }
    }
  }

  walk(parent, 0, '');
  return out;
}

function syncDrivePhotosToListings(parentFolderUrlOrId) {
  var parentFolderId = getListingPhotosParentFolderId_(parentFolderUrlOrId);
  var sh = getListingsSheet_();
  if (!sh) return { success: false, error: 'Listings sheet not found' };

  var values = sh.getDataRange().getValues();
  if (!values.length) return { success: false, error: 'Listings sheet has no header row' };
  var headers = values[0];

  var idxAddress = indexOfHeader_(headers, 'Address');
  var idxPhotos = indexOfHeader_(headers, 'Photos');
  var idxCover = indexOfHeader_(headers, 'Cover Image');
  if (idxAddress === -1 || idxPhotos === -1) {
    return { success: false, error: 'Missing required columns: Address and/or Photos' };
  }

  var rowByAddress = {};
  var r;
  for (r = 1; r < values.length; r++) {
    var key = normalizeAddress_(values[r][idxAddress]);
    if (key) rowByAddress[key] = r + 1;
    var unitKey = idxNormalizeAddressForMatch_(values[r][idxAddress]);
    if (unitKey) rowByAddress[unitKey] = r + 1;
  }

  var folders = collectDrivePhotoFolders_(parentFolderId, 3);
  var updated = 0;
  var skipped = 0;
  var unmatched = [];
  var i, folderInfo, addressKey, rowNum;

  for (i = 0; i < folders.length; i++) {
    folderInfo = folders[i];
    addressKey = idxNormalizeAddressForMatch_(folderInfo.name) || normalizeAddress_(folderInfo.name);
    rowNum = rowByAddress[addressKey] || rowByAddress[normalizeAddress_(folderInfo.name)];
    if (!rowNum) {
      skipped++;
      unmatched.push({ folder: folderInfo.name, path: folderInfo.path, url: folderInfo.url });
      continue;
    }

    sh.getRange(rowNum, idxPhotos + 1).setValue(folderInfo.url);
    if (idxCover !== -1) {
      var cover = getFirstImageUrl_(DriveApp.getFolderById(folderInfo.folderId));
      if (cover) sh.getRange(rowNum, idxCover + 1).setValue(cover);
    }
    updated++;
  }

  return {
    success: true,
    parentFolderId: parentFolderId,
    scannedFolders: folders.length,
    updatedRows: updated,
    skippedFolders: skipped,
    unmatched: unmatched.slice(0, 50)
  };
}

/**
 * Match address-named Drive photo folders to Marketing rows and write photos_url.
 *
 * @param {string=} parentFolderUrlOrId Google Drive folder URL or ID.
 * @param {Object=} options
 * @param {boolean=} options.onlyEmpty Only fill blank photos_url cells (default false for migrate).
 * @param {boolean=} options.syncMicrosites Also write gallery_folder_url on Microsites tab.
 * @param {boolean=} options.markDelivered Set photos_status to Delivered when a folder is linked.
 */
function syncDrivePhotosToMarketingTab_(parentFolderUrlOrId, options) {
  options = options || {};
  var onlyEmpty = options.onlyEmpty === true;
  var syncMicrosites = options.syncMicrosites !== false;
  var markDelivered = options.markDelivered !== false;
  var parentFolderId = getListingPhotosParentFolderId_(parentFolderUrlOrId);

  var marketingSh = getOptionalOverlaySheet_(MARKETING_SHEET_NAME);
  if (!marketingSh) throw new Error('Marketing sheet not found');

  var marketingValues = marketingSh.getDataRange().getValues();
  if (marketingValues.length < 2) {
    return {
      success: false,
      error: 'Marketing tab has no data rows yet — run syncIdxListingsToSheet() first.',
      parentFolderId: parentFolderId
    };
  }

  var marketingHeaders = marketingValues[0].map(function (h) { return String(h || '').trim(); });
  var marketingIdx = idxOverlayHeaderIndex_(marketingHeaders);
  var photosCol = marketingIdx['photos_url'];
  var photosStatusCol = marketingIdx['photos_status'];
  var photosDeliveredCol = marketingIdx['photos_delivered_at'];
  var lastUpdatedCol = marketingIdx['last_updated_at'];
  var lastUpdatedByCol = marketingIdx['last_updated_by'];
  if (photosCol == null) throw new Error('Marketing sheet missing photos_url column');

  var micrositesSh = syncMicrosites ? getOptionalOverlaySheet_(MICROSITES_SHEET_NAME) : null;
  var micrositesValues = micrositesSh ? micrositesSh.getDataRange().getValues() : null;
  var micrositesHeaders = micrositesValues && micrositesValues.length ? micrositesValues[0].map(function (h) { return String(h || '').trim(); }) : [];
  var micrositesIdx = micrositesValues ? idxOverlayHeaderIndex_(micrositesHeaders) : {};
  var galleryCol = micrositesIdx['gallery_folder_url'];
  var heroCol = micrositesIdx['hero_image_url'];

  var folders = collectDrivePhotoFolders_(parentFolderId, 3);
  var now = new Date().toISOString();
  var matched = 0;
  var updatedMarketing = 0;
  var updatedMicrosites = 0;
  var skipped = 0;
  var unmatched = [];
  var i, folderInfo, listing, targetRow, folderUrl, current, folder, cover, microRow;

  for (i = 0; i < folders.length; i++) {
    folderInfo = folders[i];
    listing = { address: folderInfo.name, addressKey: idxNormalizeAddressForMatch_(folderInfo.name) };
    targetRow = idxFindMarketingRowForListing_(marketingValues, marketingIdx, listing);
    if (targetRow < 0) {
      skipped++;
      unmatched.push({ folder: folderInfo.name, path: folderInfo.path, url: folderInfo.url });
      continue;
    }
    matched++;
    folderUrl = folderInfo.url;
    current = trim_(marketingValues[targetRow][photosCol]);
    if (!onlyEmpty || !current) {
      if (current !== folderUrl) {
        marketingSh.getRange(targetRow + 1, photosCol + 1).setValue(folderUrl);
        marketingValues[targetRow][photosCol] = folderUrl;
        updatedMarketing++;
        if (markDelivered && photosStatusCol != null && !trim_(marketingValues[targetRow][photosStatusCol])) {
          marketingSh.getRange(targetRow + 1, photosStatusCol + 1).setValue('Delivered');
          marketingValues[targetRow][photosStatusCol] = 'Delivered';
        }
        if (markDelivered && photosDeliveredCol != null && !trim_(marketingValues[targetRow][photosDeliveredCol])) {
          marketingSh.getRange(targetRow + 1, photosDeliveredCol + 1).setValue(now);
          marketingValues[targetRow][photosDeliveredCol] = now;
        }
        if (lastUpdatedCol != null) {
          marketingSh.getRange(targetRow + 1, lastUpdatedCol + 1).setValue(now);
          marketingValues[targetRow][lastUpdatedCol] = now;
        }
        if (lastUpdatedByCol != null) {
          marketingSh.getRange(targetRow + 1, lastUpdatedByCol + 1).setValue('Drive photo folder sync');
          marketingValues[targetRow][lastUpdatedByCol] = 'Drive photo folder sync';
        }
      }
    }

    if (syncMicrosites && micrositesSh && micrositesValues && micrositesValues.length > 1 && galleryCol != null) {
      microRow = idxFindMarketingRowForListing_(micrositesValues, micrositesIdx, listing);
      if (microRow >= 0) {
        current = trim_(micrositesValues[microRow][galleryCol]);
        if (!onlyEmpty || !current) {
          if (current !== folderUrl) {
            micrositesSh.getRange(microRow + 1, galleryCol + 1).setValue(folderUrl);
            micrositesValues[microRow][galleryCol] = folderUrl;
            updatedMicrosites++;
            if (heroCol != null && !trim_(micrositesValues[microRow][heroCol])) {
              folder = DriveApp.getFolderById(folderInfo.folderId);
              cover = getFirstImageUrl_(folder);
              if (cover) {
                micrositesSh.getRange(microRow + 1, heroCol + 1).setValue(cover);
                micrositesValues[microRow][heroCol] = cover;
              }
            }
          }
        }
      }
    }
  }

  if (updatedMarketing || updatedMicrosites) invalidateListingsActiveCache_();

  return {
    success: true,
    parentFolderId: parentFolderId,
    scannedFolders: folders.length,
    matched: matched,
    updatedMarketing: updatedMarketing,
    updatedMicrosites: updatedMicrosites,
    skippedFolders: skipped,
    onlyEmpty: onlyEmpty,
    unmatched: unmatched.slice(0, 50)
  };
}

/** Run from Apps Script editor — pass your Drive folder URL or ID. */
function migrateDrivePhotosToMarketingTab(parentFolderUrlOrId) {
  var result = syncDrivePhotosToMarketingTab_(parentFolderUrlOrId, {
    onlyEmpty: false,
    syncMicrosites: true,
    markDelivered: true
  });
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function syncListingsSheet() {
  return syncAsanaToListingsSheet();
}

function getFirstImageUrl_(folder) {
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    var mime = String(f.getMimeType() || '');
    if (mime.indexOf('image/') === 0) return 'https://drive.google.com/uc?export=view&id=' + f.getId();
  }
  return '';
}

function looksLikeAddress_(name) {
  return /^\d+\s+/.test(String(name || ''));
}

// ── Acuity description → services_booked ────────────────────────────────────
// The seller picks which services they want (photos / matterport / floor plan
// / video / drone / twilight) when they book on Acuity. The selection lives in
// the appointment type, the description body, and the add-ons array. We
// normalise all three into one canonical CSV that the dashboard reads via
// `listingHasService(row, key)` to flip individual services on/off in the
// Marketing Status roadmap.
function parseAcuityServices_(appointmentType, descriptionText, addons) {
  var blob = [appointmentType, descriptionText, (addons || []).join(' ')].join(' ').toLowerCase();
  var services = [];
  if (/\bphoto/.test(blob) || /\bhdr\b/.test(blob)) services.push('photos');
  if (/matterport|3d ?tour|virtual ?tour/.test(blob)) services.push('matterport');
  if (/floor ?plan|cubicasa/.test(blob)) services.push('floor_plan');
  if (/\bvideo|reel|walkthrough|cinematic/.test(blob)) services.push('video');
  if (/twilight|dusk/.test(blob)) services.push('twilight_photos');
  if (/drone|aerial/.test(blob)) services.push('drone');
  // De-dupe while preserving order.
  return services.filter(function (v, i, a) { return a.indexOf(v) === i; });
}

// ── Marketing materials rollup ──────────────────────────────────────────────
// Re-derive `marketing_status` from `marketing_requests` (the JSON column
// populated by the Asana marketing-request poller) + `fact_sheet_status`.
// Done only when every past-OH request is Delivered AND the fact sheet
// (when ever requested) is Delivered. Call this from any doPost that
// touches a *_status column and from the nightly sync.
function recomputeMarketingStatus_(rowNum) {
  var sh = getListingsSheet_();
  if (!sh) return;
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var idxRequests = indexOfHeader_(headers, 'marketing_requests');
  var idxFactSheet = indexOfHeader_(headers, 'fact_sheet_status');
  var idxStatus = indexOfHeader_(headers, 'marketing_status');
  if (idxStatus === -1) return;
  var requests = idxRequests !== -1 ? safeJsonParseArray_(sh.getRange(rowNum, idxRequests + 1).getValue()) : [];
  var factSheet = idxFactSheet !== -1 ? trim_(sh.getRange(rowNum, idxFactSheet + 1).getValue()).toLowerCase() : '';
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var anyBuilding = false, anyRequested = false, anyUndelivered = false;
  var i;
  for (i = 0; i < requests.length; i++) {
    var r = requests[i] || {};
    var s = String(r.status || '').toLowerCase();
    if (s === 'delivered') continue;
    anyUndelivered = true;
    if (s === 'building' || s === 'in progress' || s.indexOf('on it') >= 0) anyBuilding = true;
    else if (s === 'requested' || s === 'new') anyRequested = true;
  }
  if (factSheet && factSheet !== 'delivered' && factSheet !== 'not requested') {
    anyUndelivered = true;
    if (factSheet === 'building') anyBuilding = true;
    else anyRequested = true;
  }
  var rollup;
  if (!requests.length && !factSheet) rollup = 'Not Started';
  else if (!anyUndelivered) rollup = 'Done';
  else if (anyBuilding) rollup = 'In Progress';
  else if (anyRequested) rollup = 'In Progress';
  else rollup = 'In Progress';
  sh.getRange(rowNum, idxStatus + 1).setValue(rollup);
}

// ── One-shot schema bootstrap ───────────────────────────────────────────────
// Run from the Apps Script editor (or hook to a menu item) to add every
// missing header to the Listings sheet and apply data-validation dropdowns
// to the status columns. Safe to run repeatedly — it only appends columns
// that don't already exist and re-applies validation rules in place.
function bootstrapListingHubSchema() {
  var sh = getListingsSheet_();
  if (!sh) throw new Error('Listings sheet not found');
  var rawHeaders = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
  var headers = rawHeaders.map(function (h) { return String(h || '').trim(); });
  // Case-insensitive set so we never append e.g. `marketing_requests` twice
  // when the sheet already has `Marketing_Requests` or stray spaces.
  var headerSet = {};
  var hi;
  for (hi = 0; hi < headers.length; hi++) {
    var key = String(headers[hi] || '').trim().toLowerCase();
    if (key) headerSet[key] = true;
  }

  var TO_ADD = [
    // Seller questionnaire
    'seller_questionnaire_sent', 'seller_questionnaire_sent_at', 'seller_questionnaire_received_at',
    'seller_questionnaire_form_id',
    // Capture services
    'services_booked',
    'matterport_status', 'floor_plan_status', 'video_status',
    'photos_delivered_at', 'matterport_delivered_at', 'floor_plan_delivered_at', 'video_delivered_at',
    // Acuity raw
    'acuity_appointment_type', 'acuity_appointment_description', 'acuity_addons',
    'acuity_calendar_id', 'acuity_last_sync_at',
    // Marketing materials (single JSON column + fact-sheet + open-house aggregates)
    'marketing_requests',
    'fact_sheet_status', 'fact_sheet_requested_at', 'fact_sheet_delivered_at',
    'open_house_materials_status', 'open_house_materials_requested_at', 'open_house_materials_delivered_at',
    // Listing metadata
    'list_price', 'list_date', 'under_contract_date', 'closed_date', 'mls_number',
    // Agent overrides
    'agent_slug', 'agent_questionnaire_url', 'agent_booking_url',
    // Workflow + audit
    'marketing_action_plan_completed_at', 'last_updated_at', 'last_updated_by', 'notes'
  ];

  var missing = TO_ADD.filter(function (h) { return !headerSet[String(h || '').trim().toLowerCase()]; });
  if (missing.length) {
    var startCol = sh.getLastColumn() + 1;
    sh.getRange(1, startCol, 1, missing.length).setValues([missing]).setFontWeight('bold');
  }

  // Refresh header index after append so validation finds the new columns.
  var afterHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h || '').trim(); });
  function applyValidation(colName, values) {
    var idx = indexOfHeader_(afterHeaders, colName);
    if (idx < 0) return;
    var rng = sh.getRange(2, idx + 1, Math.max(sh.getMaxRows() - 1, 1), 1);
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
    rng.setDataValidation(rule);
  }
  var captureEditing = ['Not Booked', 'Booked', 'Editing', 'Delivered'];
  var captureSimple = ['Not Booked', 'Booked', 'Delivered'];
  var materialStates = ['Not Requested', 'Requested', 'Building', 'Delivered'];
  var marketingRollup = ['Not Started', 'In Progress', 'Done'];

  applyValidation('photos_status', captureEditing);
  applyValidation('video_status', captureEditing);
  applyValidation('matterport_status', captureSimple);
  applyValidation('floor_plan_status', captureSimple);
  applyValidation('fact_sheet_status', materialStates);
  applyValidation('open_house_materials_status', materialStates);
  applyValidation('marketing_status', marketingRollup);

  return { success: true, added: missing, totalColumns: sh.getLastColumn() };
}
