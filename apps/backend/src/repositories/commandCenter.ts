import { sql } from '../db/client.js';
import { getPipelineStats } from './pipeline.js';
import { getAdoption, getQaLog } from './telemetry.js';
import { getMarketingRollup } from './marketing.js';

type Row = Record<string, unknown>;
const iso = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString() : v == null ? null : String(v);

/**
 * Command Center aggregator. Because every source is already mirrored into
 * Supabase, this fans out to local tables/views instead of calling 6 external
 * APIs at request time — fast and resilient.
 */
export async function getCommandCenter(view = 'all', period = '30d') {
  const sources: Record<string, string> = {};
  const out: Record<string, unknown> = {};

  if (view === 'all' || view === 'executive') {
    out.executive = await buildExecutive();
    sources.pipelineStats = 'ok';
    sources.fub = (await sourceStatus('fub')) ?? 'down';
  }
  if (view === 'all' || view === 'adoption') {
    out.adoption = await getAdoption(period);
    sources.usageLog = 'ok';
  }
  if (view === 'all' || view === 'marketing') {
    out.marketing = await getMarketingRollup(period);
    sources.asana = (await sourceStatus('marketing')) ?? 'down';
    sources.acuity = sources.asana;
  }
  if (view === 'all' || view === 'system') {
    out.system = await buildSystem();
    sources.github = 'n/a';
  }

  return {
    ok: true,
    meta: { view, period, generatedAt: new Date().toISOString(), sources },
    ...out,
  };
}

async function sourceStatus(source: string): Promise<string | null> {
  const [run] = await sql<Row[]>`
    select status from sync_runs where source = ${source} order by started_at desc limit 1
  `;
  if (!run) return null;
  return run.status === 'ok' ? 'ok' : 'down';
}

async function buildExecutive() {
  const stats = await getPipelineStats('ytd2026');
  const [fub] = await sql<Row[]>`
    select
      count(*) filter (where status = 'open') as pending,
      count(*) filter (where status = 'won') as won
    from deals
  `;
  const [funnel] = await sql<Row[]>`
    select
      count(*) filter (where created_at_fub >= now() - interval '30 days') as new_leads
    from contacts
  `;
  const listingMix = await sql<Row[]>`select phase_key, count(*)::int n from listings group by phase_key`;
  const mixListings = { secured: 0, media: 0, live: 0, underContract: 0, closed: 0 };
  for (const r of listingMix) {
    const k = String(r.phase_key) as keyof typeof mixListings;
    if (k in mixListings) mixListings[k] = Number(r.n);
  }
  return {
    summary: {
      totalVolume: stats.summary.grandTotal,
      totalDeals: stats.summary.totalDeals,
      closedVolume: stats.summary.closedVolume,
      closedDeals: stats.summary.closedDeals,
      pendingVolume: stats.summary.pendingVolume,
      pendingDeals: stats.summary.pendingDeals,
    },
    agents: stats.agents.map((a) => ({
      name: a.name, grandTotal: a.grandTotal, totalDeals: a.totalDeals,
      pendingVolume: a.pendingVolume, pendingDeals: a.pendingDeals,
    })),
    alerts: [],
    fub: {
      newLeads: Number(funnel?.new_leads ?? 0),
      appointments: 0,
      signed: Number(fub?.won ?? 0),
      overdueTasks: 0,
      staleLeads: 0,
    },
    funnel: { newLeads: Number(funnel?.new_leads ?? 0), appointments: 0, buyerConsults: 0, sellerConsults: 0, signed: Number(fub?.won ?? 0), closed: Number(fub?.won ?? 0) },
    mix: { buy: 0, sell: 0, cash: 0, listings: mixListings },
  };
}

async function buildSystem() {
  const runs = await sql<Row[]>`
    select source, status, finished_at, records, error from sync_runs
    where started_at >= now() - interval '7 days' order by started_at desc limit 50
  `;
  const errors = runs.filter((r) => r.status === 'error').length;
  return {
    summary: { commits30: 0, openIssues: 0, appsScriptErrors: errors, staleDashboards: 0 },
    commits: [],
    qa: await getQaLog(),
    syncRuns: runs.map((r) => ({ source: r.source, status: r.status, finishedAt: iso(r.finished_at), records: Number(r.records ?? 0), error: r.error })),
    ownership: [],
  };
}
