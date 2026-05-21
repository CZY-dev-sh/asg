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
var SHEET_NAME = 'Listings';
var DEFAULT_LISTINGS_SPREADSHEET_ID = '1DtyZsOi17q04rf3uoz72Cm9bgshuMza20p-GM9jKb1U';
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

function doGet(e) {
  try {
    var p = e && e.parameter ? e.parameter : {};
    var view = String(p.view || 'active').toLowerCase();
    if (view === 'diag') return jsonResponse_(diagnosticsPayload_());
    if (view === 'detailpage') return serveListingDetailPage_(p);
    if (view === 'listing') return jsonResponse_(findSingleListingPayload_(p));
    if (view === 'listingphotos') return jsonResponse_(listingPhotosPayload_(p));
    if (view === 'listingops') return jsonResponse_(listingOpsPayload_(p));
    if (view === 'embedsnippet') return jsonResponse_(embedSnippetPayload_(p));
    if (view === 'idxsync') return jsonResponse_({ success: true, idx: idxSyncStatusPayload_() });
    if (view === 'idxprobe') return jsonResponse_({ success: true, probe: idxProbeFeeds_() });
    var listings = getListings_();
    var out = [];
    var i;
    if (view === 'all') out = listings;
    else if (view === 'archive' || view === 'closed') for (i = 0; i < listings.length; i++) if (isClosedListing_(listings[i])) out.push(listings[i]);
    else for (i = 0; i < listings.length; i++) if (!isClosedListing_(listings[i])) out.push(listings[i]);
    return jsonResponse_({ success: true, view: view, count: out.length, listings: out, meta: { webAppUrl: getPublicWebAppUrl_() } });
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
function getListings_() {
  var sh = getListingsSheet_();
  if (!sh) throw new Error('Listings sheet not found. Checked "' + getListingsSheetName_() + '" and "' + SHEET_NAME + '".');
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var idxMap = buildIdxListingsAddressMap_();
  var out = [];
  var r, c;
  for (r = 1; r < values.length; r++) {
    var row = values[r];
    var has = false;
    for (c = 0; c < row.length; c++) if ((String(row[c] || '').trim())) { has = true; break; }
    if (!has) continue;
    var rec = {};
    for (c = 0; c < headers.length; c++) rec[String(headers[c] || '').trim()] = row[c];
    var listing = mapRecordToListing_(rec);
    listing = enrichListingFromIdx_(listing, findIdxEntryForAddress_(listing.address, idxMap));
    out.push(listing);
  }
  return out;
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
      var m = buildIdxListingsAddressMap_();
      var i,
        c = 0;
      for (i = 0; i < listings.length; i++) if (listings[i].idxMatched) c++;
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
  var agentRaw = pick_(rec, ['Agent Name', 'agent_name', 'Agent']);
  var status = pick_(rec, ['Status', 'deal_stage']);
  var phase = pick_(rec, ['deal_stage', 'Listing Phase', 'Phase', 'Stage']) || status;
  return {
    // ── Core identity / lifecycle ──────────────────────────────────────────
    address: trim_(pick_(rec, ['Address'])),
    neighborhood: trim_(pick_(rec, ['Neighborhood', 'neighborhood'])),
    agent: trim_(agentRaw),
    agentCanonical: canonicalAgentName_(agentRaw),
    agentSlug: trim_(pick_(rec, ['agent_slug'])),
    agentQuestionnaireUrl: trim_(pick_(rec, ['agent_questionnaire_url'])),
    agentBookingUrl: trim_(pick_(rec, ['agent_booking_url'])),
    listingType: trim_(pick_(rec, ['Listing Type', 'listing_type'])),
    status: trim_(status),
    phaseKey: normalizeStatusKey_(phase),
    dealStage: trim_(pick_(rec, ['deal_stage'])),
    archived: normalizeCheckbox_(pick_(rec, ['Archived'])),
    emailSent: normalizeCheckbox_(pick_(rec, ['Email Sent'])),

    // ── Listing metadata ───────────────────────────────────────────────────
    coverImage: trim_(pick_(rec, ['cover_image_url', 'Cover Image'])),
    beds: trim_(pick_(rec, ['beds', 'Beds', 'Bedrooms'])),
    baths: trim_(pick_(rec, ['baths', 'Baths', 'Bathrooms'])),
    sqFt: trim_(pick_(rec, ['sq_ft', 'Sq Ft', 'Square Footage', 'Square Feet'])),
    listPrice: trim_(pick_(rec, ['list_price'])),
    listDate: trim_(pick_(rec, ['list_date'])),
    underContractDate: trim_(pick_(rec, ['under_contract_date'])),
    closedDate: trim_(pick_(rec, ['closed_date'])),
    mlsNumber: trim_(pick_(rec, ['mls_number'])),
    notes: trim_(pick_(rec, ['notes'])),

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
    marketingRequests: safeJsonParseArray_(pick_(rec, ['marketing_requests'])),
    marketingStatus: trim_(pick_(rec, ['marketing_status'])),

    // ── Seller questionnaire ──────────────────────────────────────────────
    sellerName: trim_(pick_(rec, ['seller_name', 'Seller Name', 'Seller'])),
    sellerEmail: trim_(pick_(rec, ['seller_email', 'Seller Email'])),
    sellerPhone: trim_(pick_(rec, ['seller_phone', 'Seller Phone'])),
    sellerQuestionnaireContent: trim_(pick_(rec, ['seller_questionnaire_content'])),
    sellerQuestionnaireAnswers: trim_(pick_(rec, ['seller_questionnaire_answers'])),
    sellerQuestionnaireFormId: trim_(pick_(rec, ['seller_questionnaire_form_id'])),
    sellerQuestionnaireLastSyncAt: trim_(pick_(rec, ['seller_questionnaire_last_sync_at'])),
    sellerQuestionnaireReceivedAt: trim_(pick_(rec, ['seller_questionnaire_received_at'])),
    sellerQuestionnaireSent: trim_(pick_(rec, ['seller_questionnaire_sent'])),
    sellerQuestionnaireSentAt: trim_(pick_(rec, ['seller_questionnaire_sent_at'])),

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
    fubLastSyncAt: trim_(pick_(rec, ['fub_last_sync_at']))
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

function findListingByParams_(p) {
  var address = trim_(p && p.address);
  if (!address) return null;
  var norm = normalizeAddress_(address), all = getListings_(), i;
  for (i = 0; i < all.length; i++) if (normalizeAddress_(all[i].address) === norm) return all[i];
  return null;
}
function findSingleListingPayload_(p) { var l = findListingByParams_(p || {}); return l ? { success: true, listing: l } : { success: false, error: 'Listing not found' }; }
function listingPhotosPayload_(p) {
  var l = findListingByParams_(p || {});
  if (!l) return { success: false, error: 'Listing not found', photos: [] };
  var folderId = extractDriveFolderId_(l.photos), photos = [];
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
function serveListingDetailPage_(p) {
  var one = findSingleListingPayload_(p || {});
  if (!one.success) return HtmlService.createHtmlOutput('Listing not found');
  var l = one.listing, t = HtmlService.createTemplateFromFile('ListingDetailPage');
  t.listingJson = JSON.stringify(l);
  t.opsJson = JSON.stringify(listingOpsPayload_({ address: l.address }));
  t.photosJson = JSON.stringify(listingPhotosPayload_({ address: l.address }).photos || []);
  t.useVisualMock = shouldUseVisualMock_(p);
  t.detailUrl = buildListingDetailUrl_(l.address);
  t.agentsJson = getAgentDirectoryJson_();
  t.defaultShareNote = LISTING_ASSETS_EMAIL_DEFAULT_NOTE;
  return t.evaluate().setTitle(l.address || 'Listing HQ');
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
function handleQuestionnaireComplete_(d) { var a = trim_(d.address), nowIso = new Date().toISOString(); var res = updateListingRowByAddress_(a, { seller_questionnaire_content: trim_(d.content || d.seller_questionnaire_content), seller_questionnaire_last_sync_at: nowIso }); return res.success ? { success: true, address: a, updated: true } : res; }
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
  out.email = findLabeled(/email(?:\s*address)?\s*[:\-]\s*([^\s,;]+@[^\s,;]+)/i);
  out.phone = findLabeled(/(?:phone|mobile|cell)(?:\s*number)?\s*[:\-]\s*([+\d][\d\s().\-]{6,})/i);
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
function isClosedListing_(item) { if (!item) return true; if (item.archived) return true; var st = normalizeStatusKey_(item.status || item.phaseKey); return !!STATUS_CLOSED[st]; }
function normalizeCheckbox_(v) { if (v === true) return true; if (v === false) return false; v = String(v || '').toLowerCase(); return v === 'true' || v === 'yes' || v === '1'; }
function normalizeStatusKey_(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function normalizeAddress_(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim(); }
function canonicalAgentName_(name) { var n = String(name || '').trim(), key = n.toLowerCase(); return AGENT_CANONICAL_FROM_SHEET_ALIAS[key] || n; }
function scoreMatch_(a, b) { if (!a || !b) return 0; if (a === b) return 1; var at = a.split(' '), bt = b.split(' '), hits = 0, i, j; for (i = 0; i < at.length; i++) for (j = 0; j < bt.length; j++) if (at[i] && at[i] === bt[j]) { hits++; break; } return hits / Math.max(1, at.length); }
function shouldUseVisualMock_(p) { var q = String((p && p.mock) || '').toLowerCase(); if (q === '1' || q === 'true' || q === 'yes') return true; var prop = String(PropertiesService.getScriptProperties().getProperty('LISTING_DETAIL_VISUAL_MOCK') || '').toLowerCase(); return prop === '1' || prop === 'true' || prop === 'yes'; }
function getPublicWebAppUrl_() { var u = trim_(PropertiesService.getScriptProperties().getProperty('LISTING_WEB_APP_URL')); if (u) return u; try { var s = ScriptApp.getService(); return s ? String(s.getUrl() || '') : ''; } catch (err) { return ''; } }
function buildListingDetailUrl_(address) { var base = getPublicWebAppUrl_(); return base ? base + '?view=detailpage&address=' + encodeURIComponent(address || '') : ''; }
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

function syncDrivePhotosToListings() {
  var PARENT_FOLDER_ID = '1FY64_Fe-jVDUIb6hWzwPFdo6fotm7Ztn';
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
  }

  var parent = DriveApp.getFolderById(PARENT_FOLDER_ID);
  var folders = parent.getFolders();
  var updated = 0;
  var skipped = 0;

  while (folders.hasNext()) {
    var folder = folders.next();
    var rawName = trim_(folder.getName());
    if (!rawName || !looksLikeAddress_(rawName)) {
      skipped++;
      continue;
    }
    var addressKey = normalizeAddress_(rawName);
    var rowNum = rowByAddress[addressKey];
    if (!rowNum) {
      skipped++;
      continue;
    }

    sh.getRange(rowNum, idxPhotos + 1).setValue(folder.getUrl());
    if (idxCover !== -1) {
      var cover = getFirstImageUrl_(folder);
      if (cover) sh.getRange(rowNum, idxCover + 1).setValue(cover);
    }
    updated++;
  }

  return { success: true, updatedRows: updated, skippedFolders: skipped };
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
