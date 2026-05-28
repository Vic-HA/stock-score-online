// @ts-nocheck
import { NextResponse } from "next/server";
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


export const revalidate = 0;

const STOCK_DAY_ALL_URL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
const BWIBBU_ALL_URL = "https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL";

function normalizeStockSymbol(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  let cleaned = raw;
  if (cleaned.startsWith("TPE:")) cleaned = cleaned.slice(4);
  if (cleaned.startsWith("TWO:")) cleaned = cleaned.slice(4);
  if (cleaned.endsWith(".TW")) cleaned = cleaned.slice(0, -3);
  if (cleaned.endsWith(".TWO")) cleaned = cleaned.slice(0, -4);
  cleaned = cleaned.split("").filter((ch) => /[0-9A-Z]/.test(ch)).join("");
  if (/^[0-9]{1,4}$/.test(cleaned)) return cleaned.padStart(4, "0");
  return cleaned;
}

function parseList(input, fallback = ["2330", "0050"], max = 50) {
  const raw = input || fallback.join(",");
  return raw
    .split(",")
    .map((x) => normalizeStockSymbol(x))
    .filter(Boolean)
    .slice(0, max);
}

function getAny(row, keys, fallback = "") {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return fallback;
}

function repairMojibake(value) {
  const text = String(value ?? "").trim();
  if (!text) return text;

  // TWSE OpenAPI 偶爾在 Node / Windows / fetch chain 中會出現 UTF-8 被當 latin1 解讀的 mojibake：
  // 例如「聯發科」變成「è¯ç¼ç§」，「股票」變成「è¡ç¥¨」。
  // 這裡只在偵測到典型 mojibake 字元時修正，避免誤改正常中文。
  if (/[ÃÂâèéåçæ]/.test(text)) {
    try {
      const repaired = Buffer.from(text, "latin1").toString("utf8");
      if (/[^\u0000-\u007f]/.test(repaired)) return repaired.trim();
    } catch {
      // ignore
    }
  }

  return text;
}

function toNumber(value, fallback = null) {
  const raw = String(value ?? "")
    .replace(/,/g, "")
    .replace(/%/g, "")
    .trim();

  if (!raw || raw === "-" || raw === "--" || raw.toUpperCase() === "N/A") return fallback;

  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePriceRow(row) {
  const symbol = normalizeStockSymbol(
    getAny(row, ["Code", "code", "證券代號", "股票代號", "stockNo", "stock_id", "Symbol"])
  );
  if (!symbol) return null;

  const name = repairMojibake(
    getAny(row, ["Name", "name", "證券名稱", "股票名稱", "stock_name"], symbol)
  );

  const close = toNumber(
    getAny(row, ["ClosingPrice", "Closing Price", "Closing_Price", "收盤價", "close", "Close"]),
    null
  );

  const open = toNumber(getAny(row, ["OpeningPrice", "Opening Price", "開盤價", "open", "Open"]), null);
  const high = toNumber(getAny(row, ["HighestPrice", "Highest Price", "最高價", "high", "High"]), null);
  const low = toNumber(getAny(row, ["LowestPrice", "Lowest Price", "最低價", "low", "Low"]), null);

  const prevClose = toNumber(
    getAny(row, ["PreviousClose", "Previous Close", "ReferencePrice", "referencePrice", "參考價", "昨收"]),
    close
  );

  const volume = toNumber(
    getAny(row, ["TradeVolume", "TradingVolume", "Trading_Volume", "成交股數", "成交量", "volume", "Volume"]),
    null
  );

  const tradeValue = toNumber(
    getAny(row, ["TradeValue", "成交金額", "tradeValue"]),
    null
  );

  const date = String(getAny(row, ["Date", "date", "資料日期", "statDate"], "")).trim();

  return {
    symbol,
    stock_id: symbol,
    name,
    market: "TWSE",
    type: /^00/.test(symbol) ? "ETF" : "股票",
    price: close,
    close,
    prevClose,
    previous_close: prevClose,
    open,
    high,
    low,
    high20: high,
    low20: low,
    volume,
    avgVolume20: volume,
    tradeValue,
    updatedAt: date,
    sourceNote: "TWSE OpenAPI STOCK_DAY_ALL",
  };
}

function normalizeBwibbuRow(row) {
  const symbol = normalizeStockSymbol(
    getAny(row, ["Code", "code", "證券代號", "股票代號", "stockNo", "stock_id", "Symbol"])
  );
  if (!symbol) return null;

  const name = repairMojibake(
    getAny(row, ["Name", "name", "證券名稱", "股票名稱", "stock_name"], symbol)
  );

  const per = toNumber(getAny(row, ["PEratio", "P/E ratio", "本益比", "PER", "per"]), null);
  const dividendYield = toNumber(
    getAny(row, ["DividendYield", "Dividend yield", "殖利率(%)", "殖利率", "dividendYield", "dividend_yield"]),
    null
  );
  const pbr = toNumber(getAny(row, ["PBratio", "P/B ratio", "股價淨值比", "PBR", "pbr"]), null);

  return {
    symbol,
    stock_id: symbol,
    name,
    per,
    pbr,
    dividendYield,
    sourceNote: "TWSE OpenAPI BWIBBU_ALL",
  };
}

function mergeRows(priceRows, valuationRows) {
  const map = new Map();

  priceRows.filter(Boolean).forEach((row) => {
    map.set(row.symbol, { ...row });
  });

  valuationRows.filter(Boolean).forEach((row) => {
    const previous = map.get(row.symbol) || {
      symbol: row.symbol,
      stock_id: row.symbol,
      name: row.name || row.symbol,
      market: "TWSE",
      type: /^00/.test(row.symbol) ? "ETF" : "股票",
    };

    map.set(row.symbol, {
      ...previous,
      name: previous.name && previous.name !== previous.symbol ? previous.name : row.name || previous.name,
      per: row.per ?? previous.per,
      pbr: row.pbr ?? previous.pbr,
      dividendYield: row.dividendYield ?? previous.dividendYield,
      sourceNote: [previous.sourceNote, row.sourceNote].filter(Boolean).join(" + "),
    });
  });

  return Array.from(map.values());
}

async function fetchJson(url) {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "stock-score-online/1.0",
    },
  });

  if (!res.ok) throw new Error(`TWSE OpenAPI HTTP ${res.status}: ${url}`);

  return res.json();
}

