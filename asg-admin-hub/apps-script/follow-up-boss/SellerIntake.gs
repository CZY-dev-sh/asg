/**
 * ASG Seller Onboarding -> Follow Up Boss Intake
 * ------------------------------------------------------------
 * Lives in the same Apps Script project as FubAgentHub.gs and
 * BuyerIntake.gs, so it shares the FUB_API_KEY Script Property and the
 * FUB HTTP / user-resolution helpers defined in BuyerIntake.gs
 * (_biFubRequest_, _biResolveFubUserByEmail_, _biFirstName_, etc.).
 *
 * Apps Script allows only one doPost per project, so BuyerIntake.gs owns
 * doPost and dispatches to _siHandlePost_ below when the payload's
 * _formType is "seller-onboarding".
 *
 * This handler receives the seller onboarding wizard payload
 * (asg-seller-onboarding.html), creates the lead in Follow Up Boss via
 * POST /v1/events (dedupes by email/phone, fires action plans), assigns
 * it to the chosen agent, and attaches the full questionnaire as a note.
 *
 * Script Properties (required):
 * - FUB_API_KEY                 : Follow Up Boss API key (shared)
 *
 * Script Properties (optional):
 * - FUB_API_BASE_URL            : Defaults to https://api.followupboss.com/v1
 * - SELLER_INTAKE_SOURCE        : Lead source label (default "ASG Website - Seller Onboarding")
 * - SELLER_INTAKE_SYSTEM        : FUB "system" registration name (default "ASG Website")
 * - SELLER_INTAKE_TAGS          : Comma-separated extra tags (default "Seller Onboarding")
 * - SELLER_INTAKE_FALLBACK_EMAIL: Agent email to assign when seller picks "Match me"
 *
 * POST body (JSON, sent no-cors from the wizard):
 * {
 *   _formType: "seller-onboarding", _page, _submittedAt, _renderMs, company,
 *   contact: { name, email, phone, methods: ["Text","Email"] },
 *   howHeard, howHeardOther,
 *   marketing: { generalOptIn, frequency, searchOptIn },
 *   agent: { name, email, matchMe },
 *   property: { type, address },
 *   // one of, by property.type:
 *   singleFamily: {...} | condo: {...} | multiUnit: {...} | land: {...}
 * }
 */

var SELLER_INTAKE_DEFAULTS = {
  apiBaseUrl: "https://api.followupboss.com/v1",
  source: "ASG Website - Seller Onboarding",
  system: "ASG Website",
  tags: ["Seller Onboarding"],
  minRenderMs: 4000
};

