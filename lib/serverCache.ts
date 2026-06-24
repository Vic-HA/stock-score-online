// SERVER_CACHE_BUILD_01
//
// In-memory server-side cache for Next.js route handlers.
//
// Rules:
// - First request fetches upstream and stores latest payload.
// - Repeated requests within TTL return cache.
// - force=1 / refresh=1 / cache=0 / noCache=1 bypasses cache.
// - Scheduled daily cache helper is prepared for non-realtime routes later.
// - This cache is process-memory only; dev server restart clears it.

type CacheEntry<T = unknown> = {
  value: T;
  createdAt: number;
  expiresAt: number;
  meta?: Record<string, unknown>;
};

type CachePolicy = "ttl" | "scheduled_daily";

type CacheMeta = {
  hit: boolean;
  key: string;
  ageSec: number;
  ttlSec: number;
  expiresInSec: number;
  createdAt: string;
  expiresAt: string;
  policy: CachePolicy;
  coalesced?: boolean;
};

type CacheResult<T = unknown> = {
  value: T;
  cache: CacheMeta;
};

type GetOrFetchOptions<T> = {
  key: string;
  ttlMs: number;
  force?: boolean;
  fetcher: () => Promise<T>;
  meta?: Record<string, unknown>;
};

type ScheduledDailyOptions<T> = {
  key: string;
  force?: boolean;
  fetcher: () => Promise<T>;
  refreshHours?: number[];
  timezoneOffsetMinutes?: number;
  maxStaleMs?: number;
  meta?: Record<string, unknown>;
};

const globalCache = globalThis as typeof globalThis & {
  __stockScoreServerCache?: Map<string, CacheEntry>;
  __stockScoreServerCacheInflight?: Map<string, Promise<CacheEntry>>;
};

const store = globalCache.__stockScoreServerCache || new Map<string, CacheEntry>();
const inflightStore = globalCache.__stockScoreServerCacheInflight || new Map<string, Promise<CacheEntry>>();
globalCache.__stockScoreServerCache = store;
globalCache.__stockScoreServerCacheInflight = inflightStore;

function nowMs() {
  return Date.now();
}

function iso(ms: number) {
  return new Date(ms).toISOString();
}

function normalizeTtlMs(ttlMs: number) {
  const n = Number(ttlMs);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

function buildCacheMeta(key: string, entry: CacheEntry, hit: boolean, ttlMs: number, policy: CachePolicy): CacheMeta {
  const now = nowMs();
  const ageSec = Math.max(0, Math.round((now - entry.createdAt) / 1000));
  const ttlSec = Math.max(0, Math.round(ttlMs / 1000));
  const expiresInSec = Math.max(0, Math.round((entry.expiresAt - now) / 1000));

  return {
    hit,
    key,
    ageSec,
    ttlSec,
    expiresInSec,
    createdAt: iso(entry.createdAt),
    expiresAt: iso(entry.expiresAt),
    policy,
  };
}

export function clearServerCache(keyPrefix?: string) {
  if (!keyPrefix) {
    store.clear();
    inflightStore.clear();
    return { cleared: "all" };
  }

  let count = 0;
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(keyPrefix)) {
      store.delete(key);
      count += 1;
    }
  }
  for (const key of Array.from(inflightStore.keys())) {
    if (key.startsWith(keyPrefix)) {
      inflightStore.delete(key);
    }
  }

  return { cleared: count, keyPrefix };
}

export function peekServerCache(key: string) {
  const entry = store.get(key);
  if (!entry) return null;

  return {
    key,
    createdAt: iso(entry.createdAt),
    expiresAt: iso(entry.expiresAt),
    ageSec: Math.max(0, Math.round((nowMs() - entry.createdAt) / 1000)),
    expired: entry.expiresAt <= nowMs(),
    meta: entry.meta || null,
  };
}

