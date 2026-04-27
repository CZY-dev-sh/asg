/**
 * ASG Hub Data API
 * ------------------------------------------------------------
 * Reads tabular data from:
 *  - Directory (team directory)
 *  - Events
 *  - Updates
 *
 * Returns all columns from each tab plus computed fields for:
 *  - Team tenure (from Start Date)
 *  - Next birthday + days until birthday (from Birthday)
 *  - Seniority rank (overall + by tier)
 *  - Event groupings (next up, future, past)
 *  - Update ordering (latest first)
 *
 * Query params (optional):
 *  - ?view=all        (default)
 *  - ?view=directory
 *  - ?view=events
 *  - ?view=updates
 */

var HUB_TAB_CANDIDATES = {
  directory: ["Directory", "Team Directory", "team_directory"],
  events: ["Events", "events"],
  updates: ["Updates", "updates"]
};

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var view = _resolveView_(e && e.parameter ? e.parameter.view : "");

    var directory = null;
    var events = null;
    var updates = null;

    if (view === "all" || view === "directory") {
      directory = _readDirectoryPayload_(ss);
    }
    if (view === "all" || view === "events") {
      events = _readEventsPayload_(ss);
    }
    if (view === "all" || view === "updates") {
      updates = _readUpdatesPayload_(ss);
    }

    return _json_({
      success: true,
      meta: {
        view: view,
        generatedAt: new Date().toISOString()
      },
      data: {
        directory: directory,
        events: events,
        updates: updates
      }
    });
  } catch (err) {
    return _json_({
      success: false,
      error: err && err.message ? err.message : String(err)
    });
  }
}

function _resolveView_(raw) {
  var view = String(raw || "").trim().toLowerCase();
  if (view === "directory" || view === "events" || view === "updates") return view;
  return "all";
}

function _readDirectoryPayload_(ss) {
  var sheet = _findSheet_(ss, HUB_TAB_CANDIDATES.directory);
  if (!sheet) {
    return { success: false, error: 'Directory sheet not found. Expected one of: ' + HUB_TAB_CANDIDATES.directory.join(", ") };
  }

  var table = _readTable_(sheet);
  var enriched = _enrichDirectoryRows_(table.rows);

  return {
    success: true,
    sheetName: sheet.getName(),
    headers: table.headers,
    rows: enriched.rows,
    summary: {
      total: enriched.rows.length,
      withStartDate: enriched.withStartDateCount,
      withBirthday: enriched.withBirthdayCount
    },
    tv: {
      nextBirthdays: enriched.nextBirthdays,
      seniority: enriched.seniority
    }
  };
}

function _readEventsPayload_(ss) {
  var sheet = _findSheet_(ss, HUB_TAB_CANDIDATES.events);
  if (!sheet) {
    return { success: false, error: 'Events sheet not found. Expected one of: ' + HUB_TAB_CANDIDATES.events.join(", ") };
  }

  var table = _readTable_(sheet);
  var grouped = _groupEvents_(table.rows);

  return {
    success: true,
    sheetName: sheet.getName(),
    headers: table.headers,
    rows: table.rows,
    nextUp: grouped.nextUp,
    upcoming: grouped.upcoming,
    future: grouped.future,
    past: grouped.past
  };
}

function _readUpdatesPayload_(ss) {
  var sheet = _findSheet_(ss, HUB_TAB_CANDIDATES.updates);
  if (!sheet) {
    return { success: false, error: 'Updates sheet not found. Expected one of: ' + HUB_TAB_CANDIDATES.updates.join(", ") };
  }

  var table = _readTable_(sheet);
  var ordered = _orderUpdates_(table.rows);

  return {
    success: true,
    sheetName: sheet.getName(),
    headers: table.headers,
    rows: table.rows,
    latest: ordered.length ? ordered[0] : null,
    ordered: ordered
  };
}

function _readTable_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) {
    return { headers: [], rows: [] };
  }

  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var keys = headers.map(function(h) { return _toKey_(h); });

  if (lastRow < 2) {
    return { headers: headers, rows: [] };
  }

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var display = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
  var rows = [];

  for (var r = 0; r < values.length; r++) {
    var rawRow = values[r];
    if (_isRowBlank_(rawRow)) continue;

    var obj = {
      _rowNumber: r + 2
    };

    for (var c = 0; c < keys.length; c++) {
      var key = keys[c];
      if (!key) continue;
      obj[key] = rawRow[c];
      obj[key + "_display"] = display[r][c];
    }
    rows.push(obj);
  }

  return {
    headers: headers,
    rows: rows
  };
}

