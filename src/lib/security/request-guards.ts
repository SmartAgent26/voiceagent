import type { ZodType } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RateLimitOptions = {
  scope: string;
  limit: number;
  windowMs: number;
  identity?: string;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("El cuerpo de la solicitud supera el tamaño permitido.");
  }
}

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function enforceLocalRateLimit(request: Request, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const identity = options.identity || clientIp(request);
  const key = `${options.scope}:${identity}`;
  const current = rateLimitBuckets.get(key);

  if (current && current.resetAt > now) {
    if (current.count >= options.limit) {
      return {
        allowed: false,
        limit: options.limit,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
      };
    }
    current.count += 1;
    return {
      allowed: true,
      limit: options.limit,
      remaining: Math.max(0, options.limit - current.count),
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
    };
  }

  rateLimitBuckets.set(key, { count: 1, resetAt: now + options.windowMs });
  if (rateLimitBuckets.size > 10_000) {
    for (const [bucketKey, bucket] of rateLimitBuckets) {
      if (bucket.resetAt <= now) rateLimitBuckets.delete(bucketKey);
    }
  }
  return { allowed: true, limit: options.limit, remaining: Math.max(0, options.limit - 1), retryAfterSeconds: Math.ceil(options.windowMs / 1_000) };
}

/** Shared fixed-window limit, persisted in Supabase so replicas enforce one quota. */
export async function enforceRateLimit(request: Request, options: RateLimitOptions): Promise<RateLimitResult> {
  const client = createServerSupabaseClient();
  if (!client) return enforceLocalRateLimit(request, options);
  const identity = options.identity || clientIp(request);
  const { data, error } = await client.rpc("consume_api_rate_limit", {
    p_scope: options.scope,
    p_identity: identity,
    p_limit: options.limit,
    p_window_seconds: Math.ceil(options.windowMs / 1_000),
  }).single();
  if (error || !data) throw new Error("No pudimos verificar el límite de solicitudes.");
  const result = data as { allowed: boolean; limit: number; remaining: number; retry_after_seconds: number };
  return { allowed: result.allowed, limit: result.limit, remaining: result.remaining, retryAfterSeconds: result.retry_after_seconds };
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "Retry-After": String(result.retryAfterSeconds),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
  };
}

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>, maxBytes: number): Promise<T> {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new RequestBodyTooLargeError();

  const body = await request.arrayBuffer();
  if (body.byteLength > maxBytes) throw new RequestBodyTooLargeError();

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new SyntaxError("El cuerpo debe ser JSON válido.");
  }
  return schema.parse(parsed);
}
