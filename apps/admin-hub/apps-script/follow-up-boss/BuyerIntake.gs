/**
 * ASG Buyer Onboarding -> Follow Up Boss Intake
 * ------------------------------------------------------------
 * Lives in the same Apps Script project as FubAgentHub.gs so it
 * shares the FUB_API_KEY Script Property. This file adds the
 * project's doPost: it receives the buyer onboarding wizard
 * payload (asg-buyer-onboarding.html), creates the lead in
 * Follow Up Boss via POST /v1/events (FUB's recommended lead
 * route: dedupes by email/phone and fires action plans), assigns
 * it to the selected agent, and attaches the full questionnaire
 * as a note on the person.
 *
 * Script Properties (required):
 * - FUB_API_KEY                : Follow Up Boss API key
 *
 * Script Properties (optional):
 * - FUB_API_BASE_URL           : Defaults to https://api.followupboss.com/v1
 * - BUYER_INTAKE_SOURCE        : Lead source label (default "ASG Website - Buyer Onboarding")
 * - BUYER_INTAKE_SYSTEM        : FUB "system" registration name (default "ASG Website")
 * - BUYER_INTAKE_TAGS          : Comma-separated extra tags (default "Buyer Onboarding")
 * - BUYER_INTAKE_FALLBACK_EMAIL: Agent email to assign when buyer picks "Match me"
 *
 * POST body (JSON, sent no-cors from the wizard):
 * {
 *   _formType: "buyer-onboarding", _page, _submittedAt, _renderMs, company,
 *   contact: { name, email, phone, methods: ["Text","Email"] },
 *   marketing: { generalOptIn, frequency, searchOptIn },
 *   agent: { name, email, matchMe },
 *   locations: ["Lincoln Park", ...], otherLocation,
 *   budgetMax, bedsMin, bathsMin, petFriendly, washerDryerInUnit,
 *   details: { propertyType, condition, parking, timing, financing, mustHave, autoNo }
 * }
 */

var BUYER_INTAKE_DEFAULTS = {
  apiBaseUrl: "https://api.followupboss.com/v1",
  source: "ASG Website - Buyer Onboarding",
  system: "ASG Website",
  tags: ["Buyer Onboarding"],
  minRenderMs: 4000,
  usersCacheKey: "bi_fub_users_v1",
  usersCacheTtlSec: 21600
};

/**
 * Shared POST entry point for this Apps Script project.
 * Both the buyer and seller onboarding wizards post here; we dispatch on the
 * payload's `_formType` so each wizard gets its own handler while the project
 * keeps a single doPost (Apps Script only allows one).
 */
function doPost(e) {
  var body = _biParseBody_(e);
  if (!body) return _biJson_({ success: false, error: "Empty or invalid request body" });
  if (String(body._formType || "") === "seller-onboarding" && typeof _siHandlePost_ === "function") {
    return _siHandlePost_(body);
  }
  return _biHandlePost_(body);
}

function _biHandlePost_(body) {
  try {
    if (!body) return _biJson_({ success: false, error: "Empty or invalid request body" });

    /* Spam gates: honeypot field must be empty, wizard must have been
       on screen for a human amount of time. */
    if (String(body.company || "").trim()) return _biJson_({ success: true, skipped: "honeypot" });
    var renderMs = Number(body._renderMs || 0);
    if (renderMs > 0 && renderMs < BUYER_INTAKE_DEFAULTS.minRenderMs) {
      return _biJson_({ success: true, skipped: "time-trap" });
    }

    var contact = body.contact || {};
    var name = String(contact.name || "").trim();
    var email = String(contact.email || "").trim();
    var phone = String(contact.phone || "").trim();
    if (!name || !email) return _biJson_({ success: false, error: "Missing required contact fields" });

    var props = PropertiesService.getScriptProperties();
    var apiKey = String(props.getProperty("FUB_API_KEY") || "").trim();
    if (!apiKey) return _biJson_({ success: false, error: "Missing Script Property: FUB_API_KEY" });
    var apiBase = String(props.getProperty("FUB_API_BASE_URL") || BUYER_INTAKE_DEFAULTS.apiBaseUrl).trim();

    /* Resolve the assigned agent's FUB user. */
    var agent = body.agent || {};
    var agentEmail = String(agent.email || "").trim();
    if ((!agentEmail || agent.matchMe) && props.getProperty("BUYER_INTAKE_FALLBACK_EMAIL")) {
      agentEmail = String(props.getProperty("BUYER_INTAKE_FALLBACK_EMAIL")).trim();
    }
    var fubUser = agentEmail ? _biResolveFubUserByEmail_(apiKey, apiBase, agentEmail) : null;

    /* Create / update the lead via the events endpoint. */
    var source = String(props.getProperty("BUYER_INTAKE_SOURCE") || BUYER_INTAKE_DEFAULTS.source).trim();
    var system = String(props.getProperty("BUYER_INTAKE_SYSTEM") || BUYER_INTAKE_DEFAULTS.system).trim();
    var tags = _biBuildTags_(props.getProperty("BUYER_INTAKE_TAGS"));

    var person = {
      firstName: _biFirstName_(name),
      lastName: _biLastName_(name),
      emails: [{ value: email, type: "home" }],
      tags: tags
    };
    if (phone) person.phones = [{ value: phone, type: "mobile" }];
    if (fubUser && fubUser.id) person.assignedUserId = fubUser.id;
    var methods = _biContactMethods_(contact);
    if (methods.length) person.contactPreference = methods.join(", ");

    /* Marketing opt-outs: tag so FUB smart lists / automations can exclude */
    var marketing = body.marketing || {};
    if (marketing.generalOptIn === false) person.tags = person.tags.concat(["Marketing Opt-Out"]);
    if (marketing.searchOptIn === false) person.tags = person.tags.concat(["Search Emails Opt-Out"]);

    var eventPayload = {
      source: source,
      system: system,
      type: "Registration",
      message: "Buyer onboarding questionnaire completed at " + (body._page || "/buyer-onboarding"),
      description: _biQuestionnaireText_(body),
      person: person
    };

    var eventResult = _biFubRequest_(apiKey, apiBase, "post", "/events", eventPayload);
    var personId = _biExtractPersonId_(eventResult);

    /* Re-assert assignment: /events may not override an existing
       person's assigned agent, so PUT it explicitly when known. */
    if (personId && fubUser && fubUser.id) {
      _biTryFubRequest_(apiKey, apiBase, "put", "/people/" + personId, { assignedUserId: fubUser.id });
    }

    /* Attach the full questionnaire as a note for the agent. */
    var noteId = null;
    if (personId) {
      var noteResult = _biTryFubRequest_(apiKey, apiBase, "post", "/notes", {
        personId: personId,
        subject: "Buyer Onboarding Profile",
        body: _biQuestionnaireText_(body),
        isHtml: false
      });
      if (noteResult && noteResult.id) noteId = noteResult.id;
    }

    return _biJson_({
      success: true,
      personId: personId,
      noteId: noteId,
      assignedTo: fubUser ? { id: fubUser.id, name: fubUser.name, email: fubUser.email } : null
    });
  } catch (err) {
    return _biJson_({
      success: false,
      error: err && err.message ? err.message : String(err)
    });
  }
}

