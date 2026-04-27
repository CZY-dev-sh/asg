/**
 * Team Directory -> Headshots Mailer
 * ------------------------------------------------------------
 * Sends individualized emails using each row's Headshots folder link.
 *
 * Expected columns in Team Directory sheet:
 * - Name (or Display Name)
 * - Email
 * - Headshots
 *
 * Optional tracking columns (if present they will be updated):
 * - Headshots Email Sent At
 * - Headshots Email Status
 */

const HEADSHOTS_MAILER = {
  SHEET_CANDIDATES: ["Team Directory", "Directory", "team_directory"],
  HEADSHOTS_COLUMN_CANDIDATES: ["Headshots", "Headshot Folder", "Headshots Link"],
  SENT_AT_COLUMN: "Headshots Email Sent At",
  STATUS_COLUMN: "Headshots Email Status",
  ICON_PHOTO_URL: "https://images.squarespace-cdn.com/content/v1/645525ddf33bc2091db5603a/b6436626-20ad-4f17-90cd-fbd7195fd9f1/unnamed.png?format=1000w",
  TOUCH_UP_SCHEDULING_URL: "https://example.com/touch-up-scheduling-link",
  SIGNATURE_NAME: "Tim Urmanczy",
  SIGNATURE_TITLE: "Creative Director",
  FROM_NAME: "ASG Marketing Team",
  SUBJECT: "Your Spring 2026 Portraits Are Ready!",
  // Add any always-CC recipients if needed.
  CC: []
};

/**
 * Main run: sends to rows that have Name + Email + Headshots
 * and are not already marked as sent.
 */
function sendHeadshotEmailsFromDirectory() {
  return _sendHeadshotEmails_({ dryRun: false, resendSent: false });
}

/**
 * Preview run: no emails sent, returns who would receive.
 */
function dryRunHeadshotEmailsFromDirectory() {
  return _sendHeadshotEmails_({ dryRun: true, resendSent: false });
}

/**
 * Force resend to all valid rows, including previously sent.
 */
function resendAllHeadshotEmailsFromDirectory() {
  return _sendHeadshotEmails_({ dryRun: false, resendSent: true });
}

/**
 * Useful while designing template in Apps Script editor.
 * Run and inspect Logs for HTML.
 */
function previewHeadshotEmailHtml() {
  const sheet = _findSheet_(SpreadsheetApp.getActiveSpreadsheet(), HEADSHOTS_MAILER.SHEET_CANDIDATES);
  if (!sheet) throw new Error("Team Directory sheet not found.");
  const table = _readTable_(sheet);
  const row = _firstValidHeadshotRow_(table.rows);
  if (!row) throw new Error("No row with Name + Email + Headshots found.");
  const html = _buildHeadshotsHtml_(row.name, row.headshots);
  Logger.log(html);
  return html;
}

