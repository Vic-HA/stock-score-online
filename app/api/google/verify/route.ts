// @ts-nocheck
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GOOGLE_VERIFY_ROUTE_VERSION = "GOOGLE_VERIFY_V3_FIELDS_2026_05_07";

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

function chooseBestSymbol(rawSymbol: unknown, rawTicker: unknown) {
  const symbolFromColumn = normalizeStockSymbol(rawSymbol);
  const symbolFromTicker = normalizeStockSymbol(rawTicker);

  if (!symbolFromColumn && symbolFromTicker) return symbolFromTicker;
  if (!symbolFromTicker && symbolFromColumn) return symbolFromColumn;
  if (symbolFromColumn && symbolFromTicker && symbolFromColumn !== symbolFromTicker && symbolFromTicker.endsWith(symbolFromColumn)) return symbolFromTicker;

  return symbolFromColumn || symbolFromTicker;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((v) => String(v).trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  row.push(cell);
  if (row.some((v) => String(v).trim() !== "")) rows.push(row);

  return rows;
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function rowToObject(headers: string[], cols: string[]) {
  const obj: Record<string, string> = {};
  headers.forEach((header, index) => {
    const key = String(header || "").trim();
    if (key) obj[key] = cols[index] ?? "";
  });
  obj.__cols = cols;
  return obj;
}

function getRowValue(row: any, keys: string[], fallback = "") {
  const normalizedMap = new Map<string, any>();

  Object.keys(row || {}).forEach((key) => {
    normalizedMap.set(normalizeHeader(key), row[key]);
  });

  for (const key of keys) {
    const direct = row?.[key];
    if (direct !== undefined && direct !== null && direct !== "") return direct;

    const normalized = normalizeHeader(key);
    if (normalizedMap.has(normalized)) {
      const value = normalizedMap.get(normalized);
      if (value !== undefined && value !== null && value !== "") return value;
    }
  }

  return fallback;
}

function parseOptionalNum(value: unknown) {
  const raw = String(value ?? "")
    .replace(/,/g, "")
    .replace(/％/g, "%")
    .trim();

  if (!raw || raw === "-" || raw === "--" || raw.toUpperCase() === "N/A" || raw === "#N/A" || raw === "#NAME?") return null;

  const withoutPercent = raw.replace(/%/g, "");
  const direct = Number(withoutPercent);
  if (Number.isFinite(direct)) return direct;

  const match = withoutPercent.match(/[-+]?[0-9]*[.]?[0-9]+/);
  if (!match) return null;

  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function parsePercentPointCell(value: unknown, field = "general") {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-" || raw === "--" || raw.toUpperCase() === "N/A" || raw === "#N/A" || raw === "#NAME?") return null;

  const hasPercentSign = raw.includes("%") || raw.includes("％");
  const n = parseOptionalNum(raw);
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return null;

  if (hasPercentSign) return Number(n);
  if (field === "vix") return normalizeVixPercentPoint(n);

  // Google Sheet 常見 0.0202 = 2.02%，統一存成百分點。
  if (Math.abs(n) > 0 && Math.abs(n) < 1) return Number((n * 100).toFixed(4));

  return n;
}

function normalizeVixPercentPoint(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  // 防呆：前端曾出現 80.55，通常是 0.8055% 被 *100 一次，還原。
  if (Math.abs(n) > 20) return Number((n / 100).toFixed(4));

  // VIX 若 Google Sheet 原始欄是 0.978，代表 0.978%；若是 0.00978，代表 0.978%。
  if (Math.abs(n) >= 0.2) return n;
  if (Math.abs(n) > 0) return Number((n * 100).toFixed(4));

  return n;
}

function buildGoogleFinanceTicker(symbol: string, rawTicker = "") {
  const ticker = String(rawTicker || "").trim();
  if (ticker) return ticker;
  if (/^[0-9]{4}$/.test(symbol)) return `TPE:${symbol}`;
  return symbol;
}

function normalizeGoogleValidationRow(row: any) {
  const cols = Array.isArray(row.__cols) ? row.__cols : [];

  const rawSymbol = getRowValue(row, ["symbol", "Symbol", "代號", "股票代號"], cols[0] || "");
  const name = getRowValue(row, ["name", "Name", "股票名稱", "名稱"], cols[1] || "");
  const rawTicker = getRowValue(row, ["ticker", "Ticker", "googleTicker", "GoogleTicker"], cols[2] || "");
  const symbol = chooseBestSymbol(rawSymbol, rawTicker);

  const google = {
    price: parseOptionalNum(getRowValue(row, ["price", "Price", "現價"], cols[3] || "")),
    prevClose: parseOptionalNum(getRowValue(row, ["prevClose", "PrevClose", "prev_close", "closeyest", "CloseYest", "昨收"], cols[4] || "")),
    volume: parseOptionalNum(getRowValue(row, ["volume", "Volume", "成交量"], cols[5] || "")),

    volume10ma: parseOptionalNum(getRowValue(row, ["volume10ma", "Volume10ma", "volume10MA", "10MV", "10日均量"], cols[6] || "")),
    volumeRatio: parseOptionalNum(getRowValue(row, ["volumeRatio", "VolumeRatio", "量能爆發比"], cols[7] || "")),

    ma5: parseOptionalNum(getRowValue(row, ["ma5", "MA5", "5MA"], cols[8] || "")),
    ma20: parseOptionalNum(getRowValue(row, ["ma20", "MA20", "20MA"], cols[9] || "")),
    rsi14: parseOptionalNum(getRowValue(row, ["rsi14", "RSI14"], cols[10] || "")),

    per: parseOptionalNum(getRowValue(row, ["per", "PER", "pe", "PE", "本益比"], cols[11] || "")),
    eps: parseOptionalNum(getRowValue(row, ["eps", "EPS"], cols[12] || "")),
    earningsYield: parseOptionalNum(getRowValue(row, ["earningsYield", "EarningsYield", "盈餘殖利率"], cols[13] || "")),
    yield: parseOptionalNum(getRowValue(row, ["yield", "Yield", "yieldpct", "YieldPct"], cols[14] || "")),

    high52: parseOptionalNum(getRowValue(row, ["high52", "High52", "52週高"], cols[15] || "")),
    low52: parseOptionalNum(getRowValue(row, ["low52", "Low52", "52週低"], cols[16] || "")),
    drawdown52: parseOptionalNum(getRowValue(row, ["drawdown52", "Drawdown52", "52週回撤"], cols[17] || "")),
    pricePosition52: parseOptionalNum(getRowValue(row, ["pricePosition52", "PricePosition52", "52週位階"], cols[18] || "")),
    roc20: parseOptionalNum(getRowValue(row, ["roc20", "ROC20", "20日動能"], cols[19] || "")),

    marketcap: parseOptionalNum(getRowValue(row, ["marketcap", "Marketcap", "marketCap", "MarketCap", "市值"], cols[20] || "")),
    beta: parseOptionalNum(getRowValue(row, ["beta", "Beta"], cols[21] || "")),
    datadelay: parseOptionalNum(getRowValue(row, ["datadelay", "DataDelay", "資料延遲"], cols[22] || "")),

    nasdaqReturn1d: parsePercentPointCell(getRowValue(row, ["nasdaqReturn1d", "NasdaqReturn1d"], cols[23] || ""), "general"),
    soxReturn1d: parsePercentPointCell(getRowValue(row, ["soxReturn1d", "SoxReturn1d", "SOXReturn1d"], cols[24] || ""), "general"),
    taifexAfterHoursReturn: parsePercentPointCell(getRowValue(row, ["taifexAfterHoursReturn", "TaifexAfterHoursReturn"], cols[25] || ""), "general"),
    vixChange1d: parsePercentPointCell(getRowValue(row, ["vixChange1d", "VixChange1d", "VIXChange1d"], cols[26] || ""), "vix"),

    foreign3d: parseOptionalNum(getRowValue(row, ["foreign3d", "Foreign3d"], cols[27] || "")),
    trust3d: parseOptionalNum(getRowValue(row, ["trust3d", "Trust3d"], cols[28] || "")),
    dealer3d: parseOptionalNum(getRowValue(row, ["dealer3d", "Dealer3d"], cols[29] || "")),
    marginChange5dPct: parseOptionalNum(getRowValue(row, ["marginChange5dPct", "MarginChange5dPct"], cols[30] || "")),

    tradetime: getRowValue(row, ["tradetime", "TradeTime", "最後交易時間"], cols[31] || ""),
    updatedAt: getRowValue(row, ["updatedAt", "UpdatedAt"], cols[32] || ""),
    sourceNote: getRowValue(row, ["sourceNote", "SourceNote"], cols[33] || ""),
  };

  const normalizedSymbol = normalizeStockSymbol(symbol);

  return {
    symbol: normalizedSymbol,
    name: String(name || normalizedSymbol || "").trim(),
    ticker: buildGoogleFinanceTicker(normalizedSymbol, rawTicker),
    rawSymbol,
    rawTicker,
    google,
  };
}

function hasAnyUsefulValue(row: any) {
  const g = row?.google || {};
  return [
    "price",
    "prevClose",
    "volume",
    "volume10ma",
    "volumeRatio",
    "ma5",
    "ma20",
    "per",
    "eps",
    "high52",
    "low52",
    "roc20",
    "nasdaqReturn1d",
    "soxReturn1d",
    "vixChange1d",
  ].some((key) => g[key] !== null && g[key] !== undefined && g[key] !== "");
}

function addCacheBuster(url: string) {
  try {
    const u = new URL(url);
    u.searchParams.set("_", String(Date.now()));
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}_=${Date.now()}`;
  }
}

function buildValidationMap(rows: any[]) {
  const validationMap: Record<string, any> = {};

  rows.forEach((row) => {
    const symbol = normalizeStockSymbol(row.symbol);
    if (!symbol) return;

    validationMap[symbol] = {
      ...(validationMap[symbol] || {}),
      google: {
        symbol,
        name: row.name,
        ticker: row.ticker,
        ...row.google,
        updatedAt: row.google?.updatedAt || "",
        sourceNote: row.google?.sourceNote || "GoogleFinance",
      },
    };
  });

  return validationMap;
}

function buildRawDataMap(rows: any[]) {
  const rawDataMap: Record<string, any> = {};

  rows.forEach((row) => {
    const symbol = normalizeStockSymbol(row.symbol);
    if (!symbol) return;

    rawDataMap[symbol] = {
      name: row.name,
      ticker: row.ticker,
      ...row.google,
      source: "GoogleFinance",
      sourceNote: row.google?.sourceNote || "GoogleFinance",
    };
  });

  return rawDataMap;
}

function buildRawFieldPreview(headers: string[], dataRows: any[], limit = 5) {
  return dataRows.slice(0, limit).map((row) => {
    const cols = Array.isArray(row.__cols) ? row.__cols : [];
    const out: Record<string, any> = {};
    headers.forEach((header, index) => {
      out[header || `col${index + 1}`] = cols[index] ?? "";
    });
    return out;
  });
}

function applyDerivedFallbacks(row: any) {
  const g = row.google || {};

  if ((g.volumeRatio === null || g.volumeRatio === undefined) && Number(g.volume) > 0 && Number(g.volume10ma) > 0) {
    g.volumeRatio = Number((Number(g.volume) / Number(g.volume10ma)).toFixed(8));
  }

  if ((g.earningsYield === null || g.earningsYield === undefined) && Number(g.per) > 0) {
    g.earningsYield = Number((1 / Number(g.per)).toFixed(10));
  }

  if ((g.drawdown52 === null || g.drawdown52 === undefined) && Number(g.price) > 0 && Number(g.high52) > 0) {
    g.drawdown52 = Number(((Number(g.price) - Number(g.high52)) / Number(g.high52)).toFixed(10));
  }

  if ((g.pricePosition52 === null || g.pricePosition52 === undefined) && Number(g.price) > 0 && Number(g.high52) > 0 && Number(g.low52) > 0 && Number(g.high52) !== Number(g.low52)) {
    g.pricePosition52 = Number(((Number(g.price) - Number(g.low52)) / (Number(g.high52) - Number(g.low52))).toFixed(10));
  }

  row.google = g;
  return row;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formulaCompletenessScore(rows: any[]) {
  const fields = ["volume10ma", "volumeRatio", "ma5", "ma20", "per", "eps", "high52", "low52", "roc20"];
  let total = 0;
  let ready = 0;

  rows.forEach((row) => {
    const g = row.google || {};
    fields.forEach((field) => {
      total += 1;
      if (g[field] !== null && g[field] !== undefined && g[field] !== "") ready += 1;
    });
  });

  return total ? Number((ready / total).toFixed(4)) : 0;
}

async function fetchCsvTextWithHeaders(csvUrl: string, attempt = 0) {
  const res = await fetch(addCacheBuster(csvUrl), {
    cache: "no-store",
    headers: {
      Accept: "text/csv,text/plain,*/*",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "User-Agent": `stock-score-online-google-verify/1.0 attempt-${attempt}`,
    },
  });

  const text = await res.text();
  return { res, text };
}

function parseAndNormalizeCsv(text: string) {
  const parsed = parseCsv(text);
  const headers = (parsed[0] || []).map((h) => String(h || "").replace(/^\uFEFF/, "").trim());
  const dataRows = parsed.slice(1).map((cols) => rowToObject(headers, cols));
  const normalizedRows = dataRows
    .map(normalizeGoogleValidationRow)
    .map(applyDerivedFallbacks)
    .filter((row) => row.symbol && hasAnyUsefulValue(row));
  return { parsed, headers, dataRows, normalizedRows, formulaCompleteness: formulaCompletenessScore(normalizedRows) };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const csvUrl = searchParams.get("url");

    if (!csvUrl) {
      return NextResponse.json(
        {
          ok: false,
          source: "google_csv_verify",
          version: GOOGLE_VERIFY_ROUTE_VERSION,
          message: "Missing required query parameter: url",
        },
        { status: 400 }
      );
    }

    const requestedSymbols = (searchParams.get("symbols") || "")
      .split(",")
      .map((s) => normalizeStockSymbol(s))
      .filter(Boolean);

    const requestedSet = new Set(requestedSymbols);

    let fetchAttempts = 0;
    let bestText = "";
    let bestRes: Response | null = null;
    let bestParsed: any = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      fetchAttempts = attempt + 1;

      const { res, text } = await fetchCsvTextWithHeaders(csvUrl, attempt);
      const parsedCandidate = res.ok ? parseAndNormalizeCsv(text) : null;

      if (!bestParsed || ((parsedCandidate?.formulaCompleteness || 0) > (bestParsed?.formulaCompleteness || 0))) {
        bestText = text;
        bestRes = res;
        bestParsed = parsedCandidate;
      }

      // Google Published CSV 有時第一輪只吐即時 price/volume，衍生公式欄稍晚才補上。
      // 公式欄完整度夠高就直接回；否則短暫等候再抓一次，降低「第一輪空值」問題。
      if (!res.ok || (parsedCandidate?.formulaCompleteness || 0) >= 0.65) break;
      await sleep(700);
    }

    const res = bestRes;
    const text = bestText;

    if (!res || !res.ok) {
      return NextResponse.json(
        {
          ok: false,
          source: "google_csv_verify",
          version: GOOGLE_VERIFY_ROUTE_VERSION,
          message: `Google CSV HTTP ${res?.status || "unknown"}`,
          rawPreview: text.slice(0, 500),
          fetchAttempts,
        },
        { status: res?.status || 502 }
      );
    }

    const parsed = bestParsed.parsed;
    const headers = bestParsed.headers;
    const dataRows = bestParsed.dataRows;
    const normalizedRows = bestParsed.normalizedRows;
    const formulaCompleteness = bestParsed.formulaCompleteness;

    const filteredRows = requestedSet.size
      ? normalizedRows.filter((row) => requestedSet.has(normalizeStockSymbol(row.symbol)))
      : normalizedRows;

    const matchedSymbols = filteredRows.map((row) => normalizeStockSymbol(row.symbol));
    const unmatchedSymbols = requestedSymbols.filter((symbol) => !matchedSymbols.includes(symbol));

    const validationMap = buildValidationMap(filteredRows);
    const rawDataMap = buildRawDataMap(filteredRows);

    return NextResponse.json(
      {
        ok: true,
        source: "google_csv_verify",
        version: GOOGLE_VERIFY_ROUTE_VERSION,
        parsedRows: normalizedRows.length,
        totalCsvRows: dataRows.length,
        formulaCompleteness,
        fetchAttempts,
        headers,
        matchedSymbols,
        unmatchedSymbols,
        validationMap,
        rawDataMap,
        valuePreview: filteredRows.slice(0, 5).map((row) => ({
          symbol: row.symbol,
          name: row.name,
          ticker: row.ticker,
          price: row.google.price,
          prevClose: row.google.prevClose,
          volume: row.google.volume,
          volume10ma: row.google.volume10ma,
          volumeRatio: row.google.volumeRatio,
          ma5: row.google.ma5,
          ma20: row.google.ma20,
          per: row.google.per,
          eps: row.google.eps,
          high52: row.google.high52,
          low52: row.google.low52,
          drawdown52: row.google.drawdown52,
          pricePosition52: row.google.pricePosition52,
          roc20: row.google.roc20,
          earningsYield: row.google.earningsYield,
          marketcap: row.google.marketcap,
          beta: row.google.beta,
          datadelay: row.google.datadelay,
          nasdaqReturn1d: row.google.nasdaqReturn1d,
          soxReturn1d: row.google.soxReturn1d,
          vixChange1d: row.google.vixChange1d,
          tradetime: row.google.tradetime,
        })),
        rawRowsPreview: parsed.slice(0, 4),
        rawFieldPreview: buildRawFieldPreview(headers, dataRows, 5),
        rawPreview: text.slice(0, 1000),
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        source: "google_csv_verify",
        version: GOOGLE_VERIFY_ROUTE_VERSION,
        message: error?.message || String(error),
        fetchedAt: new Date().toISOString(),
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
