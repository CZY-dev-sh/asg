import { google, type drive_v3 } from 'googleapis';
import { env, have } from '../env.js';
import { readFileSync } from 'node:fs';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: number;
  webViewLink?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

let driveClient: drive_v3.Drive | null = null;

function credentials(): Record<string, unknown> {
  if (env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }
  if (env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE) {
    return JSON.parse(readFileSync(env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE, 'utf8'));
  }
  throw new Error('Google service account not configured');
}

export function drive(): drive_v3.Drive {
  if (!have.drive()) throw new Error('Google Drive not configured');
  if (!driveClient) {
    const auth = new google.auth.GoogleAuth({
      credentials: credentials(),
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    driveClient = google.drive({ version: 'v3', auth });
  }
  return driveClient;
}

/** Extract a Drive folder/file id from a sharing URL or raw id. */
export function extractDriveId(input?: string | null): string | null {
  if (!input) return null;
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{20,}$/.test(s)) return s;
  const m =
    s.match(/\/folders\/([A-Za-z0-9_-]+)/) ||
    s.match(/[?&]id=([A-Za-z0-9_-]+)/) ||
    s.match(/\/d\/([A-Za-z0-9_-]+)/);
  return m ? m[1]! : null;
}

const PAGE_FIELDS = 'nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink)';

export async function listImages(folderId: string, max = 200): Promise<DriveFile[]> {
  const d = drive();
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const res = await d.files.list({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
      orderBy: 'name_natural',
      pageSize: 100,
      fields: PAGE_FIELDS,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files ?? []) {
      out.push({
        id: f.id!,
        name: f.name ?? '',
        mimeType: f.mimeType ?? 'image/jpeg',
        modifiedTime: f.modifiedTime ?? undefined,
        size: f.size ? Number(f.size) : undefined,
        webViewLink: f.webViewLink ?? undefined,
      });
      if (out.length >= max) return out;
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

export async function listRecentSubfolders(rootId: string, limit = 3): Promise<DriveFolder[]> {
  const d = drive();
  const res = await d.files.list({
    q: `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    orderBy: 'modifiedTime desc',
    pageSize: Math.max(limit, 10),
    fields: 'files(id, name, modifiedTime, webViewLink)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (res.data.files ?? []).slice(0, limit).map((f) => ({
    id: f.id!,
    name: f.name ?? '',
    modifiedTime: f.modifiedTime ?? undefined,
    webViewLink: f.webViewLink ?? `https://drive.google.com/drive/folders/${f.id}`,
  }));
}

export async function downloadFile(fileId: string): Promise<Buffer> {
  const d = drive();
  const res = await d.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  );
  return Buffer.from(res.data as ArrayBuffer);
}