function _enrichDirectoryRows_(rows) {
  var now = new Date();
  var withStartDate = 0;
  var withBirthday = 0;
  var startRows = [];
  var birthdayRows = [];

  var enriched = rows.map(function(row) {
    var name = _pick_(row, ["name", "display_name"]) || "";
    var tierRaw = _pick_(row, ["tier", "role_group"]) || "";
    var tier = _normalizeTier_(tierRaw);

    var startDate = _parseDate_(_pick_(row, ["start_date", "start_date_display", "startdate", "start"]));
    var birthdayDate = _parseDate_(_pick_(row, ["birthday", "birth_date", "birthday_display"]));

    var tenure = _computeTenure_(startDate, now);
    var nextBirthday = _computeNextBirthday_(birthdayDate, now);

    if (startDate) {
      withStartDate++;
      startRows.push({ row: row, startDate: startDate, tier: tier });
    }
    if (nextBirthday) {
      withBirthday++;
      birthdayRows.push({
        row: row,
        name: name,
        tier: tier,
        birthday: _toIsoDate_(birthdayDate),
        nextBirthdayDate: nextBirthday.date,
        nextBirthdayIso: _toIsoDate_(nextBirthday.date),
        daysUntilBirthday: nextBirthday.daysUntil
      });
    }

    row.computed_tier = tier;
    row.computed_tenure_days = tenure.days;
    row.computed_tenure_months = tenure.monthsTotal;
    row.computed_tenure_years = tenure.yearsDecimal;
    row.computed_tenure_label = tenure.label;
    row.computed_start_date_iso = startDate ? _toIsoDate_(startDate) : "";
    row.computed_birthday_iso = birthdayDate ? _toIsoDate_(birthdayDate) : "";
    row.computed_next_birthday_iso = nextBirthday ? _toIsoDate_(nextBirthday.date) : "";
    row.computed_days_until_birthday = nextBirthday ? nextBirthday.daysUntil : null;
    return row;
  });

  // Seniority ranking (oldest start date = highest seniority = rank 1)
  startRows.sort(function(a, b) { return a.startDate - b.startDate; });
  var overallRankMap = {};
  for (var i = 0; i < startRows.length; i++) {
    overallRankMap[startRows[i].row._rowNumber] = i + 1;
  }

  var tiers = ["Senior", "Junior", "Admin", "Other"];
  var rankByTier = {};
  for (var t = 0; t < tiers.length; t++) {
    var tier = tiers[t];
    var subset = startRows.filter(function(x) { return x.tier === tier; });
    subset.sort(function(a, b) { return a.startDate - b.startDate; });
    rankByTier[tier] = {};
    for (var j = 0; j < subset.length; j++) {
      rankByTier[tier][subset[j].row._rowNumber] = j + 1;
    }
  }

  for (var k = 0; k < enriched.length; k++) {
    var row = enriched[k];
    var rowTier = row.computed_tier || "Other";
    row.computed_seniority_rank_overall = overallRankMap[row._rowNumber] || null;
    row.computed_seniority_rank_tier = (rankByTier[rowTier] && rankByTier[rowTier][row._rowNumber]) || null;
  }

  birthdayRows.sort(function(a, b) {
    if (a.daysUntilBirthday !== b.daysUntilBirthday) return a.daysUntilBirthday - b.daysUntilBirthday;
    return a.name.localeCompare(b.name);
  });

  var nextBirthdays = birthdayRows.slice(0, 8).map(function(item) {
    return {
      rowNumber: item.row._rowNumber,
      name: item.name,
      tier: item.tier,
      birthdayIso: item.birthday,
      nextBirthdayIso: item.nextBirthdayIso,
      daysUntilBirthday: item.daysUntilBirthday,
      imageUrl: _pick_(item.row, ["image_url", "photo", "headshot_url"]) || "",
      email: _pick_(item.row, ["email"]) || "",
      phone: _pick_(item.row, ["phone_number", "phone", "mobile", "cell", "cell_phone", "work_phone"]) || ""
    };
  });

  return {
    rows: enriched,
    withStartDateCount: withStartDate,
    withBirthdayCount: withBirthday,
    nextBirthdays: nextBirthdays,
    seniority: {
      overall: enriched
        .filter(function(r) { return !!r.computed_seniority_rank_overall; })
        .sort(function(a, b) { return a.computed_seniority_rank_overall - b.computed_seniority_rank_overall; })
        .map(function(r) {
          return {
            rowNumber: r._rowNumber,
            name: _pick_(r, ["name", "display_name"]) || "",
            tier: r.computed_tier,
            startDateIso: r.computed_start_date_iso,
            tenureLabel: r.computed_tenure_label,
            rank: r.computed_seniority_rank_overall
          };
        }),
      byTier: {
        Senior: _seniorityListByTier_(enriched, "Senior"),
        Junior: _seniorityListByTier_(enriched, "Junior"),
        Admin: _seniorityListByTier_(enriched, "Admin")
      }
    }
  };
}

