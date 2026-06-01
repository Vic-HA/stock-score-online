// @ts-nocheck
import { NextResponse } from "next/server";
import { getOrFetchCached, isForceRefresh, parseTtlMs } from "@/lib/serverCache";

export const dynamic = "force-dynamic";

const CACHE_BUILD_VERSION = "CACHE_BUILD_02H_SCORE_FUNDAMENTAL_AUTO_HYDRATE";

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

const globalFinMindStocksStale = globalThis as typeof globalThis & {
  __finmindStocksLastGoodCache?: Map<string, any>;
  __finmindStocksLastGoodFullBySymbol?: Map<string, any>;
};

const finmindStocksLastGoodStore =
  globalFinMindStocksStale.__finmindStocksLastGoodCache || new Map<string, any>();
const finmindStocksLastGoodFullBySymbol =
  globalFinMindStocksStale.__finmindStocksLastGoodFullBySymbol || new Map<string, any>();

globalFinMindStocksStale.__finmindStocksLastGoodCache = finmindStocksLastGoodStore;
globalFinMindStocksStale.__finmindStocksLastGoodFullBySymbol = finmindStocksLastGoodFullBySymbol;

function makeStaleCacheMeta(key: string, entry: any, ttlMs: number, upstreamError: any) {
  const now = Date.now();
  const createdAt = Number(entry?.createdAt || now);
  const ageSec = Math.max(0, Math.round((now - createdAt) / 1000));

  return {
    hit: true,
    stale: true,
    fallback: "last_good_on_error",
    key,
    ageSec,
    ttlSec: Math.max(0, Math.round(Number(ttlMs || 0) / 1000)),
    expiresInSec: 0,
    createdAt: new Date(createdAt).toISOString(),
    expiresAt: new Date(createdAt + Number(ttlMs || 0)).toISOString(),
    policy: "ttl_stale_if_error",
    upstreamError: upstreamError?.message || String(upstreamError || ""),
  };
}

function saveFinMindStocksLastGood(key: string, payload: any, quality: any) {
  finmindStocksLastGoodStore.set(key, {
    payload,
    quality,
    createdAt: Date.now(),
  });
}

function getFinMindStocksLastGood(key: string) {
  return finmindStocksLastGoodStore.get(key) || null;
}



function normalizeFinMindProfile(value: string | null) {
  const raw = String(value || "full").trim().toLowerCase();
  if (raw === "score" || raw === "short" || raw === "short_score") return "score";
  if (raw === "fundamental" || raw === "fundamentals" || raw === "long") return "fundamental";
  return "full";
}

const FINMIND_PROFILE_DATASETS: Record<string, string[]> = {
  full: [
    "TaiwanStockPrice",
    "TaiwanStockPER",
    "TaiwanStockInstitutionalInvestorsBuySell",
    "TaiwanStockMarginPurchaseShortSale",
    "TaiwanStockMonthRevenue",
    "TaiwanStockFinancialStatements",
    "TaiwanStockBalanceSheet",
  ],
  score: [
    "TaiwanStockPrice",
    "TaiwanStockInstitutionalInvestorsBuySell",
    "TaiwanStockMarginPurchaseShortSale",
  ],
  fundamental: [
    "TaiwanStockMonthRevenue",
    "TaiwanStockFinancialStatements",
    "TaiwanStockBalanceSheet",
    "TaiwanStockPER",
  ],
};

function makeSkippedResult(dataset: string, profile: string) {
  return {
    ok: false,
    data: [],
    error: `SKIPPED_BY_PROFILE:${profile}:${dataset}`,
  };
}

function getLastGoodFullStock(symbol: string) {
  return finmindStocksLastGoodFullBySymbol.get(String(symbol || "").toUpperCase()) || null;
}

function saveLastGoodFullStock(stock: any) {
  const symbol = String(stock?.symbol || stock?.stock_id || "").toUpperCase();
  if (!symbol) return;
  finmindStocksLastGoodFullBySymbol.set(symbol, {
    ...stock,
    lastGoodFullSavedAt: new Date().toISOString(),
  });
}

function saveLastGoodFullPayload(payload: any) {
  const stocks = Array.isArray(payload?.stocks) ? payload.stocks : [];
  stocks.forEach(saveLastGoodFullStock);
}

const SCORE_FIELD_KEYS = [
  "dailyClose", "dailyOpen", "dailyHigh", "dailyLow", "dailyPrevClose", "dailyVolume",
  "high20", "low20", "avgVolume10", "volume10maFinMind", "avgVolume20", "ma5", "ma20", "ma60", "rsi14", "return20d", "return60d",
  "priceRowCount", "technicalWarmupStatus",
  "macd", "macdSignal", "macdHist", "macdHistPrev1", "macdHistPrev3", "macdHistDelta3", "macdHistTrend3", "macdState", "macdWarmupReady",
  "k9", "d9", "j9", "k9Prev1", "d9Prev1", "kdDiff", "kdDiffPrev1", "kdDiffTrend3", "kdCross", "kdState", "kdWarmupReady",
  "atr14", "atrPct", "atrPctAvg20", "atrPctVsAvg20", "volatilityState", "atrWarmupReady",
  "institutionalUpdatedAt", "foreign3d", "trust3d", "dealer3d", "institutional3d", "foreign20d", "trust20d", "dealer20d", "institutional20d",
  "marginUpdatedAt", "marginPurchaseBuy", "marginPurchaseSell", "marginPurchaseTodayBalance", "marginPurchaseYesterdayBalance", "marginChange5dPct", "marginChange20dPct",
  "shortSaleBuy", "shortSaleSell", "shortSaleTodayBalance", "shortSaleYesterdayBalance", "shortSaleChange5dPct", "shortSaleChange20dPct",
];

const FUNDAMENTAL_FIELD_KEYS = [
  "revenueUpdatedAt", "revenueLatest", "revenueMonth", "revenueYear", "revenueMoM", "revenueYoY",
  "financialUpdatedAt", "financialQuarterCount", "eps", "epsTtm", "epsGrowthYoY", "epsTtmGrowthYoY",
  "grossProfit", "operatingIncome", "financialRevenue", "incomeAfterTaxes", "incomeAfterTaxesTtm",
  "grossMargin", "grossMarginQoQ", "operatingMargin", "operatingMarginQoQ", "netMargin", "netMarginQoQ",
  "balanceUpdatedAt", "totalAssets", "totalLiabilities", "equity", "debtRatio", "roeTtm", "roe",
];

const VALUATION_FIELD_KEYS = ["per", "pbr", "dividendYield"];

function copyFieldsFromLastGood(target: any, lastGood: any, keys: string[]) {
  keys.forEach((key) => {
    if (lastGood && lastGood[key] !== undefined && lastGood[key] !== null) {
      target[key] = lastGood[key];
    }
  });
}


function latestDateFromRows(rows: any[], dateKeys = ["date", "Date"]) {
  const dates = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      for (const key of dateKeys) {
        const value = row?.[key];
        if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
      }
      return "";
    })
    .filter(Boolean)
    .sort();

  return dates[dates.length - 1] || null;
}

function normalizeYearMonthFromDate(value: any) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const dash = raw.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/);
  if (dash) return `${dash[1]}-${String(dash[2]).padStart(2, "0")}`;

  const compact = raw.match(/^(\d{4})(\d{2})(?:\d{2})?$/);
  if (compact) return `${compact[1]}-${compact[2]}`;

  return raw;
}

function quarterFromDate(value: any) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const dash = raw.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/);
  if (dash) {
    const month = Number(dash[2]);
    if (Number.isFinite(month) && month > 0) return `${dash[1]}Q${Math.ceil(month / 3)}`;
  }

  const compact = raw.match(/^(\d{4})(\d{2})(?:\d{2})?$/);
  if (compact) {
    const month = Number(compact[2]);
    if (Number.isFinite(month) && month > 0) return `${compact[1]}Q${Math.ceil(month / 3)}`;
  }

  return raw;
}

function latestRevenueMonth(rows: any[]) {
  const sorted = latestRowsByDate(rows);
  const latest = sorted[sorted.length - 1] || {};
  if (latest?.revenue_year && latest?.revenue_month) {
    return `${latest.revenue_year}-${String(latest.revenue_month).padStart(2, "0")}`;
  }

  return normalizeYearMonthFromDate(latestDateFromRows(sorted));
}