function _sendHeadshotEmails_(options) {
  const dryRun = !!(options && options.dryRun);
  const resendSent = !!(options && options.resendSent);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = _findSheet_(ss, HEADSHOTS_MAILER.SHEET_CANDIDATES);
  if (!sheet) {
    throw new Error(
      "Could not find Team Directory sheet. Tried: " + HEADSHOTS_MAILER.SHEET_CANDIDATES.join(", ")
    );
  }

  const table = _readTable_(sheet);
  if (!table.headers.length || !table.rows.length) {
    return { success: true, sheet: sheet.getName(), dryRun: dryRun, total: 0, sent: 0, skipped: 0, rows: [] };
  }

  const recipients = table.rows.filter(function(row) {
    if (!row.email || !row.headshots || !row.name) return false;
    if (resendSent) return true;
    const alreadySent = _isTruthy_(row.sentAt) || /sent/i.test(String(row.status || ""));
    return !alreadySent;
  });

  let sent = 0;
  let skipped = 0;
  const output = [];

  recipients.forEach(function(row) {
    const subject = HEADSHOTS_MAILER.SUBJECT;
    const plainText = _buildHeadshotsPlainText_(row.name, row.headshots);
    const htmlBody = _buildHeadshotsHtml_(row.name, row.headshots);

    const summary = {
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

    GmailApp.sendEmail(row.email, subject, plainText, {
      htmlBody: htmlBody,
      name: HEADSHOTS_MAILER.FROM_NAME,
      cc: HEADSHOTS_MAILER.CC.join(",")
    });

    _markHeadshotsEmailSent_(sheet, table.headerIndex, row._rowNumber);
    sent++;
    output.push(summary);
  });

  return {
    success: true,
    sheet: sheet.getName(),
    dryRun: dryRun,
    total: recipients.length,
    sent: sent,
    skipped: skipped,
    rows: output
  };
}

function _buildHeadshotsPlainText_(name, headshotsLink) {
  return [
    "Hi " + name + ",",
    "",
    "Your Spring 2026 portraits are ready.",
    "Open your folder here: " + headshotsLink,
    "",
    "These are preliminary edits. If you want additional edits, schedule a touch-up meeting with us:",
    HEADSHOTS_MAILER.TOUCH_UP_SCHEDULING_URL,
    "",
    "Best,",
    HEADSHOTS_MAILER.SIGNATURE_NAME,
    HEADSHOTS_MAILER.SIGNATURE_TITLE
  ].join("\n");
}

function _buildHeadshotsHtml_(name, headshotsLink) {
  const safeName = _escapeHtml_(name);
  const safeLink = _escapeHtml_(headshotsLink);
  const safeIconUrl = _escapeHtml_(HEADSHOTS_MAILER.ICON_PHOTO_URL);
  const safeSchedulingUrl = _escapeHtml_(HEADSHOTS_MAILER.TOUCH_UP_SCHEDULING_URL);
  const safeSignatureName = _escapeHtml_(HEADSHOTS_MAILER.SIGNATURE_NAME);
  const safeSignatureTitle = _escapeHtml_(HEADSHOTS_MAILER.SIGNATURE_TITLE);

  return (
    '<div style="margin:0;padding:24px;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#121212;">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e7e8eb;border-radius:14px;overflow:hidden;">' +
        "<tr>" +
          '<td style="padding:28px 28px 22px;background:linear-gradient(120deg,#111111 0%,#2a2a2a 100%);color:#ffffff;">' +
            '<div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.82;">ASG Marketing</div>' +
            '<div style="margin:14px 0 0;display:flex;align-items:center;gap:10px;">' +
              '<img src="' + safeIconUrl + '" alt="ASG Icon" width="28" height="28" style="display:block;width:28px;height:28px;border-radius:6px;object-fit:cover;background:#ffffff;">' +
              '<h1 style="margin:0;font-size:28px;line-height:1.2;font-weight:750;">Your Spring 2026 Portraits Are Ready!</h1>' +
            "</div>" +
          "</td>" +
        "</tr>" +
        "<tr>" +
          '<td style="padding:28px;">' +
            '<p style="margin:0 0 14px;font-size:16px;line-height:1.55;">Hi ' + safeName + ",</p>" +
            '<p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#2d2d2d;">' +
              "Use the button below to access and download your photos." +
            "</p>" +
            '<div style="margin:0 0 22px;">' +
              '<a href="' + safeLink + '" target="_blank" rel="noopener" style="display:inline-block;background:#121212;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 20px;border-radius:999px;">Download Portraits</a>' +
            "</div>" +
            '<div style="background:#f7f8fa;border:1px solid #eceef2;border-radius:10px;padding:12px 14px;margin:0 0 18px;">' +
              '<div style="font-size:12px;font-weight:700;letter-spacing:.02em;color:#515965;margin:0 0 6px;">DIRECT LINK</div>' +
              '<a href="' + safeLink + '" target="_blank" rel="noopener" style="word-break:break-all;color:#2b64d8;text-decoration:none;font-size:13px;line-height:1.45;">' + safeLink + "</a>" +
            "</div>" +
            '<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#3d444f;">These are the preliminary edits. If you would like additional edits, please schedule a touch-up meeting with us.</p>' +
            '<p style="margin:0 0 14px;font-size:14px;line-height:1.55;">' +
              '<a href="' + safeSchedulingUrl + '" target="_blank" rel="noopener" style="color:#2b64d8;text-decoration:none;font-weight:600;">Schedule a touch-up meeting</a>' +
            "</p>" +
            '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;">' +
              "<tr>" +
                '<td style="vertical-align:top;padding-right:10px;">' +
                  '<img src="' + safeIconUrl + '" alt="' + safeSignatureName + '" width="36" height="36" style="display:block;width:36px;height:36px;border-radius:8px;object-fit:cover;border:1px solid #e6e8ec;">' +
                "</td>" +
                '<td style="vertical-align:top;">' +
                  '<div style="font-size:14px;line-height:1.35;color:#111111;font-weight:700;">' + safeSignatureName + "</div>" +
                  '<div style="font-size:13px;line-height:1.35;color:#5a6270;">' + safeSignatureTitle + "</div>" +
                  '<div style="font-size:12px;line-height:1.35;color:#7b8392;">ASG Marketing Team</div>' +
                "</td>" +
              "</tr>" +
            "</table>" +
          "</td>" +
        "</tr>" +
        "<tr>" +
          '<td style="padding:16px 28px;border-top:1px solid #eceef2;background:#fbfbfc;color:#666e7a;font-size:12px;line-height:1.5;">' +
            "Sent by ASG Marketing Team via Team Directory" +
          "</td>" +
        "</tr>" +
      "</table>" +
    "</div>"
  );
}

function _markHeadshotsEmailSent_(sheet, headerIndex, rowNumber) {
  const now = new Date();
  if (headerIndex.sentAt !== -1) {
    sheet.getRange(rowNumber, headerIndex.sentAt + 1).setValue(now);
  }
  if (headerIndex.status !== -1) {
    sheet.getRange(rowNumber, headerIndex.status + 1).setValue("Sent");
  }
}

function _firstValidHeadshotRow_(rows) {
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].name && rows[i].email && rows[i].headshots) return rows[i];
  }
  return null;
}

