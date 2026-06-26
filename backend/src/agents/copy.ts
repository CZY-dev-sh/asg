import Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.js';
import { callClaude, estimateCostUsd, type RunBudget, type ClaudeUsage } from '../connectors/anthropic.js';
import type { BrandGuide } from '../data/brandGuide.js';
import type { VerifiedFacts, MarketingPackage } from './types.js';

const COPY_TOOL: Anthropic.Tool = {
  name: 'submit_marketing_package',
  description: 'Submit the complete, on-brand marketing package grounded only in the verified facts provided.',
  input_schema: {
    type: 'object',
    properties: {
      mlsDescription: { type: 'string', description: 'MLS listing description. Factual, one coherent narrative, no exclamation marks, no em dashes, no calls to action.' },
      socialCaptions: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3, description: 'Exactly 3 social captions, each leading with one idea and a specific hook.' },
      emailBlast: { type: 'string', description: 'One email blast: clear story, three to five defining facts, no all-caps urgency.' },
      factSheet: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          keyFacts: { type: 'array', items: { type: 'string' }, description: 'Bedrooms, bathrooms, square footage (qualified if unverified), price, property type.' },
          highlights: { type: 'array', items: { type: 'string' }, description: 'Up to 6 verified highlights.' },
          location: { type: 'string', description: 'Objective neighborhood/location summary using named destinations only.' },
        },
        required: ['headline', 'keyFacts', 'highlights', 'location'],
      },
      contentPillar: { type: 'string', description: 'One content pillar tag.' },
    },
    required: ['mlsDescription', 'socialCaptions', 'emailBlast', 'factSheet', 'contentPillar'],
  },
};

function buildSystem(brand: BrandGuide): string {
  // The brand guide is static across runs — it is sent as a cached system block.
  return [
    'You are the CopyAgent for the Alex Stoykov Group, a Chicago real estate team operating under Compass.',
    'Write marketing copy that follows the ASG brand voice and copy standards below.',
    '',
    '=== ASG BRAND VOICE AND COPY STANDARDS ===',
    brand.voice,
    '',
    '=== NON-NEGOTIABLE RULES ===',
    '- Ground every claim ONLY in the verified facts provided in the user message. Never invent a material, manufacturer, architect, award, view, renovation, amenity, dimension, or neighborhood fact.',
    '- If square footage is not verified, write "approximately" or omit it.',
    '- Do NOT use em dashes anywhere. Use a period, comma, or colon instead.',
    '- No exclamation marks in the MLS description. At most one in any social caption.',
    '- No all caps for emphasis. No repeated punctuation.',
    '- Use "primary suite", never "master suite".',
    '- Fair Housing: describe the property, not the occupant. Never state or imply a preference based on a protected class. Do not call an area "safe", "family-friendly", or "good for families", and do not describe who the home is "perfect for".',
    '- Select at most three primary selling ideas; let everything else support them.',
    `- contentPillar MUST be exactly one of: ${brand.contentPillars.join(', ')}.`,
    '- Present ASG as a team under its sponsoring broker (Compass), never as an independent brokerage.',
    'Call the submit_marketing_package tool exactly once.',
  ].join('\n');
}

function buildUserFacts(facts: VerifiedFacts): string {
  const lines: string[] = [];
  const add = (label: string, v: unknown) => {
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) return;
    lines.push(`${label}: ${Array.isArray(v) ? v.join('; ') : String(v)}`);
  };
  add('Address', facts.address);
  add('Neighborhood', facts.neighborhood);
  add('City/State/Zip', [facts.city, facts.state, facts.zip].filter(Boolean).join(', '));
  add('Property type', facts.propertyType);
  add('List price (USD)', facts.listPrice);
  add('Bedrooms', facts.beds);
  add('Bathrooms', facts.baths);
  add(facts.sqFtVerified ? 'Square feet (MLS-verified)' : 'Square feet (UNVERIFIED, qualify with "approximately")', facts.sqFt);
  add('MLS remarks (reference only, verify before reuse)', facts.mlsRemarks);
  add('Seller-stated highlights', facts.sellerHighlights);
  add('Improvements (seller-stated)', facts.improvements);
  add('Appliances and materials (seller-stated)', facts.appliancesAndMaterials);
  add('Outdoor spaces', facts.outdoorSpaces);
  add('Location notes (objective only)', facts.locationNotes);
  add('Primary selling ideas (use at most three)', facts.primarySellingIdeas);
  add('UNVERIFIED claims (do NOT state as fact; omit or qualify)', facts.unverifiedClaims);
  return `Verified facts for this listing. Use ONLY these:\n\n${lines.join('\n')}`;
}

export interface CopyOutput {
  pkg: MarketingPackage;
  model: string;
  usage: ClaudeUsage;
  estimatedCostUsd: number;
}

const asStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];

/**
 * Draft the marketing package grounded ONLY in verified facts + the ASG brand
 * guide. `extraInstructions` lets the ComplianceAgent (M3) feed back specific
 * fixes for a single re-run.
 */
export async function runCopy(input: {
  client: Anthropic;
  brand: BrandGuide;
  facts: VerifiedFacts;
  budget: RunBudget;
  extraInstructions?: string;
}): Promise<CopyOutput> {
  const { client, brand, facts, budget, extraInstructions } = input;
  const model = env.CLAUDE_MODEL;

  const userParts = [buildUserFacts(facts)];
  if (extraInstructions) {
    userParts.push(`\nThe previous draft failed review. Apply these specific fixes and resubmit:\n${extraInstructions}`);
  }

  const result = await callClaude({
    client,
    model,
    system: buildSystem(brand),
    temperature: 0.5,
    maxTokens: 2500,
    tools: [COPY_TOOL],
    toolChoice: { type: 'tool', name: COPY_TOOL.name },
    messages: [{ role: 'user', content: userParts.join('\n') }],
    budget,
  });

  const t = (result.toolInput ?? {}) as Record<string, unknown>;
  const fs = (t.factSheet ?? {}) as Record<string, unknown>;
  const pillar = String(t.contentPillar ?? '');
  const pkg: MarketingPackage = {
    mlsDescription: String(t.mlsDescription ?? ''),
    socialCaptions: asStrings(t.socialCaptions).slice(0, 3),
    emailBlast: String(t.emailBlast ?? ''),
    factSheet: {
      headline: String(fs.headline ?? ''),
      keyFacts: asStrings(fs.keyFacts),
      highlights: asStrings(fs.highlights),
      location: String(fs.location ?? ''),
    },
    contentPillar: brand.contentPillars.includes(pillar) ? pillar : (brand.contentPillars[0] ?? 'Lifestyle'),
  };

  return { pkg, model, usage: result.usage, estimatedCostUsd: estimateCostUsd(model, result.usage) };
}
