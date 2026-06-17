import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getOrFetchCached, isForceRefresh, normalizeCacheKeyPart } from "@/lib/serverCache";

export const dynamic = "force-dynamic";

const BUILD_VERSION = "TWSE_HISTORY_BUILD_02H_RETRY_BACKOFF_HARDENED";
const PHASE_D_ROUTE_AUTO_REFRESH_BUILD = "PHASE_D_HISTORY_ROUTE_AUTO_REFRESH_V0_5";
const MAX_SYMBOLS = 50;
const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 5;
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 350;
const DEFAULT_MONTHS_BACK = 8;
const MAX_MONTHS_BACK = 12;

type TwseHistoryRow = {
  date: string;
  rawDate: string;
  volume: number | null;
  amount: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  change: number | null;
  transactions: number | null;
  raw: string[];
};

type TechnicalBundle = {
  ma5: number | null;
  ma10: number | null;
  ma20: number | null;
  ma60: number | null;
  avgVolume10: number | null;
  avgVolume20: number | null;
  high20: number | null;
  low20: number | null;
  return20d: number | null;
  return60d: number | null;
  rsi14: number | null;
  rsi14Standard: number | null;
  rsi14FinMindCompatible: number | null;
  rsi14WilderSeedSma: number | null;
  rsi14Simple: number | null;
  rsi14Ema: number | null;
  rsi14Cutler: number | null;
  k9: number | null;
  d9: number | null;
  j9: number | null;
  atr14: number | null;
  atrPct: number | null;
  atrPctAvg20: number | null;
  atrPctVsAvg20: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  macdHistDelta3: number | null;
  macdWarmupRows: number;
  priceRowCount: number;
};

type SymbolHistoryResult = {
  symbol: string;
  ok: boolean;
  latestDate: string | null;
  latestRawDate: string | null;
  dailyOpen: number | null;
  dailyHigh: number | null;
  dailyLow: number | null;
  dailyClose: number | null;
  dailyVolume: number | null;
  avgVolume10: number | null;
  avgVolume20: number | null;
  ma5: number | null;
  ma10: number | null;
  ma20: number | null;
  ma60: number | null;
  high20: number | null;
  low20: number | null;
  return20d: number | null;
  return60d: number | null;
  rsi14: number | null;
  rsi14Standard: number | null;
  rsi14FinMindCompatible: number | null;
  rsi14WilderSeedSma: number | null;
  rsi14Simple: number | null;
  rsi14Ema: number | null;
  rsi14Cutler: number | null;
  k9: number | null;
  d9: number | null;
  j9: number | null;
  atr14: number | null;
  atrPct: number | null;
  atrPctAvg20: number | null;
  atrPctVsAvg20: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  macdHistDelta3: number | null;
  macdWarmupRows: number;
  rowCount: number;
  last10Rows: TwseHistoryRow[];
  last20Rows: TwseHistoryRow[];
  last60Rows: TwseHistoryRow[];
  last120Rows: TwseHistoryRow[];
  last220Rows: TwseHistoryRow[];
  historyRows: TwseHistoryRow[];
  dataTime: {
    latestDate: string | null;
    latestRawDate: string | null;
    monthsFetched: string[];
    note: string;
  };
  technicalStatus: {
    ma60Ready: boolean;
    macdWarmupReady: boolean;
    kdReady: boolean;
    rsiReady: boolean;
    atrReady: boolean;
    rowCount: number;
    note: string;
  };
  sourceNote: string;
  monthWarnings?: string[];
  error?: string;
};

function jsonHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
  };
}

function parseSymbols(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("symbols") || "";
  return raw
    .split(",")
    .map((x) => x.trim())
    .map((x) => x.replace(/\.(TW|TWO)$/i, ""))
    .filter(Boolean)
    .filter((x, i, arr) => arr.indexOf(x) === i)
    .slice(0, MAX_SYMBOLS);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: unknown): number | null {
  const raw = String(value ?? "")
    .replace(/,/g, "")
    .replace(/%/g, "")
    .trim();

  if (!raw || raw === "-" || raw === "--" || raw.toUpperCase() === "N/A" || raw === "X0.00") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function average(values: Array<number | null | undefined>): number | null {
  const nums = values.map((x) => Number(x)).filter((x) => Number.isFinite(x));
  if (!nums.length) return null;
  return nums.reduce((sum, x) => sum + x, 0) / nums.length;
}

function lastAverage(rows: TwseHistoryRow[], count: number, key: keyof TwseHistoryRow) {
  return average(rows.slice(-count).map((row) => row[key] as number | null));
}

function round(value: number | null, digits = 6) {
  if (!Number.isFinite(Number(value))) return null;
  const n = Number(value);
  const m = 10 ** digits;
  return Math.round(n * m) / m;
}

function rocDateToIso(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const parts = raw.split("/");
  if (parts.length === 3) {
    const year = Number(parts[0]) + 1911;
    const month = String(Number(parts[1])).padStart(2, "0");
    const day = String(Number(parts[2])).padStart(2, "0");
    if (Number.isFinite(year)) return `${year}-${month}-${day}`;
  }

  const digits = raw.replace(/\D/g, "");
  if (digits.length === 7) {
    const year = Number(digits.slice(0, 3)) + 1911;
    return `${year}-${digits.slice(3, 5)}-${digits.slice(5, 7)}`;
  }

  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }

  return raw;
}

