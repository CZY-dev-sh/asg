import { sql, j } from '../db/client.js';
import { log } from '../logger.js';
import { ASG_BRAND_GUIDE, type BrandGuide } from '../data/brandGuide.js';

/**
 * Brand guide access for the listing marketing agent.
 *
 * The brand_guidelines table is the runtime source of truth so the voice is
 * editable without a deploy. loadBrandGuide() reads the active row and falls
 * back to the canonical module constant when the table is empty/unseeded.
 */

type BrandRow = {
  key: string;
  voice: string | null;
  do_rules: unknown;
  dont_rules: unknown;
  banned_phrases: unknown;
  raw: Record<string, unknown> | null;
};

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x)) : [];

/** Load the active ASG brand guide (DB-first, module fallback). */
export async function loadBrandGuide(key = 'asg'): Promise<BrandGuide> {
  try {
    const [row] = await sql<BrandRow[]>`
      select key, voice, do_rules, dont_rules, banned_phrases, raw
      from brand_guidelines
      where key = ${key} and active = true
      limit 1
    `;
    if (row && row.voice) {
      const raw = (row.raw ?? {}) as Partial<BrandGuide>;
      return {
        ...ASG_BRAND_GUIDE,
        key: row.key,
        voice: row.voice,
        doRules: asStringArray(row.do_rules),
        dontRules: asStringArray(row.dont_rules),
        bannedPhrases: asStringArray(row.banned_phrases),
        // Vocabulary / verbs / FH list / pillars travel in raw so the whole
        // guide stays editable from one row without new columns.
        preferredVocabulary: asStringArray(raw.preferredVocabulary).length
          ? asStringArray(raw.preferredVocabulary)
          : ASG_BRAND_GUIDE.preferredVocabulary,
        useSparingly: asStringArray(raw.useSparingly).length
          ? asStringArray(raw.useSparingly)
          : ASG_BRAND_GUIDE.useSparingly,
        strongVerbs: asStringArray(raw.strongVerbs).length
          ? asStringArray(raw.strongVerbs)
          : ASG_BRAND_GUIDE.strongVerbs,
        fairHousingBannedPhrases: asStringArray(raw.fairHousingBannedPhrases).length
          ? asStringArray(raw.fairHousingBannedPhrases)
          : ASG_BRAND_GUIDE.fairHousingBannedPhrases,
        contentPillars: asStringArray(raw.contentPillars).length
          ? asStringArray(raw.contentPillars)
          : ASG_BRAND_GUIDE.contentPillars,
      };
    }
  } catch (err) {
    log.warn(`brand guide DB read failed, using module fallback: ${String(err)}`);
  }
  return ASG_BRAND_GUIDE;
}

/** Idempotently upsert the canonical brand guide into brand_guidelines. */
export async function seedBrandGuidelines(guide: BrandGuide = ASG_BRAND_GUIDE): Promise<void> {
  await sql`
    insert into brand_guidelines (key, voice, do_rules, dont_rules, banned_phrases, raw, active)
    values (
      ${guide.key}, ${guide.voice}, ${j(guide.doRules)}, ${j(guide.dontRules)},
      ${j(guide.bannedPhrases)},
      ${j({
        preferredVocabulary: guide.preferredVocabulary,
        useSparingly: guide.useSparingly,
        strongVerbs: guide.strongVerbs,
        fairHousingBannedPhrases: guide.fairHousingBannedPhrases,
        contentPillars: guide.contentPillars,
      })},
      true
    )
    on conflict (key) do update set
      voice = excluded.voice,
      do_rules = excluded.do_rules,
      dont_rules = excluded.dont_rules,
      banned_phrases = excluded.banned_phrases,
      raw = excluded.raw,
      active = true,
      updated_at = now()
  `;
  log.info(`brand guide '${guide.key}' seeded`);
}