function _seniorityListByTier_(rows, tier) {
  return rows
    .filter(function(r) { return r.computed_tier === tier && !!r.computed_seniority_rank_tier; })
    .sort(function(a, b) { return a.computed_seniority_rank_tier - b.computed_seniority_rank_tier; })
    .map(function(r) {
      return {
        rowNumber: r._rowNumber,
        name: _pick_(r, ["name", "display_name"]) || "",
        startDateIso: r.computed_start_date_iso,
        tenureLabel: r.computed_tenure_label,
        rank: r.computed_seniority_rank_tier
      };
    });
}

function _groupEvents_(rows) {
  var now = new Date();
  var mapped = rows.map(function(row) {
    var date = _eventDateTime_(row);
    var status = String(_pick_(row, ["status"]) || "").toLowerCase();
    var isCancelled = /cancel/.test(status);
    row.computed_event_datetime_iso = date ? date.toISOString() : "";
    row.computed_event_is_future = date ? date.getTime() >= now.getTime() : false;
    row.computed_event_is_cancelled = isCancelled;
    return {
      row: row,
      date: date,
      status: status,
      isCancelled: isCancelled
    };
  });

  var valid = mapped.filter(function(x) { return !!x.date && !x.isCancelled; });
  var upcoming = valid
    .filter(function(x) { return x.date.getTime() >= now.getTime(); })
    .sort(function(a, b) { return a.date - b.date; });
  var past = valid
    .filter(function(x) { return x.date.getTime() < now.getTime(); })
    .sort(function(a, b) { return b.date - a.date; });

  var nextUp = upcoming.length ? upcoming[0].row : null;
  var future = upcoming.slice(1).map(function(x) { return x.row; });

  return {
    nextUp: nextUp,
    upcoming: upcoming.map(function(x) { return x.row; }),
    future: future,
    past: past.map(function(x) { return x.row; })
  };
}

function _orderUpdates_(rows) {
  return rows.slice().sort(function(a, b) {
    var da = _updateDate_(a);
    var db = _updateDate_(b);
    if (da && db) return db - da;
    if (da) return -1;
    if (db) return 1;
    return b._rowNumber - a._rowNumber;
  }).map(function(row) {
    var date = _updateDate_(row);
    row.computed_update_sort_iso = date ? date.toISOString() : "";
    return row;
  });
}

function _eventDateTime_(row) {
  var dateVal = _pick_(row, ["start_date", "date", "event_date", "event_start_date", "datetime"]);
  var timeVal = _pick_(row, ["start_time", "time", "event_time"]);
  var date = _parseDate_(dateVal);
  if (!date) return null;

  var hm = _parseTime_(timeVal);
  date.setHours(hm.hours, hm.minutes, 0, 0);
  return date;
}

function _updateDate_(row) {
  var candidates = [
    _pick_(row, ["publish_date", "published_at", "posted_at"]),
    _pick_(row, ["effective_date", "date"])
  ];

  for (var i = 0; i < candidates.length; i++) {
    var d = _parseDate_(candidates[i]);
    if (d) return d;
  }
  return null;
}

function _computeTenure_(startDate, now) {
  if (!startDate) {
    return {
      days: null,
      monthsTotal: null,
      yearsDecimal: null,
      label: ""
    };
  }

  var ms = now.getTime() - startDate.getTime();
  var days = Math.max(0, Math.floor(ms / 86400000));
  var monthsTotal = Math.max(0, Math.floor(days / 30.4375));
  var years = Math.floor(monthsTotal / 12);
  var months = monthsTotal % 12;
  var yearsDecimal = Math.round((monthsTotal / 12) * 100) / 100;

  var label = years > 0 ? (years + "y " + months + "m") : (months + "m");
  return {
    days: days,
    monthsTotal: monthsTotal,
    yearsDecimal: yearsDecimal,
    label: label
  };
}

