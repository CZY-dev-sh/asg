/**
 * Listing Hub -> Supabase sync
 * ------------------------------------------------------------
 * Pushes the workflow/marketing overlay from the "Listings" and "Marketing"
 * tabs to the ASG backend, which upserts each row onto the listings table
 * (keyed by normalized address). Supabase then becomes the source of truth the
 * Admin Console + agent hubs read from. IDX still supplies MLS facts; this push
 * supplies the ASG-only workflow data: agent assignment, capture/marketing
 * asset links, per-service status, seller questionnaire, Compass link, etc.
 *
 * Only non-empty cells are sent, so the sheet fills gaps without wiping values
 * the console or IDX already set. Re-running is safe (idempotent upsert by
 * address).
 *
 * ONE-TIME SETUP (Apps Script editor):
 *   1. Project Settings -> Script Properties:
 *        SUPABASE_PUSH_URL    = https://asg-production.up.railway.app/api/admin/listings/import
 *        SUPABASE_PUSH_SECRET = <the same value as the backend's WEBHOOK_SECRET>
 *   2. Run installListingSyncTriggers() once and approve permissions.
 *   3. Use the "ASG Sync" menu -> "Push listings to Supabase now" to test.
 */

var LH_SUPABASE_SYNC = {
  URL_PROP: 'SUPABASE_PUSH_URL',
  SECRET_PROP: 'SUPABASE_PUSH_SECRET',
  EDIT_DEBOUNCE_MS: 8000,
  LAST_PUSH_PROP: '_supabase_listings_last_push_ms',
  SYNC_SHEETS: ['Listings', 'Marketing']
};

/** Maps mapRecordToListing_() keys -> the backend admin API (camelCase) keys. */
var LH_SUPABASE_FIELD_MAP = {
  address: 'address',
  agent: 'agentName',
  coListAgentName: 'coAgentName',
  status: 'status',
  listingType: 'listingType',
  listPrice: 'listPrice',
  listDate: 'listDate',
  mlsNumber: 'mlsNumber',
  archived: 'archived',
  emailSent: 'emailSent',
  compassLink: 'compassLink',
  coverImage: 'coverImageUrl',
  photos: 'photosFolderUrl',
  matterport: 'matterportUrl',
  floorPlan: 'floorPlanUrl',
  video: 'videoUrl',
  factSheet: 'factSheetUrl',
  openHouseMaterialsUrl: 'openHouseMaterialsUrl',
  photosStatus: 'photosStatus',
  photosDatetime: 'photosDatetime',
  photosBookingId: 'photosBookingId',
  photosBookingUrl: 'photosBookingUrl',
  photosDeliveredAt: 'photosDeliveredAt',
  matterportStatus: 'matterportStatus',
  matterportDeliveredAt: 'matterportDeliveredAt',
  floorPlanStatus: 'floorPlanStatus',
  floorPlanDeliveredAt: 'floorPlanDeliveredAt',
  videoStatus: 'videoStatus',
  videoDeliveredAt: 'videoDeliveredAt',
  factSheetStatus: 'factSheetStatus',
  factSheetRequestedAt: 'factSheetRequestedAt',
  factSheetDeliveredAt: 'factSheetDeliveredAt',
  openHouseMaterialsStatus: 'openHouseMaterialsStatus',
  openHouseMaterialsRequestedAt: 'openHouseMaterialsRequestedAt',
  openHouseMaterialsDeliveredAt: 'openHouseMaterialsDeliveredAt',
  marketingStatus: 'marketingStatus',
  sellerName: 'sellerName',
  sellerEmail: 'sellerEmail',
  sellerPhone: 'sellerPhone',
  sellerQuestionnaireContent: 'sellerQuestionnaireContent',
  sellerQuestionnaireSent: 'sellerQuestionnaireSent',
  sellerQuestionnaireSentAt: 'sellerQuestionnaireSentAt',
  asanaTaskId: 'asanaTaskId',
  asanaProjectGid: 'asanaProjectGid',
  fubDealId: 'fubDealId',
  fubStage: 'fubStage'
};

/** Array-valued fields passed through as JSON. */
var LH_SUPABASE_ARRAY_FIELDS = { servicesBooked: 'servicesBooked' };

/** Adds the "ASG Sync" menu when the spreadsheet opens. */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('ASG Sync')
      .addItem('Push listings to Supabase now', 'pushListingsToSupabase')
      .addSeparator()
      .addItem('Install auto-sync triggers', 'installListingSyncTriggers')
      .addItem('Remove auto-sync triggers', 'removeListingSyncTriggers')
      .addToUi();
  } catch (err) {
    Logger.log('onOpen menu error: ' + (err && err.message ? err.message : String(err)));
  }
}

/**
 * Reads the Listings + Marketing overlay (merged by address) and POSTs the rows
 * to /api/admin/listings/import. Returns a small summary object.
 */
