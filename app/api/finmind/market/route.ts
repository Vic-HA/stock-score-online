// @ts-nocheck
import { NextResponse } from "next/server";
import { getOrFetchCached, isForceRefresh, parseTtlMs } from "@/lib/serverCache";

export const dynamic = "force-dynamic";

const CACHE_BUILD_VERSION = "CACHE_BUILD_02_NONREALTIME_AND_GOOGLE_50_LIMIT";

function buildRouteCacheKey(prefix: string, requestUrl: string) {
  const url = new URL(requestUrl);
  const ignored = new Set(["force", "refresh", "cache", "noCache", "ttlMs", "cacheTtlMs", "_"]);
  const params = Array.from(url.searchParams.entries())
    .filter(([key]) => !ignored.has(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return `${prefix}:${params || "default"}`;
}



const FINMIND_API_URL = "https://api.finmindtrade.com/api/v4/data";

const DEFAULT_US_IDS = ["^IXIC", "^SOX", "^GSPC", "^DJI", "^VIX"];
const DEFAULT_FX_IDS = ["USD", "JPY"];
const DEFAULT_BOND_IDS = ["United States 10-Year"];
const DEFAULT_OIL_IDS = ["WTI", "Brent"];

function getRequestToken(request: Request) {
  const userToken = request.headers.get("x-finmind-token") || "";
  const serverToken = process.env.FINMIND_TOKEN || "";
  return {
    token: userToken || serverToken,
    tokenSource: userToken ? "user_header" : serverToken ? "server_env" : "missing",
  };
}

function yyyyMmDd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return yyyyMmDd(date);
}

function parseList(input: string | null, fallback: string[], max = 12) {
  const raw = input || fallback.join(",");
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);
}

function toNumber(value: unknown, fallback = 0) {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (!raw || raw === "-" || raw === "--" || raw.toUpperCase() === "N/A") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function sortByDate(rows: any[]) {
  return [...rows].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
}

function returnPct(latest: number, previous: number) {
  if (!Number.isFinite(latest) || !Number.isFinite(previous) || previous === 0) return null;
  return Number((((latest - previous) / previous) * 100).toFixed(2));
}

async function fetchFinMindSafe(dataset: string, params: Record<string, string>, token: string) {
  const url = new URL(FINMIND_API_URL);
  url.searchParams.set("dataset", dataset);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || json?.status === 402 || json?.status === 403 || json?.status === 429) {
      throw new Error(`HTTP ${res.status}: ${json?.msg || json?.message || "request failed"}`);
    }

    return { ok: true, dataset, data: Array.isArray(json?.data) ? json.data : [], error: "" };
  } catch (error: any) {
    return { ok: false, dataset, data: [], error: error?.message || `${dataset} failed` };
  }
}

function normalizeUsPrice(id: string, rows: any[]) {
  const sorted = sortByDate(rows);
  const latest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];

  if (!latest) {
    return {
      id,
      dataset: "USStockPrice",
      hasData: false,
      rowCount: rows.length,
      debug: {
        latestRaw: null,
        previousRaw: null,
        note: "FinMind returned no rows for this data_id in the requested date range.",
      },
    };
  }

  const close = toNumber(latest.Close ?? latest.close ?? latest.Adj_Close);
  const prevClose = previous ? toNumber(previous.Close ?? previous.close ?? previous.Adj_Close) : close;

  return {
    id,
    dataset: "USStockPrice",
    hasData: true,
    close,
    prevClose,
    return1d: returnPct(close, prevClose),
    volume: toNumber(latest.Volume ?? latest.volume),
    updatedAt: latest.date || "",
    rowCount: rows.length,
    debug: {
      latestRaw: latest,
      previousRaw: previous || null,
      closeFieldUsed: latest.Close !== undefined ? "Close" : latest.close !== undefined ? "close" : "Adj_Close",
      prevCloseFieldUsed: previous
        ? previous.Close !== undefined
          ? "Close"
          : previous.close !== undefined
            ? "close"
            : "Adj_Close"
        : "same_as_latest",
      note: id === "^VIX" ? "VIX is kept as reference only in page.tsx. Use this raw sample to check whether FinMind has stale date or different quote basis." : "",
    },
  };
}

function normalizeSimpleSeries(dataset: string, id: string, rows: any[], valueKeys: string[]) {
  const sorted = sortByDate(rows);
  const latest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];

  if (!latest) return { id, dataset, hasData: false };

  const getValue = (row: any) => {
    for (const key of valueKeys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== "") return toNumber(row[key]);
    }
    return 0;
  };

  const value = getValue(latest);
  const prev = previous ? getValue(previous) : value;

  return {
    id,
    dataset,
    hasData: true,
    value,
    prevValue: prev,
    return1d: returnPct(value, prev),
    updatedAt: latest.date || "",
  };
}