function _siHandlePost_(body) {
  try {
    if (!body) return _biJson_({ success: false, error: "Empty or invalid request body" });

    /* Spam gates: honeypot must be empty, wizard on screen a human amount of time. */
    if (String(body.company || "").trim()) return _biJson_({ success: true, skipped: "honeypot" });
    var renderMs = Number(body._renderMs || 0);
    if (renderMs > 0 && renderMs < SELLER_INTAKE_DEFAULTS.minRenderMs) {
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
    var apiBase = String(props.getProperty("FUB_API_BASE_URL") || SELLER_INTAKE_DEFAULTS.apiBaseUrl).trim();

    /* Resolve the assigned agent's FUB user. */
    var agent = body.agent || {};
    var agentEmail = String(agent.email || "").trim();
    if ((!agentEmail || agent.matchMe) && props.getProperty("SELLER_INTAKE_FALLBACK_EMAIL")) {
      agentEmail = String(props.getProperty("SELLER_INTAKE_FALLBACK_EMAIL")).trim();
    }
    var fubUser = agentEmail ? _biResolveFubUserByEmail_(apiKey, apiBase, agentEmail) : null;

    /* Create / update the lead via the events endpoint. */
    var source = String(props.getProperty("SELLER_INTAKE_SOURCE") || SELLER_INTAKE_DEFAULTS.source).trim();
    var system = String(props.getProperty("SELLER_INTAKE_SYSTEM") || SELLER_INTAKE_DEFAULTS.system).trim();
    var tags = _siBuildTags_(props.getProperty("SELLER_INTAKE_TAGS"));

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

    /* Marketing opt-outs: tag so FUB smart lists / automations can exclude. */
    var marketing = body.marketing || {};
    if (marketing.generalOptIn === false) person.tags = person.tags.concat(["Marketing Opt-Out"]);
    if (marketing.searchOptIn === false) person.tags = person.tags.concat(["Market Updates Opt-Out"]);

    var property = body.property || {};
    var addressMsg = property.address ? (" - " + property.address) : "";

    var eventPayload = {
      source: source,
      system: system,
      type: "Registration",
      message: "Seller onboarding questionnaire completed" + addressMsg,
      description: _siQuestionnaireText_(body),
      person: person
    };

    var eventResult = _biFubRequest_(apiKey, apiBase, "post", "/events", eventPayload);
    var personId = _biExtractPersonId_(eventResult);

    /* Re-assert assignment: /events may not override an existing person's agent. */
    if (personId && fubUser && fubUser.id) {
      _biTryFubRequest_(apiKey, apiBase, "put", "/people/" + personId, { assignedUserId: fubUser.id });
    }

    /* Attach the full questionnaire as a note for the agent. */
    var noteId = null;
    if (personId) {
      var noteResult = _biTryFubRequest_(apiKey, apiBase, "post", "/notes", {
        personId: personId,
        subject: "Seller Onboarding Profile",
        body: _siQuestionnaireText_(body),
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

function _siQuestionnaireText_(body) {
  var contact = body.contact || {};
  var agent = body.agent || {};
  var marketing = body.marketing || {};
  var property = body.property || {};
  var type = String(property.type || "");

  var lines = [];
  lines.push("SELLER ONBOARDING PROFILE");
  lines.push("Submitted: " + (body._submittedAt || new Date().toISOString()));
  lines.push("");

  lines.push("— Contact —");
  lines.push("Name / entity: " + (contact.name || ""));
  lines.push("Email: " + (contact.email || ""));
  if (contact.phone) lines.push("Phone: " + contact.phone);
  var methods = _biContactMethods_(contact);
  if (methods.length) lines.push("Preferred contact methods: " + methods.join(", "));
  if (body.howHeard) {
    lines.push("How did you hear about us: " + body.howHeard +
      (body.howHeard === "Other" && body.howHeardOther ? " (" + body.howHeardOther + ")" : ""));
  }
  lines.push("");

  lines.push("— Email Preferences —");
  lines.push("General marketing outreach: " + (marketing.generalOptIn === false
    ? "OPTED OUT"
    : "Opted in" + (marketing.frequency ? " (" + marketing.frequency + ")" : "")));
  lines.push("Market and home value updates: " + (marketing.searchOptIn === false ? "OPTED OUT" : "Opted in"));
  lines.push("");

  lines.push("— Agent —");
  lines.push(agent.matchMe ? "No preference (match me with an agent)"
    : ((agent.name || "") + (agent.email ? " <" + agent.email + ">" : "")));
  lines.push("");

  lines.push("— Property —");
  lines.push("Type: " + (type || "Not specified"));
  lines.push("Address: " + (property.address || "Not specified"));
  lines.push("");

  if (type === "Single Family Home") {
    _siAppendSingleFamily_(lines, body.singleFamily || {});
  } else if (type === "Condominium / Townhome") {
    _siAppendCondo_(lines, body.condo || {});
  } else if (type === "Multi-Unit") {
    _siAppendMultiUnit_(lines, body.multiUnit || {});
  } else if (type === "Land") {
    _siAppendLand_(lines, body.land || {});
  }

  return lines.join("\n");
}

function _siAppendSingleFamily_(lines, sf) {
  lines.push("— Single Family Details —");
  _siPush_(lines, "Access instructions", sf.access);
  _siPush_(lines, "Showing availability", sf.showings);
  _siPush_(lines, "Age of mechanicals", _siMechanicals_(sf.mechanicals));
  _siPush_(lines, "Updates / renovations", sf.updates);
  _siPush_(lines, "ComEd account #", sf.comed);
  _siPush_(lines, "Gas account #", sf.gas);
  _siPush_(lines, "Type of utilities", _siList_(sf.utilities));
  _siPush_(lines, "Homeowner's association", sf.hoa);
  if (sf.hoa === "Yes") _siPush_(lines, "HOA amount / frequency / includes", sf.hoaDetails);
  _siPush_(lines, "Occupancy", sf.occupancy);
  if (sf.occupancy === "Tenant Occupied") {
    _siPush_(lines, "Monthly rent", sf.rent);
    _siPush_(lines, "Lease expiration", sf.leaseExp);
  }
  _siPush_(lines, "Anything else about the home", sf.anythingElse);
}

function _siAppendCondo_(lines, c) {
  lines.push("— Condo / Townhome Details —");
  _siPush_(lines, "Occupancy", c.occupancy);
  if (c.occupancy === "Tenant Occupied") {
    _siPush_(lines, "Monthly rent", c.rent);
    _siPush_(lines, "Lease expiration", c.leaseExp);
  }
  _siPush_(lines, "Monthly assessment", c.assessment);
  _siPush_(lines, "Assessment includes", _siList_(c.included));
  _siPush_(lines, "Special assessments", c.specialAssess);
  if (c.specialAssess === "Yes") _siPush_(lines, "Special assessment details", c.specialDesc);
  _siPush_(lines, "Access instructions", c.access);
  _siPush_(lines, "Showing availability", c.showings);
  _siPush_(lines, "ComEd account #", c.comed);
  _siPush_(lines, "Gas account #", c.gas);
  _siPush_(lines, "Age of mechanicals", _siMechanicals_(c.mechanicals));
  _siPush_(lines, "Updates / renovations", c.updates);
  lines.push("");
  lines.push("  Association:");
  _siPush_(lines, "Property manager", c.propertyManager);
  _siPush_(lines, "Open houses allowed", c.openHouses);
  _siPush_(lines, "For Sale signs allowed", c.forSaleSigns);
  _siPush_(lines, "Rental restrictions", c.rentalRestrictions);
  _siPush_(lines, "Pet restrictions", c.petRestrictions);
  _siPush_(lines, "Reserve amount", c.reserveAmount);
  _siPush_(lines, "Recent capital improvements", c.capitalImprovements);
  _siPush_(lines, "Building budget", c.buildingBudget);
  _siPush_(lines, "Move in/out fees", c.moveFees);
  lines.push("");
  lines.push("  Building:");
  _siPush_(lines, "Storage locker/closet", c.storage);
  if (c.storage === "Yes") {
    _siPush_(lines, "Storage access", c.storageType);
    if (c.storageType === "Other") _siPush_(lines, "Storage access details", c.storageDesc);
  }
  _siPush_(lines, "Bike storage", c.bike);
  if (c.bike === "Yes") {
    _siPush_(lines, "Bike storage location", c.bikeWhere);
    _siPush_(lines, "Bike storage fee", c.bikeFee);
    if (c.bikeFee === "Yes") _siPush_(lines, "Bike storage fee amount", c.bikeFeeAmount);
  }
  _siPush_(lines, "Building amenities", c.amenities);
  if (c.amenities === "Yes") _siPush_(lines, "Amenities", _siList_(c.amenitiesList));
  _siPush_(lines, "Anything else about the building", c.anythingElse);
}

function _siAppendMultiUnit_(lines, m) {
  lines.push("— Multi-Unit Details —");
  _siPush_(lines, "Number of units", m.numUnits);
  var units = Array.isArray(m.units) ? m.units : [];
  for (var i = 0; i < units.length; i++) {
    var u = units[i] || {};
    var parts = [];
    if (u.bedsBaths) parts.push(u.bedsBaths);
    if (u.rented === "Yes") {
      parts.push("rented");
      if (u.leaseDate) parts.push("lease " + u.leaseDate);
      if (u.rent) parts.push("rent " + u.rent);
    } else if (u.rented === "No") {
      parts.push("not rented");
    }
    lines.push("Unit #" + (i + 1) + ": " + (parts.length ? parts.join(", ") : "Not specified"));
  }
  _siPush_(lines, "Utilities paid by tenants", _siList_(m.tenantUtilities));
  _siPush_(lines, "Owner expenses", m.ownerExpenses);
  _siPush_(lines, "Age of mechanicals", _siMechanicals_(m.mechanicals));
  _siPush_(lines, "Age of roof", m.roof);
  _siPush_(lines, "Parking availability", m.parking);
  _siPush_(lines, "Laundry", m.laundry);
  _siPush_(lines, "Non-conforming units", m.nonConforming);
  if (m.nonConforming === "Yes") _siPush_(lines, "Non-conforming details", m.nonConformingDetails);
}

function _siAppendLand_(lines, l) {
  lines.push("— Land Details —");
  _siPush_(lines, "Lot dimensions", l.lotDimensions);
  _siPush_(lines, "Access instructions", l.access);
  _siPush_(lines, "Type of utilities", _siList_(l.utilities));
  _siPush_(lines, "Anything else", l.anythingElse);
}

/* ───────────────────────── Small utilities ───────────────────────── */

function _siPush_(lines, label, value) {
  var v = (value == null) ? "" : String(value).trim();
  if (v) lines.push(label + ": " + v);
}

function _siList_(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.map(function (x) { return String(x || "").trim(); }).filter(String).join(", ");
}

function _siMechanicals_(arr) {
  if (!Array.isArray(arr)) return "";
  return arr
    .filter(function (m) { return m && String(m.name || "").trim() && String(m.year || "").trim(); })
    .map(function (m) { return String(m.name).trim() + " (" + String(m.year).trim() + ")"; })
    .join(", ");
}

function _siBuildTags_(rawProp) {
  var tags = SELLER_INTAKE_DEFAULTS.tags.slice();
  String(rawProp || "").split(",").forEach(function (t) {
    var tag = t.trim();
    if (tag && tags.indexOf(tag) < 0) tags.push(tag);
  });
  return tags;
}