function _readTable_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    return { headers: [], rows: [], headerIndex: {} };
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(function(h) {
    return String(h || "").trim();
  });
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();

  const idx = _buildHeaderIndex_(headers);
  const rows = [];

  for (var r = 0; r < values.length; r++) {
    const row = values[r];
    if (_isBlankRow_(row)) continue;

    rows.push({
      _rowNumber: r + 2,
      name: _pickCell_(row, idx.name),
      email: _pickCell_(row, idx.email),
      headshots: _pickCell_(row, idx.headshots),
      sentAt: _pickCell_(row, idx.sentAt),
      status: _pickCell_(row, idx.status)
    });
  }

  return { headers: headers, rows: rows, headerIndex: idx };
}

function _buildHeaderIndex_(headers) {
  const normalized = headers.map(function(h) { return _normalizeHeader_(h); });
  const sentAtKey = _normalizeHeader_(HEADSHOTS_MAILER.SENT_AT_COLUMN);
  const statusKey = _normalizeHeader_(HEADSHOTS_MAILER.STATUS_COLUMN);

  const idx = {
    name: _findFirstIndex_(normalized, ["name", "display_name", "agent_name"]),
    email: _findFirstIndex_(normalized, ["email", "agent_email"]),
    headshots: _findFirstIndex_(
      normalized,
      HEADSHOTS_MAILER.HEADSHOTS_COLUMN_CANDIDATES.map(_normalizeHeader_)
    ),
    sentAt: normalized.indexOf(sentAtKey),
    status: normalized.indexOf(statusKey)
  };

  if (idx.name === -1 || idx.email === -1 || idx.headshots === -1) {
    throw new Error(
      "Missing required columns. Need Name, Email, and Headshots. Found headers: " + headers.join(", ")
    );
  }
  return idx;
}

function _findFirstIndex_(list, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    const idx = list.indexOf(candidates[i]);
    if (idx !== -1) return idx;
  }
  return -1;
}

function _findSheet_(ss, names) {
  for (var i = 0; i < names.length; i++) {
    const sheet = ss.getSheetByName(names[i]);
    if (sheet) return sheet;
  }
  return null;
}

function _pickCell_(row, idx) {
  if (idx < 0 || idx >= row.length) return "";
  return String(row[idx] || "").trim();
}

function _isBlankRow_(row) {
  for (var i = 0; i < row.length; i++) {
    if (String(row[i] || "").trim() !== "") return false;
  }
  return true;
}

function _normalizeHeader_(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function _isTruthy_(value) {
  if (value === true || value === 1) return true;
  const s = String(value || "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1" || s === "sent";
}

function _escapeHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
