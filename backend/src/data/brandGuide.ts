// Canonical Alex Stoykov Group brand voice + real estate copy standards (v1.0).
// This is the SEED source for the brand_guidelines table (key 'asg'). At runtime
// the agent reads the DB row so the guide is editable without a deploy; this
// module is the fallback when no active row exists, and the content to seed.
//
// Do not fabricate brand rules here — everything below is ASG's own guide.

export interface BrandGuide {
  key: string;
  voice: string; // full guide, used as a cached system block for the agents
  doRules: string[];
  dontRules: string[];
  preferredVocabulary: string[];
  useSparingly: string[];
  strongVerbs: string[];
  // Style/marketing phrases ASG avoids (RELA + brand restraint).
  bannedPhrases: string[];
  // Higher-risk Fair Housing phrases — the rule-based pre-screen in the
  // ComplianceAgent. Matched case-insensitively as substrings.
  fairHousingBannedPhrases: string[];
  contentPillars: string[];
}

// The full guide, kept verbatim so the agents ground on ASG's exact standards.
export const ASG_BRAND_GUIDE_MARKDOWN = `# Alex Stoykov Group — Brand Voice and Real Estate Copy Standards (v1.0)

## Brand essence
Core idea: Chicago real estate, represented with precision. The brand should feel established, informed, composed, and capable.
Promise: We present each property accurately, position it intelligently, and communicate its value clearly.
Internal standard: Confidence comes from knowledge. Luxury comes from specificity. Trust comes from accuracy.

## The ASG voice
Informed, refined, specific, composed, aspirational, and Chicago-literate. Polished but direct, aspirational but factual, sophisticated without becoming excessive.

## Voice pillars
1. Authority through detail: demonstrate expertise through verified information, not declarations. Every major claim is supported by at least one concrete detail.
2. Refined restraint: communicate luxury through architecture, materials, scale, provenance, privacy, service, and experience — not repeated adjectives. No paragraph relies on multiple superlatives. Use at most one strong superlative in an opening paragraph.
3. Spatial storytelling: guide the reader through the home in a logical sequence using architectural relationships, not step-by-step narration ("walking into", "heading into", "from here", "ascending to", "the surprise is").
4. Property truth before marketing language: identify what is genuinely distinctive and build around that. Select no more than three primary selling ideas per property.
5. Feature, meaning, experience: state what exists, why it matters, and how it improves daily life — grounded in real features.
6. Local intelligence: location writing is precise and useful (named streets, corridors, parks, lakefront, CTA/Metra stations, institutions, verified school boundaries, verified walking distances). Avoid generic claims like "close to everything" or "near all that Chicago has to offer".

## Writing principles
Lead with the property's identity: opening establishes property type, location, and the most important differentiator. Preferred formula: "A [property type] in [location] distinguished by [primary differentiator]."
Establish a clear hierarchy: lead with the strongest information; do not bury the defining feature.
Controlled sentence length: alternate short, medium, and longer sentences. Target ~18–25 words per sentence. Avoid sentences with more than four separate features.
Active construction over passive.
Limit repetition of: features, offers, boasts, luxury, exceptional, spacious, throughout, perfect, ideal, located.
Use "primary suite", never "master suite".

## Listing description framework
1. Positioning lead. 2. Overall experience. 3. Main living spaces (flow, not inventory). 4. Kitchen (verified appliances/materials). 5. Primary suite. 6. Supporting spaces. 7. Exterior and building experience. 8. Improvements and infrastructure (distinguish new/replaced/renovated/restored/updated/original; include years when available; never call something "new" without confirmation). 9. Location (objective proximity and utility; verified school boundaries; no subjective demographic/safety claims).

## Channel adaptation
MLS description: complete but efficient, primarily factual, one coherent narrative, minimal promotional language, no unnecessary calls to action, verify every specification, no exclamation marks.
Social media: lead with one idea, short direct sentences, specific hooks rather than hype, do not paste the full MLS description, at most one exclamation mark.
Email marketing: clear subject, one property story, three to five defining facts, a direct link to complete information, no all-caps urgency.

## Editorial rules
Numbers: numerals for dimensions, counts, sizes, years, distances; "approximately" when not independently verified; "square feet" not "sqft"; formatting like "2,500 square feet", "3 bedrooms", "3.5 bathrooms".
Brand names: confirm spelling/styling (Sub-Zero, Gaggenau, Thermador, Carrara marble, Hardie siding, Lutron, Kallista, Duravit, Ann Sacks, Ipe). Do not include brands unless verified.
Punctuation: avoid exclamation marks in MLS; do not use repeated punctuation; do not use em dashes; use semicolons sparingly; break long feature lists into separate sentences; never all caps for emphasis.

## Compliance (RELA-aligned)
All advertising must be accurate, direct, and readily understandable. Do not publish unsupported claims, incorrect square footage, unverified renovation scope, incorrect school boundaries, misstated assessments/taxes, incorrect parking, unconfirmed appliance brands, unverified architectural attribution, or outdated availability.
AI may assist with drafting, but a human listing agent and reviewer remain responsible for verification. AI must never invent a material, manufacturer, architect, award, view, renovation, amenity, dimension, or neighborhood fact.
Present "Alex Stoykov Group" as a team operating under its sponsoring broker (Compass), not as an independent brokerage, realty company, agency, or firm.

## Fair Housing
Describe the property, not the preferred occupant. Marketing must not indicate a preference, limitation, exclusion, or discouragement based on a legally protected characteristic. Describe physical rooms, layout, accessibility features, objective location facts, transportation, parks, restaurants, condition, building amenities, and published school boundaries. Do not describe the demographic character of a neighborhood, who would be "perfect" for the property, whether an area is "safe" or "good for families", or residents as "young", "professional", "traditional", or "exclusive".

## Final voice statement
ASG communicates with informed confidence and refined restraint, using precise property details, architectural understanding, and Chicago market knowledge to explain value rather than manufacture it. Every communication should strengthen the reader's confidence in the property, the representation, and the Alex Stoykov Group.`;

