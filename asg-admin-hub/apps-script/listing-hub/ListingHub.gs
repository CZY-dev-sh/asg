const SHEET_NAME = 'Listings';
const ACTIVE_VIEW_STATUSES = new Set(['active', 'comingsoon', 'undercontract']);
const CLOSED_VIEW_STATUSES = new Set(['closed']);

// AGENT EMAIL MAPPING
const AGENT_EMAILS = {
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
  'Matthew Clevenger': 'matthew.clevenger@compass.com',
  'Justin Curran': 'justin.curran@compass.com',
  'Cheryl Cohn': 'cheryl.cohn@compass.com',
  'Jason Stone': 'jason.stone@compass.com',
  'Andrea Mirchef': 'andrea.mirchef@compass.com',
  'Breanna Raspopovich': 'breanna.raspopovich@compass.com',
  'Andrea Koedjikova': 'andrea.koedjikova@compass.com',
  'Danica Thomas': 'danica.thomas@compass.com',
  'Alisa Bok': 'alisa.bok@compass.com',
  'Josie Ontiveros': 'josie.ontiveros@compass.com',
  'Nasir Rizvi': 'nasir.rizvi@compass.com',
  'Preety Sidhu': 'preety.sidhu@compass.com',
  'Chloe Dittmer': 'chloe.dittmer@compass.com',
  'Natali Tzvetkova': 'natali.tzvetkova@compass.com',
  'Myriam El-Khoury': 'myriam.elkhoury@compass.com',
  'Serge Golota': 'serge.golota@compass.com',
  'Cameron Sine': 'cameron.sine@compass.com',
  'Kelsey Glascott': 'kelsey.glasscott@compass.com',
  'Deannine Weber Ronan': 'deannine.weberronan@compass.com'
};

const CC_EMAILS = [
  'ellie.ngassa@compass.com',
  'seph.gagon@compass.com',
  'tim.urmanczy@compass.com',
  'ellyn.andree@compass.com'
];