function yyyymm01(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}01`;
}

function monthList(monthsBack: number, now = new Date()) {
  return Array.from({ length: monthsBack }, (_, i) => yyyymm01(new Date(now.getFullYear(), now.getMonth() - i, 1)));
}

function parseAsOfDate(req: NextRequest): string | null {
  const raw = String(req.nextUrl.searchParams.get("asOfDate") || req.nextUrl.searchParams.get("asOf") || "").trim();
  if (!raw) return null;

  const normalized = rocDateToIso(raw) || raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;

  return null;
}

function scheduledHistoryTtlMs(now = new Date()) {
  // TWSE history is official daily history. Avoid frequent refresh.
  // Refresh windows: 14:10 / 15:30 / 18:00 / 22:00 Taiwan local time.
  const windows = [
    [14, 10],
    [15, 30],
    [18, 0],
    [22, 0],
  ];

  const todayCandidates = windows.map(([h, m]) => {
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    return d;
  });

  let next = todayCandidates.find((d) => d.getTime() > now.getTime());
  if (!next) {
    next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(windows[0][0], windows[0][1], 0, 0);
  }

  return Math.max(60_000, next.getTime() - now.getTime());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url: string, timeoutMs: number, retryCount = DEFAULT_RETRY_COUNT, retryBaseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS) {
  let lastError: any = null;

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      return await fetchJsonWithTimeout(url, timeoutMs);
    } catch (error: any) {
      lastError = error;
      if (attempt >= retryCount) break;

      const delayMs = retryBaseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 120);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json,text/plain,*/*",
        "User-Agent": "Mozilla/5.0 stock-score-online twse-history-technicals",
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function normalizeStockDayRow(row: any[]): TwseHistoryRow | null {
  if (!Array.isArray(row) || row.length < 7) return null;

  const rawDate = String(row[0] ?? "").trim();
  const date = rocDateToIso(rawDate);
  if (!date) return null;

  return {
    date,
    rawDate,
    volume: toNumber(row[1]),
    amount: toNumber(row[2]),
    open: toNumber(row[3]),
    high: toNumber(row[4]),
    low: toNumber(row[5]),
    close: toNumber(row[6]),
    change: toNumber(row[7]),
    transactions: toNumber(row[8]),
    raw: row.map((x) => String(x ?? "")),
  };
}

async function fetchTwseStockDayMonth(symbol: string, month: string, timeoutMs: number, retryCount = DEFAULT_RETRY_COUNT) {
  const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${encodeURIComponent(month)}&stockNo=${encodeURIComponent(symbol)}`;
  const json = await fetchJsonWithRetry(url, timeoutMs, retryCount);
  const stat = String(json?.stat || "");

  if (stat !== "OK") {
    return {
      ok: false,
      month,
      rows: [] as TwseHistoryRow[],
      stat,
      error: stat || "TWSE STOCK_DAY not OK",
      errorType: "twse_stat",
    };
  }

  const rows = (Array.isArray(json?.data) ? json.data : [])
    .map(normalizeStockDayRow)
    .filter(Boolean) as TwseHistoryRow[];

  return { ok: true, month, rows, stat, error: "" };
}

function emaSeries(values: number[], period: number) {
  const alpha = 2 / (period + 1);
  const out: number[] = [];

  values.forEach((value, index) => {
    if (index === 0) {
      out.push(value);
    } else {
      out.push(value * alpha + out[index - 1] * (1 - alpha));
    }
  });

  return out;
}

function rsiFromAvg(avgGain: number, avgLoss: number) {
  if (!Number.isFinite(avgGain) || !Number.isFinite(avgLoss)) return null;
  if (avgLoss === 0 && avgGain === 0) return 50;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcRsi14WilderSeedSma(closes: number[]) {
  if (closes.length < 15) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= 14; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / 14;
  let avgLoss = losses / 14;

  for (let i = 15; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * 13 + gain) / 14;
    avgLoss = (avgLoss * 13 + loss) / 14;
  }

  return rsiFromAvg(avgGain, avgLoss);
}

function calcRsi14Simple(closes: number[]) {
  if (closes.length < 15) return null;

  const diffs = closes.slice(1).map((close, i) => close - closes[i]);
  const latest14 = diffs.slice(-14);
  const avgGain = average(latest14.map((diff) => diff > 0 ? diff : 0));
  const avgLoss = average(latest14.map((diff) => diff < 0 ? Math.abs(diff) : 0));

  return rsiFromAvg(Number(avgGain), Number(avgLoss));
}

function calcRsi14Ema(closes: number[]) {
  if (closes.length < 15) return null;

  const diffs = closes.slice(1).map((close, i) => close - closes[i]);
  const gains = diffs.map((diff) => diff > 0 ? diff : 0);
  const losses = diffs.map((diff) => diff < 0 ? Math.abs(diff) : 0);
  const gainEma = emaSeries(gains, 14);
  const lossEma = emaSeries(losses, 14);

  return rsiFromAvg(gainEma[gainEma.length - 1], lossEma[lossEma.length - 1]);
}

function calcRsi14Cutler(closes: number[]) {
  // Cutler RSI equals simple moving average RSI over the latest 14 deltas.
  return calcRsi14Simple(closes);
}

function calcRsi14(closes: number[]) {
  // V72G: standard RSI follows Wilder smoothing; FinMind-compatible RSI is exposed separately as Simple/Cutler.
  return calcRsi14WilderSeedSma(closes);
}

function calcKdj(rows: TwseHistoryRow[]) {
  if (rows.length < 9) return { k9: null, d9: null, j9: null };

  let k = 50;
  let d = 50;

  for (let i = 0; i < rows.length; i++) {
    if (i < 8) continue;

    const window = rows.slice(i - 8, i + 1);
    const high = Math.max(...window.map((row) => Number(row.high)).filter(Number.isFinite));
    const low = Math.min(...window.map((row) => Number(row.low)).filter(Number.isFinite));
    const close = Number(rows[i].close);

    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close) || high === low) continue;

    const rsv = ((close - low) / (high - low)) * 100;
    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
  }

  return {
    k9: k,
    d9: d,
    j9: 3 * k - 2 * d,
  };
}

