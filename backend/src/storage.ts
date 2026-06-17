import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, have } from './env.js';
import { log } from './logger.js';

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!have.supabaseStorage()) {
    throw new Error('Supabase Storage not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }
  if (!client) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export interface UploadResult {
  path: string;
  publicUrl: string;
  bytes: number;
  contentType: string;
}

/**
 * Upload bytes to a public bucket and return the CDN URL. Idempotent: re-uploads
 * with upsert so re-syncing a photo overwrites in place.
 */
export async function uploadObject(
  bucket: string,
  path: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<UploadResult> {
  const sb = supabase();
  const { error } = await sb.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: true,
    cacheControl: '31536000',
  });
  if (error) throw new Error(`storage upload failed for ${bucket}/${path}: ${error.message}`);
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl, bytes: body.byteLength, contentType };
}

/**
 * Create a one-time signed upload URL so the browser PUTs a file straight to
 * Storage (no bytes through the API). Caller stores the path and later
 * registers the photo row via publicUrlFor().
 */
export async function createSignedUpload(
  bucket: string,
  path: string,
): Promise<{ path: string; signedUrl: string; token: string }> {
  const sb = supabase();
  await ensureBucket(bucket, true);
  const { data, error } = await sb.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(`could not sign upload for ${bucket}/${path}: ${error?.message ?? 'unknown error'}`);
  }
  return { path, signedUrl: data.signedUrl, token: data.token };
}

/** Public CDN URL for an object already (or about to be) in a public bucket. */
export function publicUrlFor(bucket: string, path: string): string {
  const { data } = supabase().storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function ensureBucket(bucket: string, isPublic = true): Promise<void> {
  const sb = supabase();
  const { data } = await sb.storage.getBucket(bucket);
  if (data) return;
  const { error } = await sb.storage.createBucket(bucket, { public: isPublic });
  if (error && !/already exists/i.test(error.message)) {
    log.warn(`could not create bucket ${bucket}: ${error.message}`);
  }
}