function latestQuarterMeta(rows: any[]) {
  const latest = latestDateFromRows(rows);
  return {
    date: latest,
    quarter: quarterFromDate(latest),
  };
}

function mergeDataTimeWithLastGood(current: any, lastGoodFullStock: any) {
  const previous = lastGoodFullStock?.dataTime || {};
  return {
    priceDate: current.priceDate || previous.priceDate || null,
    institutionalDate: current.institutionalDate || previous.institutionalDate || null,
    marginDate: current.marginDate || previous.marginDate || null,
    perDate: current.perDate || previous.perDate || null,
    revenueMonth: current.revenueMonth || previous.revenueMonth || null,
    financialDate: current.financialDate || previous.financialDate || null,
    financialQuarter: current.financialQuarter || previous.financialQuarter || null,
    balanceDate: current.balanceDate || previous.balanceDate || null,
    balanceQuarter: current.balanceQuarter || previous.balanceQuarter || null,
  };
}

function buildFinMindDataTimeFromRows({
  priceRows,
  perRows,
  institutionalRows,
  marginRows,
  revenueRows,
  financialRows,
  balanceRows,
  lastGoodFullStock,
}: {
  priceRows: any[];
  perRows: any[];
  institutionalRows: any[];
  marginRows: any[];
  revenueRows: any[];
  financialRows: any[];
  balanceRows: any[];
  lastGoodFullStock?: any;
}) {
  const financial = latestQuarterMeta(financialRows);
  const balance = latestQuarterMeta(balanceRows);

  return mergeDataTimeWithLastGood(
    {
      priceDate: latestDateFromRows(priceRows),
      institutionalDate: latestDateFromRows(institutionalRows),
      marginDate: latestDateFromRows(marginRows),
      perDate: latestDateFromRows(perRows),
      revenueMonth: latestRevenueMonth(revenueRows),
      financialDate: financial.date,
      financialQuarter: financial.quarter,
      balanceDate: balance.date,
      balanceQuarter: balance.quarter,
    },
    lastGoodFullStock
  );
}

function buildProfileDataTime(dataTime: any) {
  const scoreDates = [
    dataTime?.priceDate,
    dataTime?.institutionalDate,
    dataTime?.marginDate,
  ].filter(Boolean).sort();

  return {
    score: scoreDates[scoreDates.length - 1] || null,
    fundamental: [dataTime?.revenueMonth, dataTime?.financialQuarter, dataTime?.balanceQuarter]
      .filter(Boolean)
      .join(" / ") || null,
  };
}

function buildDataFreshness(profile: string, stock: any) {
  const normalized = normalizeFinMindProfile(profile);
  let note = "Full profile updated score and fundamental datasets. Times shown are data dates, not fetch/cache time.";

  if (normalized === "score") {
    note = stock?.staleFundamental
      ? "Score datasets were refreshed; fundamental fields are carried forward from lastGoodFull. Times shown are data dates, not fetch/cache time."
      : "Score datasets were refreshed. Times shown are data dates, not fetch/cache time.";
  } else if (normalized === "fundamental") {
    note = stock?.staleScore
      ? "Fundamental datasets were refreshed; score fields are carried forward from lastGoodFull. Times shown are data dates, not fetch/cache time."
      : "Fundamental datasets were refreshed. Times shown are data dates, not fetch/cache time.";
  }

  return {
    profile: normalized,
    staleScore: Boolean(stock?.staleScore),
    staleFundamental: Boolean(stock?.staleFundamental),
    mergedFromLastGoodFull: Boolean(stock?.mergedFromLastGoodFull),
    note,
  };
}


function mergeProfileStockWithLastGood(stock: any, profile: string) {
  const normalized = normalizeFinMindProfile(profile);
  const lastGood = getLastGoodFullStock(stock?.symbol || stock?.stock_id);
  const merged = { ...stock };

  if (normalized === "full") {
    merged.staleFundamental = false;
    merged.staleScore = false;
    merged.mergedFromLastGoodFull = false;
    return merged;
  }

  if (!lastGood) {
    merged.mergedFromLastGoodFull = false;
    merged.profileMergeWarning = "NO_LAST_GOOD_FULL_AVAILABLE";
    if (normalized === "score") merged.staleFundamental = true;
    if (normalized === "fundamental") merged.staleScore = true;
    return merged;
  }

  if (normalized === "score") {
    copyFieldsFromLastGood(merged, lastGood, [...FUNDAMENTAL_FIELD_KEYS, ...VALUATION_FIELD_KEYS]);
    merged.staleFundamental = true;
    merged.staleScore = false;
  }

  if (normalized === "fundamental") {
    copyFieldsFromLastGood(merged, lastGood, [...SCORE_FIELD_KEYS, ...VALUATION_FIELD_KEYS]);
    merged.staleFundamental = false;
    merged.staleScore = true;
  }

  merged.mergedFromLastGoodFull = true;
  merged.lastGoodFullUpdatedAt = lastGood.updatedAt || lastGood.lastGoodFullSavedAt || null;
  return merged;
}



const FINMIND_API_URL = "https://api.finmindtrade.com/api/v4/data";
const DEFAULT_SYMBOLS = ["2330", "0050"];

function yyyyMmDd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return yyyyMmDd(date);
}

function parseSymbols(input: string | null) {
  const raw = input || DEFAULT_SYMBOLS.join(",");

  return raw
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 50);
}

