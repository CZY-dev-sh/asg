import { env, have } from '../env.js';
import { httpJson } from '../util/http.js';

export interface AcuityFormValue {
  fieldID?: number | string;
  value?: string;
  name?: string;
}
export interface AcuityForm {
  id?: number | string;
  values?: AcuityFormValue[];
}

export interface AcuityAppointment {
  id: number | string;
  firstName?: string;
  lastName?: string;
  type?: string;
  calendar?: string;
  calendarID?: number;
  datetime?: string;
  endTime?: string;
  notes?: string;
  forms?: AcuityForm[];
}

const BASE = 'https://acuityscheduling.com/api/v1';

function authHeader(): string {
  return 'Basic ' + Buffer.from(`${env.ACUITY_USER_ID}:${env.ACUITY_API_KEY}`).toString('base64');
}

/**
 * Pull the property address an agent typed into the booking. Reads the
 * configured intake field id first, then falls back to a field whose label
 * mentions "address", then the appointment notes.
 */
export function addressFromAppointment(appt: AcuityAppointment): string | null {
  const fieldId = env.ACUITY_PROPERTY_ADDRESS_FIELD_ID;
  for (const form of appt.forms ?? []) {
    for (const v of form.values ?? []) {
      if (fieldId && String(v.fieldID) === fieldId && v.value) return String(v.value).trim();
    }
  }
  for (const form of appt.forms ?? []) {
    for (const v of form.values ?? []) {
      if (/address|property/i.test(String(v.name ?? '')) && v.value) return String(v.value).trim();
    }
  }
  return appt.notes?.trim() ? appt.notes.trim() : null;
}

/** True when an appointment type looks like a media/photo shoot. */
export function isMediaAppointment(appt: AcuityAppointment): boolean {
  const keywords = env.ACUITY_MEDIA_KEYWORDS.length
    ? env.ACUITY_MEDIA_KEYWORDS
    : ['photo', 'media', 'matterport', 'video', 'shoot', 'floor plan', 'twilight'];
  const hay = `${appt.type ?? ''}`.toLowerCase();
  return keywords.some((k) => hay.includes(k.toLowerCase()));
}

/**
 * Build a prefilled Acuity scheduling URL so the console can launch a booking
 * for a listing with the property address baked into the intake field (keeps
 * the address consistent and lets the webhook/sync match it back).
 */
export function buildBookingUrl(input: { address?: string; agentName?: string }): string {
  const url = new URL(env.ACUITY_BOOKING_BASE_URL);
  if (env.ACUITY_PROPERTY_ADDRESS_FIELD_ID && input.address)
    url.searchParams.set(`field:${env.ACUITY_PROPERTY_ADDRESS_FIELD_ID}`, input.address);
  if (env.ACUITY_AGENT_NAME_FIELD_ID && input.agentName)
    url.searchParams.set(`field:${env.ACUITY_AGENT_NAME_FIELD_ID}`, input.agentName);
  if (env.ACUITY_SOURCE_FIELD_ID)
    url.searchParams.set(`field:${env.ACUITY_SOURCE_FIELD_ID}`, env.ACUITY_SOURCE_VALUE);
  return url.toString();
}

export async function fetchAppointments(opts: { minDate?: string; max?: number } = {}): Promise<
  AcuityAppointment[]
> {
  if (!have.acuity()) return [];
  const url = new URL(`${BASE}/appointments`);
  url.searchParams.set('max', String(opts.max ?? 200));
  url.searchParams.set('direction', 'DESC');
  if (opts.minDate) url.searchParams.set('minDate', opts.minDate);
  const appts = await httpJson<AcuityAppointment[]>(url.toString(), {
    headers: { Authorization: authHeader() },
  });
  const calendarFilter = env.ACUITY_CALENDAR_IDS;
  if (calendarFilter.length === 0) return appts;
  const allowed = new Set(calendarFilter.map(String));
  return appts.filter((a) => allowed.has(String(a.calendarID)));
}
