import { NextResponse } from "next/server";
import { getOrFetchCached, isForceRefresh, normalizeCacheKeyPart, parseTtlMs } from "@/lib/serverCache";

export const dynamic = "force-dynamic";

type TwseMisRaw = Record<string, any>;

type PriceType = "last" | "trial" | "mid" | "none";

type NormalizedRow = {
  symbol: string;
  stock_id: string;
  name: string;
  ticker: string;
  source: string;
  sourceNote: string;

  price: number | null;
  priceType: PriceType;
  displayPrice: number | null;
  displayPriceType: PriceType;
  quoteMidPrice: number | null;
  bid1: number | null;
  ask1: number | null;

  prevClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;

  volume: number | null;
  twseMisLots: number | null;
  twseMisLastTradeVolume: number | null;

  tradetime: string;
  updatedAt: string;
  rawDate: string;
  rawTime: string;
  tlongMs: number | null;
  quoteAgeSec: number | null;

  exchange: string;
  channel: string;
  navUrl: string;
  isEtfCandidate: boolean;
  securityTypeCode: string;

  raw: TwseMisRaw;
};

type EtfListItem = {
  symbol: string;
  stock_id: string;
  name: string;
  ticker: string;
  exchange: string;
  channel: string;
  key: string;
  bp: string;
};

type MarketIndexItem = {
  symbol: string;
  name: string;
  price: number | null;
  prevClose: number | null;
  change: number | null;
  changePct: number | null;
  tradetime: string;
  updatedAt: string;
  rawDate: string;
  rawTime: string;
  tlongMs: number | null;
  quoteAgeSec: number | null;
  exchange: string;
  channel: string;
  raw: TwseMisRaw;
};

const TWSE_MIS_BASE = "https://mis.twse.com.tw";
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_SYMBOLS = 50;
const BUILD_VERSION = "TWSE_MIS_CACHE_BUILD_02C_FIRST_LOAD_RETRY";
const DEFAULT_CACHE_TTL_MS = 15 * 1000;

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}

function normalizeIndexAlias(value: unknown): string | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;

  const compact = raw.replace(/[^0-9a-z]/g, "");

  if (
    raw === "t00" ||
    raw === "tse_t00.tw" ||
    raw === "tse_t00" ||
    raw === "taiex" ||
    raw === "weighted" ||
    raw === "加權指數" ||
    compact === "t00" ||
    compact === "tset00tw" ||
    compact === "tset00" ||
    compact === "taiex"
  ) {
    return "TAIEX";
  }

  return null;
}

function isMarketIndexSymbol(symbol: string): boolean {
  return symbol === "TAIEX";
}

function normalizeSymbol(value: unknown): string {
  const indexAlias = normalizeIndexAlias(value);
  if (indexAlias) return indexAlias;

  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return "";

  let s = raw;
  if (s.startsWith("TPE:")) s = s.slice(4);
  if (s.startsWith("TWO:")) s = s.slice(4);
  if (s.endsWith(".TW")) s = s.slice(0, -3);
  if (s.endsWith(".TWO")) s = s.slice(0, -4);
  if (s.endsWith(".TPE")) s = s.slice(0, -4);

  s = s.replace(/[^0-9A-Z]/g, "");
  if (/^[0-9]{1,4}$/.test(s)) return s.padStart(4, "0");
  return s;
}

function parseSymbols(searchParams: URLSearchParams): string[] {
  const raw =
    searchParams.get("symbols") ||
    searchParams.get("symbol") ||
    searchParams.get("stocks") ||
    "";

  return raw
    .split(/[,\s|]+/)
    .map(normalizeSymbol)
    .filter(Boolean)
    .filter((s, idx, arr) => arr.indexOf(s) === idx)
    .slice(0, MAX_SYMBOLS);
}