function toNumber(value: unknown, fallback = 0) {
  const raw = String(value ?? "").replace(/,/g, "").trim();

  if (!raw || raw === "-" || raw === "--" || raw.toUpperCase() === "N/A") {
    return fallback;
  }

  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function toOptionalNumber(value: unknown) {
  const raw = String(value ?? "").replace(/,/g, "").trim();

  if (!raw || raw === "-" || raw === "--" || raw.toUpperCase() === "N/A") {
    return null;
  }

  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function average(values: number[]) {
  const clean = values.filter((x) => Number.isFinite(x));

  if (!clean.length) return 0;

  return clean.reduce((sum, x) => sum + x, 0) / clean.length;
}

function calcPctChange(current: number | null, previous: number | null) {
  if (!Number.isFinite(Number(current)) || !Number.isFinite(Number(previous)) || Number(previous) === 0) {
    return null;
  }

  return Number((((Number(current) - Number(previous)) / Number(previous)) * 100).toFixed(2));
}

function calcRsi(closes: number[], period = 14) {
  if (closes.length <= period) return 50;

  const recent = closes.slice(-(period + 1));
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < recent.length; i += 1) {
    const diff = recent[i] - recent[i - 1];

    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return Math.max(0, Math.min(100, 100 - 100 / (1 + rs)));
}


function roundOptional(value: unknown, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(digits));
}

function calcEmaSeries(values: number[], period: number) {
  const clean = values.map(Number).filter(Number.isFinite);
  if (clean.length < period) return [];

  const multiplier = 2 / (period + 1);
  const ema: number[] = [];
  let previous = average(clean.slice(0, period));

  for (let i = 0; i < clean.length; i += 1) {
    if (i < period - 1) {
      ema.push(null as any);
      continue;
    }

    if (i === period - 1) {
      ema.push(previous);
      continue;
    }

    previous = (clean[i] - previous) * multiplier + previous;
    ema.push(previous);
  }

  return ema;
}

function calcMacd(closes: number[]) {
  const rowCount = Array.isArray(closes) ? closes.length : 0;
  if (!Array.isArray(closes) || rowCount < 35) {
    return {
      macd: null,
      macdSignal: null,
      macdHist: null,
      macdHistPrev1: null,
      macdHistPrev3: null,
      macdHistDelta3: null,
      macdHistTrend3: "資料不足",
      macdState: "資料不足",
      macdWarmupReady: false,
    };
  }

  const ema12 = calcEmaSeries(closes, 12);
  const ema26 = calcEmaSeries(closes, 26);
  const diffs = closes.map((_, index) => {
    const fast = ema12[index];
    const slow = ema26[index];
    return Number.isFinite(fast) && Number.isFinite(slow) ? fast - slow : null;
  });

  const validDiffs = diffs.filter((x) => Number.isFinite(Number(x))).map(Number);
  if (validDiffs.length < 9) {
    return {
      macd: null,
      macdSignal: null,
      macdHist: null,
      macdHistPrev1: null,
      macdHistPrev3: null,
      macdHistDelta3: null,
      macdHistTrend3: "資料不足",
      macdState: "資料不足",
      macdWarmupReady: false,
    };
  }

  const signalCompact = calcEmaSeries(validDiffs, 9);
  const histSeries = validDiffs.map((macd, index) => {
    const signal = signalCompact[index];
    return Number.isFinite(signal) ? macd - signal : null;
  });

  const latestMacd = validDiffs[validDiffs.length - 1];
  const previousMacd = validDiffs[validDiffs.length - 2] ?? latestMacd;
  const latestSignal = signalCompact[signalCompact.length - 1];
  const previousSignal = signalCompact[signalCompact.length - 2] ?? latestSignal;
  const latestHist = histSeries[histSeries.length - 1];
  const previousHist = histSeries[histSeries.length - 2] ?? latestHist;
  const prev3Hist = histSeries.length > 3 ? histSeries[histSeries.length - 4] : previousHist;
  const histDelta3 = Number.isFinite(Number(latestHist)) && Number.isFinite(Number(prev3Hist))
    ? Number(latestHist) - Number(prev3Hist)
    : null;

  const recentHist = histSeries.slice(-4).filter((x) => Number.isFinite(Number(x))).map(Number);
  let macdHistTrend3 = "中性";
  if (recentHist.length >= 4) {
    const deltas = recentHist.slice(1).map((value, index) => value - recentHist[index]);
    const up = deltas.filter((x) => x > 0).length;
    const down = deltas.filter((x) => x < 0).length;
    if (up >= 2) macdHistTrend3 = "3日擴大";
    else if (down >= 2) macdHistTrend3 = "3日收斂";
  }

  let macdState = "中性整理";
  if (Number.isFinite(latestMacd) && Number.isFinite(latestSignal) && Number.isFinite(Number(latestHist))) {
    if (previousHist !== null && previousHist <= 0 && Number(latestHist) > 0) macdState = "趨勢剛轉強";
    else if (previousHist !== null && previousHist >= 0 && Number(latestHist) < 0) macdState = "趨勢剛轉弱";
    else if (Number(latestHist) > 0 && macdHistTrend3 === "3日擴大") macdState = "多方動能擴大";
    else if (Number(latestHist) > 0) macdState = "多方動能收斂";
    else if (Number(latestHist) < 0 && macdHistTrend3 === "3日收斂") macdState = "空方動能收斂";
    else if (Number(latestHist) < 0) macdState = "空方動能擴大";
  }

  return {
    macd: roundOptional(latestMacd, 3),
    macdSignal: roundOptional(latestSignal, 3),
    macdHist: roundOptional(latestHist, 3),
    macdHistPrev1: roundOptional(previousHist, 3),
    macdHistPrev3: roundOptional(prev3Hist, 3),
    macdHistDelta3: roundOptional(histDelta3, 3),
    macdHistTrend3,
    macdState,
    macdWarmupReady: rowCount >= 100,
  };
}

function calcKd(rows: Array<{ max: number; min: number; close: number }>, period = 9) {
  const rowCount = Array.isArray(rows) ? rows.length : 0;
  if (!Array.isArray(rows) || rowCount < period) {
    return {
      k9: null,
      d9: null,
      j9: null,
      k9Prev1: null,
      d9Prev1: null,
      kdDiff: null,
      kdDiffPrev1: null,
      kdDiffTrend3: "資料不足",
      kdCross: "資料不足",
      kdState: "資料不足",
      kdWarmupReady: false,
    };
  }

  let k = 50;
  let d = 50;
  const series: Array<{ k: number; d: number; j: number }> = [];

  for (let i = 0; i < rows.length; i += 1) {
    const window = rows.slice(Math.max(0, i - period + 1), i + 1);
    if (window.length < period) continue;

    const high = Math.max(...window.map((row) => row.max));
    const low = Math.min(...window.map((row) => row.min));
    const close = rows[i].close;
    const rsv = high !== low ? ((close - low) / (high - low)) * 100 : 50;

    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
    series.push({ k, d, j: 3 * k - 2 * d });
  }

  const latest = series[series.length - 1];
  const previous = series[series.length - 2] || latest;
  if (!latest) {
    return {
      k9: null,
      d9: null,
      j9: null,
      k9Prev1: null,
      d9Prev1: null,
      kdDiff: null,
      kdDiffPrev1: null,
      kdDiffTrend3: "資料不足",
      kdCross: "資料不足",
      kdState: "資料不足",
      kdWarmupReady: false,
    };
  }

  const diff = latest.k - latest.d;
  const prevDiff = previous.k - previous.d;
  const recentDiffs = series.slice(-3).map((x) => x.k - x.d);
  const positiveDays = recentDiffs.filter((x) => x > 0).length;
  const negativeDays = recentDiffs.filter((x) => x < 0).length;
  const kdDiffTrend3 = positiveDays >= 2 ? "3日偏多" : negativeDays >= 2 ? "3日偏弱" : "中性";
  const kdCross = prevDiff <= 0 && diff > 0 ? "K上穿D" : prevDiff >= 0 && diff < 0 ? "K下穿D" : "未交叉";

  let kdState = "中性整理";
  if (latest.k >= 80 && latest.d >= 80 && kdCross === "K下穿D") kdState = "高檔轉弱";
  else if (latest.k >= 80 && latest.d >= 80 && diff >= 0) kdState = "高檔強勢";
  else if (latest.k <= 20 && latest.d <= 20 && kdCross === "K上穿D") kdState = "低檔轉強";
  else if (latest.k <= 20 && latest.d <= 20 && diff < 0) kdState = "低檔弱勢";
  else if (kdCross === "K下穿D" && latest.k > 20 && latest.k < 80 && latest.d > 20 && latest.d < 80) kdState = "短線轉弱";
  else if (kdCross === "K上穿D" && latest.k > 20 && latest.k < 80 && latest.d > 20 && latest.d < 80) kdState = "短線轉強";
  else if (diff > 0 && kdDiffTrend3 === "3日偏多") kdState = "短線偏多";
  else if (diff > 0) kdState = latest.k <= 30 || latest.d <= 30 ? "低檔轉強" : "短線轉強";
  else if (diff < 0 && kdDiffTrend3 === "3日偏弱") kdState = "短線偏弱";
  else if (diff < 0) kdState = latest.k >= 80 || latest.d >= 80 ? "高檔轉弱" : "短線轉弱";

  return {
    k9: roundOptional(latest.k, 1),
    d9: roundOptional(latest.d, 1),
    j9: roundOptional(latest.j, 1),
    k9Prev1: roundOptional(previous.k, 1),
    d9Prev1: roundOptional(previous.d, 1),
    kdDiff: roundOptional(diff, 2),
    kdDiffPrev1: roundOptional(prevDiff, 2),
    kdDiffTrend3,
    kdCross,
    kdState,
    kdWarmupReady: rowCount >= 40,
  };
}

function calcAtr(rows: Array<{ max: number; min: number; close: number }>, period = 14) {
  const rowCount = Array.isArray(rows) ? rows.length : 0;
  if (!Array.isArray(rows) || rowCount <= period) {
    return {
      atr14: null,
      atrPct: null,
      atrPctAvg20: null,
      atrPctVsAvg20: null,
      volatilityState: "資料不足",
      atrWarmupReady: false,
    };
  }

  const trs: number[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const high = Number(rows[i].max);
    const low = Number(rows[i].min);
    const prevClose = Number(rows[i - 1].close);

    if (![high, low, prevClose].every(Number.isFinite)) continue;

    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }

  if (trs.length < period) {
    return {
      atr14: null,
      atrPct: null,
      atrPctAvg20: null,
      atrPctVsAvg20: null,
      volatilityState: "資料不足",
      atrWarmupReady: false,
    };
  }

  let atr = average(trs.slice(0, period));
  const atrSeries: number[] = [];
  for (let i = period; i < trs.length; i += 1) {
    atr = ((atr * (period - 1)) + trs[i]) / period;
    atrSeries.push(atr);
  }

  const latestClose = rows[rows.length - 1]?.close;
  const atrPct = latestClose ? (atr / latestClose) * 100 : null;
  const atrPctSeries = atrSeries.map((value, index) => {
    const rowIndex = index + period + 1;
    const close = rows[rowIndex]?.close;
    return close ? (value / close) * 100 : null;
  }).filter((x) => Number.isFinite(Number(x))).map(Number);
  const atrPctAvg20 = atrPctSeries.length >= 20 ? average(atrPctSeries.slice(-20)) : null;
  const atrPctVsAvg20 = Number.isFinite(Number(atrPct)) && Number.isFinite(Number(atrPctAvg20)) && Number(atrPctAvg20) > 0
    ? ((Number(atrPct) - Number(atrPctAvg20)) / Number(atrPctAvg20)) * 100
    : null;

  let volatilityState = "波動正常";
  if (Number.isFinite(Number(atrPctVsAvg20))) {
    if (Number(atrPctVsAvg20) > 50) volatilityState = "波動過大";
    else if (Number(atrPctVsAvg20) > 20) volatilityState = "波動升高";
    else if (Number(atrPctVsAvg20) < -25) volatilityState = "波動低";
    else volatilityState = "波動正常";
  } else if (Number.isFinite(Number(atrPct))) {
    if (Number(atrPct) < 1.5) volatilityState = "波動低";
    else if (Number(atrPct) <= 3.5) volatilityState = "波動正常";
    else if (Number(atrPct) <= 5.5) volatilityState = "波動升高";
    else volatilityState = "波動過大";
  }

  return {
    atr14: roundOptional(atr, 2),
    atrPct: roundOptional(atrPct, 2),
    atrPctAvg20: roundOptional(atrPctAvg20, 2),
    atrPctVsAvg20: roundOptional(atrPctVsAvg20, 1),
    volatilityState,
    atrWarmupReady: rowCount >= 100,
  };
}

function getRequestToken(request: Request) {
  const userToken = request.headers.get("x-finmind-token") || "";
  const serverToken = process.env.FINMIND_TOKEN || "";

  return {
    token: userToken || serverToken,
    tokenSource: userToken ? "user_header" : serverToken ? "server_env" : "missing",
  };
}

async function fetchFinMind(
  dataset: string,
  params: Record<string, string>,
  token: string
) {
  const url = new URL(FINMIND_API_URL);

  url.searchParams.set("dataset", dataset);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      `${dataset} HTTP ${res.status}: ${
        json?.msg || json?.message || "request failed"
      }`
    );
  }

  if (json?.status === 402 || json?.status === 403 || json?.status === 429) {
    throw new Error(
      `${dataset} FinMind status ${json.status}: ${
        json?.msg || json?.message || "limited or blocked"
      }`
    );
  }

  return Array.isArray(json?.data) ? json.data : [];
}

