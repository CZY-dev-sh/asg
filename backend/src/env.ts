import 'dotenv/config';
import { z } from 'zod';

const bool = (def = false) =>
  z
    .string()
    .optional()
    .transform((v) => (v == null ? def : /^(1|true|yes|on)$/i.test(v)));

const csv = () =>
  z
    .string()
    .optional()
    .transform((v) =>
      (v ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );

const schema = z.object({
  PORT: z.coerce.number().default(8787),
  NODE_ENV: z.string().default('development'),
  CORS_ORIGINS: csv(),
  WEBHOOK_SECRET: z.string().default(''),

  // Supabase
  SUPABASE_URL: z.string().optional().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),
  SUPABASE_ANON_KEY: z.string().optional().default(''),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  STORAGE_BUCKET_LISTINGS: z.string().default('listing-photos'),
  STORAGE_BUCKET_HEADSHOTS: z.string().default('headshots'),
  STORAGE_BUCKET_BRAND: z.string().default('brand-assets'),

  // Follow Up Boss
  FUB_API_KEY: z.string().optional().default(''),
  FUB_API_BASE_URL: z.string().default('https://api.followupboss.com/v1'),
  FUB_ADMIN_USER_IDS: csv(),
  FUB_DEAL_TRACKER_SMART_LIST_ID: z.string().default('172'),
  FUB_DEAL_TRACKER_SMART_LIST_NAME: z.string().default('Current Deals'),
  BUYER_INTAKE_SOURCE: z.string().default('ASG Website - Buyer Onboarding'),
  BUYER_INTAKE_SYSTEM: z.string().default('ASG Website'),
  BUYER_INTAKE_FALLBACK_EMAIL: z.string().optional().default(''),
  SELLER_INTAKE_SOURCE: z.string().default('ASG Website - Seller Onboarding'),
  SELLER_INTAKE_SYSTEM: z.string().default('ASG Website'),
  SELLER_INTAKE_FALLBACK_EMAIL: z.string().optional().default(''),

  // IDX Broker
  IDX_ACCESS_KEY: z.string().optional().default(''),
  IDX_API_VERSION: z.string().default('1.8'),
  IDX_API_BASE_URL: z.string().default('https://api.idxbroker.com'),

  // Google Drive
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional().default(''),
  GOOGLE_SERVICE_ACCOUNT_KEY_FILE: z.string().optional().default(''),
  DRIVE_LISTING_PHOTOS_ROOT: z.string().optional().default(''),
  DRIVE_AGENT_FOLDERS_ROOT: z.string().optional().default(''),
  DRIVE_BRAND_ASSETS_ROOT: z.string().optional().default(''),

  // Asana
  ASANA_TOKEN: z.string().optional().default(''),
  ASANA_WORKSPACE_GID: z.string().optional().default(''),
  ASANA_MARKETING_PROJECT_GID: z.string().optional().default(''),

  // Acuity
  ACUITY_USER_ID: z.string().optional().default(''),
  ACUITY_API_KEY: z.string().optional().default(''),
  ACUITY_CALENDAR_IDS: csv(),
  // Scheduling page + intake field ids used to prefill a booking from the console.
  ACUITY_BOOKING_BASE_URL: z.string().default('https://asgmarketing.as.me'),
  ACUITY_PROPERTY_ADDRESS_FIELD_ID: z.string().optional().default(''),
  ACUITY_AGENT_NAME_FIELD_ID: z.string().default('18245579'),
  ACUITY_SOURCE_FIELD_ID: z.string().default('18245580'),
  ACUITY_SOURCE_VALUE: z.string().default('Admin Hub'),
  // Appointment types that count as media/photo shoots (substring match, csv).
  ACUITY_MEDIA_KEYWORDS: csv(),

  // Pipeline CSVs
  PIPELINE_BUYERS_CSV: z.string().optional().default(''),
  PIPELINE_SELLERS_CSV: z.string().optional().default(''),

  // Scheduler
  ENABLE_SCHEDULER: bool(false),
  CRON_IDX: z.string().default('*/15 * * * *'),
  CRON_FUB: z.string().default('*/30 * * * *'),
  CRON_PIPELINE: z.string().default('*/30 * * * *'),
  CRON_PHOTOS: z.string().default('0 * * * *'),
  CRON_DIRECTORY: z.string().default('0 6 * * *'),
  CRON_MARKETING: z.string().default('*/30 * * * *'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

/** True when a source has the minimum credentials to run. */
export const have = {
  supabaseStorage: () => Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  auth: () => Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  authSignup: () => Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY),
  fub: () => Boolean(env.FUB_API_KEY),
  idx: () => Boolean(env.IDX_ACCESS_KEY),
  drive: () => Boolean(env.GOOGLE_SERVICE_ACCOUNT_JSON || env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE),
  asana: () => Boolean(env.ASANA_TOKEN && env.ASANA_WORKSPACE_GID),
  acuity: () => Boolean(env.ACUITY_USER_ID && env.ACUITY_API_KEY),
  pipeline: () => Boolean(env.PIPELINE_BUYERS_CSV || env.PIPELINE_SELLERS_CSV),
};