/* ───────────────────────── Questionnaire formatting ───────────────────────── */

function _biQuestionnaireText_(body) {
  var contact = body.contact || {};
  var agent = body.agent || {};
  var details = body.details || {};

  var locations = Array.isArray(body.locations) ? body.locations.slice() : [];
  if (String(body.otherLocation || "").trim()) locations.push(String(body.otherLocation).trim() + " (other)");

  var beds = Number(body.bedsMin);
  var bedsLabel = !isFinite(beds) ? "" : (beds === 0 ? "Studio+" : (beds >= 6 ? "6+" : beds + "+"));
  var baths = Number(body.bathsMin);
  var bathsLabel = !isFinite(baths) ? "" : ((baths >= 5 ? "5+" : baths) + "+");

  var budget = Number(body.budgetMax || 0);
  var budgetLabel = budget > 0 ? "$" + _biFormatNumber_(budget) : "No maximum set";

  var lines = [];
  lines.push("BUYER ONBOARDING PROFILE");
  lines.push("Submitted: " + (body._submittedAt || new Date().toISOString()));
  lines.push("");
  lines.push("— Contact —");
  lines.push("Name: " + (contact.name || ""));
  lines.push("Email: " + (contact.email || ""));
  if (contact.phone) lines.push("Phone: " + contact.phone);
  var methods = _biContactMethods_(contact);
  if (methods.length) lines.push("Preferred contact methods: " + methods.join(", "));
  lines.push("");
  lines.push("— Email Preferences —");
  var marketing = body.marketing || {};
  lines.push("General marketing outreach: " + (marketing.generalOptIn === false
    ? "OPTED OUT"
    : "Opted in" + (marketing.frequency ? " (" + marketing.frequency + ")" : "")));
  lines.push("Search-related emails (potential homes to go see): " + (marketing.searchOptIn === false
    ? "OPTED OUT"
    : "Opted in"));
  lines.push("");
  lines.push("— Agent —");
  lines.push(agent.matchMe ? "No preference (match me with an agent)" : ((agent.name || "") + (agent.email ? " <" + agent.email + ">" : "")));
  lines.push("");
  lines.push("— Location —");
  lines.push(locations.length ? locations.join(", ") : "Not specified");
  lines.push("");
  lines.push("— Budget —");
  lines.push("Max: " + budgetLabel);
  lines.push("");
  lines.push("— Non-Negotiables —");
  if (bedsLabel) lines.push("Bedrooms: " + bedsLabel);
  if (bathsLabel) lines.push("Bathrooms: " + bathsLabel);
  lines.push("Pet friendly: " + (body.petFriendly ? "Required" : "Not required"));
  lines.push("Washer/Dryer in unit: " + (body.washerDryerInUnit ? "Required" : "Not required"));
  lines.push("");
  lines.push("— Additional Details —");
  if (details.propertyType) lines.push("Property type: " + details.propertyType);
  if (details.condition) lines.push("Condition: " + details.condition);
  if (details.parking) lines.push("Parking: " + details.parking);
  if (details.timing) lines.push("Timing: " + details.timing);
  if (details.financing) lines.push("Financing: " + details.financing);
  if (details.mustHave) lines.push("Top must-have: " + details.mustHave);
  if (details.autoNo) lines.push("Automatic no: " + details.autoNo);
  if (!details.propertyType && !details.condition && !details.parking &&
      !details.timing && !details.financing && !details.mustHave && !details.autoNo) {
    lines.push("None provided");
  }

  return lines.join("\n");
}