async function fetchFinMindSafe(
  dataset: string,
  params: Record<string, string>,
  token: string
) {
  try {
    const data = await fetchFinMind(dataset, params, token);
    return { ok: true, data, error: "" };
  } catch (error: any) {
    return {
      ok: false,
      data: [],
      error: error?.message || `${dataset} failed`,
    };
  }
}

function latestRowsByDate(rows: any[]) {
  return [...rows].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
}

function findRevenueYoY(rows: any[], latest: any) {
  if (!latest) return null;

  const month = Number(latest.revenue_month);
  const year = Number(latest.revenue_year);

  const prevYear = rows.find(
    (row) => Number(row.revenue_month) === month && Number(row.revenue_year) === year - 1
  );

  return prevYear ? calcPctChange(toNumber(latest.revenue), toNumber(prevYear.revenue)) : null;
}

function findRevenueMoM(rows: any[], latestIndex: number) {
  if (latestIndex <= 0) return null;

  const latest = rows[latestIndex];
  const previous = rows[latestIndex - 1];

  return calcPctChange(toNumber(latest.revenue), toNumber(previous.revenue));
}

function getLatestFinancialValue(rows: any[], type: string) {
  const matched = rows
    .filter((row) => String(row.type || "").toLowerCase() === type.toLowerCase())
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

  if (!matched.length) return null;

  return toOptionalNumber(matched[matched.length - 1].value);
}

function getSameQuarterPreviousYearFinancialValue(rows: any[], type: string) {
  const matched = rows
    .filter((row) => String(row.type || "").toLowerCase() === type.toLowerCase())
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

  if (matched.length < 2) return null;

  const latest = matched[matched.length - 1];
  const latestDate = new Date(latest.date);
  const targetYear = latestDate.getFullYear() - 1;
  const targetMonth = latestDate.getMonth();

  const previous = matched
    .slice()
    .reverse()
    .find((row) => {
      const d = new Date(row.date);
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    });

  return previous ? toOptionalNumber(previous.value) : null;
}

function pickFirstFinancialValue(rows: any[], types: string[]) {
  for (const type of types) {
    const value = getLatestFinancialValue(rows, type);
    if (value !== null) return value;
  }
  return null;
}

function getBalanceValue(rows: any[], typeCandidates: string[]) {
  const normalizedCandidates = typeCandidates.map((x) => x.toLowerCase());

  const matched = rows
    .filter((row) => normalizedCandidates.includes(String(row.type || "").toLowerCase()))
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

  if (!matched.length) return null;

  return toOptionalNumber(matched[matched.length - 1].value);
}

function summarizeInstitutionalRows(rows: any[]) {
  const sorted = latestRowsByDate(rows);
  const dateMap = new Map<string, any[]>();

  sorted.forEach((row) => {
    const date = String(row.date || "");
    if (!date) return;
    if (!dateMap.has(date)) dateMap.set(date, []);
    dateMap.get(date)?.push(row);
  });

  const dates = Array.from(dateMap.keys()).sort();
  const latestDate = dates[dates.length - 1] || "";
  const last3Dates = dates.slice(-3);
  const last20Dates = dates.slice(-20);

  const sumByNames = (selectedDates: string[], names: string[]) => {
    const nameSet = new Set(names);
    let total = 0;

    selectedDates.forEach((date) => {
      const dayRows = dateMap.get(date) || [];
      dayRows.forEach((row) => {
        if (nameSet.has(String(row.name))) {
          total += toNumber(row.buy) - toNumber(row.sell);
        }
      });
    });

    return total;
  };

  const foreignNames = ["Foreign_Investor", "Foreign_Dealer_Self"];
  const trustNames = ["Investment_Trust"];
  const dealerNames = ["Dealer_self", "Dealer_Hedging"];

  const foreign3d = sumByNames(last3Dates, foreignNames);
  const trust3d = sumByNames(last3Dates, trustNames);
  const dealer3d = sumByNames(last3Dates, dealerNames);

  const foreign20d = sumByNames(last20Dates, foreignNames);
  const trust20d = sumByNames(last20Dates, trustNames);
  const dealer20d = sumByNames(last20Dates, dealerNames);

  return {
    institutionalUpdatedAt: latestDate,
    foreign3d,
    trust3d,
    dealer3d,
    institutional3d: foreign3d + trust3d + dealer3d,
    foreign20d,
    trust20d,
    dealer20d,
    institutional20d: foreign20d + trust20d + dealer20d,
  };
}

function summarizeMarginRows(rows: any[]) {
  const sorted = latestRowsByDate(rows);
  if (!sorted.length) return {};

  const latest = sorted[sorted.length - 1];
  const row5 = sorted.length > 5 ? sorted[sorted.length - 6] : sorted[0];
  const row20 = sorted.length > 20 ? sorted[sorted.length - 21] : sorted[0];

  const latestMargin = toOptionalNumber(latest.MarginPurchaseTodayBalance);
  const margin5 = toOptionalNumber(row5.MarginPurchaseTodayBalance);
  const margin20 = toOptionalNumber(row20.MarginPurchaseTodayBalance);

  const latestShort = toOptionalNumber(latest.ShortSaleTodayBalance);
  const short5 = toOptionalNumber(row5.ShortSaleTodayBalance);
  const short20 = toOptionalNumber(row20.ShortSaleTodayBalance);

  return {
    marginUpdatedAt: latest.date || "",
    marginPurchaseBuy: toNumber(latest.MarginPurchaseBuy),
    marginPurchaseSell: toNumber(latest.MarginPurchaseSell),
    marginPurchaseTodayBalance: latestMargin,
    marginPurchaseYesterdayBalance: toOptionalNumber(latest.MarginPurchaseYesterdayBalance),
    marginChange5dPct: calcPctChange(latestMargin, margin5),
    marginChange20dPct: calcPctChange(latestMargin, margin20),
    shortSaleBuy: toNumber(latest.ShortSaleBuy),
    shortSaleSell: toNumber(latest.ShortSaleSell),
    shortSaleTodayBalance: latestShort,
    shortSaleYesterdayBalance: toOptionalNumber(latest.ShortSaleYesterdayBalance),
    shortSaleChange5dPct: calcPctChange(latestShort, short5),
    shortSaleChange20dPct: calcPctChange(latestShort, short20),
  };
}

