import { httpFetch } from '../util/http.js';
import { csvToObjects } from '../util/text.js';

/** Fetch a published Google Sheet CSV and parse it into header-keyed objects. */
export async function fetchCsv(url: string): Promise<Record<string, string>[]> {
  const res = await httpFetch(url, { headers: { Accept: 'text/csv' } });
  if (!res.ok) throw new Error(`CSV fetch failed (${res.status}) for ${url}`);
  const text = await res.text();
  return csvToObjects(text);
}
