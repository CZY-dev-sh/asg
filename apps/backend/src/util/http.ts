import { log } from '../logger.js';

export interface FetchOpts extends RequestInit {
  /** number of retry attempts on 429/5xx/network errors */
  retries?: number;
  /** base backoff in ms (doubles each attempt) */
  backoffMs?: number;
  /** request timeout in ms */
  timeoutMs?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch with timeout + retry/backoff for flaky upstream APIs. */
export async function httpFetch(url: string, opts: FetchOpts = {}): Promise<Response> {
  const { retries = 3, backoffMs = 400, timeoutMs = 30_000, ...init } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(timer);
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        const wait = backoffMs * 2 ** attempt;
        log.warn(`http ${res.status} on ${url} — retry in ${wait}ms`);
        await sleep(wait);
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) {
        const wait = backoffMs * 2 ** attempt;
        log.warn(`http error on ${url} (${String(err)}) — retry in ${wait}ms`);
        await sleep(wait);
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`request failed: ${url}`);
}

export async function httpJson<T = unknown>(url: string, opts: FetchOpts = {}): Promise<T> {
  const res = await httpFetch(url, {
    ...opts,
    headers: { Accept: 'application/json', ...(opts.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}: ${body.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}
