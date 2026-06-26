import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../db/client.js';
import { env } from '../env.js';
import { callClaude, estimateCostUsd, type RunBudget, type ClaudeUsage } from '../connectors/anthropic.js';
import type { VerifiedFacts } from './types.js';

/** The columns from listings_enriched the agent is allowed to ground on. */
interface ListingFactRow {
  address: string | null;
  neighborhood: string | null;
  listing_type: string | null;
  list_price: string | null;
  beds: string | null;
  baths: string | null;
  sq_ft: number | null;
  mls_property_type: string | null;
  mls_remarks: string | null;
  mls_city: string | null;
  mls_state: string | null;
  mls_zip: string | null;
  idx_matched: boolean | null;
  seller_questionnaire_content: string | null;
}

export async function loadListingFactRow(listingId: string): Promise<ListingFactRow | null> {
  const [row] = await sql<ListingFactRow[]>`
    select
      address, neighborhood, listing_type, list_price, beds, baths, sq_ft,
      mls_property_type, mls_remarks, mls_city, mls_state, mls_zip, idx_matched,
      seller_questionnaire_content
    from listings_enriched
    where id = ${listingId}::uuid
    limit 1
  `;
  return row ?? null;
}

const num = (v: string | number | null): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Tool schema forces structured, grounded output. The model only fills the
// "soft" fields extracted from the questionnaire; the hard MLS facts are taken
// verbatim from the database, not the model.
const RESEARCH_TOOL: Anthropic.Tool = {
  name: 'record_verified_facts',
  description:
    'Record ONLY facts explicitly present in the seller questionnaire. Never infer, embellish, or invent. Omit anything not stated.',
  input_schema: {
    type: 'object',
    properties: {
      sellerHighlights: { type: 'array', items: { type: 'string' }, description: 'Distinctive features the seller explicitly stated.' },
      improvements: { type: 'array', items: { type: 'string' }, description: 'Renovations/updates the seller stated, with year if given. Do not call anything "new" unless the seller said so.' },
      appliancesAndMaterials: { type: 'array', items: { type: 'string' }, description: 'Appliance brands or materials the seller explicitly named.' },
      outdoorSpaces: { type: 'array', items: { type: 'string' }, description: 'Outdoor spaces the seller described (terrace, yard, balcony, etc.).' },
      locationNotes: { type: 'array', items: { type: 'string' }, description: 'Objective, seller-stated location facts (named streets, parks, transit). No demographic or safety claims.' },
      primarySellingIdeas: { type: 'array', items: { type: 'string' }, maxItems: 3, description: 'At most three strongest, verified selling ideas for this property.' },
      unverifiedClaims: { type: 'array', items: { type: 'string' }, description: 'Anything the seller claimed that a human must verify before publication (e.g. square footage, architect, awards, school boundaries).' },
    },
    required: ['sellerHighlights', 'improvements', 'appliancesAndMaterials', 'outdoorSpaces', 'locationNotes', 'primarySellingIdeas', 'unverifiedClaims'],
  },
};

const SYSTEM = `You are the ResearchAgent for a Chicago real estate team. You assemble VERIFIED facts for a listing from a seller questionnaire.

Hard rules:
- Use ONLY information explicitly present in the questionnaire text provided.
- Never invent or infer a material, manufacturer, architect, award, view, renovation, amenity, dimension, or neighborhood fact.
- If a detail is not stated, omit it. Do not guess.
- Do not include any statement about the demographics, safety, or "ideal" occupants of an area.
- Put anything that sounds impressive but is unconfirmed (square footage, architect, awards, school ratings) into unverifiedClaims for human review.
Call the record_verified_facts tool exactly once.`;

const asStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];

export interface ResearchOutput {
  facts: VerifiedFacts;
  model: string;
  usage: ClaudeUsage;
  estimatedCostUsd: number;
}

/**
 * Assemble VERIFIED facts: hard MLS/workflow facts come straight from the DB;
 * the seller questionnaire is parsed by Haiku (cheap, deterministic) into
 * grounded highlights. Never invents features.
 */
export async function runResearch(input: {
  client: Anthropic;
  row: ListingFactRow;
  budget: RunBudget;
}): Promise<ResearchOutput> {
  const { client, row, budget } = input;
  const model = env.CLAUDE_HAIKU_MODEL;

  const questionnaire = (row.seller_questionnaire_content ?? '').trim();
  const userText = questionnaire
    ? `Seller questionnaire for ${row.address ?? 'this property'}:\n\n${questionnaire}`
    : `No seller questionnaire text is available for ${row.address ?? 'this property'}. Return empty arrays.`;

  const result = await callClaude({
    client,
    model,
    system: SYSTEM,
    temperature: 0.1,
    maxTokens: 1500,
    tools: [RESEARCH_TOOL],
    toolChoice: { type: 'tool', name: RESEARCH_TOOL.name },
    messages: [{ role: 'user', content: userText }],
    budget,
  });

  const t = (result.toolInput ?? {}) as Record<string, unknown>;
  const facts: VerifiedFacts = {
    address: row.address,
    neighborhood: row.neighborhood,
    city: row.mls_city,
    state: row.mls_state,
    zip: row.mls_zip,
    propertyType: row.mls_property_type ?? row.listing_type,
    listPrice: num(row.list_price),
    beds: num(row.beds),
    baths: num(row.baths),
    sqFt: row.sq_ft,
    // Square footage is only "verified" when it came from the MLS match.
    sqFtVerified: Boolean(row.idx_matched && row.sq_ft),
    mlsRemarks: row.mls_remarks,
    sellerHighlights: asStrings(t.sellerHighlights),
    improvements: asStrings(t.improvements),
    appliancesAndMaterials: asStrings(t.appliancesAndMaterials),
    outdoorSpaces: asStrings(t.outdoorSpaces),
    locationNotes: asStrings(t.locationNotes),
    primarySellingIdeas: asStrings(t.primarySellingIdeas).slice(0, 3),
    unverifiedClaims: asStrings(t.unverifiedClaims),
  };

  return { facts, model, usage: result.usage, estimatedCostUsd: estimateCostUsd(model, result.usage) };
}
