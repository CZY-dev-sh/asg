import Anthropic from '@anthropic-ai/sdk';
import { env, have } from '../env.js';

/**
 * Anthropic (Claude) client for the listing marketing agent. Mirrors the
 * fubClient()/asana connector style: returns null when no API key is
 * configured so every caller degrades gracefully (have.anthropic()).
 *
 * Nothing in here publishes anything — the agent only drafts copy for human
 * review. Cost is controlled by the per-run token ceiling enforced by callers
 * (env.LISTING_AGENT_MAX_TOKENS_PER_RUN) plus the usage returned from each call.
 */
export function anthropicClient(): Anthropic | null {
  if (!have.anthropic()) return null;
  return new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}),
  });
}

export interface ClaudeUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  totalTokens: number;
}

/** Normalize Anthropic's usage block into a flat, additive shape. */
export function readUsage(usage: Anthropic.Usage | undefined | null): ClaudeUsage {
  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;
  const cacheCreationInputTokens = usage?.cache_creation_input_tokens ?? 0;
  const cacheReadInputTokens = usage?.cache_read_input_tokens ?? 0;
  return {
    inputTokens,
    outputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens,
    totalTokens: inputTokens + outputTokens + cacheCreationInputTokens + cacheReadInputTokens,
  };
}

// Per-million-token USD pricing. VERIFY against current Anthropic pricing before
// relying on the cost numbers; kept here so it's editable in one place. Cache
// reads are billed at ~10% of input and cache writes at ~125% of input.
const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

/** Best-effort USD cost estimate for a run's token usage on a given model. */
export function estimateCostUsd(model: string, usage: ClaudeUsage): number {
  const price = PRICING_PER_MTOK[model] ?? PRICING_PER_MTOK['claude-sonnet-4-6']!;
  const inputCost = ((usage.inputTokens + usage.cacheCreationInputTokens * 1.25 + usage.cacheReadInputTokens * 0.1) / 1_000_000) * price.input;
  const outputCost = (usage.outputTokens / 1_000_000) * price.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

/** Thrown when a run would exceed env.LISTING_AGENT_MAX_TOKENS_PER_RUN. */
export class TokenCeilingError extends Error {
  constructor(public used: number, public limit: number) {
    super(`token ceiling exceeded: ${used} tokens used vs limit ${limit}`);
    this.name = 'TokenCeilingError';
  }
}

/**
 * Tracks cumulative token usage across every Claude call in a single run and
 * aborts the moment the ceiling is crossed, so a prompt-loop bug can't run up a
 * bill. A single listing should never cost more than ~$1.
 */
export class RunBudget {
  private used = 0;
  private readonly perCall: ClaudeUsage[] = [];
  constructor(private readonly limit: number) {}

  get totalTokens(): number {
    return this.used;
  }

  get usages(): ClaudeUsage[] {
    return this.perCall;
  }

  /** Fail fast before a call if we're already at/over the ceiling. */
  assertBeforeCall(): void {
    if (this.used >= this.limit) throw new TokenCeilingError(this.used, this.limit);
  }

  /** Record a call's usage and throw if it pushed us past the ceiling. */
  record(usage: ClaudeUsage): void {
    this.used += usage.totalTokens;
    this.perCall.push(usage);
    if (this.used > this.limit) throw new TokenCeilingError(this.used, this.limit);
  }
}

export interface ClaudeCallInput {
  client: Anthropic;
  model: string;
  /** Static, cacheable system prompt (brand guide + role). Cached ephemerally. */
  system: string;
  messages: Anthropic.MessageParam[];
  maxTokens: number;
  temperature?: number;
  tools?: Anthropic.Tool[];
  toolChoice?: Anthropic.MessageCreateParamsNonStreaming['tool_choice'];
  budget?: RunBudget;
}

export interface ClaudeCallResult {
  text: string;
  /** First tool_use input, when a tool was forced (structured output). */
  toolInput: Record<string, unknown> | null;
  usage: ClaudeUsage;
  stopReason: string | null;
}

/**
 * One Claude message call with prompt caching on the system block and optional
 * budget enforcement. Keeps every model touchpoint in the connector so callers
 * never hand-roll the SDK.
 */
export async function callClaude(input: ClaudeCallInput): Promise<ClaudeCallResult> {
  input.budget?.assertBeforeCall();
  const res = await input.client.messages.create({
    model: input.model,
    max_tokens: input.maxTokens,
    temperature: input.temperature ?? 0.4,
    system: [{ type: 'text', text: input.system, cache_control: { type: 'ephemeral' } }],
    messages: input.messages,
    ...(input.tools ? { tools: input.tools } : {}),
    ...(input.toolChoice ? { tool_choice: input.toolChoice } : {}),
  });

  let text = '';
  let toolInput: Record<string, unknown> | null = null;
  for (const block of res.content) {
    if (block.type === 'text') text += block.text;
    else if (block.type === 'tool_use' && toolInput == null) {
      toolInput = (block.input ?? {}) as Record<string, unknown>;
    }
  }

  const usage = readUsage(res.usage);
  input.budget?.record(usage);
  return { text, toolInput, usage, stopReason: res.stop_reason ?? null };
}
