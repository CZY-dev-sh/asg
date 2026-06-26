/**
 * ASG Usage Log — beacon receiver
 * ============================================================
 * Tiny Apps Script web app that accepts page-view + click
 * beacons from the ASG hubs (Admin Hub, agent hubs, listing
 * hub, deal tracker, etc.) and appends them as rows in a
 * Google Sheet. The Command Center reads from that sheet to
 * produce adoption metrics.
 *
 * Why a separate script:
 *   - Deploy with "Anyone, even anonymous" access so the
 *     beacon can fire from any browser without auth.
 *   - Keep it small so it's never a single point of failure
 *     for the larger Command Center aggregator.
 *
 * ------------------------------------------------------------
 * SCRIPT PROPERTIES (required)
 * ------------------------------------------------------------
 *   USAGE_LOG_SHEET_ID    Google Sheet file ID to append into
 *
 * SCRIPT PROPERTIES (optional)
 * ------------------------------------------------------------
 *   USAGE_LOG_TAB         Sheet tab name (default "Events")
 *   USAGE_LOG_HMAC_KEY    Optional HMAC-SHA256 secret. If set,
 *                         the beacon must include a matching
 *                         `sig` field. Currently advisory; the
 *                         beacon snippet doesn't sign by default.
 *
 * ------------------------------------------------------------
 * SHEET SCHEMA
 * ------------------------------------------------------------
 * The receiver lazily creates the tab + header row on the
 * first valid POST. Columns:
 *
 *   timestamp | type | page | label | url | visitor_id |
 *   agent_email | agent_name | session_id | user_agent | referrer | meta
 *
 * ------------------------------------------------------------
 * REQUEST CONTRACT
 * ------------------------------------------------------------
 * The beacon snippet sends a JSON body via fetch() (or
 * navigator.sendBeacon for unloads). The body should look like:
 *
 *   {
 *     "type": "view" | "click" | "form_submit" | "video_play",
 *     "page": "agent-hub-sam-abadi",
 *     "label": "FUB Open Tasks",
 *     "url": "https://...",
 *     "visitor_id": "uuid-or-cookie-id",
 *     "agent_email": "sam@asg.com",
 *     "agent_name": "Sam Abadi",
 *     "session_id": "session-uuid",
 *     "meta": { ... arbitrary extras ... }
 *   }
 *
 * Returns { ok: true } on success and { ok: false, error }
 * on failure. Status code is always 200 so the browser doesn't
 * trigger CORS/error noise on best-effort beacons.
 */

var USAGE_LOG_DEFAULTS = {
  tab: "Events"
};

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "";
    var body = _ulParseJson_(raw, null);
    if (!body || typeof body !== "object") {
      return _ulJson_({ ok: false, error: "invalid_body" });
    }
    var props = PropertiesService.getScriptProperties();
    var sheetId = String(props.getProperty("USAGE_LOG_SHEET_ID") || "").trim();
    if (!sheetId) return _ulJson_({ ok: false, error: "missing_sheet_id" });

    var tabName = String(props.getProperty("USAGE_LOG_TAB") || USAGE_LOG_DEFAULTS.tab).trim();
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
      sheet.appendRow([
        "timestamp", "type", "page", "label", "url",
        "visitor_id", "agent_email", "agent_name",
        "session_id", "user_agent", "referrer", "meta"
      ]);
      sheet.setFrozenRows(1);
    }

    var row = [
      new Date(),
      String(body.type || "view").trim().slice(0, 32),
      String(body.page || "").trim().slice(0, 200),
      String(body.label || "").trim().slice(0, 200),
      String(body.url || "").trim().slice(0, 600),
      String(body.visitor_id || "").trim().slice(0, 80),
      String(body.agent_email || "").trim().toLowerCase().slice(0, 200),
      String(body.agent_name || "").trim().slice(0, 200),
      String(body.session_id || "").trim().slice(0, 80),
      String(body.user_agent || "").trim().slice(0, 400),
      String(body.referrer || "").trim().slice(0, 400),
      body.meta ? JSON.stringify(body.meta).slice(0, 2000) : ""
    ];
    sheet.appendRow(row);
    return _ulJson_({ ok: true });
  } catch (err) {
    return _ulJson_({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}

function doGet(e) {
  // Health check — confirm the endpoint is reachable.
  return _ulJson_({
    ok: true,
    service: "asg-usage-log",
    message: "POST a JSON event body to log it. See Apps Script header doc for schema.",
    timestamp: new Date().toISOString()
  });
}

function _ulJson_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function _ulParseJson_(text, fallback) {
  try { return JSON.parse(text); } catch (err) { return fallback; }
}
