/** Normalize an address the same way the SQL normalize_address() does. */
export function normalizeAddress(addr?: string | null): string {
  return (addr ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(input?: string | null): string {
  return (input ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function trim(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}

/** Parse loose currency/number strings ("$1,250,000", "1.25M") into a number. */
export function parseNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v == null) return null;
  let s = String(v).trim().replace(/[$,\s]/g, '');
  if (!s) return null;
  let mult = 1;
  if (/m$/i.test(s)) { mult = 1_000_000; s = s.replace(/m$/i, ''); }
  else if (/k$/i.test(s)) { mult = 1_000; s = s.replace(/k$/i, ''); }
  const n = Number(s);
  return Number.isFinite(n) ? n * mult : null;
}

/** Loose boolean parse for sheet cells: TRUE/yes/1/x/done → true. */
export function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (v == null) return false;
  return /^(true|yes|y|1|x|done|complete|completed)$/i.test(String(v).trim());
}

export function parseDate(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function parseDateTime(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Minimal RFC-4180-ish CSV parser (handles quotes, commas, newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/** Parse a CSV with a header row into an array of objects. */
export function csvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = (rows[0] ?? []).map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
    return obj;
  });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