/* ───────────────────────── FUB user resolution ───────────────────────── */

function _biResolveFubUserByEmail_(apiKey, apiBase, email) {
  var target = String(email || "").trim().toLowerCase();
  if (!target) return null;

  var users = _biLoadFubUsers_(apiKey, apiBase);
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].email || "").trim().toLowerCase() === target) return users[i];
  }
  return null;
}

function _biLoadFubUsers_(apiKey, apiBase) {
  var cache = CacheService.getScriptCache();
  try {
    var cached = cache.get(BUYER_INTAKE_DEFAULTS.usersCacheKey);
    if (cached) return JSON.parse(cached);
  } catch (ignored) {}

  var users = [];
  var offset = 0;
  var limit = 100;
  for (var page = 0; page < 10; page++) {
    var payload = _biTryFubRequest_(apiKey, apiBase, "get", "/users", { limit: limit, offset: offset });
    var batch = payload && Array.isArray(payload.users) ? payload.users : [];
    for (var i = 0; i < batch.length; i++) {
      users.push({
        id: batch[i].id,
        name: String(batch[i].name || "").trim(),
        email: String(batch[i].email || "").trim()
      });
    }
    if (batch.length < limit) break;
    offset += limit;
  }

  if (users.length) {
    try {
      cache.put(BUYER_INTAKE_DEFAULTS.usersCacheKey, JSON.stringify(users), BUYER_INTAKE_DEFAULTS.usersCacheTtlSec);
    } catch (ignored) {}
  }
  return users;
}

/* ───────────────────────── FUB HTTP helpers ───────────────────────── */

function _biFubRequest_(apiKey, apiBase, method, path, payloadOrQuery) {
  var url = String(apiBase || "").replace(/\/+$/, "") + path;
  var options = {
    method: method,
    muteHttpExceptions: true,
    headers: {
      Authorization: "Basic " + Utilities.base64Encode(apiKey + ":"),
      Accept: "application/json"
    }
  };

  if (method === "get") {
    var params = [];
    var query = payloadOrQuery || {};
    for (var key in query) {
      if (query.hasOwnProperty(key) && query[key] !== "" && query[key] != null) {
        params.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(query[key])));
      }
    }
    if (params.length) url += (url.indexOf("?") >= 0 ? "&" : "?") + params.join("&");
  } else {
    options.contentType = "application/json";
    options.payload = JSON.stringify(payloadOrQuery || {});
  }

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var text = response.getContentText();
  var parsed = {};
  if (text) {
    try { parsed = JSON.parse(text); } catch (ignored) { parsed = { raw: text }; }
  }

  if (code < 200 || code >= 300) {
    var message = parsed && parsed.message ? parsed.message : ("HTTP " + code);
    throw new Error("Follow Up Boss request failed (" + method.toUpperCase() + " " + path + "): " + message);
  }
  return parsed;
}

function _biTryFubRequest_(apiKey, apiBase, method, path, payloadOrQuery) {
  try {
    return _biFubRequest_(apiKey, apiBase, method, path, payloadOrQuery);
  } catch (ignored) {
    return null;
  }
}

/* ───────────────────────── Small utilities ───────────────────────── */

function _biContactMethods_(contact) {
  if (!contact) return [];
  if (Array.isArray(contact.methods)) {
    return contact.methods.map(function (m) { return String(m || "").trim(); }).filter(String);
  }
  /* Legacy single-method payloads */
  var single = String(contact.method || "").trim();
  return single ? [single] : [];
}

function _biParseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return null;
  try {
    var parsed = JSON.parse(e.postData.contents);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (ignored) {
    return null;
  }
}

function _biExtractPersonId_(eventResult) {
  if (!eventResult) return null;
  /* POST /events returns the affected person (sometimes nested). */
  if (eventResult.id && eventResult.firstName !== undefined) return eventResult.id;
  if (eventResult.person && eventResult.person.id) return eventResult.person.id;
  if (eventResult.personId) return eventResult.personId;
  return eventResult.id || null;
}

function _biBuildTags_(rawProp) {
  var tags = BUYER_INTAKE_DEFAULTS.tags.slice();
  String(rawProp || "").split(",").forEach(function (t) {
    var tag = t.trim();
    if (tag && tags.indexOf(tag) < 0) tags.push(tag);
  });
  return tags;
}

function _biFirstName_(fullName) {
  var parts = String(fullName || "").trim().split(/\s+/);
  return parts.length ? parts[0] : "";
}

function _biLastName_(fullName) {
  var parts = String(fullName || "").trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
}

function _biFormatNumber_(n) {
  return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function _biJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
