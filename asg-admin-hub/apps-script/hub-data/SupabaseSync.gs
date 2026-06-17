/**
 * ASG Directory -> Supabase sync
 * ------------------------------------------------------------
 * Pushes every row of the Directory tab to the ASG backend, which upserts it
 * into Supabase. Supabase then becomes the single source of truth that the
 * Admin Console and every public surface reads from. The sheet stays the place
 * the team edits; this just mirrors it.
 *
 * ONE-TIME SETUP (Apps Script editor):
 *   1. Project Settings -> Script Properties, add two properties:
 *        SUPABASE_PUSH_URL    = https://asg-production.up.railway.app/api/admin/directory
 *        SUPABASE_PUSH_SECRET = <the same value as the backend's WEBHOOK_SECRET>
 *   2. Run installDirectorySyncTriggers() once and approve the permissions.
 *        (Installs an on-edit + hourly backup trigger.)
 *   3. Use the "ASG Sync" menu -> "Push directory to Supabase now" to test.
 *
 * Everything is keyed by email, so re-running is safe (idempotent upsert).
 */

var SUPABASE_SYNC = {
  URL_PROP: 'SUPABASE_PUSH_URL',
  SECRET_PROP: 'SUPABASE_PUSH_SECRET',
  // Coalesce rapid edits: only push if the last push was > this many ms ago.
  EDIT_DEBOUNCE_MS: 8000,
  LAST_PUSH_PROP: '_supabase_last_push_ms'
};

/** Adds the "ASG Sync" menu when the spreadsheet opens. */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('ASG Sync')
      .addItem('Push directory to Supabase now', 'pushDirectoryToSupabase')
      .addItem('Push events + updates to Supabase now', 'pushHubContentToSupabase')
      .addItem('Push everything to Supabase now', 'pushAllHubDataToSupabase')
      .addSeparator()
      .addItem('Install auto-sync triggers', 'installDirectorySyncTriggers')
      .addItem('Remove auto-sync triggers', 'removeDirectorySyncTriggers')
      .addToUi();
  } catch (err) {
    Logger.log('onOpen menu error: ' + (err && err.message ? err.message : String(err)));
  }
}

/** Convenience: push the directory and the events/updates tabs in one go. */
function pushAllHubDataToSupabase() {
  var dir = pushDirectoryToSupabase();
  var hub = pushHubContentToSupabase();
  return { ok: true, directory: dir, hubContent: hub };
}

/**
 * Reads the Directory tab (via HubData's enriched reader) and POSTs the rows to
 * the backend. Returns a small summary object.
 */
function pushDirectoryToSupabase() {
  var props = PropertiesService.getScriptProperties();
  var url = String(props.getProperty(SUPABASE_SYNC.URL_PROP) || '').trim();
  var secret = String(props.getProperty(SUPABASE_SYNC.SECRET_PROP) || '').trim();
  if (!url || !secret) {
    throw new Error(
      'Missing Script Properties. Set ' + SUPABASE_SYNC.URL_PROP + ' and ' +
      SUPABASE_SYNC.SECRET_PROP + ' under Project Settings.'
    );
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var payload = _readDirectoryPayload_(ss); // defined in HubData.gs (same project)
  if (!payload || !payload.success) {
    throw new Error('Could not read Directory tab: ' + (payload && payload.error ? payload.error : 'unknown'));
  }

  // Drop the per-cell *_display / *_link helper keys to keep the payload lean;
  // the backend reads the canonical snake_case keys plus computed_* fields.
  var rows = (payload.rows || []).map(_supabaseCleanRow_);

  var body = {
    secret: secret,            // accepted as X-Asg-Secret equivalent by the backend
    deactivateMissing: true,   // a row removed from the sheet => inactive in the UI
    directory: rows
  };

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
    throw new Error('Supabase push failed (' + code + '): ' + text);
  }

  props.setProperty(SUPABASE_SYNC.LAST_PUSH_PROP, String(Date.now()));
  Logger.log('Directory pushed: ' + text);

  // Friendly toast when run from the sheet UI.
  try {
    var parsed = JSON.parse(text);
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Synced ' + (parsed.upserted || rows.length) + ' agents to Supabase' +
      (parsed.deactivated ? (' (' + parsed.deactivated + ' deactivated)') : ''),
      'ASG Sync', 5
    );
  } catch (ignore) {}

  return { ok: true, sent: rows.length, response: text };
}

/**
 * Reads the Events + Updates tabs and POSTs them to /api/admin/hub-content.
 * The hub-content URL is derived from SUPABASE_PUSH_URL (same host, swapped
 * path), so only the one directory property needs configuring. Each row gets a
 * stable external_key (title + date) so re-runs upsert in place.
 */