export async function getOrFetchCached<T>(options: GetOrFetchOptions<T>): Promise<CacheResult<T>> {
  const key = options.key;
  const ttlMs = normalizeTtlMs(options.ttlMs);
  const force = !!options.force;

  if (!key) throw new Error("cache key is required");

  if (!ttlMs) {
    const value = await options.fetcher();
    const createdAt = nowMs();
    const entry: CacheEntry<T> = {
      value,
      createdAt,
      expiresAt: createdAt,
      meta: options.meta,
    };
    return { value, cache: buildCacheMeta(key, entry, false, 0, "ttl") };
  }

  const existing = store.get(key) as CacheEntry<T> | undefined;
  if (!force && existing && existing.expiresAt > nowMs()) {
    return {
      value: existing.value,
      cache: buildCacheMeta(key, existing, true, ttlMs, "ttl"),
    };
  }

  if (!force) {
    const inflight = inflightStore.get(key) as Promise<CacheEntry<T>> | undefined;
    if (inflight) {
      const entry = await inflight;
      return {
        value: entry.value,
        cache: {
          ...buildCacheMeta(key, entry, false, ttlMs, "ttl"),
          coalesced: true,
        },
      };
    }
  }

  const fetchPromise = (async () => {
    const value = await options.fetcher();
    const createdAt = nowMs();
    const entry: CacheEntry<T> = {
      value,
      createdAt,
      expiresAt: createdAt + ttlMs,
      meta: options.meta,
    };

    store.set(key, entry);
    return entry;
  })();

  if (!force) inflightStore.set(key, fetchPromise as Promise<CacheEntry>);

  try {
    const entry = await fetchPromise;
    return {
      value: entry.value,
      cache: buildCacheMeta(key, entry, false, ttlMs, "ttl"),
    };
  } finally {
    if (!force && inflightStore.get(key) === fetchPromise) {
      inflightStore.delete(key);
    }
  }
}