function _computeNextBirthday_(birthdayDate, now) {
  if (!birthdayDate) return null;
  var next = new Date(now.getFullYear(), birthdayDate.getMonth(), birthdayDate.getDate());
  next.setHours(0, 0, 0, 0);
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (next.getTime() < today.getTime()) {
    next = new Date(now.getFullYear() + 1, birthdayDate.getMonth(), birthdayDate.getDate());
    next.setHours(0, 0, 0, 0);
  }
  var daysUntil = Math.round((next.getTime() - today.getTime()) / 86400000);
  return {
    date: next,
    daysUntil: daysUntil
  };
}

function _parseTime_(raw) {
  if (raw instanceof Date) {
    return { hours: raw.getHours(), minutes: raw.getMinutes() };
  }
  var s = String(raw || "").trim();
  if (!s) return { hours: 0, minutes: 0 };

  var m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    return { hours: _clamp_(parseInt(m24[1], 10), 0, 23), minutes: _clamp_(parseInt(m24[2], 10), 0, 59) };
  }

  var m12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([AP]M)$/i);
  if (m12) {
    var h = parseInt(m12[1], 10);
    var min = m12[2] ? parseInt(m12[2], 10) : 0;
    var ap = m12[3].toUpperCase();
    if (h === 12) h = 0;
    if (ap === "PM") h += 12;
    return { hours: _clamp_(h, 0, 23), minutes: _clamp_(min, 0, 59) };
  }

  return { hours: 0, minutes: 0 };
}

function _parseDate_(raw) {
  if (!raw && raw !== 0) return null;
  if (raw instanceof Date && !isNaN(raw.getTime())) return new Date(raw.getTime());

  var s = String(raw).trim();
  if (!s) return null;

  var parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed;

  // MM/DD/YYYY or MM.DD.YYYY or MM-DD-YYYY
  var mdy = s.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})$/);
  if (mdy) {
    var month = parseInt(mdy[1], 10) - 1;
    var day = parseInt(mdy[2], 10);
    var year = parseInt(mdy[3], 10);
    if (year < 100) year += 2000;
    var d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

function _normalizeTier_(raw) {
  var s = String(raw || "").trim().toLowerCase();
  if (!s) return "Other";
  if (/senior/.test(s)) return "Senior";
  if (/junior/.test(s)) return "Junior";
  if (/admin/.test(s)) return "Admin";
  return "Other";
}

function _toIsoDate_(d) {
  if (!d) return "";
  // Use script timezone so calendar day matches the sheet / local intent (UTC would shift dates).
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function _pick_(obj, keys) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (obj.hasOwnProperty(key) && obj[key] !== "" && obj[key] !== null && obj[key] !== undefined) {
      return obj[key];
    }
  }
  return "";
}

function _toKey_(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function _findSheet_(ss, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var sh = ss.getSheetByName(candidates[i]);
    if (sh) return sh;
  }
  return null;
}

function _isRowBlank_(row) {
  for (var i = 0; i < row.length; i++) {
    if (String(row[i] || "").trim() !== "") return false;
  }
  return true;
}

