import { NextRequest, NextResponse } from "next/server";
import { getOrFetchScheduledDailyCached, isForceRefresh } from "@/lib/serverCache";

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



type YahooEtfRow = {
  symbol: string;
  stock_id: string;
  source: string;
  sourcePage: "premium" | "discount" | "unknown";
  rank: number | null;
  name: string;
  marketPrice: number | null;
  change: number | null;
  changePct: number | null;
  rangeHigh: number | null;
  rangeLow: number | null;
  rangeSpread: number | null;
  premiumDiscountPct: number | null;
  refUrl: string;
  fetchedAt: string;
  probeQuality: {
    matched: boolean;
    extractedAny: boolean;
    parserVersion: string;
    notes: string[];
  };
  rawText?: string;
};

type FetchStatus = {
  id: string;
  ok: boolean;
  status: number;
  contentType: string;
  elapsedMs: number;
  url: string;
  byteLength: number;
  preview: string;
  error: string;
};

const YAHOO_ETF_PAGES = [
  { id: "premium", url: "https://tw.stock.yahoo.com/tw-etf/premium", sourcePage: "premium" as const },
  { id: "discount", url: "https://tw.stock.yahoo.com/tw-etf/discount", sourcePage: "discount" as const },
];

function parseSymbols(input: string | null): string[] {
  const raw = input || "0050,0056,00878";
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/\.(TW|TWO)$/i, "").padStart(4, "0"))
    )
  );
}

function decodeHtml(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\\u002F/g, "/")
    .replace(/\\u0026/g, "&")
    .replace(/\\u003C/gi, "<")
    .replace(/\\u003E/gi, ">")
    .replace(/\\u0022/g, '"');
}

