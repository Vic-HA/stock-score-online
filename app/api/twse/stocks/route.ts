// @ts-nocheck
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FINMIND_API_URL = "https://api.finmindtrade.com/api/v4/data";
const DEFAULT_SYMBOLS = ["2330", "2454", "3231", "2317", "6446", "0050"];

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
    .slice(0, 20);
}

function toNumber(value: unknown, fallback = 0) {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (!raw || raw === "-" || raw === "--" || raw.toUpperCase() === "N/A") return fallback;

  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function average(values: number[]) {
  const clean = values.filter((x) => Number.isFinite(x));
  if (!clean.length) return 0;
  return clean.reduce((sum, x) => sum + x, 0) / clean.length;
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

function getRequestToken(request: Request) {
  const userToken = request.headers.get("x-finmind-token") || "";
  const serverToken = process.env.FINMIND_TOKEN || "";

  return {
    token: userToken || serverToken,
    tokenSource: userToken ? "user_header" : serverToken ? "server_env" : "missing",
  };
}

async function fetchFinMind(dataset: string, params: Record<string, string>, token: string) {
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
    throw new Error(`${dataset} HTTP ${res.status}: ${json?.msg || json?.message || "request failed"}`);
  }

  if (json?.status === 402 || json?.status === 403 || json?.status === 429) {
    throw new Error(`${dataset} FinMind status ${json.status}: ${json?.msg || json?.message || "limited or blocked"}`);
  }

  return Array.isArray(json?.data) ? json.data : [];
}

async function buildStock(symbol: string, token: string) {
  const startDate = daysAgo(120);
  const endDate = yyyyMmDd(new Date());

  const [priceRows, perRows] = await Promise.all([
    fetchFinMind(
      "TaiwanStockPrice",
      { data_id: symbol, start_date: startDate, end_date: endDate },
      token
    ),
    fetchFinMind(
      "TaiwanStockPER",
      { data_id: symbol, start_date: startDate, end_date: endDate },
      token
    ).catch(() => []),
  ]);

  const sorted = priceRows
    .map((row: any) => ({
      date: String(row.date || ""),
      stock_id: String(row.stock_id || symbol),
      close: toNumber(row.close),
      max: toNumber(row.max, toNumber(row.close)),
      min: toNumber(row.min, toNumber(row.close)),
      Trading_Volume: toNumber(row.Trading_Volume || row.trading_volume || row.volume),
    }))
    .filter((row) => row.date && Number.isFinite(row.close) && row.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!sorted.length) {
    return { symbol, error: "NO_PRICE_DATA" };
  }

  const latest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2] || latest;
  const last20 = sorted.slice(-20);
  const closes = sorted.map((row) => row.close);
  const perLatest: any = Array.isArray(perRows) && perRows.length ? perRows[perRows.length - 1] : {};

  const price = latest.close;
  const close20Ago = sorted.length > 20 ? sorted[sorted.length - 21].close : sorted[0].close;
  const close60Ago = sorted.length > 60 ? sorted[sorted.length - 61].close : sorted[0].close;

  return {
    symbol,
    stock_id: symbol,
    name: symbol,
    market: "TWSE",
    type: /^00/.test(symbol) ? "ETF" : "股票",

    price,
    close: price,
    prevClose: previous.close,
    previous_close: previous.close,

    high20: Math.max(...last20.map((row) => row.max)),
    low20: Math.min(...last20.map((row) => row.min)),
    volume: latest.Trading_Volume,
    avgVolume20: average(last20.map((row) => row.Trading_Volume)),

    ma5: average(closes.slice(-5)),
    ma20: average(closes.slice(-20)),
    ma60: average(closes.slice(-60)),
    rsi14: Number(calcRsi(closes).toFixed(1)),

    return20d: close20Ago > 0 ? Number((((price - close20Ago) / close20Ago) * 100).toFixed(1)) : 0,
    return60d: close60Ago > 0 ? Number((((price - close60Ago) / close60Ago) * 100).toFixed(1)) : 0,

    per: toNumber(perLatest.PER || perLatest.per || perLatest.PEratio, 0),
    pbr: toNumber(perLatest.PBR || perLatest.pbr || perLatest.PBratio, 0),
    dividendYield: toNumber(
      perLatest.dividend_yield ||
        perLatest.DividendYield ||
        perLatest["殖利率"] ||
        perLatest["殖利率(%)"],
      0
    ),

    updatedAt: latest.date,
    sourceNote: "FinMind TaiwanStockPrice + TaiwanStockPER",
  };
}

export async function GET(request: Request) {
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
  const symbols = parseSymbols(searchParams.get("symbols"));

  const results = await Promise.allSettled(
    symbols.map((symbol) => buildStock(symbol, token))
  );

  const stocks = results
    .map((result, index) => {
      if (result.status === "fulfilled") return result.value;
      return {
        symbol: symbols[index],
        error: result.reason?.message || "UNKNOWN_ERROR",
      };
    })
    .filter((row: any) => !row.error);

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
    source: "finmind_proxy",
    tokenSource,
    requestedSymbols: symbols,
    count: stocks.length,
    stocks,
    errors,
    fetchedAt: new Date().toISOString(),
  });
}