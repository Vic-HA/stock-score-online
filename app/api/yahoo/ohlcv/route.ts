// @ts-nocheck
import { NextResponse } from "next/server";
import { getOrFetchScheduledDailyCached, isForceRefresh } from "@/lib/serverCache";

export const dynamic = "force-dynamic";

const CACHE_BUILD_VERSION = "CACHE_BUILD_02C_YAHOO_OHLCV_DATA_TIME";

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


export const revalidate = 0;

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const DEFAULT_SYMBOLS = ["2330", "0050"];

function normalizeStockSymbol(value: unknown) {
  const raw = String(value ?? "").trim().toUpperCase();
  let cleaned = raw;
  if (cleaned.startsWith("TPE:")) cleaned = cleaned.slice(4);
  if (cleaned.startsWith("TWO:")) cleaned = cleaned.slice(4);
  if (cleaned.endsWith(".TW")) cleaned = cleaned.slice(0, -3);
  if (cleaned.endsWith(".TWO")) cleaned = cleaned.slice(0, -4);
  cleaned = cleaned.replace(/^'/, "");
  cleaned = cleaned.split("").filter((ch) => /[0-9A-Z]/.test(ch)).join("");
  if (/^[0-9]{1,4}$/.test(cleaned)) return cleaned.padStart(4, "0");
  return cleaned;
}

function toYahooSymbol(symbol: string) {
  const normalized = normalizeStockSymbol(symbol);
  if (/^[0-9]{4,6}$/.test(normalized)) return `${normalized}.TW`;
  return normalized;
}

function parseSymbols(input: string | null) {
  const raw = input || DEFAULT_SYMBOLS.join(",");
  return raw
    .split(",")
    .map((x) => normalizeStockSymbol(x))
    .filter(Boolean)
    .slice(0, 50);
}

function toNumber(value: unknown, fallback = 0) {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (!raw || raw === "-" || raw === "--" || raw.toUpperCase() === "N/A") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function roundOptional(value: unknown, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(digits));
}

function average(values: number[]) {
  const clean = values.filter((x) => Number.isFinite(x));
  if (!clean.length) return 0;
  return clean.reduce((sum, x) => sum + x, 0) / clean.length;
}

function yyyyMmDdFromUnix(seconds: number, timezone = "Asia/Taipei") {
  const date = new Date(Number(seconds) * 1000);
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function calcEmaSeries(values: number[], period: number) {
  const clean = Array.isArray(values) ? values.map(Number) : [];
  if (clean.length < period) return clean.map(() => null as any);

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
  const latestSignal = signalCompact[signalCompact.length - 1];
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

function buildTechnicalRows(rows: any[]) {
  const closes = rows.map((row) => row.close);
  return {
    priceRowCount: rows.length,
    technicalWarmupStatus: {
      priceRowCount: rows.length,
      macdReady: rows.length >= 100,
      kdReady: rows.length >= 40,
      atrReady: rows.length >= 100,
      recommendedCalendarDays: 300,
    },
    ...calcMacd(closes),
    ...calcKd(rows),
    ...calcAtr(rows),
  };
}

function buildTechnicalDebugRows(rows: any[], limit = 20) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const start = Math.max(0, rows.length - limit);
  return rows.slice(start).map((row, offset) => {
    const endIndex = start + offset + 1;
    const slice = rows.slice(0, endIndex);
    const technical = buildTechnicalRows(slice);
    return {
      date: row.date,
      dailyOpen: row.open ?? null,
      dailyHigh: row.max ?? null,
      dailyLow: row.min ?? null,
      dailyClose: row.close ?? null,
      dailyVolume: row.volume ?? null,
      adjClose: row.adjClose ?? null,
      ...technical,
    };
  });
}

async function fetchYahoo(symbol: string, range: string, interval: string) {
  const yahooSymbol = toYahooSymbol(symbol);
  const url = new URL(`${YAHOO_CHART_URL}/${encodeURIComponent(yahooSymbol)}`);
  url.searchParams.set("range", range);
  url.searchParams.set("interval", interval);
  url.searchParams.set("events", "div,splits");
  url.searchParams.set("includeAdjustedClose", "true");

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      Accept: "application/json,text/plain,*/*",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "User-Agent": "stock-score-online-yahoo-ohlcv/1.0",
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Yahoo chart HTTP ${res.status}: ${json?.chart?.error?.description || "request failed"}`);
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(json?.chart?.error?.description || "Yahoo chart returned no result");

  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const quote = result.indicators?.quote?.[0] || {};
  const adj = result.indicators?.adjclose?.[0]?.adjclose || [];
  const timezone = result.meta?.exchangeTimezoneName || "Asia/Taipei";

  const rows = timestamps.map((ts: number, index: number) => ({
    date: yyyyMmDdFromUnix(ts, timezone),
    open: toNumber(quote.open?.[index], null as any),
    max: toNumber(quote.high?.[index], null as any),
    min: toNumber(quote.low?.[index], null as any),
    close: toNumber(quote.close?.[index], null as any),
    volume: toNumber(quote.volume?.[index], null as any),
    adjClose: toNumber(adj?.[index], null as any),
  })).filter((row: any) => row.date && Number.isFinite(row.close) && Number.isFinite(row.max) && Number.isFinite(row.min));

  const sorted = rows.sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
  const latest = sorted[sorted.length - 1] || null;
  const technical = buildTechnicalRows(sorted);
  const technicalRows = buildTechnicalDebugRows(sorted, 20);

  return {
    symbol: normalizeStockSymbol(symbol),
    stock_id: normalizeStockSymbol(symbol),
    yahooSymbol,
    range,
    interval,
    price: latest?.close ?? null,
    dailyClose: latest?.close ?? null,
    dailyOpen: latest?.open ?? null,
    dailyHigh: latest?.max ?? null,
    dailyLow: latest?.min ?? null,
    dailyVolume: latest?.volume ?? null,
    adjClose: latest?.adjClose ?? null,
    updatedAt: latest?.date || "",
    dataTime: {
      firstOhlcvDate: sorted[0]?.date || null,
      latestOhlcvDate: latest?.date || null,
      rowCount: sorted.length,
      timezone,
      range,
      interval,
      note: "Yahoo OHLCV source data dates, not fetch/cache timestamps.",
    },
    rows: sorted.slice(-20),
    technicalRows,
    ...technical,
    sourceNote: "Yahoo Finance chart raw OHLCV validation",
    rawCount: sorted.length,
  };
}


function buildYahooOhlcvDataTimeSummary(stocks: any[]) {
  const dates = (Array.isArray(stocks) ? stocks : [])
    .map((stock) => stock?.dataTime?.latestOhlcvDate)
    .filter(Boolean)
    .sort();
  const firstDates = (Array.isArray(stocks) ? stocks : [])
    .map((stock) => stock?.dataTime?.firstOhlcvDate)
    .filter(Boolean)
    .sort();

  return {
    latestOhlcvDate: dates[dates.length - 1] || null,
    earliestOhlcvDate: firstDates[0] || null,
    symbolsWithDataTime: dates.length,
    note: "Yahoo OHLCV source data dates, not fetch/cache timestamps.",
  };
}

async function uncachedGET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = parseSymbols(searchParams.get("symbols"));
  const range = searchParams.get("range") || "1y";
  const interval = searchParams.get("interval") || "1d";
  const includeRows = searchParams.get("rows") !== "0";

  const results = await Promise.all(symbols.map(async (symbol) => {
    try {
      const stock = await fetchYahoo(symbol, range, interval);
      if (!includeRows) delete (stock as any).rows;
      return { ok: true, stock, error: "" };
    } catch (error: any) {
      return { ok: false, stock: { symbol, stock_id: symbol, yahooSymbol: toYahooSymbol(symbol) }, error: error?.message || "Yahoo fetch failed" };
    }
  }));

  const stocks = results.filter((item) => item.ok).map((item: any) => item.stock);
  const errors = results.filter((item) => !item.ok).map((item: any) => ({ symbol: item.stock?.symbol, yahooSymbol: item.stock?.yahooSymbol, error: item.error }));

  return NextResponse.json({
    ok: true,
    source: "yahoo_ohlcv_validation",
    requestedSymbols: symbols,
    count: stocks.length,
    dataTimeSummary: buildYahooOhlcvDataTimeSummary(stocks),
    stocks,
    errors,
    fetchedAt: new Date().toISOString(),
    requestCostHint: {
      note: "Yahoo is used only as raw OHLCV sampling validation. It does not overwrite FinMind, GoogleFinance, TWSE, or scoring inputs.",
    },
  });
}


export async function GET(request: Request) {
  const wrapperStartedAt = new Date().toISOString();
  const url = new URL(request.url);
  const force = isForceRefresh(url.searchParams);
  const cacheKey = buildRouteCacheKey("yahoo_ohlcv_v02c", request.url);

  try {
    const cached = await getOrFetchScheduledDailyCached({
      key: cacheKey,
      force,
      meta: { route: "/api/yahoo/ohlcv", policy: "Yahoo OHLCV scheduled cache" },
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
          kind: "scheduled_daily",
          schedule: "08:30 / 14:10 / 15:30 / 18:00 / 22:00 Asia/Taipei",
          force,
          route: "/api/yahoo/ohlcv",
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
        route: "/api/yahoo/ohlcv",
        cachePolicy: { build: CACHE_BUILD_VERSION, kind: "scheduled_daily", force },
        wrapperStartedAt,
        wrapperFinishedAt: new Date().toISOString(),
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