function calcAtr(rows: TwseHistoryRow[]) {
  if (rows.length < 15) {
    return { atr14: null, atrPct: null, atrPctAvg20: null, atrPctVsAvg20: null };
  }

  const trValues: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const high = Number(rows[i].high);
    const low = Number(rows[i].low);
    const prevClose = i > 0 ? Number(rows[i - 1].close) : Number(rows[i].close);

    if (![high, low, prevClose].every(Number.isFinite)) continue;

    trValues.push(Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    ));
  }

  if (trValues.length < 14) {
    return { atr14: null, atrPct: null, atrPctAvg20: null, atrPctVsAvg20: null };
  }

  let atr = average(trValues.slice(0, 14)) as number;
  const atrList: number[] = [];

  for (let i = 14; i < trValues.length; i++) {
    atr = (atr * 13 + trValues[i]) / 14;
    atrList.push(atr);
  }

  const latestClose = Number(rows[rows.length - 1]?.close);
  const atr14 = atrList[atrList.length - 1] ?? atr;
  const atrPct = latestClose > 0 ? (atr14 / latestClose) * 100 : null;

  const atrPctSeries = atrList
    .map((x, idx) => {
      const row = rows[14 + idx];
      const close = Number(row?.close);
      return close > 0 ? (x / close) * 100 : null;
    })
    .filter((x) => x !== null) as number[];

  const atrPctAvg20 = average(atrPctSeries.slice(-20));
  const atrPctVsAvg20 = atrPct !== null && atrPctAvg20 !== null && atrPctAvg20 !== 0
    ? ((atrPct - atrPctAvg20) / atrPctAvg20) * 100
    : null;

  return { atr14, atrPct, atrPctAvg20, atrPctVsAvg20 };
}

function calcMacd(closes: number[]) {
  if (closes.length < 35) {
    return { macd: null, macdSignal: null, macdHist: null, macdHistDelta3: null, macdWarmupRows: closes.length };
  }

  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const macdLine = closes.map((_, i) => ema12[i] - ema26[i]);
  const signal = emaSeries(macdLine, 9);
  const hist = macdLine.map((x, i) => x - signal[i]);

  const last = macdLine.length - 1;
  return {
    macd: macdLine[last],
    macdSignal: signal[last],
    macdHist: hist[last],
    macdHistDelta3: hist.length > 3 ? hist[last] - hist[last - 3] : null,
    macdWarmupRows: closes.length,
  };
}

function calcTechnicals(rows: TwseHistoryRow[]): TechnicalBundle {
  const closes = rows.map((row) => Number(row.close)).filter(Number.isFinite);
  const latestClose = closes[closes.length - 1] ?? null;
  const last20 = rows.slice(-20);
  const last60 = rows.slice(-60);

  const kdj = calcKdj(rows);
  const atr = calcAtr(rows);
  const macd = calcMacd(closes);
  const rsi14WilderSeedSma = calcRsi14WilderSeedSma(closes);
  const rsi14Simple = calcRsi14Simple(closes);
  const rsi14Ema = calcRsi14Ema(closes);
  const rsi14Cutler = calcRsi14Cutler(closes);

  const close20Ago = closes.length > 20 ? closes[closes.length - 21] : null;
  const close60Ago = closes.length > 60 ? closes[closes.length - 61] : null;

  return {
    ma5: round(average(closes.slice(-5))),
    ma10: round(average(closes.slice(-10))),
    ma20: round(average(closes.slice(-20))),
    ma60: round(average(closes.slice(-60))),
    avgVolume10: round(lastAverage(rows, 10, "volume"), 1),
    avgVolume20: round(lastAverage(rows, 20, "volume"), 1),
    high20: last20.length ? Math.max(...last20.map((row) => Number(row.high)).filter(Number.isFinite)) : null,
    low20: last20.length ? Math.min(...last20.map((row) => Number(row.low)).filter(Number.isFinite)) : null,
    return20d: latestClose !== null && close20Ago ? round(((latestClose - close20Ago) / close20Ago) * 100, 4) : null,
    return60d: latestClose !== null && close60Ago ? round(((latestClose - close60Ago) / close60Ago) * 100, 4) : null,
    rsi14: round(rsi14WilderSeedSma, 4),
    rsi14Standard: round(rsi14WilderSeedSma, 4),
    rsi14FinMindCompatible: round(rsi14Simple, 4),
    rsi14WilderSeedSma: round(rsi14WilderSeedSma, 4),
    rsi14Simple: round(rsi14Simple, 4),
    rsi14Ema: round(rsi14Ema, 4),
    rsi14Cutler: round(rsi14Cutler, 4),
    k9: round(kdj.k9, 4),
    d9: round(kdj.d9, 4),
    j9: round(kdj.j9, 4),
    atr14: round(atr.atr14, 4),
    atrPct: round(atr.atrPct, 4),
    atrPctAvg20: round(atr.atrPctAvg20, 4),
    atrPctVsAvg20: round(atr.atrPctVsAvg20, 4),
    macd: round(macd.macd, 4),
    macdSignal: round(macd.macdSignal, 4),
    macdHist: round(macd.macdHist, 4),
    macdHistDelta3: round(macd.macdHistDelta3, 4),
    macdWarmupRows: macd.macdWarmupRows,
    priceRowCount: rows.length,
  };
}