function summarizeRevenueRows(rows: any[]) {
  const sorted = latestRowsByDate(rows);
  if (!sorted.length) return {};

  const latestIndex = sorted.length - 1;
  const latest = sorted[latestIndex];

  return {
    revenueUpdatedAt: latest.date || "",
    revenueLatest: toNumber(latest.revenue),
    revenueMonth: toNumber(latest.revenue_month),
    revenueYear: toNumber(latest.revenue_year),
    revenueMoM: findRevenueMoM(sorted, latestIndex),
    revenueYoY: findRevenueYoY(sorted, latest),
  };
}

function pickValueFromSnapshot(snapshot: any, typeCandidates: string[]) {
  const lower = new Map<string, any>();
  Object.keys(snapshot || {}).forEach((key) => lower.set(String(key).toLowerCase(), snapshot[key]));

  for (const type of typeCandidates) {
    const value = lower.get(String(type).toLowerCase());
    if (value !== null && value !== undefined && value !== "") return toOptionalNumber(value);
  }

  return null;
}

function buildFinancialQuarterSnapshots(rows: any[]) {
  const dateMap = new Map<string, any>();

  latestRowsByDate(rows).forEach((row) => {
    const date = String(row.date || "");
    const type = String(row.type || "");
    if (!date || !type) return;
    if (!dateMap.has(date)) dateMap.set(date, { date });
    dateMap.get(date)[type] = row.value;
  });

  return Array.from(dateMap.values())
    .map((snapshot) => {
      const eps = pickValueFromSnapshot(snapshot, ["EPS"]);
      const grossProfit = pickValueFromSnapshot(snapshot, ["GrossProfit"]);
      const operatingIncome = pickValueFromSnapshot(snapshot, [
        "OperatingIncome",
        "OperatingProfit",
        "NetOperatingIncome",
      ]);
      const revenue = pickValueFromSnapshot(snapshot, [
        "Revenue",
        "OperatingRevenue",
        "TotalRevenue",
        "Income",
      ]);
      const incomeAfterTaxes = pickValueFromSnapshot(snapshot, ["IncomeAfterTaxes"]);

      return {
        date: snapshot.date,
        eps,
        grossProfit,
        operatingIncome,
        financialRevenue: revenue,
        incomeAfterTaxes,
        grossMargin:
          revenue && grossProfit !== null
            ? Number(((Number(grossProfit) / Number(revenue)) * 100).toFixed(2))
            : null,
        operatingMargin:
          revenue && operatingIncome !== null
            ? Number(((Number(operatingIncome) / Number(revenue)) * 100).toFixed(2))
            : null,
        netMargin:
          revenue && incomeAfterTaxes !== null
            ? Number(((Number(incomeAfterTaxes) / Number(revenue)) * 100).toFixed(2))
            : null,
      };
    })
    .filter((snapshot) => snapshot.date)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
}

function sumRecentFinite(values: any[], limit: number) {
  const clean = values
    .filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)))
    .map((value) => Number(value));

  if (clean.length < limit) return null;
  return Number(clean.slice(-limit).reduce((sum, value) => sum + value, 0).toFixed(2));
}

function pointDelta(current: any, previous: any) {
  if (!Number.isFinite(Number(current)) || !Number.isFinite(Number(previous))) return null;
  return Number((Number(current) - Number(previous)).toFixed(2));
}

function summarizeFinancialRows(rows: any[]) {
  const sorted = latestRowsByDate(rows);
  if (!sorted.length) return {};

  const snapshots = buildFinancialQuarterSnapshots(sorted);
  const latest = snapshots[snapshots.length - 1] || {};
  const previous = snapshots[snapshots.length - 2] || {};
  const latestDate = latest?.date || sorted[sorted.length - 1]?.date || "";

  const eps = latest.eps ?? getLatestFinancialValue(sorted, "EPS");
  const epsPrevYear = getSameQuarterPreviousYearFinancialValue(sorted, "EPS");
  const epsSeries = snapshots.map((snapshot) => snapshot.eps);
  const incomeSeries = snapshots.map((snapshot) => snapshot.incomeAfterTaxes);
  const epsTtm = sumRecentFinite(epsSeries, 4);
  const previousEpsTtm = epsSeries.filter((value) => value !== null && value !== undefined).length >= 8
    ? Number(epsSeries.filter((value) => value !== null && value !== undefined).slice(-8, -4).reduce((sum, value) => sum + Number(value), 0).toFixed(2))
    : null;
  const incomeAfterTaxesTtm = sumRecentFinite(incomeSeries, 4);

  return {
    financialUpdatedAt: latestDate,
    financialQuarterCount: snapshots.length,
    eps,
    epsTtm,
    epsGrowthYoY: calcPctChange(eps, epsPrevYear),
    epsTtmGrowthYoY: calcPctChange(epsTtm, previousEpsTtm),
    grossProfit: latest.grossProfit ?? getLatestFinancialValue(sorted, "GrossProfit"),
    operatingIncome: latest.operatingIncome ?? pickFirstFinancialValue(sorted, [
      "OperatingIncome",
      "OperatingProfit",
      "NetOperatingIncome",
    ]),
    financialRevenue: latest.financialRevenue ?? pickFirstFinancialValue(sorted, [
      "Revenue",
      "OperatingRevenue",
      "TotalRevenue",
      "Income",
    ]),
    incomeAfterTaxes: latest.incomeAfterTaxes ?? getLatestFinancialValue(sorted, "IncomeAfterTaxes"),
    incomeAfterTaxesTtm,
    grossMargin: latest.grossMargin ?? null,
    grossMarginQoQ: pointDelta(latest.grossMargin, previous.grossMargin),
    operatingMargin: latest.operatingMargin ?? null,
    operatingMarginQoQ: pointDelta(latest.operatingMargin, previous.operatingMargin),
    netMargin: latest.netMargin ?? null,
    netMarginQoQ: pointDelta(latest.netMargin, previous.netMargin),
  };
}

function summarizeBalanceRows(rows: any[]) {
  const sorted = latestRowsByDate(rows);
  if (!sorted.length) return {};

  const latestDate = sorted[sorted.length - 1]?.date || "";
  const totalAssets = getBalanceValue(sorted, [
    "TotalAssets",
    "Assets",
  ]);
  const totalLiabilities = getBalanceValue(sorted, [
    "TotalLiabilities",
    "Liabilities",
  ]);
  const equity = getBalanceValue(sorted, [
    "Equity",
    "TotalEquity",
    "EquityAttributableToOwnersOfParent",
  ]);

  return {
    balanceUpdatedAt: latestDate,
    totalAssets,
    totalLiabilities,
    equity,
    debtRatio: totalAssets ? Number(((Number(totalLiabilities || 0) / Number(totalAssets)) * 100).toFixed(2)) : null,
  };
}