function pushHubContentToSupabase() {
  var props = PropertiesService.getScriptProperties();
  var dirUrl = String(props.getProperty(SUPABASE_SYNC.URL_PROP) || '').trim();
  var secret = String(props.getProperty(SUPABASE_SYNC.SECRET_PROP) || '').trim();
  if (!dirUrl || !secret) {
    throw new Error(
      'Missing Script Properties. Set ' + SUPABASE_SYNC.URL_PROP + ' and ' +
      SUPABASE_SYNC.SECRET_PROP + ' under Project Settings.'
    );
  }
  var url = _supabaseEndpoint_(dirUrl, 'hub-content');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var events = _supabaseEventRows_(_readEventsPayload_(ss));   // defined in HubData.gs
  var updates = _supabaseUpdateRows_(_readUpdatesPayload_(ss)); // defined in HubData.gs

  var body = { secret: secret, events: events, updates: updates };

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
    throw new Error('Supabase hub-content push failed (' + code + '): ' + text);
  }

  Logger.log('Hub content pushed: ' + text);
  try {
    var parsed = JSON.parse(text);
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Synced ' + (parsed.events || events.length) + ' events + ' +
      (parsed.updates || updates.length) + ' updates to Supabase',
      'ASG Sync', 5
    );
  } catch (ignore) {}

  return { ok: true, events: events.length, updates: updates.length, response: text };
}

/** Swap the trailing /api/... path of the directory URL for another admin route. */
function _supabaseEndpoint_(dirUrl, name) {
  if (/\/api\//.test(dirUrl)) return dirUrl.replace(/\/api\/.*$/, '/api/admin/' + name);
  return dirUrl.replace(/\/+$/, '') + '/api/admin/' + name;
}

/** Build canonical event rows for the backend (carries raw + external_key). */
function _supabaseEventRows_(payload) {
  if (!payload || !payload.success || !payload.rows) return [];
  return payload.rows.map(function(row) {
    var clean = _supabaseCleanRow_(row);
    var title = _supabasePick_(row, ['title', 'event', 'event_title', 'name']);
    var startsIso = _supabasePick_(row, ['computed_event_datetime_iso', 'starts_at', 'start_date', 'date']);
    clean.title = title;
    clean.starts_at = startsIso;
    clean.external_key = 'evt:' + _supabaseSlug_(title + '|' + (startsIso || row._rowNumber || ''));
    return clean;
  }).filter(function(r) { return !!r.title; });
}

/** Build canonical update rows for the backend (carries raw + external_key). */
function _supabaseUpdateRows_(payload) {
  if (!payload || !payload.success || !payload.rows) return [];
  return payload.rows.map(function(row) {
    var clean = _supabaseCleanRow_(row);
    var title = _supabasePick_(row, ['title', 'headline', 'subject', 'name']);
    var pubIso = _supabasePick_(row, ['computed_update_sort_iso', 'published_at', 'publish_date', 'date']);
    clean.title = title;
    clean.published_at = pubIso;
    clean.external_key = 'upd:' + _supabaseSlug_(title + '|' + (pubIso || row._rowNumber || ''));
    return clean;
  }).filter(function(r) { return !!r.title; });
}

/** First non-empty value among keys, preferring the *_display mirror for text. */
function _supabasePick_(row, keys) {
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var disp = row[k + '_display'];
    if (disp !== undefined && disp !== null && String(disp).trim() !== '') return String(disp).trim();
    var v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return v instanceof Date ? v.toISOString() : String(v).trim();
    }
  }
  return '';
}

function _supabaseSlug_(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Strip the verbose *_display / *_link mirror keys; keep real + computed data. */
function _supabaseCleanRow_(row) {
  var out = {};
  for (var key in row) {
    if (!row.hasOwnProperty(key)) continue;
    if (/_display$/.test(key)) continue;
    var val = row[key];
    if (val instanceof Date) {
      out[key] = val.toISOString();
    } else {
      out[key] = val;
    }
  }
  return out;
}

/**
 * Installable trigger handler. The simple onEdit() in HubData.gs already stamps
 * branding timestamps; this fires on the same edits and pushes to Supabase,
 * debounced so a burst of edits results in a single push.
 */
function onDirectoryEditSync(e) {
  try {
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();
    if (!sheet || !_isDirectorySheetName_(sheet.getName())) return;

    var props = PropertiesService.getScriptProperties();
    var last = Number(props.getProperty(SUPABASE_SYNC.LAST_PUSH_PROP) || 0);
    if (Date.now() - last < SUPABASE_SYNC.EDIT_DEBOUNCE_MS) return;

    pushDirectoryToSupabase();
  } catch (err) {
    Logger.log('onDirectoryEditSync error: ' + (err && err.message ? err.message : String(err)));
  }
}

/** Installs an on-edit trigger + an hourly backup push. Run once. */
function installDirectorySyncTriggers() {
  removeDirectorySyncTriggers();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger('onDirectoryEditSync')
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  ScriptApp.newTrigger('pushDirectoryToSupabase')
    .timeBased()
    .everyHours(1)
    .create();
  ScriptApp.newTrigger('pushHubContentToSupabase')
    .timeBased()
    .everyHours(1)
    .create();
  return {
    ok: true,
    installed: [
      'onDirectoryEditSync (onEdit)',
      'pushDirectoryToSupabase (hourly)',
      'pushHubContentToSupabase (hourly)'
    ]
  };
}

/** Removes the sync triggers created by installDirectorySyncTriggers(). */
function removeDirectorySyncTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === 'onDirectoryEditSync' || fn === 'pushDirectoryToSupabase' || fn === 'pushHubContentToSupabase') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  return { ok: true, removed: removed };
}