export function nextScheduledRefreshMs(
  refreshHours = [8, 14, 15, 18, 22],
  timezoneOffsetMinutes = 8 * 60,
  fromMs = nowMs()
) {
  // Local Taiwan schedule:
  // 08:30, 14:10, 15:30, 18:00, 22:00
  const local = new Date(fromMs + timezoneOffsetMinutes * 60 * 1000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();

  const schedule = [
    { h: 8, m: 30 },
    { h: 14, m: 10 },
    { h: 15, m: 30 },
    { h: 18, m: 0 },
    { h: 22, m: 0 },
  ];

  const candidates = schedule.map((x) =>
    Date.UTC(y, m, d, x.h, x.m, 0) - timezoneOffsetMinutes * 60 * 1000
  );

  const tomorrow = Date.UTC(y, m, d + 1, 8, 30, 0) - timezoneOffsetMinutes * 60 * 1000;
  candidates.push(tomorrow);

  return candidates.find((x) => x > fromMs) || tomorrow;
}

export function shouldRefreshScheduledDaily(
  entry: CacheEntry | undefined,
  refreshHours = [8, 14, 15, 18, 22],
  timezoneOffsetMinutes = 8 * 60,
  maxStaleMs = 24 * 60 * 60 * 1000
) {
  if (!entry) return true;
  const now = nowMs();
  if (now - entry.createdAt > maxStaleMs) return true;
  return entry.expiresAt <= now;
}

export async function getOrFetchScheduledDailyCached<T>(options: ScheduledDailyOptions<T>): Promise<CacheResult<T>> {
  const key = options.key;
  const force = !!options.force;
  const refreshHours = options.refreshHours || [8, 14, 15, 18, 22];
  const timezoneOffsetMinutes = options.timezoneOffsetMinutes ?? 8 * 60;
  const maxStaleMs = options.maxStaleMs ?? 24 * 60 * 60 * 1000;

  if (!key) throw new Error("cache key is required");

  const existing = store.get(key) as CacheEntry<T> | undefined;
  if (!force && existing && !shouldRefreshScheduledDaily(existing, refreshHours, timezoneOffsetMinutes, maxStaleMs)) {
    const ttlMs = Math.max(0, existing.expiresAt - existing.createdAt);
    return {
      value: existing.value,
      cache: buildCacheMeta(key, existing, true, ttlMs, "scheduled_daily"),
    };
  }

  if (!force) {
    const inflight = inflightStore.get(key) as Promise<CacheEntry<T>> | undefined;
    if (inflight) {
      const entry = await inflight;
      return {
        value: entry.value,
        cache: {
          ...buildCacheMeta(key, entry, false, Math.max(0, entry.expiresAt - entry.createdAt), "scheduled_daily"),
          coalesced: true,
        },
      };
    }
  }

  const fetchPromise = (async () => {
    const value = await options.fetcher();
    const createdAt = nowMs();
    const expiresAt = nextScheduledRefreshMs(refreshHours, timezoneOffsetMinutes, createdAt);
    const entry: CacheEntry<T> = {
      value,
      createdAt,
      expiresAt,
      meta: options.meta,
    };

    store.set(key, entry);
    return entry;
  })();

  if (!force) inflightStore.set(key, fetchPromise as Promise<CacheEntry>);

  try {
    const entry = await fetchPromise;
    return {
      value: entry.value,
      cache: buildCacheMeta(key, entry, false, Math.max(0, entry.expiresAt - entry.createdAt), "scheduled_daily"),
    };
  } finally {
    if (!force && inflightStore.get(key) === fetchPromise) {
      inflightStore.delete(key);
    }
  }
}

export function normalizeCacheKeyPart(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .split(/[,\s|]+/)
    .filter(Boolean)
    .sort()
    .join(",");
}

export function isForceRefresh(searchParams: URLSearchParams) {
  return (
    searchParams.get("force") === "1" ||
    searchParams.get("refresh") === "1" ||
    searchParams.get("cache") === "0" ||
    searchParams.get("noCache") === "1"
  );
}

type HeadersLike = {
  get?: (name: string) => string | null;
};

function safeUrl(requestUrl: string) {
  try {
    return new URL(requestUrl);
  } catch {
    return new URL(requestUrl || "/", "http://localhost");
  }
}

function isLocalHostname(hostname: string) {
  const host = String(hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

function getHeader(headers: HeadersLike | undefined, name: string) {
  try {
    return headers?.get?.(name) || null;
  } catch {
    return null;
  }
}

export function hasPrivilegedCacheBypass(requestUrl: string, headers?: HeadersLike) {
  const url = safeUrl(requestUrl);
  const configuredSecret = String(
    process.env.STOCK_SCORE_ADMIN_SECRET ||
    process.env.PHASE_D_ADMIN_SECRET ||
    process.env.ADMIN_SECRET ||
    ""
  ).trim();
  const providedSecret = String(
    url.searchParams.get("adminSecret") ||
    url.searchParams.get("admin_secret") ||
    url.searchParams.get("secret") ||
    getHeader(headers, "x-stock-score-admin-secret") ||
    getHeader(headers, "x-phase-d-admin-secret") ||
    ""
  ).trim();

  if (configuredSecret && providedSecret && providedSecret === configuredSecret) return true;
  if (process.env.GITHUB_ACTIONS === "true") return true;
  if (process.env.NODE_ENV === "development" && isLocalHostname(url.hostname)) return true;

  return false;
}

export function guardedForceRefresh(requestUrl: string, headers?: HeadersLike) {
  const url = safeUrl(requestUrl);
  if (!hasPrivilegedCacheBypass(requestUrl, headers)) return false;
  return isForceRefresh(url.searchParams);
}

export function guardedTtlMs(requestUrl: string, headers: HeadersLike | undefined, defaultTtlMs: number) {
  const url = safeUrl(requestUrl);
  if (!hasPrivilegedCacheBypass(requestUrl, headers)) return defaultTtlMs;
  return parseTtlMs(url.searchParams, defaultTtlMs);
}

export function parseTtlMs(searchParams: URLSearchParams, defaultTtlMs: number) {
  const raw = searchParams.get("cacheTtlMs") || searchParams.get("ttlMs");
  if (!raw) return defaultTtlMs;

  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return defaultTtlMs;

  return Math.min(Math.round(n), 10 * 60 * 1000);
}
