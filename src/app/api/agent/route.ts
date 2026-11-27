// The thin proxy. It holds the API key, checks the request, applies the rate
// limit and daily cap, and forwards one model call. It never sees the user's
// graph: tools run in the browser, and only their results come through here.
import Anthropic from "@anthropic-ai/sdk";
import { buildRequest } from "@/agent/request.ts";
import { Guard, configFromEnv } from "@/agent/guard.ts";

export const runtime = "nodejs";

const guard = new Guard(configFromEnv(process.env));
let client: Anthropic | null = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 60_000 });
  return client;
}

const reply = (status: number, body: object, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });

/** Lets the page know whether the assistant is available, without spending anything. */
export function GET() {
  return reply(200, { configured: Boolean(process.env.ANTHROPIC_API_KEY) });
}

export async function POST(req: Request) {
  const anthropic = getClient();
  if (!anthropic) return reply(503, { error: "not_configured" });

  const text = await req.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return reply(400, { error: "bad_request", message: "Not JSON." });
  }
  const built = buildRequest(raw, text.length);
  if (!built.ok) return reply(400, { error: "bad_request", message: built.message });

  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
  const verdict = guard.admit(ip);
  if (!verdict.ok) return reply(429, { error: verdict.reason }, { "retry-after": String(verdict.retryAfterSec) });

  try {
    const msg = await anthropic.messages.create(built.params);
    guard.record(msg.usage);
    return reply(200, { content: msg.content, stop_reason: msg.stop_reason });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
      return reply(503, { error: "not_configured" });
    if (e instanceof Anthropic.RateLimitError) return reply(429, { error: "upstream_busy" });
    if (e instanceof Anthropic.APIError) {
      console.error("Anthropic API error", e.status, e.message);
      return reply(502, { error: "upstream", message: "The assistant service had a problem. Please try again." });
    }
    console.error("Agent proxy error", e);
    return reply(502, { error: "upstream", message: "Could not reach the assistant service." });
  }
}