function doGet(e) {
  const view = (e.parameter.view || 'active').toLowerCase();
  const listings = getListings_();

  let filtered = [];

  if (view === 'archive' || view === 'closed') {
    filtered = listings.filter(item =>
      CLOSED_VIEW_STATUSES.has(normalizeStatusKey_(item.status))
    );
  } else {
    filtered = listings.filter(item =>
      ACTIVE_VIEW_STATUSES.has(normalizeStatusKey_(item.status))
    );
  }

  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      view,
      count: filtered.length,
      listings: filtered
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === 'sendListingEmail') {
      const result = sendListingEmail_(data);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function sendListingEmail_(data) {
  const { address, agent, listingType, photos, matterport, floorPlan, factSheet, openHouse, video, neighborhood, sentBy } = data;
  
  const agentEmail = AGENT_EMAILS[agent];
  
  if (!agentEmail) {
    throw new Error(`No email found for agent: ${agent}`);
  }
  
  const subject = `${listingType} Listing Assets Ready: ${address}`;
  
  let assetLinks = '';
  if (photos) assetLinks += `📸 <b>Photos:</b> <a href="${photos}">${photos}</a><br>`;
  if (matterport) assetLinks += `🏠 <b>Matterport:</b> <a href="${matterport}">${matterport}</a><br>`;
  if (floorPlan) assetLinks += `📐 <b>Floor Plan:</b> <a href="${floorPlan}">${floorPlan}</a><br>`;
  if (factSheet) assetLinks += `📄 <b>Fact Sheet:</b> <a href="${factSheet}">${factSheet}</a><br>`;
  if (openHouse) assetLinks += `🏡 <b>Open House:</b> <a href="${openHouse}">${openHouse}</a><br>`;
  if (video) assetLinks += `🎥 <b>Video:</b> <a href="${video}">${video}</a><br>`;
  
  if (!assetLinks) {
    assetLinks = '<i>No assets available yet.</i>';
  }
  
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0; padding: 0;">
      <div style="background: #111111; color: #ffffff; padding: 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 24px; font-weight: 700;">Marketing Assets Ready</h2>
      </div>
      
      <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 24px 0; font-size: 16px; color: #111111;">
          Hi ${agent || 'there'},
        </p>
        
        <p style="margin: 0 0 24px 0; font-size: 16px; color: #111111;">
          All marketing assets for <strong>${address}</strong> ${neighborhood ? `in ${neighborhood}` : ''} are now complete and ready for use.
        </p>
        
        <div style="background: #f7f7f7; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #111111;">Listing Type:</p>
          <p style="margin: 0 0 20px 0; font-size: 16px; color: #111111;">${listingType}</p>
          
          <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #111111;">Available Assets:</p>
          <div style="font-size: 14px; line-height: 1.8; color: #111111;">
            ${assetLinks}
          </div>
        </div>
        
        <p style="margin: 0 0 8px 0; font-size: 16px; color: #111111;">
          Please review the assets and let us know if you need any adjustments.
        </p>
        
        <p style="margin: 0; font-size: 16px; color: #111111;">
          Best regards,<br>
          <strong>ASG Marketing Team</strong>
        </p>
      </div>
      
      <div style="text-align: center; padding: 16px; color: #999999; font-size: 12px;">
        This email was sent by ${sentBy || 'ASG Marketing'} via the Listing Hub
      </div>
    </div>
  `;
  
  try {
    // Send the email
    GmailApp.sendEmail(
      agentEmail,
      subject,
      '', // Plain text version
      {
        htmlBody: htmlBody,
        cc: CC_EMAILS.join(','),
        name: 'ASG Marketing Team'
      }
    );
    
    // Mark as sent in the sheet
    markEmailAsSent_(address);
    
    return {
      success: true,
      message: `Email sent successfully to ${agent} (${agentEmail})`
    };
    
  } catch (error) {
    throw new Error(`Failed to send email: ${error.toString()}`);
  }
}

function markEmailAsSent_(address) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) return;
  
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  
  const addressCol = headers.indexOf('Address');
  const emailSentCol = headers.indexOf('Email Sent');
  
  if (addressCol === -1 || emailSentCol === -1) return;
  
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][addressCol]).trim() === address.trim()) {
      sheet.getRange(i + 1, emailSentCol + 1).setValue(true);
      break;
    }
  }
}

function getListings_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error(`Sheet "${SHEET_NAME}" not found.`);
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(h => String(h).trim());
  const rows = values.slice(1);

  return rows
    .filter(row => row.some(cell => String(cell).trim() !== ''))
    .map(row => {
      const record = {};
      headers.forEach((header, i) => {
        record[header] = row[i];
      });

      return {
        address: String(record['Address'] || '').trim(),
        neighborhood: String(record['Neighborhood'] || '').trim(),
        agent: String(record['Agent'] || '').trim(),
        listingType: String(record['Listing Type'] || '').trim(),
        status: String(record['Status'] || '').trim(),
        coverImage: String(record['Cover Image'] || '').trim(),
        photos: String(record['Photos'] || '').trim(),
        matterport: String(record['Matterport'] || '').trim(),
        floorPlan: String(record['Floor Plan'] || '').trim(),
        factSheet: String(record['Fact Sheet'] || '').trim(),
        openHouse: String(record['Open House'] || '').trim(),
        video: String(record['Video'] || '').trim(),
        archived: normalizeStatusKey_(record['Status']) === 'closed' || normalizeCheckbox_(record['Archived']),
        emailSent: normalizeCheckbox_(record['Email Sent'])
      };
    });
}

function normalizeCheckbox_(value) {
  if (value === true) return true;
  if (value === false) return false;

  const str = String(value || '').trim().toLowerCase();
  return str === 'true' || str === 'yes' || str === '1';
}

function normalizeStatusKey_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Sync Google Drive listing-photo folders -> Listings sheet
 * Maps:
 *   Folder name => Address
 *   Folder URL  => Photos
 *   First image => Cover Image
 */
function syncDrivePhotosToListings() {
  const PARENT_FOLDER_ID = '1FY64_Fe-jVDUIb6hWzwPFdo6fotm7Ztn'; // your Listing Photos folder
  const SHEET_NAME = 'Listings';
  const DEFAULT_STATUS = 'Active';
  const DEFAULT_LISTING_TYPE = 'Sale';

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found.`);

  const values = sheet.getDataRange().getValues();
  if (!values.length) throw new Error('Sheet is empty.');

  const headers = values[0].map(h => String(h).trim());
  const col = indexMap_(headers, [
    'Address', 'Status', 'Cover Image', 'Photos',
    'Archived', 'Listing Type', 'Email Sent'
  ]);

  // Build row lookup by normalized address
  const rowByAddress = {};
  for (let r = 1; r < values.length; r++) {
    const addr = normalizeAddress_(values[r][col['Address']]);
    if (addr) rowByAddress[addr] = r + 1; // 1-based row
  }

  const parent = DriveApp.getFolderById(PARENT_FOLDER_ID);
  const folders = parent.getFolders();

  let created = 0, updated = 0, skipped = 0;

  while (folders.hasNext()) {
    const folder = folders.next();
    const rawName = String(folder.getName() || '').trim();
    if (!rawName) { skipped++; continue; }

    // Optional guard: skip obvious non-address folders
    if (!looksLikeAddress_(rawName)) { skipped++; continue; }

    const address = rawName;
    const key = normalizeAddress_(address);
    const photosUrl = folder.getUrl();
    const coverImage = getFirstImageUrl_(folder); // may be blank

    if (rowByAddress[key]) {
      // Update existing listing row (only overwrite photo fields)
      const row = rowByAddress[key];
      sheet.getRange(row, col['Photos'] + 1).setValue(photosUrl);
      if (coverImage) sheet.getRange(row, col['Cover Image'] + 1).setValue(coverImage);
      updated++;
    } else {
      // Append new listing row with defaults
      const newRow = new Array(headers.length).fill('');
      newRow[col['Address']] = address;
      newRow[col['Photos']] = photosUrl;
      newRow[col['Cover Image']] = coverImage || '';
      newRow[col['Status']] = DEFAULT_STATUS;
      newRow[col['Listing Type']] = DEFAULT_LISTING_TYPE;
      newRow[col['Archived']] = false;
      newRow[col['Email Sent']] = false;

      sheet.appendRow(newRow);
      rowByAddress[key] = sheet.getLastRow();
      created++;
    }
  }

  Logger.log(`Sync complete. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
}

/** Returns first image file URL (Drive image rendering URL) */
function getFirstImageUrl_(folder) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    const mime = String(f.getMimeType() || '');
    if (mime.indexOf('image/') === 0) {
      return `https://drive.google.com/uc?export=view&id=${f.getId()}`;
    }
  }
  return '';
}

function indexMap_(headers, required) {
  const out = {};
  required.forEach(name => {
    const i = headers.indexOf(name);
    if (i === -1) throw new Error(`Missing required column: "${name}"`);
    out[name] = i;
  });
  return out;
}

function normalizeAddress_(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '') // remove punctuation
    .trim();
}

function looksLikeAddress_(name) {
  // Basic heuristic: starts with number + has street-ish text
  return /^\d+\s+/.test(name);
}
