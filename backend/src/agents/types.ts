import type { ClaudeUsage } from '../connectors/anthropic.js';

/**
 * VERIFIED facts the agent is allowed to ground copy on. Hard fields come
 * straight from listings_enriched (MLS + workflow); the "seller*" arrays are
 * extracted from the seller questionnaire and must never include anything the
 * seller did not actually state. unverifiedClaims surfaces anything that needs
 * a human to confirm before publication.
 */
export interface VerifiedFacts {
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  propertyType: string | null;
  listPrice: number | null;
  beds: number | null;
  baths: number | null;
  sqFt: number | null;
  sqFtVerified: boolean;
  mlsRemarks: string | null;
  sellerHighlights: string[];
  improvements: string[];
  appliancesAndMaterials: string[];
  outdoorSpaces: string[];
  locationNotes: string[];
  primarySellingIdeas: string[];
  unverifiedClaims: string[];
}

/** The reviewable marketing package the CopyAgent produces. Drafts only. */
export interface MarketingPackage {
  mlsDescription: string;
  socialCaptions: string[];
  emailBlast: string;
  factSheet: {
    headline: string;
    keyFacts: string[];
    highlights: string[];
    location: string;
  };
  contentPillar: string;
}

export interface OrchestratorResult {
  facts: VerifiedFacts;
  pkg: MarketingPackage;
  models: { research: string; copy: string };
  totalTokens: number;
  estimatedCostUsd: number;
  usageByStep: { step: string; model: string; usage: ClaudeUsage }[];
}