function stripHtmlToText(html: string): string {
  return decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(value: string | null | undefined): number | null {
  if (value == null) return null;
  const s = String(value).replace(/,/g, "").replace("%", "").trim();
  if (!s || s === "-" || s === "--") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function buildEmptyRow(symbol: string, fetchedAt: string): YahooEtfRow {
  return {
    symbol,
    stock_id: symbol,
    source: "Yahoo ETF page text",
    sourcePage: "unknown",
    rank: null,
    name: "",
    marketPrice: null,
    change: null,
    changePct: null,
    rangeHigh: null,
    rangeLow: null,
    rangeSpread: null,
    premiumDiscountPct: null,
    refUrl: "",
    fetchedAt,
    probeQuality: {
      matched: false,
      extractedAny: false,
      parserVersion: "yahoo_etf_parser_v2",
      notes: ["not_found"],
    },
  };
}

function extractRowFromText(
  text: string,
  symbol: string,
  sourcePage: "premium" | "discount",
  refUrl: string,
  fetchedAt: string,
  debug: boolean
): YahooEtfRow | null {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Yahoo ETF ranking row example:
  // 32 元大台灣50 0050.TW 96.85 0.05 0.05% 97.35 95.50 1.85 0.08%
  const rowRegex = new RegExp(
    "(?:^|\\s)(\\d{1,3})\\s+(.{1,40}?)\\s+" +
      escaped +
      "\\.(?:TW|TWO)\\s+" +
      "([-+]?\\d+(?:\\.\\d+)?)\\s+" +
      "([-+]?\\d+(?:\\.\\d+)?)\\s+" +
      "([-+]?\\d+(?:\\.\\d+)?)%\\s+" +
      "([-+]?\\d+(?:\\.\\d+)?)\\s+" +
      "([-+]?\\d+(?:\\.\\d+)?)\\s+" +
      "([-+]?\\d+(?:\\.\\d+)?)\\s+" +
      "([-+]?\\d+(?:\\.\\d+)?)%",
    "u"
  );

  const match = text.match(rowRegex);
  if (!match) return null;

  const [
    raw,
    rankRaw,
    nameRaw,
    marketPriceRaw,
    changeRaw,
    changePctRaw,
    highRaw,
    lowRaw,
    spreadRaw,
    premiumRaw,
  ] = match;

  const name = nameRaw.replace(/\s+/g, "").replace(/^\d+/, "").trim();

  const row: YahooEtfRow = {
    symbol,
    stock_id: symbol,
    source: "Yahoo ETF page text",
    sourcePage,
    rank: toNumber(rankRaw),
    name,
    marketPrice: toNumber(marketPriceRaw),
    change: toNumber(changeRaw),
    changePct: toNumber(changePctRaw),
    rangeHigh: toNumber(highRaw),
    rangeLow: toNumber(lowRaw),
    rangeSpread: toNumber(spreadRaw),
    premiumDiscountPct: toNumber(premiumRaw),
    refUrl,
    fetchedAt,
    probeQuality: {
      matched: true,
      extractedAny: true,
      parserVersion: "yahoo_etf_parser_v2",
      notes: [],
    },
  };

  if (debug) row.rawText = raw.trim();
  return row;
}

function betterRow(a: YahooEtfRow | null, b: YahooEtfRow | null): YahooEtfRow | null {
  if (!a) return b;
  if (!b) return a;
  const score = (row: YahooEtfRow) =>
    (row.marketPrice != null ? 2 : 0) +
    (row.premiumDiscountPct != null ? 2 : 0) +
    (row.name ? 1 : 0) +
    (row.sourcePage === "premium" || row.sourcePage === "discount" ? 1 : 0);
  return score(b) > score(a) ? b : a;
}

async function fetchText(url: string): Promise<{ text: string; status: FetchStatus }> {
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
      },
    });
    const text = await res.text();
    return {
      text,
      status: {
        id: "",
        ok: res.ok,
        status: res.status,
        contentType: res.headers.get("content-type") || "",
        elapsedMs: Date.now() - startedAt,
        url,
        byteLength: text.length,
        preview: text.slice(0, 900),
        error: "",
      },
    };
  } catch (error) {
    return {
      text: "",
      status: {
        id: "",
        ok: false,
        status: 0,
        contentType: "",
        elapsedMs: Date.now() - startedAt,
        url,
        byteLength: 0,
        preview: "",
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

async function uncachedGET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbols = parseSymbols(searchParams.get("symbols"));
  const debug = searchParams.get("debug") === "1";
  const fetchedAt = new Date().toISOString();

  const statuses: FetchStatus[] = [];
  const pageTexts: Array<{
    id: string;
    sourcePage: "premium" | "discount";
    url: string;
    text: string;
  }> = [];

  for (const page of YAHOO_ETF_PAGES) {
    const { text: html, status } = await fetchText(page.url);
    statuses.push({ ...status, id: page.id });
    if (status.ok && html) {
      pageTexts.push({
        id: page.id,
        sourcePage: page.sourcePage,
        url: page.url,
        text: stripHtmlToText(html),
      });
    }
  }

  const etfs: YahooEtfRow[] = symbols.map((symbol) => {
    let best: YahooEtfRow | null = null;
    for (const page of pageTexts) {
      const row = extractRowFromText(page.text, symbol, page.sourcePage, page.url, fetchedAt, debug);
      best = betterRow(best, row);
    }
    return best || buildEmptyRow(symbol, fetchedAt);
  });

  const validEtfs = etfs.filter((row) => row.probeQuality.extractedAny);
  const rawDataMap = Object.fromEntries(etfs.map((row) => [row.symbol, row]));
  const missingSymbols = etfs.filter((row) => !row.probeQuality.extractedAny).map((row) => row.symbol);

  return NextResponse.json({
    ok: true,
    source: "yahoo_etf_probe_v2",
    route: "/api/yahoo/etf",
    requestedSymbols: symbols,
    count: validEtfs.length,
    etfs,
    rawDataMap,
    missingSymbols,
    fetchedAt,
    note:
      "Probe route only. Parses Yahoo Taiwan ETF premium/discount ranking pages. Use as ETF auxiliary data only; do not override FinMind/TWSE/Google main fields.",
    upstreamStatus: statuses,
    debug: debug
      ? {
          parserVersion: "yahoo_etf_parser_v2",
          sourcePages: pageTexts.map((p) => ({
            id: p.id,
            url: p.url,
            textLength: p.text.length,
          })),
        }
      : undefined,
  });
}


export async function GET(req: NextRequest) {
  const wrapperStartedAt = new Date().toISOString();
  const url = new URL(req.url);
  const force = isForceRefresh(url.searchParams);
  const cacheKey = buildRouteCacheKey("yahoo_etf", req.url);

  try {
    const cached = await getOrFetchScheduledDailyCached({
      key: cacheKey,
      force,
      meta: { route: "/api/yahoo/etf", policy: "Yahoo ETF scheduled cache" },
      fetcher: async () => {
        const res = await uncachedGET(req);
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
          route: "/api/yahoo/etf",
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
        route: "/api/yahoo/etf",
        cachePolicy: { build: CACHE_BUILD_VERSION, kind: "scheduled_daily", force },
        wrapperStartedAt,
        wrapperFinishedAt: new Date().toISOString(),
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

