import { sql } from '../db/client.js';
import { env, have } from '../env.js';
import { fetchCsv } from '../connectors/sheets.js';
import { parseDate, parseNumber, trim } from '../util/text.js';
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
 * refresh per-agent volume snapshots (agent_stats) from synced FUB deals.
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

/**
 * Snapshot per-agent volume from synced FUB deals into agent_stats for the
 * periods the Pipeline Stats API exposes. Replace with the "ASG Deals" workbook
 * import if you publish those tabs as CSV.
 */
export async function refreshAgentStats(): Promise<void> {
  for (const period of ['ytd2026', 'allTime']) {
    await sql`
      insert into agent_stats (agent_name, period, grand_total, total_deals, closed_volume,
                               closed_deals, pending_volume, pending_deals, buy_pct, synced_at)
      select
        v.agent_name, ${period}, v.grand_total, v.total_deals, v.closed_volume,
        v.closed_deals, v.pending_volume, v.pending_deals,
        coalesce(round(100.0 * b.buy_deals / nullif(v.total_deals, 0)), 0), now()
      from agent_volume v
      left join (
        select coalesce(agent_name,'Unassigned') agent_name,
               count(*) filter (where side = 'buy') buy_deals
        from deals group by coalesce(agent_name,'Unassigned')
      ) b on b.agent_name = v.agent_name
      where v.agent_name <> 'Unassigned'
      on conflict (agent_name, period) do update set
        grand_total = excluded.grand_total, total_deals = excluded.total_deals,
        closed_volume = excluded.closed_volume, closed_deals = excluded.closed_deals,
        pending_volume = excluded.pending_volume, pending_deals = excluded.pending_deals,
        buy_pct = excluded.buy_pct, synced_at = now()
    `;
  }
}

export const pipelineConfigured = () => have.pipeline();
