import { env, have } from '../env.js';
import { httpFetch } from '../util/http.js';
import { sleep } from '../util/text.js';

/**
 * Follow Up Boss REST client. Auth is HTTP Basic with the API key as the
 * username and an empty password. Public API tolerates ~10 req/sec, so callers
 * should throttle bulk per-record sub-calls (see syncFub).
 */
export class FubClient {
  private base: string;
  private authHeader: string;

  constructor(apiKey = env.FUB_API_KEY, base = env.FUB_API_BASE_URL) {
    if (!apiKey) throw new Error('FUB_API_KEY not configured');
    this.base = base.replace(/\/$/, '');
    this.authHeader = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64');
  }

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.base}${path}`;
    const res = await httpFetch(url, {
      ...init,
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-System': 'ASG-Backend',
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`FUB ${res.status} ${path}: ${body.slice(0, 400)}`);
    }
    if (res.status === 204) return {} as T;
    return (await res.json()) as T;
  }

  /** Paginate a collection endpoint (FUB uses limit/offset + _metadata). */
  async collect<T = Record<string, unknown>>(
    path: string,
    collectionKey: string,
    params: Record<string, string | number | undefined> = {},
    { limit = 100, max = 5000, throttleMs = 110 } = {},
  ): Promise<T[]> {
    const out: T[] = [];
    let offset = 0;
    while (out.length < max) {
      const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      for (const [k, v] of Object.entries(params)) if (v != null) qs.set(k, String(v));
      const data = await this.req<Record<string, unknown>>(`${path}?${qs.toString()}`);
      const batch = (data[collectionKey] as T[]) ?? [];
      out.push(...batch);
      const meta = data._metadata as { next?: string; total?: number } | undefined;
      if (batch.length < limit || !meta?.next) break;
      offset += limit;
      await sleep(throttleMs);
    }
    return out;
  }

  people(params: Record<string, string | number | undefined> = {}) {
    return this.collect('/people', 'people', { ...params, includeTrash: 'false' });
  }
  person(id: string | number) {
    return this.req<Record<string, unknown>>(`/people/${id}`);
  }
  deals(params: Record<string, string | number | undefined> = {}) {
    return this.collect('/deals', 'deals', params);
  }
  tasks(params: Record<string, string | number | undefined> = {}) {
    return this.collect('/tasks', 'tasks', params);
  }
  notes(params: Record<string, string | number | undefined> = {}) {
    return this.collect('/notes', 'notes', params);
  }
  appointments(params: Record<string, string | number | undefined> = {}) {
    return this.collect('/appointments', 'appointments', params);
  }
  users() {
    return this.collect('/users', 'users');
  }
  smartLists() {
    return this.collect('/smartLists', 'smartlists');
  }
  pipelines() {
    return this.collect('/pipelines', 'pipelines');
  }
  stages() {
    return this.collect('/stages', 'stages');
  }
  customFields() {
    return this.collect('/customFields', 'customfields');
  }

  /** Resolve a FUB user id by email (used for lead assignment). */
  async findUserByEmail(email: string): Promise<Record<string, unknown> | null> {
    const users = await this.users();
    const lower = email.toLowerCase();
    return (
      users.find((u) => String((u as { email?: string }).email ?? '').toLowerCase() === lower) ??
      null
    );
  }

  /**
   * Find an existing contact to avoid duplicates. Matches on email, then phone,
   * then exact full name (any one is enough). FUB's name filter is fuzzy, so we
   * verify candidates against the actual emails/phones/name before returning.
   */
  async findExistingPerson(input: {
    email?: string | null;
    phone?: string | null;
    name?: string | null;
  }): Promise<Record<string, unknown> | null> {
    const fields = 'id,name,firstName,lastName,emails,phones,tags,assignedUserId,stage';
    const search = async (
      params: Record<string, string>,
      ok: (p: Record<string, unknown>) => boolean,
    ): Promise<Record<string, unknown> | null> => {
      const people = await this.collect('/people', 'people', { ...params, fields }, { max: 50 });
      return people.find(ok) ?? null;
    };

    const email = input.email?.trim().toLowerCase() || '';
    if (email) {
      const m = await search({ email }, (p) =>
        ((p.emails as { value?: string }[]) ?? []).some(
          (e) => String(e.value ?? '').trim().toLowerCase() === email,
        ),
      );
      if (m) return m;
    }

    const digits = (input.phone ?? '').replace(/\D/g, '');
    if (digits.length >= 7) {
      const last10 = digits.slice(-10);
      const m = await search({ phone: input.phone as string }, (p) =>
        ((p.phones as { value?: string }[]) ?? []).some(
          (ph) => String(ph.value ?? '').replace(/\D/g, '').endsWith(last10),
        ),
      );
      if (m) return m;
    }

    const name = input.name?.trim().toLowerCase() || '';
    if (name) {
      const m = await search({ name: input.name as string }, (p) =>
        String(p.name ?? '').trim().toLowerCase() === name,
      );
      if (m) return m;
    }
    return null;
  }

  /** Create/update a lead via the events endpoint (fires action plans, dedupes). */
  createEvent(event: Record<string, unknown>) {
    return this.req<Record<string, unknown>>('/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }
  updatePerson(id: string | number, body: Record<string, unknown>) {
    return this.req<Record<string, unknown>>(`/people/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }
  createNote(body: Record<string, unknown>) {
    return this.req<Record<string, unknown>>('/notes', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
  deal(id: string | number) {
    return this.req<Record<string, unknown>>(`/deals/${id}`);
  }
  /** Create a deal. `stageId` is required and implies the pipeline. */
  createDeal(body: Record<string, unknown>) {
    return this.req<Record<string, unknown>>('/deals', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
  updateDeal(id: string | number, body: Record<string, unknown>) {
    return this.req<Record<string, unknown>>(`/deals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }
  deleteDeal(id: string | number) {
    return this.req<Record<string, unknown>>(`/deals/${id}`, { method: 'DELETE' });
  }
}

export function fubClient(): FubClient | null {
  return have.fub() ? new FubClient() : null;
}