function _clamp_(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function _json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Headshots Mailer Integration
 * ------------------------------------------------------------
 * Creates previews, drafts, or sends individualized headshots emails from Directory.
 */
var HEADSHOTS_MAILER = {
  SHEET_CANDIDATES: ["Directory", "Team Directory", "team_directory"],
  HEADSHOTS_COLUMN_CANDIDATES: ["Headshots", "Headshot Folder", "Headshots Link"],
  PHOTO_COLUMN_CANDIDATES: ["icon_photo_url", "Image URL", "Photo", "Headshot URL", "Headshot", "Profile Photo"],
  SIGNATURE_PHONE_COLUMN_CANDIDATES: ["phone_number", "phone", "mobile", "cell", "cell_phone", "work_phone"],
  SENT_AT_COLUMN: "Headshots Email Sent At",
  STATUS_COLUMN: "Headshots Email Status",
  SIGNATURE_ICON_URL: "https://images.squarespace-cdn.com/content/v1/645525ddf33bc2091db5603a/2a8918dd-61d9-46db-abd1-f145bd3c2e5a/TimDetail-SS26.jpg?format=1500w",
  TOUCH_UP_SCHEDULING_URL: "https://asgmarketing.as.me/?appointmentType=92351009",
  SIGNATURE_NAME: "Tim Urmanczy",
  SIGNATURE_TITLE: "Creative Director",
  SIGNATURE_PHONE: "",
  FROM_NAME: "ASG Marketing Team",
  SUBJECT: "Your Spring 2026 Portraits Are Ready!",
  TEST_EMAIL: "tim.urmanczy@compass.com",
  CC: []
};

var HEADSHOTS_FONT_STACK = "Outfit, Arial, Helvetica, sans-serif";

function sendHeadshotEmailsFromDirectory() {
  return _hsSendHeadshotEmails_({ dryRun: false, resendSent: false });
}

function dryRunHeadshotEmailsFromDirectory() {
  return _hsSendHeadshotEmails_({ dryRun: true, resendSent: false });
}

function resendAllHeadshotEmailsFromDirectory() {
  return _hsSendHeadshotEmails_({ dryRun: false, resendSent: true });
}

function createHeadshotEmailDraftsFromDirectory() {
  var data = _hsGetDirectoryData_();
  var created = [];
  data.rows.filter(_hsIsValidRecipient_).forEach(function(row) {
    GmailApp.createDraft(row.email, HEADSHOTS_MAILER.SUBJECT, _hsBuildHeadshotsPlainText_(row.name, row.headshots), {
      htmlBody: _hsBuildHeadshotsHtml_(row.name, row.headshots, row.photoUrl, data.signaturePhone),
      name: HEADSHOTS_MAILER.FROM_NAME
    });
    created.push({ rowNumber: row._rowNumber, name: row.name, email: row.email });
  });
  return { success: true, created: created.length, rows: created };
}

function previewHeadshotEmailHtml() {
  var data = _hsGetDirectoryData_();
  var row = _hsFirstValidHeadshotRow_(data.rows);
  if (!row) throw new Error("No row with Name + Email + Headshots found.");
  var html = _hsBuildHeadshotsHtml_(row.name, row.headshots, row.photoUrl, data.signaturePhone);
  Logger.log(html);
  return html;
}

function previewHeadshotEmailHtmlForRow(rowNumber) {
  var target = Number(rowNumber);
  if (!target || target < 2) {
    throw new Error("Pass a valid sheet row number (2+), e.g. previewHeadshotEmailHtmlForRow(12).");
  }
  var data = _hsGetDirectoryData_();
  var row = null;
  for (var i = 0; i < data.rows.length; i++) {
    if (data.rows[i]._rowNumber === target) {
      row = data.rows[i];
      break;
    }
  }
  if (!row) throw new Error("Row not found in directory data: " + target);
  if (!_hsIsValidRecipient_(row)) throw new Error("Row " + target + " is missing Name, Email, or Headshots.");
  var html = _hsBuildHeadshotsHtml_(row.name, row.headshots, row.photoUrl, data.signaturePhone);
  Logger.log(html);
  return html;
}

function sendHeadshotEmailTestToMe(testEmail) {
  var email = String(testEmail || HEADSHOTS_MAILER.TEST_EMAIL || "").trim();
  if (!email || email.indexOf("@") === -1) {
    throw new Error("Provide a valid test email address, e.g. sendHeadshotEmailTestToMe('you@example.com').");
  }
  var data = _hsGetDirectoryData_();
  var row = _hsFirstValidHeadshotRow_(data.rows);
  if (!row) throw new Error("No row with Name + Email + Headshots found.");
  GmailApp.sendEmail(email, "[TEST] " + HEADSHOTS_MAILER.SUBJECT, _hsBuildHeadshotsPlainText_(row.name, row.headshots), {
    htmlBody: _hsBuildHeadshotsHtml_(row.name, row.headshots, row.photoUrl, data.signaturePhone),
    name: HEADSHOTS_MAILER.FROM_NAME
  });
  return { success: true, sentTo: email, usingDirectoryRow: row._rowNumber, sourceRecipient: row.email };
}

function _hsSendHeadshotEmails_(options) {
  var dryRun = !!(options && options.dryRun);
  var resendSent = !!(options && options.resendSent);
  var data = _hsGetDirectoryData_();
  var recipients = data.rows.filter(function(row) {
    if (!_hsIsValidRecipient_(row)) return false;
    if (resendSent) return true;
    return !(_hsIsTruthy_(row.sentAt) || /sent/i.test(String(row.status || "")));
  });
  var sent = 0;
  var skipped = 0;
  var output = [];
  recipients.forEach(function(row) {
    var summary = {
      rowNumber: row._rowNumber,
      name: row.name,
      email: row.email,
      headshots: row.headshots,
      action: dryRun ? "would_send" : "sent"
    };
    if (dryRun) {
      output.push(summary);
      skipped++;
      return;
    }
    var emailOptions = {
      htmlBody: _hsBuildHeadshotsHtml_(row.name, row.headshots, row.photoUrl, data.signaturePhone),
      name: HEADSHOTS_MAILER.FROM_NAME
    };
    if (HEADSHOTS_MAILER.CC && HEADSHOTS_MAILER.CC.length) {
      emailOptions.cc = HEADSHOTS_MAILER.CC.join(",");
    }
    GmailApp.sendEmail(row.email, HEADSHOTS_MAILER.SUBJECT, _hsBuildHeadshotsPlainText_(row.name, row.headshots), emailOptions);
    _hsMarkHeadshotsEmailSent_(data.sheet, data.headerIndex, row._rowNumber);
    sent++;
    output.push(summary);
  });
  return { success: true, sheet: data.sheet.getName(), dryRun: dryRun, total: recipients.length, sent: sent, skipped: skipped, rows: output };
}

function _hsBuildHeadshotsPlainText_(name, headshotsLink) {
  return [
    "Hi " + _hsFirstName_(name) + ",",
    "",
    "Your Spring 2026 portraits are ready for download.",
    "Download your photos here: " + headshotsLink,
    "",
    "If you want any changes, please schedule an editing session with us here:",
    HEADSHOTS_MAILER.TOUCH_UP_SCHEDULING_URL,
    "",
    "Best,",
    HEADSHOTS_MAILER.SIGNATURE_NAME,
    HEADSHOTS_MAILER.SIGNATURE_TITLE,
    HEADSHOTS_MAILER.SIGNATURE_PHONE
  ].join("\n");
}

function _hsBuildHeadshotsHtml_(name, headshotsLink, photoUrl, signaturePhone) {
  var font = "font-family:" + HEADSHOTS_FONT_STACK + ";";
  var safeName = _hsEscapeHtml_(_hsFirstName_(name));
  var safeLink = _hsEscapeHtml_(headshotsLink);
  var safeProfileIconUrl = _hsEscapeHtml_(_hsResolveIconUrl_(photoUrl));
  var safeSignatureIconUrl = _hsEscapeHtml_(HEADSHOTS_MAILER.SIGNATURE_ICON_URL);
  var safeSchedulingUrl = _hsEscapeHtml_(HEADSHOTS_MAILER.TOUCH_UP_SCHEDULING_URL);
  var safeSignatureName = _hsEscapeHtml_(HEADSHOTS_MAILER.SIGNATURE_NAME);
  var safeSignatureTitle = _hsEscapeHtml_(HEADSHOTS_MAILER.SIGNATURE_TITLE);
  var safeSignaturePhone = _hsEscapeHtml_(signaturePhone || HEADSHOTS_MAILER.SIGNATURE_PHONE);
  var signaturePhoneHtml = safeSignaturePhone
    ? '<div style="' + font + 'font-size:13px;line-height:18px;color:#7b8392;">' + safeSignaturePhone + "</div>"
    : "";

  return (
    '<style>@import url("https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap"); body, table, td, p, a, div, h1 { font-family: Outfit, Arial, Helvetica, sans-serif !important; }</style>' +
    '<div style="margin:0;padding:24px;background:transparent;color-scheme:light dark;supported-color-schemes:light dark;' + font + 'color:#111111;">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="' + font + 'max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e7e8eb;border-radius:14px;overflow:hidden;">' +
        "<tr>" +
          '<td style="' + font + 'padding:28px 28px 24px;background:#151515;color:#ffffff;">' +
            '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="' + font + '"><tr>' +
              '<td style="' + font + 'vertical-align:top;color:#ffffff;">' +
                '<div style="' + font + 'font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#d7d7d7;">ASG Marketing</div>' +
                '<div style="' + font + 'margin-top:5px;font-size:13px;line-height:1.35;color:#aeb4bf;">Photos - Spring 2026</div>' +
              "</td>" +
              '<td align="right" style="' + font + 'vertical-align:top;width:44px;">' +
                '<img src="' + safeProfileIconUrl + '" alt="' + safeName + '" width="40" height="40" style="display:block;width:40px;height:40px;border-radius:50%;object-fit:cover;background:#ffffff;border:2px solid rgba(255,255,255,0.7);">' +
              "</td>" +
            "</tr></table>" +
            '<h1 style="' + font + 'margin:18px 0 0;font-size:30px;line-height:1.15;font-weight:800;color:#ffffff;">Spring 2026 Portraits</h1>' +
          "</td>" +
        "</tr>" +
        "<tr>" +
          '<td style="' + font + 'padding:28px;background:#ffffff;color:#111111;">' +
            '<p style="' + font + 'margin:0 0 14px;font-size:16px;line-height:1.55;color:#111111;">Hi ' + safeName + ",</p>" +
            '<p style="' + font + 'margin:0 0 22px;font-size:16px;line-height:1.6;color:#2d2d2d;">Your Spring 2026 portraits are ready for download. If you want any changes, please schedule an editing session with us by clicking Edit Photos.</p>' +
            '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="' + font + 'margin:0 0 22px;"><tr>' +
              '<td style="' + font + 'padding:0 10px 10px 0;">' +
                '<a href="' + safeLink + '" target="_blank" rel="noopener" style="' + font + 'display:inline-block;width:148px;text-align:center;background:#121212;color:#ffffff;text-decoration:none;font-size:15px;line-height:1.2;font-weight:700;padding:14px 0;border-radius:999px;">Download</a>' +
              "</td>" +
              '<td style="' + font + 'padding:0 0 10px 0;">' +
                '<a href="' + safeSchedulingUrl + '" target="_blank" rel="noopener" style="' + font + 'display:inline-block;width:148px;text-align:center;background:#2b64d8;color:#ffffff;text-decoration:none;font-size:15px;line-height:1.2;font-weight:700;padding:14px 0;border-radius:999px;">Edit Photos</a>' +
              "</td>" +
            "</tr></table>" +
            '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="' + font + 'margin-top:18px;"><tr>' +
              '<td style="' + font + 'vertical-align:top;padding-right:12px;">' +
                '<img src="' + safeSignatureIconUrl + '" alt="' + safeSignatureName + '" width="54" height="54" style="display:block;width:54px;height:54px;border-radius:50%;object-fit:cover;border:1px solid #e6e8ec;">' +
              "</td>" +
              '<td style="' + font + 'vertical-align:top;">' +
                '<div style="' + font + 'font-size:14px;line-height:18px;color:#111111;font-weight:700;">' + safeSignatureName + "</div>" +
                '<div style="' + font + 'font-size:13px;line-height:18px;color:#5a6270;">' + safeSignatureTitle + "</div>" +
                signaturePhoneHtml +
              "</td>" +
            "</tr></table>" +
          "</td>" +
        "</tr>" +
        "<tr>" +
          '<td style="' + font + 'padding:16px 28px;border-top:1px solid #eceef2;background:#ffffff;color:#666e7a;font-size:12px;line-height:1.5;">Sent by ASG Marketing Team</td>' +
        "</tr>" +
      "</table>" +
    "</div>"
  );
}

function _hsGetDirectoryData_() {
  var sheet = _hsFindSheet_(SpreadsheetApp.getActiveSpreadsheet(), HEADSHOTS_MAILER.SHEET_CANDIDATES);
  if (!sheet) {
    throw new Error("Could not find Directory sheet. Tried: " + HEADSHOTS_MAILER.SHEET_CANDIDATES.join(", "));
  }
  var table = _hsReadTable_(sheet);
  return { sheet: sheet, headers: table.headers, headerIndex: table.headerIndex, rows: table.rows, signaturePhone: _hsFindSignaturePhone_(table.rows) };
}

function _hsReadTable_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return { headers: [], rows: [], headerIndex: {} };
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(function(h) {
    return String(h || "").trim();
  });
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
  var idx = _hsBuildHeaderIndex_(headers);
  var rows = [];
  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    if (_hsIsBlankRow_(row)) continue;
    rows.push({
      _rowNumber: r + 2,
      name: _hsPickCell_(row, idx.name),
      email: _hsPickCell_(row, idx.email),
      headshots: _hsPickCell_(row, idx.headshots),
      photoUrl: _hsPickCell_(row, idx.photo),
      signaturePhone: _hsPickCell_(row, idx.signaturePhone),
      sentAt: _hsPickCell_(row, idx.sentAt),
      status: _hsPickCell_(row, idx.status)
    });
  }
  return { headers: headers, rows: rows, headerIndex: idx };
}