async function buildStock(symbol: string, token: string, profile = "full") {
  const endDate = yyyyMmDd(new Date());

  const startPrice = daysAgo(300);
  const startPer = daysAgo(180);
  const startChip = daysAgo(45);
  const startMargin = daysAgo(45);
  const startRevenue = daysAgo(500);
  const startFinancial = daysAgo(1200);

  const normalizedProfile = normalizeFinMindProfile(profile);
  const profileDatasets = new Set(FINMIND_PROFILE_DATASETS[normalizedProfile] || FINMIND_PROFILE_DATASETS.full);
  const wants = (dataset: string) => profileDatasets.has(dataset);

  const [
    priceResult,
    perResult,
    institutionalResult,
    marginResult,
    revenueResult,
    financialResult,
    balanceResult,
  ] = await Promise.all([
    wants("TaiwanStockPrice")
      ? fetchFinMindSafe(
          "TaiwanStockPrice",
          { data_id: symbol, start_date: startPrice, end_date: endDate },
          token
        )
      : Promise.resolve(makeSkippedResult("TaiwanStockPrice", normalizedProfile)),
    wants("TaiwanStockPER")
      ? fetchFinMindSafe(
          "TaiwanStockPER",
          { data_id: symbol, start_date: startPer, end_date: endDate },
          token
        )
      : Promise.resolve(makeSkippedResult("TaiwanStockPER", normalizedProfile)),
    wants("TaiwanStockInstitutionalInvestorsBuySell")
      ? fetchFinMindSafe(
          "TaiwanStockInstitutionalInvestorsBuySell",
          { data_id: symbol, start_date: startChip, end_date: endDate },
          token
        )
      : Promise.resolve(makeSkippedResult("TaiwanStockInstitutionalInvestorsBuySell", normalizedProfile)),
    wants("TaiwanStockMarginPurchaseShortSale")
      ? fetchFinMindSafe(
          "TaiwanStockMarginPurchaseShortSale",
          { data_id: symbol, start_date: startMargin, end_date: endDate },
          token
        )
      : Promise.resolve(makeSkippedResult("TaiwanStockMarginPurchaseShortSale", normalizedProfile)),
    wants("TaiwanStockMonthRevenue")
      ? fetchFinMindSafe(
          "TaiwanStockMonthRevenue",
          { data_id: symbol, start_date: startRevenue, end_date: endDate },
          token
        )
      : Promise.resolve(makeSkippedResult("TaiwanStockMonthRevenue", normalizedProfile)),
    wants("TaiwanStockFinancialStatements")
      ? fetchFinMindSafe(
          "TaiwanStockFinancialStatements",
          { data_id: symbol, start_date: startFinancial, end_date: endDate },
          token
        )
      : Promise.resolve(makeSkippedResult("TaiwanStockFinancialStatements", normalizedProfile)),
    wants("TaiwanStockBalanceSheet")
      ? fetchFinMindSafe(
          "TaiwanStockBalanceSheet",
          { data_id: symbol, start_date: startFinancial, end_date: endDate },
          token
        )
      : Promise.resolve(makeSkippedResult("TaiwanStockBalanceSheet", normalizedProfile)),
  ]);

  const priceRows = priceResult.data;
  const perRows = perResult.data;
  const institutionalRows = institutionalResult.data;
  const marginRows = marginResult.data;
  const revenueRows = revenueResult.data;
  const financialRows = financialResult.data;
  const balanceRows = balanceResult.data;

  const priceSorted = priceRows
    .map((row: any) => ({
      date: String(row.date || ""),
      stock_id: String(row.stock_id || symbol),
      open: toNumber(row.open, toNumber(row.close)),
      close: toNumber(row.close),
      max: toNumber(row.max, toNumber(row.close)),
      min: toNumber(row.min, toNumber(row.close)),
      Trading_Volume: toNumber(row.Trading_Volume || row.trading_volume || row.volume),
    }))
    .filter((row) => row.date && Number.isFinite(row.close) && row.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const latestPrice = priceSorted[priceSorted.length - 1] || null;
  const previousPrice = priceSorted[priceSorted.length - 2] || latestPrice;
  const last10 = priceSorted.slice(-10);
  const last20 = priceSorted.slice(-20);
  const closes = priceSorted.map((row) => row.close);
  const technicalIndicators = {
    ...calcMacd(closes),
    ...calcKd(priceSorted),
    ...calcAtr(priceSorted),
  };
  const priceRowCount = priceSorted.length;
  const technicalWarmupStatus = {
    priceRowCount,
    macdReady: priceRowCount >= 100,
    kdReady: priceRowCount >= 40,
    atrReady: priceRowCount >= 100,
    recommendedCalendarDays: 300,
  };

  const dailyClose = latestPrice?.close ?? null;
  const close20Ago =
    priceSorted.length > 20 ? priceSorted[priceSorted.length - 21].close : priceSorted[0]?.close;
  const close60Ago =
    priceSorted.length > 60 ? priceSorted[priceSorted.length - 61].close : priceSorted[0]?.close;

  const perLatest: any =
    Array.isArray(perRows) && perRows.length ? latestRowsByDate(perRows)[perRows.length - 1] : {};

  const institutional = summarizeInstitutionalRows(institutionalRows);
  const margin = summarizeMarginRows(marginRows);
  const revenue = summarizeRevenueRows(revenueRows);
  const financial = summarizeFinancialRows(financialRows);
  const balance = summarizeBalanceRows(balanceRows);
  const roeTtm =
    Number.isFinite(Number(financial.incomeAfterTaxesTtm)) &&
    Number(financial.incomeAfterTaxesTtm) !== 0 &&
    Number.isFinite(Number(balance.equity)) &&
    Number(balance.equity) !== 0
      ? Number(((Number(financial.incomeAfterTaxesTtm) / Number(balance.equity)) * 100).toFixed(2))
      : null;

  const fieldErrors = {
    TaiwanStockPrice: priceResult.error,
    TaiwanStockPER: perResult.error,
    TaiwanStockInstitutionalInvestorsBuySell: institutionalResult.error,
    TaiwanStockMarginPurchaseShortSale: marginResult.error,
    TaiwanStockMonthRevenue: revenueResult.error,
    TaiwanStockFinancialStatements: financialResult.error,
    TaiwanStockBalanceSheet: balanceResult.error,
  };

  const lastGoodFullStock = getLastGoodFullStock(symbol);
  const dataTime = buildFinMindDataTimeFromRows({
    priceRows,
    perRows,
    institutionalRows,
    marginRows,
    revenueRows,
    financialRows,
    balanceRows,
    lastGoodFullStock,
  });

  const stock = {
    symbol,
    stock_id: symbol,
    finmindProfile: normalizedProfile,
    requestedDatasets: Array.from(profileDatasets),
    dataTime,
    profileDataTime: buildProfileDataTime(dataTime),
    dataFreshness: null,

    // Daily 技術 / 歷史序列欄位。不回傳 price，避免覆蓋 GoogleFinance 較新行情。
    dailyClose,
    dailyOpen: latestPrice?.open ?? null,
    dailyHigh: latestPrice?.max ?? null,
    dailyLow: latestPrice?.min ?? null,
    dailyPrevClose: previousPrice?.close ?? null,
    dailyVolume: latestPrice?.Trading_Volume ?? null,
    avgVolume10: average(last10.map((row) => row.Trading_Volume)),
    volume10maFinMind: average(last10.map((row) => row.Trading_Volume)),
    high20: last20.length ? Math.max(...last20.map((row) => row.max)) : null,
    low20: last20.length ? Math.min(...last20.map((row) => row.min)) : null,
    avgVolume20: average(last20.map((row) => row.Trading_Volume)),
    ma5: average(closes.slice(-5)),
    ma20: average(closes.slice(-20)),
    ma60: average(closes.slice(-60)),
    rsi14: Number(calcRsi(closes).toFixed(1)),
    return20d:
      dailyClose && close20Ago
        ? Number((((dailyClose - close20Ago) / close20Ago) * 100).toFixed(1))
        : null,
    return60d:
      dailyClose && close60Ago
        ? Number((((dailyClose - close60Ago) / close60Ago) * 100).toFixed(1))
        : null,
    priceRowCount,
    technicalWarmupStatus,

    // App/API 層技術指標：由 FinMind 日 K OHLCV 計算，不放 Google Sheet 運算。
    macd: technicalIndicators.macd,
    macdSignal: technicalIndicators.macdSignal,
    macdHist: technicalIndicators.macdHist,
    macdHistPrev1: technicalIndicators.macdHistPrev1,
    macdHistPrev3: technicalIndicators.macdHistPrev3,
    macdHistDelta3: technicalIndicators.macdHistDelta3,
    macdHistTrend3: technicalIndicators.macdHistTrend3,
    macdState: technicalIndicators.macdState,
    macdWarmupReady: technicalIndicators.macdWarmupReady,
    k9: technicalIndicators.k9,
    d9: technicalIndicators.d9,
    j9: technicalIndicators.j9,
    k9Prev1: technicalIndicators.k9Prev1,
    d9Prev1: technicalIndicators.d9Prev1,
    kdDiff: technicalIndicators.kdDiff,
    kdDiffPrev1: technicalIndicators.kdDiffPrev1,
    kdDiffTrend3: technicalIndicators.kdDiffTrend3,
    kdCross: technicalIndicators.kdCross,
    kdState: technicalIndicators.kdState,
    kdWarmupReady: technicalIndicators.kdWarmupReady,
    atr14: technicalIndicators.atr14,
    atrPct: technicalIndicators.atrPct,
    atrPctAvg20: technicalIndicators.atrPctAvg20,
    atrPctVsAvg20: technicalIndicators.atrPctVsAvg20,
    volatilityState: technicalIndicators.volatilityState,
    atrWarmupReady: technicalIndicators.atrWarmupReady,

    // TaiwanStockPER：只作估值比對來源，不覆蓋 Google/TWSE 主欄位。
    per: toOptionalNumber(perLatest.PER || perLatest.per || perLatest.PEratio),
    pbr: toOptionalNumber(perLatest.PBR || perLatest.pbr || perLatest.PBratio),
    dividendYield: toOptionalNumber(
      perLatest.dividend_yield ||
        perLatest.DividendYield ||
        perLatest["殖利率"] ||
        perLatest["殖利率(%)"]
    ),

    // 籌碼面
    ...institutional,
    ...margin,

    // 基本面
    ...revenue,
    ...financial,
    ...balance,
    roeTtm,
    roe: roeTtm,

    updatedAt: latestPrice?.date || endDate,
    sourceNote: `FinMind enriched profile=${normalizedProfile}: ${Array.from(profileDatasets).join("/")} + profile merge`,
    datasetStatus: {
      TaiwanStockPrice: priceResult.ok,
      TaiwanStockPER: perResult.ok,
      TaiwanStockInstitutionalInvestorsBuySell: institutionalResult.ok,
      TaiwanStockMarginPurchaseShortSale: marginResult.ok,
      TaiwanStockMonthRevenue: revenueResult.ok,
      TaiwanStockFinancialStatements: financialResult.ok,
      TaiwanStockBalanceSheet: balanceResult.ok,
    },
    fieldErrors,
    rawCounts: {
      TaiwanStockPrice: priceRows.length,
      TaiwanStockPER: perRows.length,
      TaiwanStockInstitutionalInvestorsBuySell: institutionalRows.length,
      TaiwanStockMarginPurchaseShortSale: marginRows.length,
      TaiwanStockMonthRevenue: revenueRows.length,
      TaiwanStockFinancialStatements: financialRows.length,
      TaiwanStockBalanceSheet: balanceRows.length,
    },
  };

  const merged = mergeProfileStockWithLastGood(stock, normalizedProfile);
  merged.profileDataTime = buildProfileDataTime(merged.dataTime);
  merged.dataFreshness = buildDataFreshness(normalizedProfile, merged);

  if (normalizedProfile === "full") saveLastGoodFullStock(merged);
  return merged;
}


function hasUsableFundamentalFields(stock: any) {
  return [stock?.eps, stock?.epsTtm, stock?.epsGrowthYoY, stock?.epsTtmGrowthYoY]
    .some((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));
}

function hasUsableDividendYieldField(stock: any) {
  return stock?.dividendYield !== null && stock?.dividendYield !== undefined && Number.isFinite(Number(stock.dividendYield));
}

function mergeFundamentalIntoScoreStock(scoreStock: any, fundamentalStock: any) {
  const merged = { ...scoreStock };
  copyFieldsFromLastGood(merged, fundamentalStock, [...FUNDAMENTAL_FIELD_KEYS, ...VALUATION_FIELD_KEYS]);
  merged.dataTime = mergeDataTimeWithLastGood(scoreStock?.dataTime || {}, fundamentalStock?.dataTime || {});
  merged.profileDataTime = buildProfileDataTime(merged.dataTime);
  merged.staleFundamental = false;
  merged.staleScore = false;
  merged.mergedFromFundamentalProfile = true;
  merged.fundamentalHydratedAt = new Date().toISOString();
  merged.fundamentalHydrationSource = "profile=fundamental";
  return merged;
}

async function hydrateScoreStocksWithFundamentals(stocks: any[], token: string, profile: string) {
  const normalizedProfile = normalizeFinMindProfile(profile);
  if (normalizedProfile !== "score") {
    return {
      stocks,
      fundamentalHydration: {
        enabled: false,
        reason: `profile=${normalizedProfile}`,
      },
    };
  }

  const missing = (Array.isArray(stocks) ? stocks : [])
    .filter((stock) => stock?.symbol && (!hasUsableFundamentalFields(stock) || !hasUsableDividendYieldField(stock)))
    .map((stock) => String(stock.symbol));

  if (!missing.length) {
    return {
      stocks,
      fundamentalHydration: {
        enabled: true,
        fetched: false,
        reason: "score already has cached fundamental / dividendYield fields",
        missingSymbols: [],
        hydratedSymbols: [],
        failedSymbols: [],
      },
    };
  }

  const results = await Promise.allSettled(
    missing.map((symbol) => buildStock(symbol, token, "fundamental"))
  );

  const bySymbol = new Map<string, any>();
  const failedSymbols: string[] = [];

  results.forEach((result, index) => {
    const symbol = missing[index];
    if (result.status === "fulfilled" && result.value && !result.value.error) {
      bySymbol.set(symbol, result.value);
      return;
    }
    failedSymbols.push(symbol);
  });

  const hydratedStocks = (Array.isArray(stocks) ? stocks : []).map((stock) => {
    const symbol = String(stock?.symbol || "");
    const fundamental = bySymbol.get(symbol);
    if (!fundamental || !hasUsableFundamentalFields(fundamental)) return stock;
    const merged = mergeFundamentalIntoScoreStock(stock, fundamental);
    saveLastGoodFullStock(merged);
    return merged;
  });

  return {
    stocks: hydratedStocks,
    fundamentalHydration: {
      enabled: true,
      fetched: true,
      reason: "score profile auto-hydrated missing EPS/fundamental/dividendYield fields from profile=fundamental",
      missingSymbols: missing,
      hydratedSymbols: Array.from(bySymbol.keys()),
      failedSymbols,
      datasetsPerMissingSymbol: FINMIND_PROFILE_DATASETS.fundamental.length,
      note: "This keeps score profile lightweight while filling low-frequency EPS fields without requiring a full profile fetch every time.",
    },
  };
}


function buildProfileDataSummary(stocks: any[], profile: string) {
  const dataTimes = (Array.isArray(stocks) ? stocks : []).map((stock) => stock?.dataTime || {});
  const latest = (key: string) => {
    const values = dataTimes.map((x) => x?.[key]).filter(Boolean).sort();
    return values[values.length - 1] || null;
  };

  return {
    profile: normalizeFinMindProfile(profile),
    symbols: Array.isArray(stocks) ? stocks.length : 0,
    latestPriceDate: latest("priceDate"),
    latestInstitutionalDate: latest("institutionalDate"),
    latestMarginDate: latest("marginDate"),
    latestPerDate: latest("perDate"),
    latestRevenueMonth: latest("revenueMonth"),
    latestFinancialQuarter: latest("financialQuarter"),
    latestBalanceQuarter: latest("balanceQuarter"),
    note: "All values are source data dates/months/quarters, not fetch/cache timestamps.",
  };
}


async function uncachedGET(request: Request) {
  const { token, tokenSource } = getRequestToken(request);

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Missing FinMind token. Set FINMIND_TOKEN in .env.local or send X-FinMind-Token header.",
      },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const symbols = parseSymbols(searchParams.get("symbols"));
  const profile = normalizeFinMindProfile(searchParams.get("profile"));
  const profileDatasets = FINMIND_PROFILE_DATASETS[profile] || FINMIND_PROFILE_DATASETS.full;

  const results = await Promise.allSettled(
    symbols.map((symbol) => buildStock(symbol, token, profile))
  );

  let stocks = results
    .map((result, index) => {
      if (result.status === "fulfilled") return result.value;

      return {
        symbol: symbols[index],
        error: result.reason?.message || "UNKNOWN_ERROR",
      };
    })
    .filter((row: any) => !row.error);

  const hydrationResult = await hydrateScoreStocksWithFundamentals(stocks, token, profile);
  stocks = hydrationResult.stocks;

  const errors = results
    .map((result, index) => {
      if (result.status === "rejected") {
        return {
          symbol: symbols[index],
          error: result.reason?.message || "UNKNOWN_ERROR",
        };
      }

      const value: any = result.value;

      if (value?.error) {
        return {
          symbol: symbols[index],
          error: value.error,
        };
      }

      return null;
    })
    .filter(Boolean);

  return NextResponse.json({
    ok: true,
    source: "finmind_enriched_proxy",
    tokenSource,
    requestedSymbols: symbols,
    profile,
    profileDatasets,
    count: stocks.length,
    profileDataSummary: buildProfileDataSummary(stocks, profile),
    fundamentalHydration: hydrationResult.fundamentalHydration,
    stocks,
    errors,
    fetchedAt: new Date().toISOString(),
    requestCostHint: {
      profile,
      datasetsPerSymbol: profileDatasets.length,
      estimatedRequests: symbols.length * profileDatasets.length,
      datasets: profileDatasets,
      note:
        profile === "full"
          ? "Full profile fetches all 7 FinMind datasets and updates lastGoodFull for later partial-refresh merge."
          : profile === "score"
            ? "Score profile fetches Price + Institutional + Margin first, then auto-hydrates missing EPS/fundamental fields from profile=fundamental and caches the merged result."
            : "Fundamental profile fetches MonthRevenue + FinancialStatements + BalanceSheet only. Score fields are merged from lastGoodFull when available.",
    },
  });
}


