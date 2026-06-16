import { env, have } from '../env.js';
import { httpJson } from '../util/http.js';

export interface AcuityAppointment {
  id: number;
  firstName?: string;
  lastName?: string;
  type?: string;
  calendar?: string;
  calendarID?: number;
  datetime?: string;
  endTime?: string;
}

const BASE = 'https://acuityscheduling.com/api/v1';

function authHeader(): string {
  return 'Basic ' + Buffer.from(`${env.ACUITY_USER_ID}:${env.ACUITY_API_KEY}`).toString('base64');
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
