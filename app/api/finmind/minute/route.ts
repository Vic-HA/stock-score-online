// @ts-nocheck
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FINMIND_V4_DATA_URL = "https://api.finmindtrade.com/api/v4/data";
const FINMIND_V3_DATA_URL = "https://api.finmindtrade.com/api/v3/data";
const DEFAULT_SYMBOLS = ["2330", "0050"];
const MAX_SYMBOLS = 10;

function getRequestToken(request: Request) {
  const userToken = request.headers.get("x-finmind-token") || "";
  const serverToken = process.env.FINMIND_TOKEN || "";

  return {
    token: userToken || serverToken,
    tokenSource: userToken ? "user_header" : serverToken ? "server_env" : "missing",
  };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function parseSymbols(input: string | null) {
  const raw = input || DEFAULT_SYMBOLS.join(",");
  return raw
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, MAX_SYMBOLS);
}

function toNumber(value: unknown, fallback = 0) {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (!raw || raw === "-" || raw === "--" || raw.toUpperCase() === "N/A") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function pickLatest(rows: any[]) {
  return [...rows].sort((a, b) => {
    const ad = `${a.date || ""} ${a.Time || a.time || a.minute || ""}`;
    const bd = `${b.date || ""} ${b.Time || b.time || b.minute || ""}`;
    return ad.localeCompare(bd);
  })[rows.length - 1] || null;
}

async function fetchJson(url: string, token: string) {
  const res = await fetch(url, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || json?.status === 402 || json?.status === 403 || json?.status === 429) {
    throw new Error(`HTTP ${res.status}: ${json?.msg || json?.message || "request failed"}`);
  }

  return Array.isArray(json?.data) ? json.data : [];
}

async function fetchMinuteRows(symbol: string, token: string) {
  const v4 = new URL(FINMIND_V4_DATA_URL);
  v4.searchParams.set("dataset", "TaiwanStockPriceMinute");
  v4.searchParams.set("data_id", symbol);
  v4.searchParams.set("start_date", today());

  try {
    const data = await fetchJson(v4.toString(), token);
    return { ok: true, endpoint: "v4", data, error: "" };
  } catch (v4Error: any) {
    const v3 = new URL(FINMIND_V3_DATA_URL);
    v3.searchParams.set("dataset", "TaiwanStockPriceMinute");
    v3.searchParams.set("stock_id", symbol);

    try {
      const data = await fetchJson(v3.toString(), token);
      return { ok: true, endpoint: "v3", data, error: "" };
    } catch (v3Error: any) {
      return {
        ok: false,
        endpoint: "v4/v3",
        data: [],
        error: `v4=${v4Error?.message || "failed"}; v3=${v3Error?.message || "failed"}`,
      };
    }
  }
}

function normalizeMinute(symbol: string, result: any) {
  const rows = result.data || [];
  const latest = pickLatest(rows);

  if (!latest) {
    return {
      symbol,
      stock_id: symbol,
      hasMinuteData: false,
      minutePrice: null,
      minuteVolume: null,
      minuteTime: null,
      minuteDate: null,
      rows: 0,
      endpoint: result.endpoint,
      error: result.error || "NO_MINUTE_DATA",
      sourceNote: "FinMind TaiwanStockPriceMinute",
    };
  }

  const close = toNumber(latest.close ?? latest.price ?? latest.deal_price ?? latest.Close);
  const volume = toNumber(latest.volume ?? latest.Volume ?? latest.Trading_Volume);

  return {
    symbol,
    stock_id: symbol,
    hasMinuteData: true,
    minutePrice: close,
    minuteClose: close,
    minuteOpen: toNumber(latest.open ?? latest.Open, close),
    minuteHigh: toNumber(latest.high ?? latest.max ?? latest.High, close),
    minuteLow: toNumber(latest.low ?? latest.min ?? latest.Low, close),
    minuteVolume: volume,
    minuteTime: String(latest.Time || latest.time || latest.minute || ""),
    minuteDate: String(latest.date || today()),
    rows: rows.length,
    endpoint: result.endpoint,
    sourceNote: "FinMind TaiwanStockPriceMinute",
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
    symbols.map(async (symbol) => normalizeMinute(symbol, await fetchMinuteRows(symbol, token)))
  );

  const stocks = results.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    return {
      symbol: symbols[index],
      stock_id: symbols[index],
      hasMinuteData: false,
      error: result.reason?.message || "UNKNOWN_ERROR",
      sourceNote: "FinMind TaiwanStockPriceMinute",
    };
  });

  return NextResponse.json({
    ok: true,
    source: "finmind_minute_proxy",
    tokenSource,
    requestedSymbols: symbols,
    count: stocks.length,
    stocks,
    fetchedAt: new Date().toISOString(),
    requestCostHint: {
      datasetsPerSymbol: 1,
      maxSymbols: MAX_SYMBOLS,
      note: "Minute route is designed for at most 10 symbols. At 180 seconds interval, 10 symbols use about 200 requests/hour.",
    },
  });
}
