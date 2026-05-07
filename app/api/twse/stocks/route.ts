import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TWSE_STOCK_DAY_ALL_URL =
  "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
const TWSE_BWIBBU_ALL_URL =
  "https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL";

const DEFAULT_SYMBOLS = ["2330", "0050"];

function parseSymbols(input: string | null) {
  const raw = input || DEFAULT_SYMBOLS.join(",");

  return new Set(
    raw
      .split(",")
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 50)
  );
}

function toNumber(value: unknown, fallback = 0) {
  const raw = String(value ?? "")
    .replace(/,/g, "")
    .replace(/--/g, "")
    .trim();

  if (!raw || raw === "-" || raw.toUpperCase() === "N/A") return fallback;

  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function getAnyField(row: any, keys: string[], fallback = "") {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }

  return fallback;
}

async function fetchTwseJson(url: string) {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 stock-score-online",
    },
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`TWSE HTTP ${res.status}: ${text.slice(0, 160)}`);
  }

  try {
    const json = JSON.parse(text);
    return Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
  } catch {
    throw new Error(`TWSE returned non-JSON: ${text.slice(0, 160)}`);
  }
}

function normalizeStockDayRow(row: any) {
  const symbol = String(
    getAnyField(row, [
      "Code",
      "code",
      "證券代號",
      "股票代號",
      "stockNo",
      "stock_id",
    ])
  )
    .trim()
    .toUpperCase();

  if (!symbol) return null;

  const name = String(
    getAnyField(row, ["Name", "name", "證券名稱", "股票名稱", "stock_name"], symbol)
  ).trim();

  const close = toNumber(
    getAnyField(row, [
      "ClosingPrice",
      "Closing Price",
      "收盤價",
      "close",
      "Close",
    ]),
    0
  );

  const high = toNumber(
    getAnyField(row, ["HighestPrice", "Highest Price", "最高價", "high", "High"]),
    close
  );

  const low = toNumber(
    getAnyField(row, ["LowestPrice", "Lowest Price", "最低價", "low", "Low"]),
    close
  );

  const volume = toNumber(
    getAnyField(row, [
      "TradeVolume",
      "TradingVolume",
      "Trade Volume",
      "成交股數",
      "成交量",
      "volume",
    ]),
    0
  );

  const change = toNumber(
    getAnyField(row, ["Change", "漲跌價差", "漲跌", "change"]),
    0
  );

  const prevClose = close > 0 ? close - change : 0;

  return {
    symbol,
    stock_id: symbol,
    name,
    market: "TWSE",
    type: /^00/.test(symbol) ? "ETF" : "股票",

    price: close,
    close,
    prevClose: prevClose > 0 ? prevClose : close,
    previous_close: prevClose > 0 ? prevClose : close,

    high20: high,
    low20: low,
    volume,
    avgVolume20: volume,

    updatedAt: new Date().toISOString().slice(0, 10),
    sourceNote: "TWSE OpenAPI STOCK_DAY_ALL",
  };
}

function normalizeBwibbuRow(row: any) {
  const symbol = String(
    getAnyField(row, [
      "Code",
      "code",
      "證券代號",
      "股票代號",
      "stockNo",
      "stock_id",
    ])
  )
    .trim()
    .toUpperCase();

  if (!symbol) return null;

  return {
    symbol,
    per: toNumber(
      getAnyField(row, ["PEratio", "PER", "本益比", "本益比(倍)"]),
      0
    ),
    pbr: toNumber(
      getAnyField(row, ["PBratio", "PBR", "股價淨值比", "股價淨值比(倍)"]),
      0
    ),
    dividendYield: toNumber(
      getAnyField(row, [
        "DividendYield",
        "Dividend Yield",
        "殖利率",
        "殖利率(%)",
      ]),
      0
    ),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolSet = parseSymbols(searchParams.get("symbols"));

  try {
    const [stockDayRows, bwibbuRows] = await Promise.all([
      fetchTwseJson(TWSE_STOCK_DAY_ALL_URL),
      fetchTwseJson(TWSE_BWIBBU_ALL_URL).catch(() => []),
    ]);

    const valuationMap = new Map(
      bwibbuRows
        .map(normalizeBwibbuRow)
        .filter(Boolean)
        .map((row: any) => [row.symbol, row])
    );

    const stocks = stockDayRows
      .map(normalizeStockDayRow)
      .filter(Boolean)
      .filter((row: any) => symbolSet.has(row.symbol))
      .map((row: any) => ({
        ...row,
        ...(valuationMap.get(row.symbol) || {}),
      }));

    const foundSet = new Set(stocks.map((row: any) => row.symbol));
    const missingSymbols = Array.from(symbolSet).filter((symbol) => !foundSet.has(symbol));

    return NextResponse.json({
      ok: true,
      source: "twse_proxy",
      requestedSymbols: Array.from(symbolSet),
      count: stocks.length,
      stocks,
      missingSymbols,
      fetchedAt: new Date().toISOString(),
      upstream: {
        stockDayUrl: TWSE_STOCK_DAY_ALL_URL,
        bwibbuUrl: TWSE_BWIBBU_ALL_URL,
        stockDayRows: stockDayRows.length,
        bwibbuRows: bwibbuRows.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        source: "twse_proxy",
        message: error?.message || "TWSE OpenAPI proxy failed",
      },
      { status: 500 }
    );
  }
}