function parseNumber(value: unknown): number | null {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (!raw || raw === "-" || raw === "--" || raw.toUpperCase() === "N/A") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseLotsToShares(value: unknown): number | null {
  const lots = parseNumber(value);
  if (lots === null) return null;
  return Math.round(lots * 1000);
}

function firstPriceFromUnderscoreList(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-" || raw === "--") return null;
  const first = raw.split("_").map((x) => x.trim()).find(Boolean);
  return parseNumber(first);
}

function makeTradeTime(rawDate: string, rawTime: string): string {
  const d = String(rawDate || "").trim();
  const t = String(rawTime || "").trim();

  if (/^\d{8}$/.test(d) && t) {
    return `${d.slice(0, 4)}/${d.slice(4, 6)}/${d.slice(6, 8)} ${t}`;
  }

  if (d && t) return `${d} ${t}`;
  return "";
}

function inferExchange(_symbol: string): "tse" | "otc" {
  // 目前先預設 tse。route 會同時組 tse / otc 做 fallback。
  // 後續可依 TWSE/TPEx 清單快取精準分類。
  return "tse";
}

function buildCandidateChannels(symbols: string[]): string[] {
  const channels: string[] = [];

  for (const symbol of symbols) {
    if (isMarketIndexSymbol(symbol)) {
      channels.push("tse_t00.tw");
      continue;
    }

    const preferred = inferExchange(symbol);
    const first = `${preferred}_${symbol}.tw`;
    const second = preferred === "tse" ? `otc_${symbol}.tw` : `tse_${symbol}.tw`;

    channels.push(first);
    channels.push(second);
  }

  return channels.filter((x, idx, arr) => arr.indexOf(x) === idx);
}

async function fetchText(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json,text/plain,*/*",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache,no-store",
        Pragma: "no-cache",
        Referer: "https://mis.twse.com.tw/stock/index.jsp",
      },
    });

    const text = await res.text();

    if (!res.ok) {
      throw new Error(`TWSE MIS HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<any> {
  const text = await fetchText(url, timeoutMs);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`TWSE MIS JSON parse failed: ${text.slice(0, 300)}`);
  }
}

function normalizeMisRow(raw: TwseMisRaw, fetchedAtMs: number): NormalizedRow | null {
  const symbol = normalizeSymbol(raw?.c || raw?.ch || raw?.["@"]);
  if (!symbol) return null;

  const exchange = String(raw?.ex || "").trim() || (String(raw?.ch || "").includes(".tw") ? "tse" : "");
  const channel = String(raw?.ch || raw?.["@"] || "").trim();
  const name = String(raw?.n || raw?.nf || symbol).trim();

  const lastPrice = parseNumber(raw?.z);
  const trialPrice = parseNumber(raw?.pz);
  const ask1 = firstPriceFromUnderscoreList(raw?.a);
  const bid1 = firstPriceFromUnderscoreList(raw?.b);
  const quoteMidPrice =
    bid1 !== null && ask1 !== null && bid1 > 0 && ask1 > 0
      ? Number(((bid1 + ask1) / 2).toFixed(4))
      : null;

  let price: number | null = null;
  let priceType: PriceType = "none";

  if (lastPrice !== null && lastPrice > 0) {
    price = lastPrice;
    priceType = "last";
  } else if (trialPrice !== null && trialPrice > 0) {
    price = trialPrice;
    priceType = "trial";
  } else {
    // 不把 mid 當正式成交價；但保留 quoteMidPrice 給 ETF 風控小卡參考。
    price = null;
    priceType = quoteMidPrice !== null ? "mid" : "none";
  }

  const displayPrice = price ?? quoteMidPrice;
  const displayPriceType: PriceType = price !== null ? priceType : quoteMidPrice !== null ? "mid" : "none";

  const rawDate = String(raw?.d || raw?.["^"] || "").trim();
  const rawTime = String(raw?.t || raw?.["%"] || "").trim();
  const tradetime = makeTradeTime(rawDate, rawTime);

  const tlongMs = parseNumber(raw?.tlong);
  const quoteAgeSec =
    tlongMs !== null && tlongMs > 0
      ? Math.max(0, Math.round((fetchedAtMs - tlongMs) / 1000))
      : null;

  const lots = parseNumber(raw?.v);
  const volume = parseLotsToShares(raw?.v);
  const lastTradeVolume = parseNumber(raw?.tv);

  const navUrl = String(raw?.nu || "").trim();
  const securityTypeCode = String(raw?.it || "").trim();

  // ETF 在 TWSE MIS raw 常見 it=02，且會有 nu 投信 NAV 連結。
  // 避免用「4碼數字」誤把一般股票 2330 判成 ETF。
  const isEtfCandidate = !!navUrl || securityTypeCode === "02";

  return {
    symbol,
    stock_id: symbol,
    name,
    ticker: channel || `${symbol}.tw`,
    source: "TWSE MIS",
    sourceNote: "TWSE MIS",

    price,
    priceType,
    displayPrice,
    displayPriceType,
    quoteMidPrice,
    bid1,
    ask1,

    prevClose: parseNumber(raw?.y),
    open: parseNumber(raw?.o),
    high: parseNumber(raw?.h),
    low: parseNumber(raw?.l),

    volume,
    twseMisLots: lots,
    twseMisLastTradeVolume: lastTradeVolume,

    tradetime,
    updatedAt: tradetime,
    rawDate,
    rawTime,
    tlongMs,
    quoteAgeSec,

    exchange,
    channel,
    navUrl,
    isEtfCandidate,
    securityTypeCode,

    raw,
  };
}

function chooseBestRows(rows: NormalizedRow[], requestedSymbols: string[]) {
  const bySymbol: Record<string, NormalizedRow> = {};

  for (const symbol of requestedSymbols) {
    const candidates = rows.filter((row) => row.symbol === symbol);
    if (!candidates.length) continue;

    const withPrice = candidates.find((row) => row.price !== null);
    const withDisplayPrice = candidates.find((row) => row.displayPrice !== null);
    const withVolume = candidates.find((row) => row.volume !== null);
    const first = candidates[0];

    bySymbol[symbol] = withPrice || withDisplayPrice || withVolume || first;
  }

  return bySymbol;
}

function buildRawDataMap(rowsBySymbol: Record<string, NormalizedRow>) {
  return Object.fromEntries(
    Object.entries(rowsBySymbol).map(([symbol, row]) => [
      symbol,
      {
        ...row,
        raw: undefined,
        twseMisRaw: row.raw,
      },
    ]),
  );
}

function normalizeMarketIndexRow(raw: TwseMisRaw, fetchedAtMs: number): MarketIndexItem | null {
  const channel = String(raw?.ch || raw?.["@"] || "").trim().toLowerCase();
  const rawSymbol = normalizeSymbol(raw?.c || raw?.ch || raw?.["@"]);

  if (rawSymbol !== "TAIEX" && channel !== "tse_t00.tw" && channel !== "t00.tw") return null;

  const rawDate = String(raw?.d || raw?.["^"] || "").trim();
  const rawTime = String(raw?.t || raw?.["%"] || "").trim();
  const tradetime = makeTradeTime(rawDate, rawTime);

  const price = parseNumber(raw?.z);
  const prevClose = parseNumber(raw?.y);
  const change =
    price !== null && prevClose !== null
      ? Number((price - prevClose).toFixed(2))
      : parseNumber(raw?.diff);
  const changePct =
    price !== null && prevClose !== null && prevClose > 0
      ? Number((((price - prevClose) / prevClose) * 100).toFixed(2))
      : null;

  const tlongMs = parseNumber(raw?.tlong);
  const quoteAgeSec =
    tlongMs !== null && tlongMs > 0
      ? Math.max(0, Math.round((fetchedAtMs - tlongMs) / 1000))
      : null;

  return {
    symbol: "TAIEX",
    name: String(raw?.n || raw?.nf || "加權指數").trim() || "加權指數",
    price,
    prevClose,
    change,
    changePct,
    tradetime,
    updatedAt: tradetime,
    rawDate,
    rawTime,
    tlongMs,
    quoteAgeSec,
    exchange: String(raw?.ex || "tse").trim() || "tse",
    channel: String(raw?.ch || raw?.["@"] || "tse_t00.tw").trim() || "tse_t00.tw",
    raw,
  };
}

function buildMarketIndex(rawRows: TwseMisRaw[], fetchedAtMs: number): MarketIndexItem | null {
  for (const row of rawRows) {
    const normalized = normalizeMarketIndexRow(row, fetchedAtMs);
    if (normalized) return normalized;
  }

  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getUsableQuotePrice(row: NormalizedRow | null | undefined): number | null {
  const price = row?.price;
  if (typeof price === "number" && Number.isFinite(price) && price > 0) return price;
  const displayPrice = row?.displayPrice;
  if (typeof displayPrice === "number" && Number.isFinite(displayPrice) && displayPrice > 0) return displayPrice;
  const quoteMidPrice = row?.quoteMidPrice;
  if (typeof quoteMidPrice === "number" && Number.isFinite(quoteMidPrice) && quoteMidPrice > 0) return quoteMidPrice;
  return null;
}

function summarizeQuoteResult(result: Awaited<ReturnType<typeof fetchTwseMisQuotes>>) {
  const requested = Array.isArray(result?.requestedSymbols) ? result.requestedSymbols.filter((symbol) => !isMarketIndexSymbol(symbol)) : [];
  const rowSymbols = new Set((Array.isArray(result?.rows) ? result.rows : []).map((row) => normalizeSymbol(row?.symbol || row?.stock_id)).filter(Boolean));
  const priceSymbols = new Set((Array.isArray(result?.rows) ? result.rows : []).filter((row) => getUsableQuotePrice(row) !== null).map((row) => normalizeSymbol(row?.symbol || row?.stock_id)).filter(Boolean));
  return {
    requestedCount: requested.length,
    rowCount: rowSymbols.size,
    usablePriceCount: priceSymbols.size,
    missingSymbols: requested.filter((symbol) => !rowSymbols.has(symbol)),
    priceMissingSymbols: requested.filter((symbol) => !priceSymbols.has(symbol)),
  };
}

function shouldRetryQuoteResult(result: Awaited<ReturnType<typeof fetchTwseMisQuotes>>) {
  const summary = summarizeQuoteResult(result);
  if (!summary.requestedCount) return false;
  if (!summary.rowCount) return true;
  if (summary.missingSymbols.length) return true;
  return summary.priceMissingSymbols.length > 0;
}

function chooseBetterQuoteResult<T extends Awaited<ReturnType<typeof fetchTwseMisQuotes>> | null>(current: T, next: Awaited<ReturnType<typeof fetchTwseMisQuotes>>): Awaited<ReturnType<typeof fetchTwseMisQuotes>> {
  if (!current) return next;
  const currentSummary = summarizeQuoteResult(current);
  const nextSummary = summarizeQuoteResult(next);
  if (nextSummary.usablePriceCount > currentSummary.usablePriceCount) return next;
  if (nextSummary.usablePriceCount === currentSummary.usablePriceCount && nextSummary.rowCount > currentSummary.rowCount) return next;
  return current;
}

async function fetchTwseMisQuotesWithRetry(symbols: string[], timeoutMs: number, fetchedAtMs: number) {
  const attempts = 3;
  let bestResult: Awaited<ReturnType<typeof fetchTwseMisQuotes>> | null = null;
  let lastError: any = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const attemptFetchedAtMs = attempt === 1 ? fetchedAtMs : Date.now();
      const result = await fetchTwseMisQuotes(symbols, timeoutMs, attemptFetchedAtMs);
      bestResult = chooseBetterQuoteResult(bestResult, result);
      if (!shouldRetryQuoteResult(result)) break;
      if (attempt < attempts) await sleep(350 * attempt);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(350 * attempt);
    }
  }

  if (!bestResult && lastError) throw lastError;
  if (!bestResult) return fetchTwseMisQuotes(symbols, timeoutMs, Date.now());
  return bestResult;
}

async function fetchTwseMisQuotes(symbols: string[], timeoutMs: number, fetchedAtMs: number) {
  if (!symbols.length) {
    return {
      requestedSymbols: symbols,
      rows: [] as NormalizedRow[],
      rawDataMap: {},
      missingSymbols: [] as string[],
      upstream: null,
      upstreamUrl: "",
    };
  }

  const channels = buildCandidateChannels(symbols);
  const exCh = channels.join("|");

  const upstreamUrl =
    `${TWSE_MIS_BASE}/stock/api/getStockInfo.jsp` +
    `?ex_ch=${encodeURIComponent(exCh)}` +
    `&json=1&delay=0&_=${Date.now()}`;

  const upstream = await fetchJson(upstreamUrl, timeoutMs);
  const rawRows = Array.isArray(upstream?.msgArray) ? upstream.msgArray : [];
  const marketIndex = buildMarketIndex(rawRows, fetchedAtMs);
  const quoteSymbols = symbols.filter((symbol) => !isMarketIndexSymbol(symbol));
  const normalizedRows = rawRows.map((row: TwseMisRaw) => normalizeMisRow(row, fetchedAtMs)).filter(Boolean) as NormalizedRow[];
  const bestRows = chooseBestRows(normalizedRows, quoteSymbols);
  const rows = quoteSymbols.map((symbol) => bestRows[symbol]).filter(Boolean) as NormalizedRow[];
  const rawDataMap = buildRawDataMap(bestRows);
  const missingSymbols = [
    ...quoteSymbols.filter((symbol) => !bestRows[symbol]),
    ...symbols.filter((symbol) => isMarketIndexSymbol(symbol) && !marketIndex),
  ];

  return {
    requestedSymbols: symbols,
    rows,
    rawDataMap,
    missingSymbols,
    marketIndex,
    upstream,
    upstreamUrl,
  };
}

async function fetchEtfList(timeoutMs: number) {
  const url =
    `${TWSE_MIS_BASE}/stock/api/getCategory.jsp` +
    `?ex=tse&i=B0&_=${Date.now()}&lang=zh_tw`;

  const upstream = await fetchJson(url, timeoutMs);
  const msgArray = Array.isArray(upstream?.msgArray) ? upstream.msgArray : [];

  const etfs: EtfListItem[] = msgArray
    .map((row: any) => {
      const symbol = normalizeSymbol(row?.ch || row?.key);
      return {
        symbol,
        stock_id: symbol,
        name: String(row?.n || symbol).trim(),
        ticker: String(row?.ch || "").trim(),
        exchange: String(row?.ex || "tse").trim(),
        channel: String(row?.ch || "").trim(),
        key: String(row?.key || "").trim(),
        bp: String(row?.bp ?? "").trim(),
      };
    })
    .filter((row: EtfListItem) => row.symbol);

  return {
    url,
    count: etfs.length,
    etfs,
    raw: upstream,
  };
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);

  const symbols = parseSymbols(searchParams);
  const includeEtfList =
    searchParams.get("includeEtfList") === "1" ||
    searchParams.get("etfList") === "1";

  const timeoutMs = Math.max(
    3000,
    Math.min(Number(searchParams.get("timeoutMs") || DEFAULT_TIMEOUT_MS), 30000),
  );

  try {
    const force = isForceRefresh(searchParams);
    const cacheTtlMs = parseTtlMs(searchParams, DEFAULT_CACHE_TTL_MS);
    const cacheKey = [
      "twse_mis",
      normalizeCacheKeyPart(symbols.join(",")),
      includeEtfList ? "etfList=1" : "etfList=0",
    ].join(":");

    const cached = await getOrFetchCached({
      key: cacheKey,
      ttlMs: cacheTtlMs,
      force,
      meta: { symbols, includeEtfList },
      fetcher: async () => {
        const fetchedAtMs = Date.now();
        const quoteResult = await fetchTwseMisQuotesWithRetry(symbols, timeoutMs, fetchedAtMs);
        const quoteSummary = summarizeQuoteResult(quoteResult);
        const etfListResult = includeEtfList ? await fetchEtfList(timeoutMs) : null;

        return {
          ok: true,
          source: "twse_mis",
          route: "/api/twse/mis",
          version: BUILD_VERSION,
          refreshHintSec: 5,
          note:
            "TWSE MIS 盤中近即時價量來源。股票可用 last price / volume；ETF 多數 z 為 '-'，因此提供 displayPrice/quoteMidPrice 作五檔參考價。ETF 另提供 B0 清單、行情與 raw.nu 投信 NAV 連結。支援 t00 / TAIEX 查詢加權指數，回傳 marketIndex 並計算與昨收相比的漲跌與漲跌%。ETF iNAV / 折溢價由 /api/etf/inav 提供，不進短線分數。首次載入若遇到 MIS 空包 / 部分缺價，route 會短暫重試後回傳最佳結果。",
          requestedSymbols: symbols,
          quoteSummary,
          count: quoteResult.rows.length,
          rows: quoteResult.rows.map((row) => ({
            ...row,
            raw: undefined,
            twseMisRaw: row.raw,
          })),
          rawDataMap: quoteResult.rawDataMap,
          missingSymbols: quoteResult.missingSymbols,
          priceMissingSymbols: quoteSummary.priceMissingSymbols,
          marketIndex: quoteResult.marketIndex
            ? {
                ...quoteResult.marketIndex,
                raw: undefined,
                twseMisRaw: quoteResult.marketIndex.raw,
              }
            : null,
          etfList: etfListResult
            ? {
                count: etfListResult.count,
                etfs: etfListResult.etfs,
                sourceUrl: etfListResult.url,
              }
            : null,
          upstream: {
            quoteUrl: quoteResult.upstreamUrl,
            rtcode: quoteResult.upstream?.rtcode,
            rtmessage: quoteResult.upstream?.rtmessage,
            queryTime: quoteResult.upstream?.queryTime,
            cachedAlive: quoteResult.upstream?.cachedAlive,
          },
          elapsedMs: Date.now() - fetchedAtMs,
          fetchedAt: new Date(fetchedAtMs).toISOString(),
        };
      },
    });

    return json({
      ...cached.value,
      cache: cached.cache,
      cachePolicy: {
        realtime: true,
        ttlMs: cacheTtlMs,
        force,
        sourceUpdateTimeField: "rows[].tradetime / marketIndex.tradetime / fetchedAt",
      },
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error: any) {
    return json(
      {
        ok: false,
        source: "twse_mis",
        route: "/api/twse/mis",
        version: BUILD_VERSION,
        requestedSymbols: symbols,
        error: error?.message || String(error),
        elapsedMs: Date.now() - startedAt,
        fetchedAt: new Date(startedAt).toISOString(),
      },
      500,
    );
  }
}