function _hsBuildHeaderIndex_(headers) {
  var normalized = headers.map(function(h) { return _hsNormalizeHeader_(h); });
  var idx = {
    name: _hsFindFirstIndex_(normalized, ["name", "display_name", "agent_name"]),
    email: _hsFindFirstIndex_(normalized, ["email", "agent_email"]),
    headshots: _hsFindFirstIndex_(normalized, HEADSHOTS_MAILER.HEADSHOTS_COLUMN_CANDIDATES.map(_hsNormalizeHeader_)),
    photo: _hsFindFirstIndex_(normalized, HEADSHOTS_MAILER.PHOTO_COLUMN_CANDIDATES.map(_hsNormalizeHeader_)),
    signaturePhone: _hsFindFirstIndex_(normalized, HEADSHOTS_MAILER.SIGNATURE_PHONE_COLUMN_CANDIDATES.map(_hsNormalizeHeader_)),
    sentAt: normalized.indexOf(_hsNormalizeHeader_(HEADSHOTS_MAILER.SENT_AT_COLUMN)),
    status: normalized.indexOf(_hsNormalizeHeader_(HEADSHOTS_MAILER.STATUS_COLUMN))
  };
  if (idx.name === -1 || idx.email === -1 || idx.headshots === -1) {
    throw new Error("Missing required columns. Need Name, Email, and Headshots. Found headers: " + headers.join(", "));
  }
  return idx;
}

