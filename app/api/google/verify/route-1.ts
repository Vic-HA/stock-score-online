import { NextResponse } from "next/server";

const DEFAULT_GOOGLE_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTwI6HZIQcKRt3H9MCDW4kRynUlkMtR1KnzUYpGpXMhNErX-LrO3ejwbJ7hD9R_BfaOXtCaSo6nhhf_/pub?output=csv";

const WATCH_SYMBOLS = ["2330", "2454", "3231", "2317", "6446", "0050"];

type CsvRow = Record<string, string | string[]> & {
  __cols?: string[];
};

type GoogleRawData = {
  price: number | null;
  prevClose: number | null;
  volume: number | null;
  per: number | null;
  eps: number | null;
  ma5: number | null;
  ma20: number | null;
  rsi14: number | null;
  foreign3d: number | null;
  trust3d: number | null;
  dealer3d: number | null;
  marginChange5dPct: number | null;
  nasdaqReturn1d: number | null;
  soxReturn1d: number | null;
  taifexAfterHoursReturn: number | null;
  vixChange1d: number | null;
  updatedAt: string;
  sourceNote: string;
};

type GoogleValidationItem = {
  symbol: string;
  name: string;
  ticker: string;
  rawSymbol: string;
  rawTicker: string;
  google: GoogleRawData;
};

function splitDelimitedLine(line: string, delimiter = ",") {
  if (delimiter === "\t") {
    return String(line || "")
      .split(delimiter)
      .map((cell) => cell.trim());
  }

  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }

  cells.push(current.trim());
  return cells;
}

function detectDelimiter(headerLine: string) {
  const text = String(headerLine || "");
  const tabCount = text.split("\t").length - 1;
  const commaCount = text.split(",").length - 1;
  return tabCount > commaCount ? "\t" : ",";
}

function parseCsv(text: string): CsvRow[] {
  const cleanText = String(text || "").trim();
  if (!cleanText) return [];

  const lines = cleanText
    .split("\n")
    .map((row) => row.replaceAll("\r", ""))
    .filter(Boolean);

  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitDelimitedLine(lines[0], delimiter).map((h) =>
    h.replace(/^\uFEFF/, "").trim()
  );

  return lines.slice(1).map((line) => {
    const cols = splitDelimitedLine(line, delimiter);
    return headers.reduce<CsvRow>(
      (obj, header, index) => {
        obj[header] = cols[index] ?? "";
        return obj;
      },
      { __cols: cols }
    );
  });
}

function normalizeStockSymbol(value: unknown) {
  const raw = String(value || "").trim().toUpperCase();

  const cleaned = raw
    .replace(/^TPE:/, "")
    .replace(/^TWO:/, "")
    .replace(/\.TW$/, "")
    .replace(/\.TWO$/, "")
    .replace(/[^0-9A-Z]/g, "");

  if (/^\d{1,4}$/.test(cleaned)) {
    return cleaned.padStart(4, "0");
  }

  return cleaned;
}

function chooseBestSymbol(rawSymbol: string, rawTicker: string) {
  const symbolFromColumn = normalizeStockSymbol(rawSymbol);
  const symbolFromTicker = normalizeStockSymbol(rawTicker);

  if (!symbolFromColumn && symbolFromTicker) return symbolFromTicker;
  if (!symbolFromTicker && symbolFromColumn) return symbolFromColumn;

  if (
    symbolFromColumn &&
    symbolFromTicker &&
    symbolFromColumn !== symbolFromTicker &&
    symbolFromTicker.endsWith(symbolFromColumn)
  ) {
    return symbolFromTicker;
  }

  return symbolFromColumn || symbolFromTicker;
}

function getRowValue(row: CsvRow, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }
  return fallback;
}

