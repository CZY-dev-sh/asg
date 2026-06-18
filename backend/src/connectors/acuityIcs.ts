import { env } from '../env.js';
import { httpFetch } from '../util/http.js';
import { log } from '../logger.js';
import type { AcuityAppointment } from './acuity.js';

/**
 * No-API Acuity ingestion. Acuity's REST API is gated behind the Powerhouse
 * plan, but every plan exposes a read-only iCal/ICS calendar feed. This module
 * fetches those feed(s) and maps each event to the same AcuityAppointment shape
 * the API path produces, so the rest of the marketing sync (listing matching,
 * timeline logging, photo status) is reused unchanged.
 */

interface VProp {
  value: string;
  params: Record<string, string>;
}
type VEvent = Record<string, VProp>;

/** Join RFC-5545 folded lines (continuations begin with a space or tab). */
function unfold(ics: string): string[] {
  const raw = ics.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function unescapeText(v: string): string {
  return v
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/** Offset (ms) of a time zone at a given instant, via Intl (no dependency). */
function tzOffsetMs(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const hour = (p.hour ?? '0') === '24' ? '0' : (p.hour ?? '0');
  const asUTC = Date.UTC(
    +(p.year ?? '0'),
    +(p.month ?? '1') - 1,
    +(p.day ?? '1'),
    +hour,
    +(p.minute ?? '0'),
    +(p.second ?? '0'),
  );
  return asUTC - date.getTime();
}

/** Convert a wall-clock time in a zone to the correct UTC instant (DST-safe). */
function wallToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, timeZone: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  let real = guess - tzOffsetMs(timeZone, new Date(guess));
  real = guess - tzOffsetMs(timeZone, new Date(real));
  return new Date(real);
}

/** Parse an ICS date/datetime into an ISO string. Handles Z, TZID, and date-only. */
function parseIcsDate(prop: VProp, defaultTz: string): string | null {
  const value = prop.value.trim();
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const y = +m[1]!;
  const mo = +m[2]!;
  const d = +m[3]!;
  const h = m[4] != null ? +m[4] : 0;
  const mi = m[5] != null ? +m[5] : 0;
  const s = m[6] != null ? +m[6] : 0;
  if (m[7]) return new Date(Date.UTC(y, mo - 1, d, h, mi, s)).toISOString();
  const tz = prop.params.TZID || defaultTz;
  return wallToUtc(y, mo, d, h, mi, s, tz).toISOString();
}

function parseEvents(ics: string): VEvent[] {
  const lines = unfold(ics);
  const events: VEvent[] = [];
  let cur: VEvent | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur) events.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const left = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const [name, ...paramParts] = left.split(';');
    if (!name) continue;
    const params: Record<string, string> = {};
    for (const pp of paramParts) {
      const eq = pp.indexOf('=');
      if (eq > -1) params[pp.slice(0, eq).toUpperCase()] = pp.slice(eq + 1);
    }
    cur[name.toUpperCase()] = { value, params };
  }
  return events;
}

/** Pull a property address out of the event's description, else LOCATION. */
function extractAddress(description: string, location: string): string | null {
  for (const line of description.split('\n').map((l) => l.trim())) {
    // Acuity intake answers hold the canonical address, e.g.
    // "What is the full address?: 55 W Delaware #1120" / "Where is the shoot?: ...".
    const m = line.match(
      /(?:what is the (?:full )?address|where is the shoot|property\s*address)\s*\??\s*[:\-]\s*(.+)$/i,
    );
    const a = m?.[1]?.trim();
    if (a) return a;
  }
  // Otherwise use the event's LOCATION (the property address for shoots).
  return location.trim() || null;
}

/**
 * Acuity ICS SUMMARY is "{Client}: {Appointment Type} ({Photographer})".
 * Split it so the listing workshop shows a clean type and the right person.
 */
function parseSummary(summary: string): { client: string; type: string; person: string } {
  const withPerson = summary.match(/^(.*?):\s*(.*?)\s*\(([^)]*)\)\s*$/);
  if (withPerson) {
    return { client: withPerson[1]!.trim(), type: withPerson[2]!.trim(), person: withPerson[3]!.trim() };
  }
  const noPerson = summary.match(/^(.*?):\s*(.+)$/);
  if (noPerson) return { client: noPerson[1]!.trim(), type: noPerson[2]!.trim(), person: '' };
  return { client: '', type: summary.trim(), person: '' };
}

function calendarName(ics: string): string {
  const m = ics.match(/^X-WR-CALNAME:(.+)$/m);
  return m && m[1] ? unescapeText(m[1].trim()) : 'Acuity';
}

function toAppointment(ev: VEvent, calendarLabel: string, defaultTz: string): AcuityAppointment | null {
  const uid = ev.UID?.value?.trim();
  const start = ev.DTSTART ? parseIcsDate(ev.DTSTART, defaultTz) : null;
  if (!uid || !start) return null;
  const end = ev.DTEND ? parseIcsDate(ev.DTEND, defaultTz) : null;
  const summary = unescapeText(ev.SUMMARY?.value ?? '').trim();
  const description = unescapeText(ev.DESCRIPTION?.value ?? '');
  const location = unescapeText(ev.LOCATION?.value ?? '').trim();
  const address = extractAddress(description, location);
  const { client, type, person } = parseSummary(summary);
  return {
    id: `ics-${uid}`,
    firstName: client,
    lastName: '',
    type: type || summary,
    calendar: person || calendarLabel,
    datetime: start,
    endTime: end ?? undefined,
    notes: description || undefined,
    forms: address ? [{ values: [{ name: 'Property Address', value: address }] }] : [],
  };
}

/** Fetch and parse all configured Acuity ICS feeds into appointment records. */
export async function fetchIcsAppointments(): Promise<AcuityAppointment[]> {
  const urls = env.ACUITY_ICS_URLS;
  if (!urls.length) return [];
  const tz = env.ACUITY_TIMEZONE || 'America/Chicago';
  const out: AcuityAppointment[] = [];
  for (const raw of urls) {
    const url = raw.replace(/^webcal:\/\//i, 'https://');
    try {
      const res = await httpFetch(url, { timeoutMs: 20_000 });
      if (!res.ok) {
        log.warn(`acuity ICS ${res.status} for ${url}`);
        continue;
      }
      const text = await res.text();
      const label = calendarName(text);
      for (const ev of parseEvents(text)) {
        const appt = toAppointment(ev, label, tz);
        if (appt) out.push(appt);
      }
    } catch (err) {
      log.warn(`acuity ICS fetch failed for ${url}: ${String(err)}`);
    }
  }
  return out;
}