async function uncachedGET(request: Request) {
  const { token, tokenSource } = getRequestToken(request);

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        message: "Missing FinMind token. Set FINMIND_TOKEN in .env.local or send X-FinMind-Token header.",
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);

  const usIds = parseList(searchParams.get("us"), DEFAULT_US_IDS, 12);
  const fxIds = parseList(searchParams.get("fx"), DEFAULT_FX_IDS, 8);
  const bondIds = parseList(searchParams.get("bonds"), DEFAULT_BOND_IDS, 5);
  const oilIds = parseList(searchParams.get("oil"), DEFAULT_OIL_IDS, 4);
  const startDate = searchParams.get("start_date") || daysAgo(10);
  const endDate = searchParams.get("end_date") || yyyyMmDd(new Date());

  const usResults = await Promise.all(
    usIds.map(async (id) => ({
      id,
      result: await fetchFinMindSafe("USStockPrice", { data_id: id, start_date: startDate, end_date: endDate }, token),
    }))
  );

  const fxResults = await Promise.all(
    fxIds.map(async (id) => ({
      id,
      result: await fetchFinMindSafe("TaiwanExchangeRate", { data_id: id, start_date: startDate, end_date: endDate }, token),
    }))
  );

  const bondResults = await Promise.all(
    bondIds.map(async (id) => ({
      id,
      result: await fetchFinMindSafe("GovernmentBondsYield", { data_id: id, start_date: startDate, end_date: endDate }, token),
    }))
  );

  const oilResults = await Promise.all(
    oilIds.map(async (id) => ({
      id,
      result: await fetchFinMindSafe("CrudeOilPrices", { data_id: id, start_date: startDate, end_date: endDate }, token),
    }))
  );

  const goldResult = await fetchFinMindSafe("GoldPrice", { start_date: startDate, end_date: endDate }, token);
  const fedRateResult = await fetchFinMindSafe("InterestRate", { data_id: "FED", start_date: daysAgo(365), end_date: endDate }, token);

  const usMarket = usResults.map(({ id, result }) => ({
    ...normalizeUsPrice(id, result.data),
    ok: result.ok,
    error: result.error,
  }));

  const fx = fxResults.map(({ id, result }) => ({
    ...normalizeSimpleSeries("TaiwanExchangeRate", id, result.data, ["spot_buy", "cash_buy"]),
    ok: result.ok,
    error: result.error,
  }));

  const bonds = bondResults.map(({ id, result }) => ({
    ...normalizeSimpleSeries("GovernmentBondsYield", id, result.data, ["value"]),
    ok: result.ok,
    error: result.error,
  }));

  const oil = oilResults.map(({ id, result }) => ({
    ...normalizeSimpleSeries("CrudeOilPrices", id, result.data, ["price"]),
    ok: result.ok,
    error: result.error,
  }));

  const gold = {
    ...normalizeSimpleSeries("GoldPrice", "Gold", goldResult.data, ["Price"]),
    ok: goldResult.ok,
    error: goldResult.error,
  };

  const fedRate = {
    ...normalizeSimpleSeries("InterestRate", "FED", fedRateResult.data, ["interest_rate"]),
    ok: fedRateResult.ok,
    error: fedRateResult.error,
  };

  const byId = Object.fromEntries(usMarket.map((item) => [item.id, item]));
  const includeDebug = searchParams.get("debug") === "1";

  return NextResponse.json({
    ok: true,
    source: "finmind_market_proxy",
    tokenSource,
    market: {
      us: usMarket.map((item: any) => includeDebug ? item : ({ ...item, debug: undefined })),
      fx,
      bonds,
      oil,
      gold,
      fedRate,
      derived: {
        nasdaqReturn1d: byId["^IXIC"]?.return1d ?? null,
        soxReturn1d: byId["^SOX"]?.return1d ?? null,
        sp500Return1d: byId["^GSPC"]?.return1d ?? null,
        dowReturn1d: byId["^DJI"]?.return1d ?? null,
        vixChange1d: byId["^VIX"]?.return1d ?? null,
      },
    },
    vixDebug: includeDebug ? byId["^VIX"]?.debug || null : undefined,
    fetchedAt: new Date().toISOString(),
    requestCostHint: {
      defaultRequests: usIds.length + fxIds.length + bondIds.length + oilIds.length + 2,
      note: "Default route uses USStockPrice + FX + bond yield + oil + gold + FED rate. Use every 5–15 minutes, not every 20 seconds.",
    },
  });
}


export async function GET(request: Request) {
  const wrapperStartedAt = new Date().toISOString();
  const url = new URL(request.url);
  const force = isForceRefresh(url.searchParams);
  const cacheTtlMs = parseTtlMs(url.searchParams, 60 * 60 * 1000);
  const cacheKey = buildRouteCacheKey("finmind_market", request.url);

  try {
    const cached = await getOrFetchCached({
      key: cacheKey,
      ttlMs: cacheTtlMs,
      force,
      meta: { route: "/api/finmind/market", policy: "FinMind Market 1h TTL" },
      fetcher: async () => {
        const res = await uncachedGET(request);
        const payload = await res.json();
        return { payload, status: res.status };
      },
    });

    return NextResponse.json(
      {
        ...cached.value.payload,
        cache: cached.cache,
        cachePolicy: {
          build: CACHE_BUILD_VERSION,
          kind: "ttl",
          ttlMs: cacheTtlMs,
          force,
          route: "/api/finmind/market",
        },
        wrapperStartedAt,
        wrapperFinishedAt: new Date().toISOString(),
      },
      { status: cached.value.status || 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/finmind/market",
        cachePolicy: { build: CACHE_BUILD_VERSION, kind: "ttl", ttlMs: cacheTtlMs, force },
        wrapperStartedAt,
        wrapperFinishedAt: new Date().toISOString(),
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

