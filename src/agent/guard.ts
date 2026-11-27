// Protection for the public demo: a per-IP rate limit and a daily spending cap.
// Counters live in server memory. That is enough for a demo on one server
// instance; on serverless hosts each instance counts on its own, so the README
// also asks you to set a monthly spend limit on the Anthropic API key itself,
// which is the real hard stop.

/** Claude Haiku 5.5 list prices, USD per million tokens (prompts up to 100K). */
const PRICE_IN = 0.1;
const PRICE_OUT = 0.5;

export type GuardConfig = {
  /** Model calls allowed per IP in the window. One question is usually 2 to 4 calls. */
  perIpLimit: number;
  windowMs: number;
  /** Stop all calls once today's estimated spend reaches this. */
  dailyBudgetUsd: number;
};

export function configFromEnv(env: Record<string, string | undefined>): GuardConfig {
  const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
  return {
    perIpLimit: num(env.AGENT_CALLS_PER_IP, 40),
    windowMs: num(env.AGENT_WINDOW_MINUTES, 60) * 60_000,
    dailyBudgetUsd: num(env.AGENT_DAILY_BUDGET_USD, 2),
  };
}

export type Verdict = { ok: true } | { ok: false; reason: "rate_limited" | "budget"; retryAfterSec: number };

export class Guard {
  private calls = new Map<string, number[]>();
  private day = "";
  private spentUsd = 0;

  constructor(private config: GuardConfig, private now: () => number = Date.now) {}

  private rollDay() {
    const today = new Date(this.now()).toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.spentUsd = 0;
    }
  }

  /** Check before a model call; counts the call if it is allowed. */
  admit(ip: string): Verdict {
    this.rollDay();
    const t = this.now();
    if (this.spentUsd >= this.config.dailyBudgetUsd) {
      const midnight = Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth(), new Date(t).getUTCDate() + 1);
      return { ok: false, reason: "budget", retryAfterSec: Math.ceil((midnight - t) / 1000) };
    }
    const recent = (this.calls.get(ip) ?? []).filter((x) => t - x < this.config.windowMs);
    if (recent.length >= this.config.perIpLimit) {
      this.calls.set(ip, recent);
      return { ok: false, reason: "rate_limited", retryAfterSec: Math.ceil((recent[0] + this.config.windowMs - t) / 1000) };
    }
    recent.push(t);
    this.calls.set(ip, recent);
    // Keep memory bounded if many different IPs show up.
    if (this.calls.size > 5000) for (const [k, v] of this.calls) if (!v.some((x) => t - x < this.config.windowMs)) this.calls.delete(k);
    return { ok: true };
  }

  /** Add what a finished call cost. */
  record(usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }) {
    this.rollDay();
    const input = usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
    this.spentUsd += (input * PRICE_IN + usage.output_tokens * PRICE_OUT) / 1_000_000;
  }

  get spent() {
    this.rollDay();
    return this.spentUsd;
  }
}
