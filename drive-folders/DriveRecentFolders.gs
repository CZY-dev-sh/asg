/**
 * Recent listing-photo folders (Google Drive) — Web App GET API
 * Repo: apps-script/drive-folders/DriveRecentFolders.gs
 * Frontend: components/marketing-assets.html, components/admin-dashboard.html
 *
 * Requires Advanced Google Services: enable "Drive API" (Resources → Libraries
 * is legacy; in modern editor: Services → add Drive API).
 */

const LISTINGS_FOLDER_ID = '1FY64_Fe-jVDUIb6hWzwPFdo6fotm7Ztn';

function doGet() {
  try {
    const folders = getRecentFolders_(LISTINGS_FOLDER_ID, 3);

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        folders: folders
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.message || String(error)
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getRecentFolders_(parentFolderId, limit) {
  const q = [
    "'" + parentFolderId + "' in parents",
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false"
  ].join(" and ");

  const response = Drive.Files.list({
    q: q,
    orderBy: 'modifiedDate desc',
    maxResults: limit
  });

  const files = response.items || [];

  return files.map(function(file) {
    return {
      id: file.id,
      name: file.title,
      url: file.alternateLink || ("https://drive.google.com/drive/folders/" + file.id),
      modifiedTime: file.modifiedDate
    };
  });
}