async function fetchSymbolHistory(symbol: string, months: string[], timeoutMs: number, asOfDate: string | null = null, retryCount = DEFAULT_RETRY_COUNT): Promise<SymbolHistoryResult> {
  const monthResults = [];
  const monthWarnings: string[] = [];

  for (const month of months) {
    try {
      const result = await fetchTwseStockDayMonth(symbol, month, timeoutMs, retryCount);
      monthResults.push(result);
      if (!result.ok) monthWarnings.push(`${month}:${result.error || result.stat}`);
    } catch (error: any) {
      monthWarnings.push(`${month}:network:${error?.message || String(error)}`);
      monthResults.push({ ok: false, month, rows: [], stat: "ERROR", error: error?.message || String(error), errorType: "network" });
    }
  }

  const rows = monthResults
    .flatMap((x) => x.rows || [])
    .filter((row) => row.volume !== null && row.close !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const uniqueRowsAll = Array.from(new Map(rows.map((row) => [row.date, row])).values())
    .sort((a, b) => a.date.localeCompare(b.date));

  const uniqueRows = asOfDate
    ? uniqueRowsAll.filter((row) => row.date <= asOfDate)
    : uniqueRowsAll;

  const latest = uniqueRows[uniqueRows.length - 1] || null;
  const last10Rows = uniqueRows.slice(-10).reverse();
  const last20Rows = uniqueRows.slice(-20).reverse();
  const last60Rows = uniqueRows.slice(-60).reverse();
  const last120Rows = uniqueRows.slice(-120).reverse();
  const last220Rows = uniqueRows.slice(-220).reverse();
  const historyRows = uniqueRows.slice(-220);
  const tech = calcTechnicals(uniqueRows);

  return {
    symbol,
    ok: Boolean(latest),
    latestDate: latest?.date || null,
    latestRawDate: latest?.rawDate || null,
    dailyOpen: latest?.open ?? null,
    dailyHigh: latest?.high ?? null,
    dailyLow: latest?.low ?? null,
    dailyClose: latest?.close ?? null,
    dailyVolume: latest?.volume ?? null,
    avgVolume10: tech.avgVolume10,
    avgVolume20: tech.avgVolume20,
    ma5: tech.ma5,
    ma10: tech.ma10,
    ma20: tech.ma20,
    ma60: tech.ma60,
    high20: tech.high20,
    low20: tech.low20,
    return20d: tech.return20d,
    return60d: tech.return60d,
    rsi14: tech.rsi14,
    rsi14Standard: tech.rsi14Standard,
    rsi14FinMindCompatible: tech.rsi14FinMindCompatible,
    rsi14WilderSeedSma: tech.rsi14WilderSeedSma,
    rsi14Simple: tech.rsi14Simple,
    rsi14Ema: tech.rsi14Ema,
    rsi14Cutler: tech.rsi14Cutler,
    k9: tech.k9,
    d9: tech.d9,
    j9: tech.j9,
    atr14: tech.atr14,
    atrPct: tech.atrPct,
    atrPctAvg20: tech.atrPctAvg20,
    atrPctVsAvg20: tech.atrPctVsAvg20,
    macd: tech.macd,
    macdSignal: tech.macdSignal,
    macdHist: tech.macdHist,
    macdHistDelta3: tech.macdHistDelta3,
    macdWarmupRows: tech.macdWarmupRows,
    rowCount: uniqueRows.length,
    last10Rows,
    last20Rows,
    last60Rows,
    last120Rows,
    last220Rows,
    historyRows,
    dataTime: {
      latestDate: latest?.date || null,
      latestRawDate: latest?.rawDate || null,
      monthsFetched: months,
      note: asOfDate
        ? "TWSE STOCK_DAY official source data dates filtered by asOfDate, not fetch/cache timestamps."
        : "TWSE STOCK_DAY official source data dates, not fetch/cache timestamps.",
    },
    technicalStatus: {
      ma60Ready: uniqueRows.length >= 60,
      macdWarmupReady: uniqueRows.length >= 100,
      kdReady: uniqueRows.length >= 9,
      rsiReady: uniqueRows.length >= 15,
      atrReady: uniqueRows.length >= 15,
      rowCount: uniqueRows.length,
      note: asOfDate
        ? `Route-only technical calculation from TWSE STOCK_DAY as of ${asOfDate}. Uses standard Wilder RSI14 as default; exposes FinMind-compatible Simple/Cutler RSI14 separately for validation.`
        : "Route-only technical calculation from TWSE STOCK_DAY. Uses standard Wilder RSI14 as default; exposes FinMind-compatible Simple/Cutler RSI14 separately for validation.",
    },
    sourceNote: asOfDate ? `TWSE STOCK_DAY official history + app calculated technicals as of ${asOfDate}` : "TWSE STOCK_DAY official history + app calculated technicals",
    ...(monthWarnings.length && !latest ? { error: monthWarnings.join("; ") } : {}),
    ...(monthWarnings.length && latest ? { monthWarnings } : {}),
  };
}

async function mapLimit<T, R>(items: T[], limit: number, mapper: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function buildDataTimeSummary(results: SymbolHistoryResult[]) {
  const latestDates = results.map((row) => row.latestDate).filter(Boolean).sort();
  const months = Array.from(new Set(results.flatMap((row) => row.dataTime.monthsFetched || []))).sort();

  return {
    latestDate: latestDates[latestDates.length - 1] || null,
    earliestLatestDate: latestDates[0] || null,
    symbolsWithHistory: results.filter((row) => row.ok).length,
    symbolsRequested: results.length,
    monthsFetched: months,
    note: "TWSE STOCK_DAY official source data dates, not fetch/cache timestamps.",
  };
}

function buildTechnicalSummary(results: SymbolHistoryResult[]) {
  const count = results.length || 1;
  return {
    ma60ReadyCount: results.filter((row) => row.technicalStatus.ma60Ready).length,
    macdWarmupReadyCount: results.filter((row) => row.technicalStatus.macdWarmupReady).length,
    kdReadyCount: results.filter((row) => row.technicalStatus.kdReady).length,
    rsiReadyCount: results.filter((row) => row.technicalStatus.rsiReady).length,
    atrReadyCount: results.filter((row) => row.technicalStatus.atrReady).length,
    total: count,
    note: "MACD warm-up uses rowCount >= 100 as safer validation threshold. Route still returns MACD when rowCount >= 35. RSI variants: WilderSeedSma(default standard), Simple/Cutler(FinMind-compatible), EMA.",
  };
}


// V73A4_SNAPSHOT_FIRST_HELPERS_START
type V73SnapshotCompactRow = {
  d?: string;
  o?: number | null;
  h?: number | null;
  l?: number | null;
  c?: number | null;
  v?: number | null;
};

type V73SnapshotPayload = {
  build?: string;
  builder?: string;
  updatedAt?: string;
  sourceLatestDate?: string | null;
  retentionRows?: number;
  symbols?: Record<string, V73SnapshotCompactRow[]>;
  diagnostics?: any;
};

const V73A4_SNAPSHOT_ROUTE_BUILD = "V73A4_TWSE_HISTORY_SNAPSHOT_FIRST_01";
const V73A4_SNAPSHOT_PATH = path.join(process.cwd(), "data", "twse-history-snapshot.json");
const PHASE_D_HISTORY_STATUS_PATH = path.join(process.cwd(), "data", "history-cache", "status.json");
const PHASE_D_HISTORY_REFRESH_SCRIPT_PATH = path.join(process.cwd(), "scripts", "phase-d-refresh-history-cache.mjs");
const execFileAsync = promisify(execFile);

function shouldUseV73Snapshot(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const forceLike =
    isForceRefresh(params) ||
    params.get("force") === "1" ||
    params.get("forceFetch") === "1" ||
    params.get("debugFetch") === "1" ||
    params.get("source") === "twse" ||
    params.get("source") === "live";

  return !forceLike;
}

function snapshotRowsToHistoryRows(rows: V73SnapshotCompactRow[], asOfDate: string | null): TwseHistoryRow[] {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.d)
    .filter((row) => !asOfDate || String(row.d) <= asOfDate)
    .map((row) => ({
      date: String(row.d),
      rawDate: String(row.d),
      open: row.o ?? null,
      high: row.h ?? null,
      low: row.l ?? null,
      close: row.c ?? null,
      volume: row.v ?? null,
      amount: null,
      change: null,
      transactions: null,
      raw: ["snapshot", row.d, row.o, row.h, row.l, row.c, row.v].map((x) => String(x ?? "")),
    }))
    .filter((row) => row.volume !== null && row.close !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildV73SnapshotDataTimeSummary(results: any[], snapshot: V73SnapshotPayload) {
  const latestDates = results.map((row) => row.latestDate).filter(Boolean).sort();
  return {
    latestDate: latestDates[latestDates.length - 1] || null,
    earliestDate: latestDates[0] || null,
    symbolsWithHistory: results.filter((row) => row.ok).length,
    symbolsRequested: results.length,
    snapshotUpdatedAt: snapshot.updatedAt || null,
    snapshotSourceLatestDate: snapshot.sourceLatestDate || null,
    note: "TWSE STOCK_DAY snapshot source data dates, not fetch/cache timestamps.",
  };
}

function buildV73SnapshotTechnicalSummary(results: any[]) {
  const count = results.length || 1;
  return {
    ma60ReadyCount: results.filter((row) => row.technicalStatus?.ma60Ready).length,
    macdWarmupReadyCount: results.filter((row) => row.technicalStatus?.macdWarmupReady).length,
    kdReadyCount: results.filter((row) => row.technicalStatus?.kdReady).length,
    rsiReadyCount: results.filter((row) => row.technicalStatus?.rsiReady).length,
    atrReadyCount: results.filter((row) => row.technicalStatus?.atrReady).length,
    total: count,
    note: "Calculated from local TWSE snapshot rows.",
  };
}



type PhaseDAutoRefreshResult = {
  build: string;
  enabled: boolean;
  attempted: boolean;
  skippedReason?: string;
  ok?: boolean;
  symbols?: string[];
  ttlMs?: number;
  lastAutoRefreshAt?: string | null;
  ageMs?: number | null;
  stdout?: string;
  stderr?: string;
  error?: string;
};

const phaseDAutoGlobal = globalThis as typeof globalThis & {
  __stockScorePhaseDHistoryAutoRefreshPromise?: Promise<PhaseDAutoRefreshResult> | null;
};

function envFlag(name: string) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function envFlagOff(name: string) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  return value === "0" || value === "false" || value === "no" || value === "off";
}

function parseBoundedNumber(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function isPhaseDRouteAutoRefreshEnabled(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("historyAutoRefresh") || req.nextUrl.searchParams.get("phaseDAutoRefresh");
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;

  if (envFlag("PHASE_D_HISTORY_CACHE_AUTO_REFRESH")) return true;
  if (envFlagOff("PHASE_D_HISTORY_CACHE_AUTO_REFRESH")) return false;

  // Local dev default only. Production should use GitHub Actions / durable cache refresh.
  return process.env.NODE_ENV === "development";
}

function phaseDAutoRefreshTtlMs(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("historyAutoRefreshTtlMs")
    || req.nextUrl.searchParams.get("phaseDAutoRefreshTtlMs")
    || process.env.PHASE_D_HISTORY_CACHE_AUTO_REFRESH_TTL_MS;
  return parseBoundedNumber(raw, 60 * 60 * 1000, 60 * 1000, 12 * 60 * 60 * 1000);
}

function phaseDAutoRefreshTimeoutMs(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("historyAutoRefreshTimeoutMs")
    || process.env.PHASE_D_HISTORY_CACHE_AUTO_REFRESH_TIMEOUT_MS;
  return parseBoundedNumber(raw, 180_000, 30_000, 10 * 60 * 1000);
}

function phaseDAutoRefreshMaxSymbols(req: NextRequest, requestedCount: number) {
  const raw = req.nextUrl.searchParams.get("historyAutoMaxSymbols")
    || req.nextUrl.searchParams.get("phaseDAutoMaxSymbols")
    || process.env.PHASE_D_HISTORY_CACHE_AUTO_MAX_SYMBOLS;
  return parseBoundedNumber(raw, requestedCount || MAX_SYMBOLS, 1, MAX_SYMBOLS);
}

async function readPhaseDHistoryStatus() {
  try {
    return JSON.parse(await fs.readFile(PHASE_D_HISTORY_STATUS_PATH, "utf8"));
  } catch {
    return null;
  }
}

function lastAutoRefreshAtFromStatus(status: any): string | null {
  if (!status || status.mode !== "auto") return null;
  return status.finishedAt || status.startedAt || null;
}

function compactOutput(value: string | undefined, maxLength = 1600) {
  const raw = String(value || "").trim();
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, maxLength)}...<truncated>`;
}

async function maybeRunPhaseDHistoryAutoRefresh(req: NextRequest, symbols: string[]): Promise<PhaseDAutoRefreshResult> {
  const enabled = isPhaseDRouteAutoRefreshEnabled(req);
  const baseResult: PhaseDAutoRefreshResult = {
    build: PHASE_D_ROUTE_AUTO_REFRESH_BUILD,
    enabled,
    attempted: false,
    symbols,
  };

  if (!enabled) return { ...baseResult, skippedReason: "disabled" };
  if (!symbols.length) return { ...baseResult, skippedReason: "no_symbols" };
  if (!shouldUseV73Snapshot(req)) return { ...baseResult, skippedReason: "force_or_live_request" };

  const ttlMs = phaseDAutoRefreshTtlMs(req);
  const status = await readPhaseDHistoryStatus();
  const lastAutoRefreshAt = lastAutoRefreshAtFromStatus(status);
  const lastAutoMs = Date.parse(lastAutoRefreshAt || "");
  const ageMs = Number.isFinite(lastAutoMs) ? Date.now() - lastAutoMs : null;
  const force = req.nextUrl.searchParams.get("historyAutoForce") === "1" || req.nextUrl.searchParams.get("phaseDAutoForce") === "1";

  if (!force && ageMs !== null && ageMs >= 0 && ageMs < ttlMs) {
    return {
      ...baseResult,
      ttlMs,
      lastAutoRefreshAt,
      ageMs,
      skippedReason: "fresh_within_ttl",
    };
  }

  if (phaseDAutoGlobal.__stockScorePhaseDHistoryAutoRefreshPromise) {
    return {
      ...baseResult,
      ttlMs,
      lastAutoRefreshAt,
      ageMs,
      skippedReason: "already_running",
    };
  }

  const selectedSymbols = symbols.slice(0, phaseDAutoRefreshMaxSymbols(req, symbols.length));
  const baseUrl = req.nextUrl.origin || process.env.PHASE_D_HISTORY_CACHE_BASE_URL || "http://localhost:3000";
  const args = [
    PHASE_D_HISTORY_REFRESH_SCRIPT_PATH,
    "--mode=auto",
    `--symbols=${selectedSymbols.join(",")}`,
    `--baseUrl=${baseUrl}`,
    "--autoFailOnPartial",
  ];

  const runPromise = execFileAsync(process.execPath, args, {
    cwd: process.cwd(),
    timeout: phaseDAutoRefreshTimeoutMs(req),
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 4,
    env: {
      ...process.env,
      // Prevent nested route-triggered auto refresh. The script uses force=1 internally.
      PHASE_D_HISTORY_CACHE_AUTO_REFRESH: "0",
    },
  })
    .then(({ stdout, stderr }) => ({
      ...baseResult,
      attempted: true,
      ok: true,
      symbols: selectedSymbols,
      ttlMs,
      lastAutoRefreshAt,
      ageMs,
      stdout: compactOutput(stdout),
      stderr: compactOutput(stderr),
    }))
    .catch((error: any) => ({
      ...baseResult,
      attempted: true,
      ok: false,
      symbols: selectedSymbols,
      ttlMs,
      lastAutoRefreshAt,
      ageMs,
      stdout: compactOutput(error?.stdout),
      stderr: compactOutput(error?.stderr),
      error: error?.message || String(error),
    }))
    .finally(() => {
      phaseDAutoGlobal.__stockScorePhaseDHistoryAutoRefreshPromise = null;
    });

  phaseDAutoGlobal.__stockScorePhaseDHistoryAutoRefreshPromise = runPromise;
  return runPromise;
}

async function tryBuildV73SnapshotPayload(req: NextRequest, symbols: string[], monthsBack: number, asOfDate: string | null) {
  if (!shouldUseV73Snapshot(req)) return null;

  let snapshot: V73SnapshotPayload | null = null;

  try {
    snapshot = JSON.parse(await fs.readFile(V73A4_SNAPSHOT_PATH, "utf8"));
  } catch {
    return null;
  }

  const snapshotSymbols = snapshot?.symbols || {};
  const results = symbols.map((symbol) => {
    const rows = snapshotRowsToHistoryRows(snapshotSymbols[symbol] || [], asOfDate);
    const latest = rows[rows.length - 1] || null;
    const tech = calcTechnicals(rows);

    return {
      ok: rows.length > 0,
      source: "twse_history_snapshot",
      symbol,
      latestDate: latest?.date || null,
      latestRawDate: latest?.rawDate || null,
      open: latest?.open ?? null,
      high: latest?.high ?? null,
      low: latest?.low ?? null,
      close: latest?.close ?? null,
      volume: latest?.volume ?? null,
      ma5: tech.ma5,
      ma10: tech.ma10,
      ma20: tech.ma20,
      ma60: tech.ma60,
      avgVolume10: tech.avgVolume10,
      avgVolume20: tech.avgVolume20,
      high20: tech.high20,
      low20: tech.low20,
      return20d: tech.return20d,
      return60d: tech.return60d,
      rsi14: tech.rsi14,
      rsi14Standard: tech.rsi14Standard,
      rsi14FinMindCompatible: tech.rsi14FinMindCompatible,
      rsi14WilderSeedSma: tech.rsi14WilderSeedSma,
      rsi14Simple: tech.rsi14Simple,
      rsi14Ema: tech.rsi14Ema,
      rsi14Cutler: tech.rsi14Cutler,
      k9: tech.k9,
      d9: tech.d9,
      j9: tech.j9,
      atr14: tech.atr14,
      atrPct: tech.atrPct,
      atrPctAvg20: tech.atrPctAvg20,
      atrPctVsAvg20: tech.atrPctVsAvg20,
      macd: tech.macd,
      macdSignal: tech.macdSignal,
      macdHist: tech.macdHist,
      macdHistDelta3: tech.macdHistDelta3,
      macdWarmupRows: tech.macdWarmupRows,
      rowCount: rows.length,
      last10Rows: rows.slice(-10).reverse(),
      last20Rows: rows.slice(-20).reverse(),
      last60Rows: rows.slice(-60).reverse(),
      last120Rows: rows.slice(-120).reverse(),
      last220Rows: rows.slice(-220).reverse(),
      historyRows: rows.slice(-220),
      dataTime: {
        latestDate: latest?.date || null,
        latestRawDate: latest?.rawDate || null,
        monthsFetched: [],
        snapshotUpdatedAt: snapshot?.updatedAt || null,
        snapshotSourceLatestDate: snapshot?.sourceLatestDate || null,
        note: asOfDate
          ? `TWSE STOCK_DAY local snapshot filtered by asOfDate ${asOfDate}.`
          : "TWSE STOCK_DAY local snapshot data dates, not fetch/cache timestamps.",
      },
      technicalStatus: {
        ma60Ready: rows.length >= 60,
        macdWarmupReady: rows.length >= 100,
        kdReady: rows.length >= 9,
        rsiReady: rows.length >= 15,
        atrReady: rows.length >= 15,
        rowCount: rows.length,
        note: "Snapshot technical calculation from local TWSE STOCK_DAY rows. Force/debug can still call live TWSE route.",
      },
      monthWarnings: [],
      error: rows.length > 0 ? "" : "No snapshot rows for symbol",
    };
  });

  const errors = results
    .filter((row) => !row.ok)
    .map((row) => ({ symbol: row.symbol, error: row.error || "No snapshot rows" }));

  return {
    ok: errors.length < symbols.length,
    source: "twse_history_snapshot",
    build: BUILD_VERSION,
    snapshotBuild: snapshot?.build || null,
    snapshotBuilder: snapshot?.builder || null,
    routeBuild: V73A4_SNAPSHOT_ROUTE_BUILD,
    params: {
      symbols,
      monthsBack,
      asOfDate,
      snapshotPath: "data/twse-history-snapshot.json",
    },
    dataTimeSummary: buildV73SnapshotDataTimeSummary(results, snapshot || {}),
    technicalSummary: buildV73SnapshotTechnicalSummary(results),
    count: results.length,
    passCount: results.filter((row) => row.ok).length,
    errors,
    warnings: [],
    history: results,
    cache: {
      hit: true,
      kind: "local_snapshot_file",
      source: "data/twse-history-snapshot.json",
      updatedAt: snapshot?.updatedAt || null,
      sourceLatestDate: snapshot?.sourceLatestDate || null,
    },
    cachePolicy: {
      build: BUILD_VERSION,
      kind: "snapshot_first",
      note: "Default route path reads local TWSE snapshot. Use force=1/source=twse/debugFetch=1 to bypass snapshot.",
    },
  };
}
// V73A4_SNAPSHOT_FIRST_HELPERS_END

async function uncachedGET(req: NextRequest) {
  const symbols = parseSymbols(req);
  if (!symbols.length) {
    return NextResponse.json(
      { ok: false, error: "Missing symbols", build: BUILD_VERSION, maxSymbols: MAX_SYMBOLS },
      { status: 400, headers: jsonHeaders() }
    );
  }

  const timeoutMs = clampNumber(Number(req.nextUrl.searchParams.get("timeoutMs") || DEFAULT_TIMEOUT_MS), 5_000, 60_000);
  const concurrency = clampNumber(Number(req.nextUrl.searchParams.get("concurrency") || DEFAULT_CONCURRENCY), 1, MAX_CONCURRENCY);
  const retryCount = clampNumber(Number(req.nextUrl.searchParams.get("retry") || req.nextUrl.searchParams.get("retryCount") || DEFAULT_RETRY_COUNT), 0, 4);
  const monthsBack = clampNumber(Number(req.nextUrl.searchParams.get("monthsBack") || DEFAULT_MONTHS_BACK), 2, MAX_MONTHS_BACK);
  const months = monthList(monthsBack, new Date());
  const asOfDate = parseAsOfDate(req);

  const results = await mapLimit(symbols, concurrency, async (symbol) => fetchSymbolHistory(symbol, months, timeoutMs, asOfDate, retryCount));

  const errors = results
    .filter((row) => !row.ok)
    .map((row) => ({ symbol: row.symbol, error: row.error || "No history rows" }));

  const warnings = results
    .filter((row) => row.ok && Array.isArray(row.monthWarnings) && row.monthWarnings.length)
    .map((row) => ({ symbol: row.symbol, warnings: row.monthWarnings }));

  return NextResponse.json(
    {
      ok: errors.length < symbols.length,
      source: "twse_history",
      build: BUILD_VERSION,
      input: {
        requestedSymbols: symbols,
        requestedCount: symbols.length,
        maxSymbols: MAX_SYMBOLS,
        months,
        monthsBack,
        asOfDate,
        concurrency,
        maxConcurrency: MAX_CONCURRENCY,
        retryCount,
        retryBaseDelayMs: DEFAULT_RETRY_BASE_DELAY_MS,
        timeoutMs,
      },
      dataTimeSummary: buildDataTimeSummary(results),
      technicalSummary: buildTechnicalSummary(results),
      count: results.length,
      passCount: results.filter((row) => row.ok).length,
      history: results,
      errors,
      warnings,
      warningCount: warnings.length,
      errorCount: errors.length,
      fetchedAt: new Date().toISOString(),
      policy: {
        kind: "scheduled_daily",
        refreshWindows: ["14:10", "15:30", "18:00", "22:00"],
        maxSymbols: MAX_SYMBOLS,
        defaultConcurrency: DEFAULT_CONCURRENCY,
        maxConcurrency: MAX_CONCURRENCY,
        retryCount,
        retryBaseDelayMs: DEFAULT_RETRY_BASE_DELAY_MS,
        defaultMonthsBack: DEFAULT_MONTHS_BACK,
        note: asOfDate ? "Route-only official historical validation filtered by asOfDate for same-date comparison. Do not call it as an intraday auto-refresh source. Avoid force except debug. Network fetches use retry/backoff and small concurrency." : "Route-only official historical validation. Do not call it as an intraday auto-refresh source. Avoid force except debug. Network fetches use retry/backoff and small concurrency.",
      },
    },
    { headers: jsonHeaders() }
  );
}

export async function GET(req: NextRequest) {
  const ttlMs = scheduledHistoryTtlMs();
  const symbols = parseSymbols(req);
  const monthsBack = clampNumber(Number(req.nextUrl.searchParams.get("monthsBack") || DEFAULT_MONTHS_BACK), 2, MAX_MONTHS_BACK);
  const concurrency = clampNumber(Number(req.nextUrl.searchParams.get("concurrency") || DEFAULT_CONCURRENCY), 1, MAX_CONCURRENCY);
  const retryCount = clampNumber(Number(req.nextUrl.searchParams.get("retry") || req.nextUrl.searchParams.get("retryCount") || DEFAULT_RETRY_COUNT), 0, 4);
  const asOfDate = parseAsOfDate(req);

  const phaseDAutoRefresh = await maybeRunPhaseDHistoryAutoRefresh(req, symbols);
  const snapshotPayload = await tryBuildV73SnapshotPayload(req, symbols, monthsBack, asOfDate);
  if (snapshotPayload) {
    return NextResponse.json(
      {
        ...snapshotPayload,
        cachePolicy: {
          ...(snapshotPayload.cachePolicy || {}),
          phaseDAutoRefresh,
        },
      },
      { headers: jsonHeaders() }
    );
  }

  const cacheKey = [
    "twse_history_v02h",
    `symbols=${normalizeCacheKeyPart(symbols.join(","))}`,
    `monthsBack=${monthsBack}`,
    `concurrency=${concurrency}`,
    `retry=${retryCount}`,
    asOfDate ? `asOfDate=${asOfDate}` : "asOfDate=latest",
  ].join(":");

  try {
    const cached = await getOrFetchCached({
      key: cacheKey,
      ttlMs,
      force: isForceRefresh(req.nextUrl.searchParams),
      fetcher: async () => {
        const res = await uncachedGET(req);
        const payload = await res.json();
        return { payload, status: res.status || 200 };
      },
    });

    return NextResponse.json(
      {
        ...cached.value.payload,
        cache: cached.cache,
        cachePolicy: {
          build: BUILD_VERSION,
          kind: "scheduled_daily",
          ttlMs,
          refreshWindows: ["14:10", "15:30", "18:00", "22:00"],
          force: isForceRefresh(req.nextUrl.searchParams),
          maxSymbols: MAX_SYMBOLS,
          defaultConcurrency: DEFAULT_CONCURRENCY,
          maxConcurrency: MAX_CONCURRENCY,
          retryCount,
          retryBaseDelayMs: DEFAULT_RETRY_BASE_DELAY_MS,
          monthsBack,
          asOfDate,
        },
      },
      { status: cached.value.status || 200, headers: jsonHeaders() }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        source: "twse_history",
        build: BUILD_VERSION,
        error: error?.message || String(error),
        fetchedAt: new Date().toISOString(),
      },
      { status: 500, headers: jsonHeaders() }
    );
  }
}