function getFinMindStocksCacheQuality(payload: any) {
  const stocks = Array.isArray(payload?.stocks) ? payload.stocks : [];
  const errors = Array.isArray(payload?.errors) ? payload.errors : [];
  const requestedSymbols = Array.isArray(payload?.requestedSymbols) ? payload.requestedSymbols : [];

  const usableStocks = stocks.filter((stock: any) => {
    const priceRowCount = Number(stock?.priceRowCount ?? 0);
    const dailyClose = Number(stock?.dailyClose);
    const dailyVolume = Number(stock?.dailyVolume);
    const ma5 = Number(stock?.ma5);
    const ma20 = Number(stock?.ma20);
    const avgVolume20 = Number(stock?.avgVolume20);

    return (
      priceRowCount > 0 ||
      dailyClose > 0 ||
      dailyVolume > 0 ||
      ma5 > 0 ||
      ma20 > 0 ||
      avgVolume20 > 0
    );
  });

  const invalidStocks = stocks.filter((stock: any) => {
    const priceRowCount = Number(stock?.priceRowCount ?? 0);
    const dailyClose = Number(stock?.dailyClose);
    const ma5 = Number(stock?.ma5);
    const ma20 = Number(stock?.ma20);

    return priceRowCount <= 0 && !dailyClose && !ma5 && !ma20;
  });

  const requestedCount = requestedSymbols.length || stocks.length;
  const invalidRatio = stocks.length ? invalidStocks.length / stocks.length : 1;

  let reason = "";
  if (!payload || payload.ok !== true) reason = "payload.ok is not true";
  else if (!stocks.length) reason = "payload.stocks is empty";
  else if (!usableStocks.length) reason = "no usable daily price/technical data";
  else if (requestedCount > 0 && errors.length >= requestedCount) reason = "all requested symbols returned errors";
  else if (stocks.length >= 2 && invalidRatio >= 0.5) reason = `too many invalid stocks (${invalidStocks.length}/${stocks.length})`;

  return {
    cacheable: !reason,
    reason,
    requestedCount,
    stockCount: stocks.length,
    usableCount: usableStocks.length,
    invalidCount: invalidStocks.length,
    errorCount: errors.length,
  };
}



