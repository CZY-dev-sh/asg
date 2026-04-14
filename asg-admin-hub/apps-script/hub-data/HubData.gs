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