export const ASG_BRAND_GUIDE: BrandGuide = {
  key: 'asg',
  voice: ASG_BRAND_GUIDE_MARKDOWN,
  doRules: [
    'Lead with the property identity: type, location, and primary differentiator.',
    'Support every major claim with at least one concrete, verified detail.',
    'Select no more than three primary selling ideas per property.',
    'Guide the reader through the home using architectural relationships, not step-by-step narration.',
    'Use controlled sentence length, averaging roughly 18 to 25 words.',
    'Prefer active construction and stronger verbs over passive phrasing.',
    'Use "primary suite", never "master suite".',
    'Use numerals for dimensions, counts, sizes, years, and distances; write "square feet", not "sqft".',
    'Use "approximately" when a measurement has not been independently verified.',
    'Keep location writing precise: named streets, corridors, parks, transit, and published school boundaries.',
    'Present Alex Stoykov Group as a team operating under its sponsoring broker, Compass.',
  ],
  dontRules: [
    'Do not invent a material, manufacturer, architect, award, view, renovation, amenity, dimension, or neighborhood fact.',
    'Do not rely on multiple superlatives; use at most one strong superlative in an opening paragraph.',
    'Do not use em dashes; use a period, comma, or colon instead.',
    'Do not use exclamation marks in an MLS description.',
    'Do not use all caps for promotional emphasis or repeated punctuation.',
    'Do not call something "new" when its age has not been confirmed.',
    'Do not include appliance brands or architectural attributions unless verified.',
    'Do not make subjective claims about neighborhood demographics, safety, or who should live there.',
    'Do not describe ASG as an independent brokerage, realty company, agency, or firm.',
    'Do not begin with "rare opportunity", "welcome home", "must see", or "your dream home awaits".',
  ],
  preferredVocabulary: [
    'architecturally significant', 'considered', 'composed', 'custom', 'distinctive',
    'enduring', 'expansive', 'integrated', 'original', 'private', 'refined', 'restored',
    'tailored', 'thoughtfully configured', 'well-proportioned', 'light-filled',
    'park-facing', 'lake-facing', 'turnkey', 'flexible', 'substantial', 'direct access',
    'unobstructed views', 'indoor-outdoor living',
  ],
  useSparingly: [
    'rare', 'exceptional', 'luxury', 'luxurious', 'premier', 'prestigious', 'sophisticated',
    'stunning', 'breathtaking', 'unparalleled', 'meticulous', 'impeccable', 'coveted',
    'iconic', 'oasis',
  ],
  strongVerbs: [
    'frames', 'connects', 'anchors', 'opens', 'extends', 'introduces', 'preserves',
    'integrates', 'complements', 'organizes', 'defines', 'retains', 'overlooks', 'positions',
  ],
  bannedPhrases: [
    'dream home', "won't last", 'must-see', 'must see', 'act fast', 'hidden gem',
    'something for everyone', 'checks every box', 'better than new', 'best neighborhood',
    'rare opportunity', 'welcome home', "don't miss", 'prepare to be impressed',
    'your dream home awaits', 'close to everything', 'in the middle of it all',
    'the perfect location', 'steps from endless dining and shopping',
    'master suite', 'master bedroom',
  ],
  fairHousingBannedPhrases: [
    'perfect for families', 'family-friendly', 'family friendly', 'good for families',
    'ideal for families', 'safe neighborhood', 'safe area', 'safe and quiet',
    'ideal for young professionals', 'perfect for young professionals', 'young professionals',
    'bachelor pad', 'empty-nester', 'empty nester', 'exclusive community',
    'prestigious residents', 'no children', 'adults only', 'mature couple',
    'walking distance to great schools', 'top-rated schools', 'great for kids',
    'perfect for a growing family',
  ],
  contentPillars: ['Market Insight', 'Educational', 'Neighborhood', 'Lifestyle'],
};
