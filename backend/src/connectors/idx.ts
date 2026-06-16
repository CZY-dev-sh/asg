import { env, have } from '../env.js';
import { httpFetch } from '../util/http.js';
import { parseNumber, trim } from '../util/text.js';

export interface IdxPhoto {
  url: string;
  caption: string;
  order: number;
}

export interface NormalizedIdxListing {
  idxListingId: string;
  feed: string;
  mlsNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  areaMajor: string | null;
  neighborhood: string | null;
  status: string | null;
  propertyType: string | null;
  listPrice: number | null;
  beds: number | null;
  baths: number | null;
  sqFt: number | null;
  yearBuilt: number | null;
  latitude: number | null;
  longitude: number | null;
  remarks: string | null;
  coverImageUrl: string | null;
  photoCount: number;
  detailsUrl: string | null;
  fullDetailsUrl: string | null;
  photos: IdxPhoto[];
  raw: Record<string, unknown>;
}

/** IDX Broker / Elm Street client (MLS feed mirror). */
export class IdxClient {
  private base: string;
  constructor(
    private accessKey = env.IDX_ACCESS_KEY,
    private version = env.IDX_API_VERSION,
    base = env.IDX_API_BASE_URL,
  ) {
    if (!accessKey) throw new Error('IDX_ACCESS_KEY not configured');
    this.base = base.replace(/\/$/, '');
  }

  private async req<T>(path: string): Promise<T> {
    const res = await httpFetch(`${this.base}${path}`, {
      headers: {
        accesskey: this.accessKey,
        outputtype: 'json',
        apiversion: this.version,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`IDX ${res.status} ${path}: ${body.slice(0, 400)}`);
    }
    const json = (await res.json()) as T;
    return json;
  }

  /** featured | soldpending | supplemental — each returns a keyed object. */
  async feed(name: 'featured' | 'soldpending' | 'supplemental'): Promise<Record<string, unknown>> {
    const data = await this.req<unknown>(`/clients/${name}`);
    if (Array.isArray(data)) {
      // some accounts return an array; key it by listingID
      const obj: Record<string, unknown> = {};
      for (const item of data as Record<string, unknown>[]) {
        const id = String(item.listingID ?? item.idxID ?? item.listingId ?? '');
        if (id) obj[id] = item;
      }
      return obj;
    }
    return (data as Record<string, unknown>) ?? {};
  }

  async allListings(): Promise<NormalizedIdxListing[]> {
    const feeds: Array<'featured' | 'soldpending' | 'supplemental'> = [
      'featured',
      'soldpending',
      'supplemental',
    ];
    const byId = new Map<string, NormalizedIdxListing>();
    for (const feed of feeds) {
      let raw: Record<string, unknown> = {};
      try {
        raw = await this.feed(feed);
      } catch {
        continue; // a feed may be empty/unauthorized; keep going
      }
      for (const [key, value] of Object.entries(raw)) {
        if (!value || typeof value !== 'object') continue;
        const norm = normalizeIdxListing(key, value as Record<string, unknown>, feed);
        if (norm) byId.set(norm.idxListingId, norm);
      }
    }
    return [...byId.values()];
  }
}

export function buildPhotoGallery(image: unknown): IdxPhoto[] {
  if (!image || typeof image !== 'object') return [];
  const out: IdxPhoto[] = [];
  for (const [k, v] of Object.entries(image as Record<string, unknown>)) {
    if (k === 'totalCount') continue;
    const entry = v as { url?: string; caption?: string; description?: string };
    if (!entry || !entry.url) continue;
    out.push({
      url: trim(entry.url),
      caption: trim(entry.caption ?? entry.description ?? ''),
      order: Number(k) || 0,
    });
  }
  out.sort((a, b) => a.order - b.order);
  return out;
}

export function normalizeIdxListing(
  key: string,
  L: Record<string, unknown>,
  feed: string,
): NormalizedIdxListing | null {
  const id = String(L.listingID ?? L.idxID ?? key ?? '').trim();
  if (!id) return null;
  const g = (k: string): unknown => L[k];
  const photos = buildPhotoGallery(L.image);
  const cover =
    (L.image as { firstUrl?: string } | undefined)?.firstUrl ?? photos[0]?.url ?? null;
  const street = trim(g('address') ?? g('streetName') ?? '');
  const cityState = [trim(g('cityName')), trim(g('state')), trim(g('zipcode'))]
    .filter(Boolean)
    .join(', ');
  const address = [street, cityState].filter(Boolean).join(', ') || null;
  return {
    idxListingId: id,
    feed,
    mlsNumber: trim(g('listingID') ?? g('mlsNumber') ?? '') || null,
    address,
    city: trim(g('cityName')) || null,
    state: trim(g('state')) || null,
    zip: trim(g('zipcode')) || null,
    areaMajor: trim(g('parentPtype') ?? g('areaMajor') ?? '') || null,
    neighborhood: trim(g('subdivision') ?? g('neighborhood') ?? '') || null,
    status: trim(g('propStatus') ?? g('status') ?? '') || null,
    propertyType: trim(g('idxPropType') ?? g('propType') ?? '') || null,
    listPrice: parseNumber(g('listingPrice') ?? g('price') ?? g('currentPrice')),
    beds: parseNumber(g('bedrooms') ?? g('totalBedrooms')),
    baths: parseNumber(g('totalBaths') ?? g('bathrooms')),
    sqFt: parseNumber(g('sqFt') ?? g('totalSqFt')) ?? null,
    yearBuilt: parseNumber(g('yearBuilt')) ?? null,
    latitude: parseNumber(g('latitude')),
    longitude: parseNumber(g('longitude')),
    remarks: trim(g('remarksConcat') ?? g('remarks') ?? '') || null,
    coverImageUrl: cover ? trim(cover) : null,
    photoCount:
      Number((L.image as { totalCount?: number } | undefined)?.totalCount) || photos.length,
    detailsUrl: trim(g('fullDetailsURL') ?? g('detailsURL') ?? '') || null,
    fullDetailsUrl: trim(g('fullDetailsURL') ?? '') || null,
    photos,
    raw: L,
  };
}

export function idxClient(): IdxClient | null {
  return have.idx() ? new IdxClient() : null;
}
