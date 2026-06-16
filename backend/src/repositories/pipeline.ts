import { sql } from '../db/client.js';

type Row = Record<string, unknown>;
const num = (v: unknown): number => (v == null ? 0 : Number(v));

export async function getPipelineStats(period = 'ytd2026') {
  const rows = await sql<Row[]>`
    select agent_name, grand_total, total_deals, closed_volume, closed_deals,
           pending_volume, pending_deals, buy_pct, total_zillow
    from agent_stats where period = ${period}
    order by grand_total desc
  `;
  const agents = rows.map((r) => ({
    name: String(r.agent_name),
    grandTotal: num(r.grand_total),
    totalDeals: num(r.total_deals),
    closedVolume: num(r.closed_volume),
    closedDeals: num(r.closed_deals),
    pendingVolume: num(r.pending_volume),
    pendingDeals: num(r.pending_deals),
    buyPct: num(r.buy_pct),
    totalZillow: num(r.total_zillow),
  }));
  const summary = agents.reduce(
    (acc, a) => {
      acc.grandTotal += a.grandTotal;
      acc.totalDeals += a.totalDeals;
      acc.closedVolume += a.closedVolume;
      acc.closedDeals += a.closedDeals;
      acc.pendingVolume += a.pendingVolume;
      acc.pendingDeals += a.pendingDeals;
      return acc;
    },
    { grandTotal: 0, totalDeals: 0, closedVolume: 0, closedDeals: 0, pendingVolume: 0, pendingDeals: 0 },
  );
  return {
    success: true,
    summary: { ...summary, totalVolume: summary.grandTotal, totalTransactions: summary.totalDeals },
    agents,
  };
}

export async function getPipelineRaw() {
  const closed = await sql<Row[]>`
    select agent_name, address, price, stage, close_date, photo_url
    from pipeline_deals order by close_date desc nulls last
  `;
  const ytdClosed = closed
    .filter((r) => /clos|sold/i.test(String(r.stage ?? '')))
    .map(rowToDeal);
  const ytdPending = closed
    .filter((r) => !/clos|sold/i.test(String(r.stage ?? '')))
    .map(rowToDeal);
  return { success: true, ytdClosed, ytdPending };
}

function rowToDeal(r: Row) {
  return {
    agent: r.agent_name,
    address: r.address,
    price: num(r.price),
    stage: r.stage,
    closeDate: r.close_date instanceof Date ? r.close_date.toISOString().slice(0, 10) : r.close_date,
    photoUrl: r.photo_url,
  };
}

export async function getPipelineDeals(kind?: 'buyer' | 'seller') {
  const rows = kind
    ? await sql<Row[]>`select * from pipeline_deals where kind = ${kind} order by close_date desc nulls last`
    : await sql<Row[]>`select * from pipeline_deals order by close_date desc nulls last`;
  return rows.map((r) => ({ kind: r.kind, ...rowToDeal(r) }));
}
