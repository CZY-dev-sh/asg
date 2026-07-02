import { sql } from '../db/client.js';
import { env, have } from '../env.js';
import { fetchCsv } from '../connectors/sheets.js';
import { parseDate, parseNumber, trim } from '../util/text.js';
import { log } from '../logger.js';
import type { SyncResult } from './runner.js';

const col = (row: Record<string, string>, ...names: string[]): string => {
  for (const n of names) {
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().trim() === n.toLowerCase()) return trim(row[key]);
    }
  }
  return '';
};

/**
 * Ingest the published buyer/seller pipeline CSVs into pipeline_deals, then
 * refresh per-agent volume snapshots (agent_stats) from the ASG Deals 2026
 * workbook's stats endpoint.
 */
export async function syncPipeline(): Promise<SyncResult> {
  let count = 0;
  const sources: Array<{ kind: 'buyer' | 'seller'; url: string }> = [];
  if (env.PIPELINE_BUYERS_CSV) sources.push({ kind: 'buyer', url: env.PIPELINE_BUYERS_CSV });
  if (env.PIPELINE_SELLERS_CSV) sources.push({ kind: 'seller', url: env.PIPELINE_SELLERS_CSV });

  for (const src of sources) {
    const rows = await fetchCsv(src.url);
    await sql`delete from pipeline_deals where kind = ${src.kind}`;
    for (const row of rows) {
      const agent = col(row, 'Agent');
      const address = col(row, 'Address', 'Property');
      if (!agent && !address) continue;
      await sql`
        insert into pipeline_deals (kind, agent_name, address, price, stage, close_date, photo_url, raw)
        values (${src.kind}, ${agent || null}, ${address || null},
          ${parseNumber(col(row, 'Price'))}, ${col(row, 'Stage') || null},
          ${parseDate(col(row, 'Close Date', 'CloseDate'))},
          ${col(row, 'Photo URL', 'PhotoURL', 'Photo') || null}, ${sql.json(row)})
      `;
      count++;
    }
  }

  await refreshAgentStats();
  return { source: 'pipeline', records: count, meta: { csvSources: sources.length } };
}

type SheetAgent = {
  name?: string;
  grandTotal?: number;
  totalDeals?: number;
  closedVolume?: number;
  closedDeals?: number;
  pendingVolume?: number;
  pendingDeals?: number;
  buyPct?: number;
  totalZillow?: number;
};

/**
 * Snapshot per-agent volume into agent_stats from the "ASG Deals 2026" workbook
 * (via its Apps Script stats endpoint) — the sheet the transaction coordinators
 * maintain is the source of truth for deals/volume on every hub, NOT FUB.
 * If the sheet endpoint is unreachable the existing snapshot is left in place.
 */
export async function refreshAgentStats(): Promise<void> {
  if (!env.DEALS_STATS_API) return;
  for (const period of ['ytd2026', 'allTime']) {
    let agents: SheetAgent[];
    try {
      const res = await fetch(`${env.DEALS_STATS_API}?period=${encodeURIComponent(period)}`);
      const data = (await res.json()) as { success?: boolean; agents?: SheetAgent[] };
      if (!data?.success || !Array.isArray(data.agents)) throw new Error('bad stats payload');
      agents = data.agents.filter((a) => a.name);
    } catch (err) {
      log.warn(`agent_stats refresh skipped for ${period}: ${String(err)}`);
      continue;
    }
    await sql.begin(async (tx) => {
      await tx`delete from agent_stats where period = ${period}`;
      for (const a of agents) {
        await tx`
          insert into agent_stats (agent_name, period, grand_total, total_deals, closed_volume,
                                   closed_deals, pending_volume, pending_deals, buy_pct, total_zillow, synced_at)
          values (${String(a.name)}, ${period}, ${a.grandTotal ?? 0}, ${a.totalDeals ?? 0},
                  ${a.closedVolume ?? 0}, ${a.closedDeals ?? 0}, ${a.pendingVolume ?? 0},
                  ${a.pendingDeals ?? 0}, ${a.buyPct ?? 0}, ${a.totalZillow ?? 0}, now())
        `;
      }
    });
  }
}

export const pipelineConfigured = () => have.pipeline();
