import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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
    .slice(0, 10);
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

function summarizeFinancialRows(rows: any[]) {
  const sorted = latestRowsByDate(rows);
  if (!sorted.length) return {};

  const latestDate = sorted[sorted.length - 1]?.date || "";

  const eps = getLatestFinancialValue(sorted, "EPS");
  const epsPrevYear = getSameQuarterPreviousYearFinancialValue(sorted, "EPS");
  const grossProfit = getLatestFinancialValue(sorted, "GrossProfit");
  const operatingIncome = pickFirstFinancialValue(sorted, [
    "OperatingIncome",
    "OperatingProfit",
    "NetOperatingIncome",
  ]);
  const revenue = pickFirstFinancialValue(sorted, [
    "Revenue",
    "OperatingRevenue",
    "TotalRevenue",
    "Income",
  ]);
  const incomeAfterTaxes = getLatestFinancialValue(sorted, "IncomeAfterTaxes");

  return {
    financialUpdatedAt: latestDate,
    eps,
    epsGrowthYoY: calcPctChange(eps, epsPrevYear),
    grossProfit,
    operatingIncome,
    financialRevenue: revenue,
    incomeAfterTaxes,
    grossMargin: revenue ? Number(((Number(grossProfit || 0) / Number(revenue)) * 100).toFixed(2)) : null,
    operatingMargin: revenue ? Number(((Number(operatingIncome || 0) / Number(revenue)) * 100).toFixed(2)) : null,
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

async function buildStock(symbol: string, token: string) {
  const endDate = yyyyMmDd(new Date());

  const startPrice = daysAgo(180);
  const startPer = daysAgo(180);
  const startChip = daysAgo(45);
  const startMargin = daysAgo(45);
  const startRevenue = daysAgo(500);
  const startFinancial = daysAgo(1200);

  const [
    priceResult,
    perResult,
    institutionalResult,
    marginResult,
    revenueResult,
    financialResult,
    balanceResult,
  ] = await Promise.all([
    fetchFinMindSafe(
      "TaiwanStockPrice",
      { data_id: symbol, start_date: startPrice, end_date: endDate },
      token
    ),
    fetchFinMindSafe(
      "TaiwanStockPER",
      { data_id: symbol, start_date: startPer, end_date: endDate },
      token
    ),
    fetchFinMindSafe(
      "TaiwanStockInstitutionalInvestorsBuySell",
      { data_id: symbol, start_date: startChip, end_date: endDate },
      token
    ),
    fetchFinMindSafe(
      "TaiwanStockMarginPurchaseShortSale",
      { data_id: symbol, start_date: startMargin, end_date: endDate },
      token
    ),
    fetchFinMindSafe(
      "TaiwanStockMonthRevenue",
      { data_id: symbol, start_date: startRevenue, end_date: endDate },
      token
    ),
    fetchFinMindSafe(
      "TaiwanStockFinancialStatements",
      { data_id: symbol, start_date: startFinancial, end_date: endDate },
      token
    ),
    fetchFinMindSafe(
      "TaiwanStockBalanceSheet",
      { data_id: symbol, start_date: startFinancial, end_date: endDate },
      token
    ),
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
      close: toNumber(row.close),
      max: toNumber(row.max, toNumber(row.close)),
      min: toNumber(row.min, toNumber(row.close)),
      Trading_Volume: toNumber(row.Trading_Volume || row.trading_volume || row.volume),
    }))
    .filter((row) => row.date && Number.isFinite(row.close) && row.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const latestPrice = priceSorted[priceSorted.length - 1] || null;
  const previousPrice = priceSorted[priceSorted.length - 2] || latestPrice;
  const last20 = priceSorted.slice(-20);
  const closes = priceSorted.map((row) => row.close);

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

  const fieldErrors = {
    TaiwanStockPrice: priceResult.error,
    TaiwanStockPER: perResult.error,
    TaiwanStockInstitutionalInvestorsBuySell: institutionalResult.error,
    TaiwanStockMarginPurchaseShortSale: marginResult.error,
    TaiwanStockMonthRevenue: revenueResult.error,
    TaiwanStockFinancialStatements: financialResult.error,
    TaiwanStockBalanceSheet: balanceResult.error,
  };

  return {
    symbol,
    stock_id: symbol,

    // Daily 技術 / 歷史序列欄位。不回傳 price，避免覆蓋 GoogleFinance 較新行情。
    dailyClose,
    dailyPrevClose: previousPrice?.close ?? null,
    dailyVolume: latestPrice?.Trading_Volume ?? null,
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

    updatedAt: latestPrice?.date || endDate,
    sourceNote: "FinMind enriched: Price/PER/Institutional/Margin/Revenue/Financial/Balance",
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
}

export async function GET(request: Request) {
  const { token, tokenSource } = getRequestToken(request);

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Missing FinMind token. Set FINMIND_TOKEN in .env.local or send X-FinMind-Token header.",
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
    source: "finmind_enriched_proxy",
    tokenSource,
    requestedSymbols: symbols,
    count: stocks.length,
    stocks,
    errors,
    fetchedAt: new Date().toISOString(),
    requestCostHint: {
      datasetsPerSymbol: 7,
      note: "This route intentionally enriches FinMind fields. For 10 symbols it may use about 70 FinMind requests per manual refresh.",
    },
  });
}