export async function GET(request: Request) {
  const wrapperStartedAt = new Date().toISOString();
  const url = new URL(request.url);
  const force = isForceRefresh(url.searchParams);
  const cacheTtlMs = parseTtlMs(url.searchParams, 60 * 60 * 1000);
  const cacheKey = buildRouteCacheKey("finmind_stocks_profile_v02g", request.url);

  try {
    const cached = await getOrFetchCached({
      key: cacheKey,
      ttlMs: cacheTtlMs,
      force,
      meta: { route: "/api/finmind/stocks", policy: "FinMind Daily 1h TTL" },
      fetcher: async () => {
        const res = await uncachedGET(request);
        const payload = await res.json();
        const quality = getFinMindStocksCacheQuality(payload);

        if (!res.ok || !quality.cacheable) {
          const error = new Error(
            `FinMind stocks response was not cached: ${quality.reason || `HTTP ${res.status}`}`
          ) as any;
          error.status = res.status || 502;
          error.payload = payload;
          error.quality = quality;
          throw error;
        }

        const guardedPayload = {
          ...payload,
          cacheQuality: quality,
        };

        saveFinMindStocksLastGood(cacheKey, guardedPayload, quality);
        if (guardedPayload.profile === "full") saveLastGoodFullPayload(guardedPayload);

        return {
          payload: guardedPayload,
          status: res.status,
        };
      },
    });

    if (cached.value?.payload?.profile === "full") saveLastGoodFullPayload(cached.value.payload);

    return NextResponse.json(
      {
        ...cached.value.payload,
        cache: cached.cache,
        cachePolicy: {
          build: CACHE_BUILD_VERSION,
          kind: "ttl_profile_merge",
          profile: cached.value?.payload?.profile || normalizeFinMindProfile(url.searchParams.get("profile")),
          ttlMs: cacheTtlMs,
          force,
          route: "/api/finmind/stocks",
        },
        wrapperStartedAt,
        wrapperFinishedAt: new Date().toISOString(),
      },
      { status: cached.value.status || 200 }
    );
  } catch (error: any) {
    const lastGood = getFinMindStocksLastGood(cacheKey);

    if (lastGood?.payload) {
      return NextResponse.json(
        {
          ...lastGood.payload,
          ok: true,
          stale: true,
          staleReason: "FinMind upstream response failed quality checks; served last good payload instead of caching bad data.",
          staleGeneratedAt: new Date(lastGood.createdAt).toISOString(),
          cache: makeStaleCacheMeta(cacheKey, lastGood, cacheTtlMs, error),
          cachePolicy: {
            build: CACHE_BUILD_VERSION,
            kind: "ttl_stale_if_error_profile_merge",
            profile: normalizeFinMindProfile(url.searchParams.get("profile")),
            ttlMs: cacheTtlMs,
            force,
            route: "/api/finmind/stocks",
            staleIfError: true,
          },
          cacheQuality: lastGood.quality || lastGood.payload.cacheQuality || null,
          upstreamError: {
            message: error?.message || String(error),
            quality: error?.quality || null,
            status: error?.status || null,
            summary: error?.payload
              ? {
                  ok: error.payload?.ok,
                  source: error.payload?.source,
                  requestedSymbols: error.payload?.requestedSymbols,
                  count: error.payload?.count,
                  errorCount: Array.isArray(error.payload?.errors) ? error.payload.errors.length : null,
                  fetchedAt: error.payload?.fetchedAt,
                }
              : null,
          },
          wrapperStartedAt,
          wrapperFinishedAt: new Date().toISOString(),
          note: "Served stale last-good FinMind data. The failed upstream payload was not cached.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        route: "/api/finmind/stocks",
        cachePolicy: {
          build: CACHE_BUILD_VERSION,
          kind: "ttl_stale_if_error_profile_merge",
          profile: normalizeFinMindProfile(url.searchParams.get("profile")),
          ttlMs: cacheTtlMs,
          force,
          route: "/api/finmind/stocks",
          staleIfError: true,
        },
        wrapperStartedAt,
        wrapperFinishedAt: new Date().toISOString(),
        error: error?.message || String(error),
        cacheQuality: error?.quality || null,
        upstreamStatus: error?.status || null,
        upstreamSummary: error?.payload
          ? {
              ok: error.payload?.ok,
              source: error.payload?.source,
              requestedSymbols: error.payload?.requestedSymbols,
              count: error.payload?.count,
              errorCount: Array.isArray(error.payload?.errors) ? error.payload.errors.length : null,
              fetchedAt: error.payload?.fetchedAt,
            }
          : null,
        note: "This bad FinMind response was intentionally not cached, and no last-good payload is available yet.",
      },
      { status: error?.status && error.status >= 400 ? error.status : 502 }
    );
  }
}