function pushListingsToSupabase() {
  var props = PropertiesService.getScriptProperties();
  var url = String(props.getProperty(LH_SUPABASE_SYNC.URL_PROP) || '').trim();
  var secret = String(props.getProperty(LH_SUPABASE_SYNC.SECRET_PROP) || '').trim();
  if (!url || !secret) {
    throw new Error(
      'Missing Script Properties. Set ' + LH_SUPABASE_SYNC.URL_PROP + ' and ' +
      LH_SUPABASE_SYNC.SECRET_PROP + ' under Project Settings.'
    );
  }

  var rows = _lhSupabaseBuildRows_();
  var body = { secret: secret, listings: rows };

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Asg-Secret': secret },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  var text = res.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('Supabase listings push failed (' + code + '): ' + text);
  }

  props.setProperty(LH_SUPABASE_SYNC.LAST_PUSH_PROP, String(Date.now()));
  Logger.log('Listings pushed: ' + text);
  try {
    var parsed = JSON.parse(text);
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Synced ' + (parsed.upserted || rows.length) + ' listings to Supabase' +
      (parsed.created ? (' (' + parsed.created + ' new)') : '') +
      (parsed.linkedAgents ? (', linked ' + parsed.linkedAgents + ' agents') : ''),
      'ASG Sync', 5
    );
  } catch (ignore) {}

  return { ok: true, sent: rows.length, response: text };
}

/** Merge the Listings + Marketing overlays by address, then map to API rows. */
function _lhSupabaseBuildRows_() {
  var listingsByAddr = buildListingsWorkflowOverlayByAddress_(); // ListingHub.gs
  var marketingByAddr = buildMarketingOverlayByAddress_();        // ListingHub.gs

  var merged = {};
  _lhSupabaseCollect_(merged, listingsByAddr);
  _lhSupabaseCollect_(merged, marketingByAddr); // marketing fills/overrides non-empty

  var rows = [];
  var key;
  for (key in merged) {
    if (!merged.hasOwnProperty(key)) continue;
    var apiRow = _lhSupabaseMapListing_(merged[key]);
    if (apiRow && apiRow.address) rows.push(apiRow);
  }
  return rows;
}

/** Shallow-merge each overlay listing into the accumulator, non-empty wins. */
function _lhSupabaseCollect_(acc, byAddr) {
  var k, src, existing, field;
  for (k in byAddr) {
    if (!byAddr.hasOwnProperty(k)) continue;
    src = byAddr[k] || {};
    var addrKey = _lhSupabaseAddrKey_(src.address);
    if (!addrKey) continue;
    existing = acc[addrKey] || {};
    for (field in src) {
      if (!src.hasOwnProperty(field)) continue;
      if (_lhSupabaseHasValue_(src[field])) existing[field] = src[field];
    }
    acc[addrKey] = existing;
  }
}

/** Map an internal listing object to the backend admin API shape. */
function _lhSupabaseMapListing_(listing) {
  var out = {};
  var key, apiKey;
  for (key in LH_SUPABASE_FIELD_MAP) {
    if (!LH_SUPABASE_FIELD_MAP.hasOwnProperty(key)) continue;
    apiKey = LH_SUPABASE_FIELD_MAP[key];
    var v = listing[key];
    if (!_lhSupabaseHasValue_(v)) continue;
    if (v instanceof Date) v = v.toISOString();
    out[apiKey] = v;
  }
  for (key in LH_SUPABASE_ARRAY_FIELDS) {
    if (!LH_SUPABASE_ARRAY_FIELDS.hasOwnProperty(key)) continue;
    var arr = listing[key];
    if (Array.isArray(arr) && arr.length) out[LH_SUPABASE_ARRAY_FIELDS[key]] = arr;
  }
  return out;
}

function _lhSupabaseHasValue_(v) {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function _lhSupabaseAddrKey_(addr) {
  return String(addr || '').toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim();
}

/** Installable trigger handler: push on edits to the Listings/Marketing tabs. */
function onListingEditSync(e) {
  try {
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();
    if (!sheet) return;
    var name = String(sheet.getName() || '').trim();
    if (LH_SUPABASE_SYNC.SYNC_SHEETS.indexOf(name) === -1) return;

    var props = PropertiesService.getScriptProperties();
    var last = Number(props.getProperty(LH_SUPABASE_SYNC.LAST_PUSH_PROP) || 0);
    if (Date.now() - last < LH_SUPABASE_SYNC.EDIT_DEBOUNCE_MS) return;

    pushListingsToSupabase();
  } catch (err) {
    Logger.log('onListingEditSync error: ' + (err && err.message ? err.message : String(err)));
  }
}

/** Installs an on-edit trigger + an hourly backup push. Run once. */
function installListingSyncTriggers() {
  removeListingSyncTriggers();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger('onListingEditSync')
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  ScriptApp.newTrigger('pushListingsToSupabase')
    .timeBased()
    .everyHours(1)
    .create();
  return { ok: true, installed: ['onListingEditSync (onEdit)', 'pushListingsToSupabase (hourly)'] };
}

/** Removes the sync triggers created by installListingSyncTriggers(). */
function removeListingSyncTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === 'onListingEditSync' || fn === 'pushListingsToSupabase') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  return { ok: true, removed: removed };
}