async function uncachedGET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedSymbols = parseList(searchParams.get("symbols"));

    const [stockDayJson, bwibbuJson] = await Promise.all([
      fetchJson(STOCK_DAY_ALL_URL),
      fetchJson(BWIBBU_ALL_URL),
    ]);

    const stockDayRows = Array.isArray(stockDayJson) ? stockDayJson : Array.isArray(stockDayJson?.data) ? stockDayJson.data : [];
    const bwibbuRows = Array.isArray(bwibbuJson) ? bwibbuJson : Array.isArray(bwibbuJson?.data) ? bwibbuJson.data : [];

    const merged = mergeRows(
      stockDayRows.map(normalizePriceRow).filter(Boolean),
      bwibbuRows.map(normalizeBwibbuRow).filter(Boolean)
    );

    const bySymbol = new Map(merged.map((row) => [row.symbol, row]));
    const stocks = requestedSymbols
      .map((symbol) => bySymbol.get(symbol))
      .filter(Boolean);

    const missingSymbols = requestedSymbols.filter((symbol) => !bySymbol.has(symbol));

    return NextResponse.json(
      {
        ok: true,
        source: "twse_proxy",
        requestedSymbols,
        count: stocks.length,
        stocks,
        missingSymbols,
        fetchedAt: new Date().toISOString(),
        upstream: {
          stockDayUrl: STOCK_DAY_ALL_URL,
          bwibbuUrl: BWIBBU_ALL_URL,
          stockDayRows: stockDayRows.length,
          bwibbuRows: bwibbuRows.length,
        },
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        source: "twse_proxy",
        message: error?.message || String(error),
        fetchedAt: new Date().toISOString(),
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      }
    );
  }
}


export async function GET(request) {
  const wrapperStartedAt = new Date().toISOString();
  const url = new URL(request.url);
  const force = isForceRefresh(url.searchParams);
  const cacheKey = buildRouteCacheKey("twse_stocks", request.url);

  try {
    const cached = await getOrFetchScheduledDailyCached({
      key: cacheKey,
      force,
      meta: { route: "/api/twse/stocks", policy: "TWSE OpenAPI scheduled cache" },
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
          route: "/api/twse/stocks",
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
        route: "/api/twse/stocks",
        cachePolicy: { build: CACHE_BUILD_VERSION, kind: "scheduled_daily", force },
        wrapperStartedAt,
        wrapperFinishedAt: new Date().toISOString(),
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

