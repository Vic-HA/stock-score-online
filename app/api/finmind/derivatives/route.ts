// @ts-nocheck
import { NextResponse } from "next/server";
import { getOrFetchCached, isForceRefresh, parseTtlMs } from "@/lib/serverCache";

export const dynamic = "force-dynamic";

const CACHE_BUILD_VERSION = "CACHE_BUILD_03_FINMIND_DERIVATIVES_DATA_TIME";

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

function toNumber(value: unknown, fallback = 0) {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (!raw || raw === "-" || raw === "--" || raw.toUpperCase() === "N/A") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function sortByDate(rows: any[]) {
  return [...rows].sort((a, b) => {
    const ad = `${a.date || ""} ${a.trading_session || ""} ${a.contract_date || ""}`;
    const bd = `${b.date || ""} ${b.trading_session || ""} ${b.contract_date || ""}`;
    return ad.localeCompare(bd);
  });
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

function latestDate(rows: any[]) {
  const dates = rows.map((row) => String(row.date || "")).filter(Boolean).sort();
  return dates[dates.length - 1] || "";
}

function latestDateRows(rows: any[]) {
  const date = latestDate(rows);
  if (!date) return [];
  return rows.filter((row) => String(row.date || "") === date);
}

function contractScore(row: any) {
  const contract = String(row.contract_date || "");
  const close = toNumber(row.close);
  const open = toNumber(row.open);
  const volume = toNumber(row.volume);
  const settlement = toNumber(row.settlement_price);
  const oi = toNumber(row.open_interest);
  const isSpread = contract.includes("/");
  const hasPrice = close > 0 || settlement > 0 || open > 0;
  return [
    isSpread ? -100000000 : 0,
    hasPrice ? 10000000 : 0,
    volume,
    oi,
  ].reduce((sum, x) => sum + x, 0);
}

function pickBestFuturesRow(rows: any[]) {
  const latestRows = latestDateRows(rows);
  if (!latestRows.length) return null;

  const regularRows = latestRows.filter((row) => String(row.trading_session || "").toLowerCase() !== "after_market");
  const candidates = regularRows.length ? regularRows : latestRows;

  return [...candidates].sort((a, b) => contractScore(b) - contractScore(a))[0] || null;
}

function pickBestAfterMarketRow(rows: any[]) {
  const latestRows = latestDateRows(rows);
  const afterRows = latestRows.filter((row) => String(row.trading_session || "").toLowerCase() === "after_market");
  const candidates = afterRows.length ? afterRows : latestRows;
  return [...candidates].sort((a, b) => contractScore(b) - contractScore(a))[0] || null;
}

function summarizeFuturesDaily(rows: any[]) {
  const regular = pickBestFuturesRow(rows);
  const afterMarket = pickBestAfterMarketRow(rows);

  if (!regular && !afterMarket) return { hasData: false };

  const main = regular || afterMarket;
  const after = afterMarket || null;

  return {
    hasData: true,
    date: main.date || "",
    futuresId: main.futures_id || "",
    contractDate: main.contract_date || "",
    close: toNumber(main.close),
    open: toNumber(main.open),
    high: toNumber(main.max),
    low: toNumber(main.min),
    spread: toNumber(main.spread),
    spreadPer: toNumber(main.spread_per),
    volume: toNumber(main.volume),
    settlementPrice: toNumber(main.settlement_price),
    openInterest: toNumber(main.open_interest),
    tradingSession: main.trading_session || "",
    afterMarket: after
      ? {
          date: after.date || "",
          contractDate: after.contract_date || "",
          close: toNumber(after.close),
          spread: toNumber(after.spread),
          spreadPer: toNumber(after.spread_per),
          volume: toNumber(after.volume),
          settlementPrice: toNumber(after.settlement_price),
          openInterest: toNumber(after.open_interest),
          tradingSession: after.trading_session || "",
        }
      : null,
  };
}

function summarizeFuturesInstitutional(rows: any[]) {
  const latestRows = latestDateRows(rows);
  if (!latestRows.length) return { hasData: false };

  let longAmount = 0;
  let shortAmount = 0;
  let longVolume = 0;
  let shortVolume = 0;
  let longOiAmount = 0;
  let shortOiAmount = 0;

  latestRows.forEach((row) => {
    longAmount += toNumber(row.long_deal_amount);
    shortAmount += toNumber(row.short_deal_amount);
    longVolume += toNumber(row.long_deal_volume);
    shortVolume += toNumber(row.short_deal_volume);
    longOiAmount += toNumber(row.long_open_interest_balance_amount);
    shortOiAmount += toNumber(row.short_open_interest_balance_amount);
  });

  return {
    hasData: true,
    date: latestRows[0]?.date || "",
    txInstitutionalLongAmount: longAmount,
    txInstitutionalShortAmount: shortAmount,
    txInstitutionalNetAmount: longAmount - shortAmount,
    txInstitutionalLongVolume: longVolume,
    txInstitutionalShortVolume: shortVolume,
    txInstitutionalNetVolume: longVolume - shortVolume,
    txOpenInterestLongAmount: longOiAmount,
    txOpenInterestShortAmount: shortOiAmount,
    txOpenInterestNetAmount: longOiAmount - shortOiAmount,
  };
}

function summarizeOptionDaily(rows: any[]) {
  const latestRows = latestDateRows(rows);
  if (!latestRows.length) return { hasData: false };

  let callVolume = 0;
  let putVolume = 0;
  let callOpenInterest = 0;
  let putOpenInterest = 0;

  latestRows.forEach((row) => {
    const callPut = String(row.call_put || row.PutCall || "").toLowerCase();
    const volume = toNumber(row.volume);
    const oi = toNumber(row.open_interest);

    if (callPut.includes("call") || callPut === "c") {
      callVolume += volume;
      callOpenInterest += oi;
    }
    if (callPut.includes("put") || callPut === "p") {
      putVolume += volume;
      putOpenInterest += oi;
    }
  });

  return {
    hasData: true,
    date: latestRows[0]?.date || "",
    optionCallVolume: callVolume,
    optionPutVolume: putVolume,
    putCallVolumeRatio: callVolume > 0 ? Number((putVolume / callVolume).toFixed(3)) : null,
    optionCallOpenInterest: callOpenInterest,
    optionPutOpenInterest: putOpenInterest,
    putCallOpenInterestRatio: callOpenInterest > 0 ? Number((putOpenInterest / callOpenInterest).toFixed(3)) : null,
  };
}

function summarizeOptionInstitutional(rows: any[]) {
  const latestRows = latestDateRows(rows);
  if (!latestRows.length) return { hasData: false };

  let callLongAmount = 0;
  let callShortAmount = 0;
  let putLongAmount = 0;
  let putShortAmount = 0;

  latestRows.forEach((row) => {
    const callPut = String(row.call_put || row.PutCall || "").toLowerCase();
    const longAmount = toNumber(row.long_deal_amount);
    const shortAmount = toNumber(row.short_deal_amount);

    if (callPut.includes("call") || callPut === "c") {
      callLongAmount += longAmount;
      callShortAmount += shortAmount;
    }
    if (callPut.includes("put") || callPut === "p") {
      putLongAmount += longAmount;
      putShortAmount += shortAmount;
    }
  });

  return {
    hasData: true,
    date: latestRows[0]?.date || "",
    optionCallNetAmount: callLongAmount - callShortAmount,
    optionPutNetAmount: putLongAmount - putShortAmount,
    optionInstitutionalNetBias: (callLongAmount - callShortAmount) - (putLongAmount - putShortAmount),
  };
}


function buildDerivativesDataTimeSummary(derivatives: any) {
  return {
    futuresDate: derivatives?.futures?.date || null,
    futuresAfterMarketDate: derivatives?.futures?.afterMarket?.date || null,
    futuresInstitutionalDate: derivatives?.futuresInstitutional?.date || null,
    optionDate: derivatives?.options?.date || null,
    optionInstitutionalDate: derivatives?.optionInstitutional?.date || null,
    note: "FinMind Derivatives source data dates, not fetch/cache timestamps.",
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
  const futuresId = searchParams.get("futures_id") || "TX";
  const optionId = searchParams.get("option_id") || "TXO";
  const startDate = searchParams.get("start_date") || daysAgo(14);
  const endDate = searchParams.get("end_date") || yyyyMmDd(new Date());

  const [
    futOptInfo,
    futuresDaily,
    optionDaily,
    futuresInstitutional,
    optionInstitutional,
    futuresDealer,
    optionDealer,
  ] = await Promise.all([
    fetchFinMindSafe("TaiwanFutOptDailyInfo", {}, token),
    fetchFinMindSafe("TaiwanFuturesDaily", { data_id: futuresId, start_date: startDate, end_date: endDate }, token),
    fetchFinMindSafe("TaiwanOptionDaily", { data_id: optionId, start_date: startDate, end_date: endDate }, token),
    fetchFinMindSafe("TaiwanFuturesInstitutionalInvestors", { data_id: futuresId, start_date: startDate, end_date: endDate }, token),
    fetchFinMindSafe("TaiwanOptionInstitutionalInvestors", { data_id: optionId, start_date: startDate, end_date: endDate }, token),
    fetchFinMindSafe("TaiwanFuturesDealerTradingVolumeDaily", { data_id: futuresId, start_date: startDate, end_date: endDate }, token),
    fetchFinMindSafe("TaiwanOptionDealerTradingVolumeDaily", { data_id: optionId, start_date: startDate, end_date: endDate }, token),
  ]);

  const futures = summarizeFuturesDaily(futuresDaily.data);
  const futuresInst = summarizeFuturesInstitutional(futuresInstitutional.data);
  const options = summarizeOptionDaily(optionDaily.data);
  const optionInst = summarizeOptionInstitutional(optionInstitutional.data);

  const afterSpreadPer = futures?.afterMarket?.spreadPer ?? null;
  const regularSpreadPer = futures?.spreadPer ?? null;

const derivativesPayload = {
    futuresId,
    optionId,
    futures,
    futuresInstitutional: futuresInst,
    options,
    optionInstitutional: optionInst,
    derived: {
      taifexAfterHoursReturn: afterSpreadPer,
      futuresSpreadPer: regularSpreadPer,
      futuresInstitutionalNetAmount: futuresInst?.txInstitutionalNetAmount ?? null,
      futuresInstitutionalNetVolume: futuresInst?.txInstitutionalNetVolume ?? null,
      futuresOpenInterestNetAmount: futuresInst?.txOpenInterestNetAmount ?? null,
      putCallVolumeRatio: options?.putCallVolumeRatio ?? null,
      putCallOpenInterestRatio: options?.putCallOpenInterestRatio ?? null,
      optionInstitutionalNetBias: optionInst?.optionInstitutionalNetBias ?? null,
    },
  };

  return NextResponse.json({
    ok: true,
    source: "finmind_derivatives_proxy",
    tokenSource,
    dataTimeSummary: buildDerivativesDataTimeSummary(derivativesPayload),
    derivatives: derivativesPayload,
    datasetStatus: {
      TaiwanFutOptDailyInfo: futOptInfo.ok,
      TaiwanFuturesDaily: futuresDaily.ok,
      TaiwanOptionDaily: optionDaily.ok,
      TaiwanFuturesInstitutionalInvestors: futuresInstitutional.ok,
      TaiwanOptionInstitutionalInvestors: optionInstitutional.ok,
      TaiwanFuturesDealerTradingVolumeDaily: futuresDealer.ok,
      TaiwanOptionDealerTradingVolumeDaily: optionDealer.ok,
    },
    rawCounts: {
      TaiwanFutOptDailyInfo: futOptInfo.data.length,
      TaiwanFuturesDaily: futuresDaily.data.length,
      TaiwanOptionDaily: optionDaily.data.length,
      TaiwanFuturesInstitutionalInvestors: futuresInstitutional.data.length,
      TaiwanOptionInstitutionalInvestors: optionInstitutional.data.length,
      TaiwanFuturesDealerTradingVolumeDaily: futuresDealer.data.length,
      TaiwanOptionDealerTradingVolumeDaily: optionDealer.data.length,
    },
    fieldErrors: {
      TaiwanFutOptDailyInfo: futOptInfo.error,
      TaiwanFuturesDaily: futuresDaily.error,
      TaiwanOptionDaily: optionDaily.error,
      TaiwanFuturesInstitutionalInvestors: futuresInstitutional.error,
      TaiwanOptionInstitutionalInvestors: optionInstitutional.error,
      TaiwanFuturesDealerTradingVolumeDaily: futuresDealer.error,
      TaiwanOptionDealerTradingVolumeDaily: optionDealer.error,
    },
    fetchedAt: new Date().toISOString(),
    requestCostHint: {
      defaultRequests: 7,
      note: "Derivative route uses free daily / institutional datasets first. Tick and snapshot sponsor-only datasets are intentionally excluded.",
    },
  });
}


export async function GET(request: Request) {
  const wrapperStartedAt = new Date().toISOString();
  const url = new URL(request.url);
  const force = isForceRefresh(url.searchParams);
  const cacheTtlMs = parseTtlMs(url.searchParams, 60 * 60 * 1000);
  const cacheKey = buildRouteCacheKey("finmind_derivatives_v03", request.url);

  try {
    const cached = await getOrFetchCached({
      key: cacheKey,
      ttlMs: cacheTtlMs,
      force,
      meta: { route: "/api/finmind/derivatives", policy: "FinMind Derivatives 1h TTL" },
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
          route: "/api/finmind/derivatives",
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
        route: "/api/finmind/derivatives",
        cachePolicy: { build: CACHE_BUILD_VERSION, kind: "ttl", ttlMs: cacheTtlMs, force },
        wrapperStartedAt,
        wrapperFinishedAt: new Date().toISOString(),
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