function parseOptionalNum(value: unknown) {
  const raw = String(value ?? "").replace(/,/g, "").trim();

  if (
    raw === "" ||
    raw === "-" ||
    raw === "--" ||
    raw.toUpperCase() === "N/A" ||
    raw.toUpperCase() === "NULL"
  ) {
    return null;
  }

  const direct = Number(raw);
  if (Number.isFinite(direct)) return direct;

  const match = raw.match(/[-+]?[0-9]*[.]?[0-9]+/);
  if (!match) return null;

  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function normalizeGoogleValidationRow(row: CsvRow): GoogleValidationItem {
  const cols = Array.isArray(row.__cols) ? row.__cols : [];

  const rawSymbol = getRowValue(row, ["symbol", "Symbol"], cols[0] || "");
  const name = getRowValue(row, ["name", "Name"], cols[1] || "");
  const rawTicker = getRowValue(row, ["ticker", "Ticker"], cols[2] || "");
  const symbol = chooseBestSymbol(rawSymbol, rawTicker);

  return {
    symbol,
    name,
    ticker: rawTicker,
    rawSymbol,
    rawTicker,
    google: {
      price: parseOptionalNum(getRowValue(row, ["price", "Price"], cols[3] || "")),
      prevClose: parseOptionalNum(getRowValue(row, ["prevClose", "PrevClose"], cols[4] || "")),
      volume: parseOptionalNum(getRowValue(row, ["volume", "Volume"], cols[5] || "")),
      per: parseOptionalNum(getRowValue(row, ["per", "PER", "pe", "PE"], cols[6] || "")),
      eps: parseOptionalNum(getRowValue(row, ["eps", "EPS"], cols[7] || "")),
      ma5: parseOptionalNum(getRowValue(row, ["ma5", "MA5"], cols[8] || "")),
      ma20: parseOptionalNum(getRowValue(row, ["ma20", "MA20"], cols[9] || "")),
      rsi14: parseOptionalNum(getRowValue(row, ["rsi14", "RSI14"], cols[10] || "")),
      foreign3d: parseOptionalNum(getRowValue(row, ["foreign3d", "Foreign3d"], cols[11] || "")),
      trust3d: parseOptionalNum(getRowValue(row, ["trust3d", "Trust3d"], cols[12] || "")),
      dealer3d: parseOptionalNum(getRowValue(row, ["dealer3d", "Dealer3d"], cols[13] || "")),
      marginChange5dPct: parseOptionalNum(
        getRowValue(row, ["marginChange5dPct", "MarginChange5dPct"], cols[14] || "")
      ),
      nasdaqReturn1d: parseOptionalNum(
        getRowValue(row, ["nasdaqReturn1d", "NasdaqReturn1d"], cols[15] || "")
      ),
      soxReturn1d: parseOptionalNum(
        getRowValue(row, ["soxReturn1d", "SoxReturn1d", "SOXReturn1d"], cols[16] || "")
      ),
      taifexAfterHoursReturn: parseOptionalNum(
        getRowValue(row, ["taifexAfterHoursReturn", "TaifexAfterHoursReturn"], cols[17] || "")
      ),
      vixChange1d: parseOptionalNum(
        getRowValue(row, ["vixChange1d", "VixChange1d", "VIXChange1d"], cols[18] || "")
      ),
      updatedAt: getRowValue(row, ["updatedAt", "UpdatedAt"], cols[19] || ""),
      sourceNote: getRowValue(row, ["sourceNote", "SourceNote"], cols[20] || ""),
    },
  };
}

function getDataAvailability(item: GoogleValidationItem) {
  const keys: Array<keyof GoogleRawData> = [
    "price",
    "prevClose",
    "volume",
    "per",
    "eps",
    "ma5",
    "ma20",
    "rsi14",
    "foreign3d",
    "trust3d",
    "dealer3d",
    "marginChange5dPct",
    "nasdaqReturn1d",
    "soxReturn1d",
    "taifexAfterHoursReturn",
    "vixChange1d",
  ];

  const available = keys.filter((key) => item.google[key] !== null && item.google[key] !== "");
  const unavailable = keys.filter((key) => item.google[key] === null || item.google[key] === "");

  return {
    available,
    unavailable,
    availableCount: available.length,
    unavailableCount: unavailable.length,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const csvUrl = searchParams.get("url") || DEFAULT_GOOGLE_CSV_URL;

  const symbols = (searchParams.get("symbols") || WATCH_SYMBOLS.join(","))
    .split(",")
    .map((s) => normalizeStockSymbol(s))
    .filter(Boolean);

  try {
    const res = await fetch(csvUrl, {
      cache: "no-store",
      headers: {
        "User-Agent": "stock-score-google-verify/2.0",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `GOOGLE_CSV_HTTP_${res.status}`,
          csvUrl,
        },
        { status: 500 }
      );
    }

    const text = await res.text();
    const rows = parseCsv(text);

    const incoming = rows
      .map((row) => normalizeGoogleValidationRow(row))
      .filter((item) => item.symbol);

    const allow = new Set(symbols);
    const matched = incoming.filter((item) => allow.has(item.symbol));
    const unmatched = incoming.filter((item) => !allow.has(item.symbol));

    const validationMap = Object.fromEntries(
      matched.map((item) => [item.symbol, { google: item.google }])
    );

    const rawDataMap = Object.fromEntries(
      matched.map((item) => [
        item.symbol,
        {
          symbol: item.symbol,
          name: item.name,
          ticker: item.ticker,
          google: item.google,
          dataAvailability: getDataAvailability(item),
        },
      ])
    );

    return NextResponse.json({
      ok: true,
      version: "google_verify_v2_raw_schema",
      source: "google_sheet_csv",
      csvUrl,
      symbols,
      parsedRows: rows.length,
      headers: rows[0] ? Object.keys(rows[0]).filter((key) => key !== "__cols") : [],
      rawPreview: rows.slice(0, 3).map((row) => row.__cols || []),
      symbolDebug: incoming.map((item) => ({
        rawSymbol: item.rawSymbol,
        rawTicker: item.rawTicker,
        normalizedSymbol: item.symbol,
      })),
      matchedSymbols: matched.map((item) => item.symbol),
      unmatchedSymbols: unmatched.map((item) => item.symbol),
      valuePreview: matched.map((item) => ({
        symbol: item.symbol,
        price: item.google.price,
        prevClose: item.google.prevClose,
        volume: item.google.volume,
        per: item.google.per,
        eps: item.google.eps,
        ma5: item.google.ma5,
        ma20: item.google.ma20,
        rsi14: item.google.rsi14,
        nasdaqReturn1d: item.google.nasdaqReturn1d,
        soxReturn1d: item.google.soxReturn1d,
        taifexAfterHoursReturn: item.google.taifexAfterHoursReturn,
        vixChange1d: item.google.vixChange1d,
        updatedAt: item.google.updatedAt,
        sourceNote: item.google.sourceNote,
      })),
      validationMap,
      rawDataMap,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        ok: false,
        error: "GOOGLE_VERIFY_FAILED",
        message,
        csvUrl,
      },
      { status: 500 }
    );
  }
}