function _hsMarkHeadshotsEmailSent_(sheet, headerIndex, rowNumber) {
  if (headerIndex.sentAt !== -1) sheet.getRange(rowNumber, headerIndex.sentAt + 1).setValue(new Date());
  if (headerIndex.status !== -1) sheet.getRange(rowNumber, headerIndex.status + 1).setValue("Sent");
}

function _hsFirstValidHeadshotRow_(rows) {
  for (var i = 0; i < rows.length; i++) {
    if (_hsIsValidRecipient_(rows[i])) return rows[i];
  }
  return null;
}

function _hsIsValidRecipient_(row) {
  return !!(row && row.name && row.email && row.headshots);
}

function _hsFindFirstIndex_(list, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var idx = list.indexOf(candidates[i]);
    if (idx !== -1) return idx;
  }
  return -1;
}

function _hsFindSheet_(ss, names) {
  for (var i = 0; i < names.length; i++) {
    var sheet = ss.getSheetByName(names[i]);
    if (sheet) return sheet;
  }
  return null;
}

function _hsPickCell_(row, idx) {
  if (idx < 0 || idx >= row.length) return "";
  return String(row[idx] || "").trim();
}

function _hsIsBlankRow_(row) {
  for (var i = 0; i < row.length; i++) {
    if (String(row[i] || "").trim() !== "") return false;
  }
  return true;
}

function _hsNormalizeHeader_(raw) {
  return String(raw || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function _hsIsTruthy_(value) {
  if (value === true || value === 1) return true;
  var s = String(value || "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1" || s === "sent";
}

function _hsEscapeHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function _hsResolveIconUrl_(raw) {
  var url = String(raw || "").trim();
  if (/^https?:\/\//i.test(url)) return url;
  return HEADSHOTS_MAILER.SIGNATURE_ICON_URL;
}

function _hsFindSignaturePhone_(rows) {
  var signatureName = _hsNormalizeHeader_(HEADSHOTS_MAILER.SIGNATURE_NAME);
  for (var i = 0; i < rows.length; i++) {
    if (_hsNormalizeHeader_(rows[i].name) === signatureName && rows[i].signaturePhone) {
      return rows[i].signaturePhone;
    }
  }
  return HEADSHOTS_MAILER.SIGNATURE_PHONE;
}

function _hsFirstName_(name) {
  var parts = String(name || "").trim().split(/\s+/);
  return parts[0] || "";
}
