"use client";

import React, { useMemo, useState } from "react";

type AssetType = "股票" | "ETF";
type MarketType = "TWSE" | "TPEx";
type Horizon = "short" | "mid" | "long";

type Stock = {
  symbol: string;
  name: string;
  type: AssetType;
  market: MarketType;

  price: number;
  prevClose: number;
  high20: number;
  low20: number;
  volume: number;
  avgVolume20: number;

  ma5: number;
  ma20: number;
  ma60: number;
  rsi14: number;
  return20d: number;
  return60d: number;

  nasdaqReturn1d: number;
  soxReturn1d: number;
  taifexAfterHoursReturn: number;
  vixChange1d: number;

  foreign3d: number;
  trust3d: number;
  dealer3d: number;
  foreign20d: number;
  trust20d: number;
  marginChange5dPct: number;
  marginChange20dPct: number;

  revenueYoY: number;
  revenueMoM: number;
  epsGrowthYoY: number;
  grossMargin: number;
  operatingMargin: number;
  roe: number;
  debtRatio: number;
  per: number;
  pbr: number;
  dividendYield: number;
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

type GoogleVerifyResponse = {
  ok: boolean;
  version?: string;
  source?: string;
  csvUrl?: string;
  symbols?: string[];
  parsedRows?: number;
  headers?: string[];
  rawPreview?: string[][];
  symbolDebug?: Array<{
    rawSymbol: string;
    rawTicker: string;
    normalizedSymbol: string;
  }>;
  matchedSymbols?: string[];
  unmatchedSymbols?: string[];
  valuePreview?: Array<Record<string, unknown>>;
  validationMap?: Record<string, { google: GoogleRawData }>;
  rawDataMap?: Record<
    string,
    {
      symbol: string;
      name: string;
      ticker: string;
      google: GoogleRawData;
      dataAvailability: {
        available: string[];
        unavailable: string[];
        availableCount: number;
        unavailableCount: number;
      };
    }
  >;
  error?: string;
  message?: string;
};

type ScoreRow = {
  weightKey: string;
  dimension: string;
  item: string;
  source: string;
  weight: number;
  score: number;
  rule: string;
  status: string;
};

type ScoreResult = {
  rows: ScoreRow[];
  dimensions: Array<{
    dimension: string;
    weight: number;
    points: number;
    pass: number;
    count: number;
    dataCount: number;
    scorePct: number;
  }>;
  totalWeight: number;
  total: number;
  score100: number;
  rawScore100?: number;
  stopLoss?: {
    triggered: boolean;
    reasons: string[];
    pullbackFromHigh20: number;
  };
};

type WeightConfig = {
  short: Record<string, number>;
  mid: Record<string, number>;
  long: Record<string, number>;
};

type CompareRow = {
  label: string;
  mainValue: number | null;
  googleValue: number | null;
  diffPct: number | null;
  tolerancePct: number;
  status: "通過" | "需檢查" | "無法取得";
  note: string;
};

type ApiConfig = {
  googleCsvUrl: string;
  finmindProxyUrl: string;
  twseProxyUrl: string;
};

type NewAssetInput = {
  symbol: string;
  name: string;
  type: AssetType;
  market: MarketType;
};

const DEFAULT_DATA_MODE = "mock";
const DEFAULT_GOOGLE_SHEET_CSV_URL = "";
const DEFAULT_FINMIND_PROXY_URL = "";
const DEFAULT_TWSE_PROXY_URL = "/api/twse/stocks";

const SOURCE_REFRESH_POLICY = {
  google_csv: {
    label: "Google 驗證",
    timeoutMs: 12000,
    cooldownMs: 5 * 60 * 1000,
    cacheNote: "只做偏差驗證，5 分鐘內不重抓，不覆蓋主資料。",
  },
  finmind_proxy: {
    label: "FinMind Proxy",
    timeoutMs: 12000,
    cooldownMs: 10 * 60 * 1000,
    cacheNote: "主資料源，10 分鐘內不重抓，避免浪費 API 額度。",
  },
  twse_proxy: {
    label: "TWSE Proxy",
    timeoutMs: 10000,
    cooldownMs: 15 * 60 * 1000,
    cacheNote: "官方盤後/延遲資料，15 分鐘內不重抓。",
  },
};

const DEFAULT_WEIGHT_CONFIG: WeightConfig = {
  short: {
    ma5: 0.15,
    ma20: 0.15,
    rsi: 0.1,
    institutional3d: 0.2,
    margin5d: 0.1,
    usMarket: 0.15,
    futuresVix: 0.15,
    fundamentalsData: 0,
    derivativesData: 0,
  },
  mid: {
    trendData: 0.2,
    chipData: 0.2,
    fundamentalData: 0.25,
    derivativesData: 0.1,
    marketData: 0.25,
  },
  long: {
    priceData: 0.1,
    chipData: 0.1,
    qualityData: 0.5,
    derivativesData: 0,
    macroData: 0.3,
  },
};

const WEIGHT_LABELS: Record<string, string> = {
  ma5: "股價站上 5MA",
  ma20: "股價站上 20MA",
  rsi: "RSI 未過熱",
  institutional3d: "三大法人近 3 日買超",
  margin5d: "融資未異常暴增",
  usMarket: "Nasdaq / SOX 收紅",
  futuresVix: "台指期 / VIX 支撐",
  fundamentalsData: "基本面資料確認",
  derivativesData: "衍生性商品資料確認",
  trendData: "趨勢資料",
  chipData: "籌碼資料",
  fundamentalData: "基本面資料",
  marketData: "市場資料",
  priceData: "長期價量資料",
  qualityData: "品質 / 財務安全資料",
  macroData: "利率 / 匯率 / 總經資料",
};

const WEIGHT_SECTIONS: Array<{ horizon: Horizon; title: string; note: string }> = [
  {
    horizon: "short",
    title: "短線權重",
    note: "預設貼齊圖片版短線三大面向；基本面與衍生性商品預設 0，只做資料確認。",
  },
  {
    horizon: "mid",
    title: "中線權重",
    note: "目前先作資料可用分與架構測試；之後可替換成正式中線公式。",
  },
  {
    horizon: "long",
    title: "長線權重",
    note: "目前先作資料可用分與架構測試；ETF 長線未來應改用 ETF 專屬權重。",
  },
];

const initialStocks: Stock[] = [
  {
    symbol: "2330",
    name: "台積電",
    type: "股票",
    market: "TWSE",
    price: 980,
    prevClose: 965,
    high20: 990,
    low20: 880,
    volume: 62000,
    avgVolume20: 51000,
    ma5: 955,
    ma20: 930,
    ma60: 885,
    rsi14: 63,
    return20d: 8.5,
    return60d: 17.2,
    nasdaqReturn1d: 1.1,
    soxReturn1d: 1.8,
    taifexAfterHoursReturn: 0.6,
    vixChange1d: -3.2,
    foreign3d: 3800,
    trust3d: 1200,
    dealer3d: 600,
    foreign20d: 12000,
    trust20d: 3500,
    marginChange5dPct: 1.8,
    marginChange20dPct: 2.4,
    revenueYoY: 33,
    revenueMoM: 4,
    epsGrowthYoY: 28,
    grossMargin: 54,
    operatingMargin: 43,
    roe: 27,
    debtRatio: 24,
    per: 24,
    pbr: 5.7,
    dividendYield: 1.2,
  },
  {
    symbol: "2454",
    name: "聯發科",
    type: "股票",
    market: "TWSE",
    price: 1240,
    prevClose: 1265,
    high20: 1320,
    low20: 1180,
    volume: 9800,
    avgVolume20: 8700,
    ma5: 1260,
    ma20: 1235,
    ma60: 1190,
    rsi14: 56,
    return20d: 3.8,
    return60d: 9.1,
    nasdaqReturn1d: 1.1,
    soxReturn1d: 1.8,
    taifexAfterHoursReturn: 0.6,
    vixChange1d: -3.2,
    foreign3d: -900,
    trust3d: 450,
    dealer3d: -120,
    foreign20d: -2200,
    trust20d: 900,
    marginChange5dPct: 0.7,
    marginChange20dPct: 1.4,
    revenueYoY: 18,
    revenueMoM: -2,
    epsGrowthYoY: 12,
    grossMargin: 48,
    operatingMargin: 23,
    roe: 20,
    debtRatio: 28,
    per: 19,
    pbr: 3.8,
    dividendYield: 4.1,
  },
  {
    symbol: "3231",
    name: "緯創",
    type: "股票",
    market: "TWSE",
    price: 116,
    prevClose: 109,
    high20: 118,
    low20: 96,
    volume: 145000,
    avgVolume20: 90000,
    ma5: 107,
    ma20: 101,
    ma60: 93,
    rsi14: 76,
    return20d: 19.5,
    return60d: 34.2,
    nasdaqReturn1d: 1.1,
    soxReturn1d: 1.8,
    taifexAfterHoursReturn: 0.6,
    vixChange1d: -3.2,
    foreign3d: 6000,
    trust3d: 2400,
    dealer3d: 900,
    foreign20d: 18000,
    trust20d: 7200,
    marginChange5dPct: 18,
    marginChange20dPct: 24,
    revenueYoY: 12,
    revenueMoM: 8,
    epsGrowthYoY: 10,
    grossMargin: 8,
    operatingMargin: 4.5,
    roe: 18,
    debtRatio: 62,
    per: 28,
    pbr: 3.2,
    dividendYield: 2.5,
  },
  {
    symbol: "2317",
    name: "鴻海",
    type: "股票",
    market: "TWSE",
    price: 198,
    prevClose: 201,
    high20: 215,
    low20: 184,
    volume: 82000,
    avgVolume20: 76000,
    ma5: 202,
    ma20: 195,
    ma60: 176,
    rsi14: 61,
    return20d: 6.2,
    return60d: 22.5,
    nasdaqReturn1d: 1.1,
    soxReturn1d: 1.8,
    taifexAfterHoursReturn: 0.6,
    vixChange1d: -3.2,
    foreign3d: 2600,
    trust3d: -800,
    dealer3d: 300,
    foreign20d: 8900,
    trust20d: -1200,
    marginChange5dPct: 4.5,
    marginChange20dPct: 8.1,
    revenueYoY: 9,
    revenueMoM: 3,
    epsGrowthYoY: 8,
    grossMargin: 6.5,
    operatingMargin: 3.2,
    roe: 12,
    debtRatio: 49,
    per: 18,
    pbr: 1.7,
    dividendYield: 2.7,
  },
  {
    symbol: "6446",
    name: "藥華藥",
    type: "股票",
    market: "TPEx",
    price: 620,
    prevClose: 640,
    high20: 690,
    low20: 590,
    volume: 3200,
    avgVolume20: 4100,
    ma5: 635,
    ma20: 648,
    ma60: 610,
    rsi14: 48,
    return20d: -2.8,
    return60d: 5.6,
    nasdaqReturn1d: 1.1,
    soxReturn1d: 1.8,
    taifexAfterHoursReturn: 0.6,
    vixChange1d: -3.2,
    foreign3d: -300,
    trust3d: 120,
    dealer3d: -80,
    foreign20d: 700,
    trust20d: 600,
    marginChange5dPct: -2.1,
    marginChange20dPct: 3.2,
    revenueYoY: 26,
    revenueMoM: 7,
    epsGrowthYoY: 35,
    grossMargin: 72,
    operatingMargin: 21,
    roe: 10,
    debtRatio: 18,
    per: 62,
    pbr: 7.2,
    dividendYield: 0,
  },
  {
    symbol: "0050",
    name: "元大台灣50",
    type: "ETF",
    market: "TWSE",
    price: 184,
    prevClose: 183,
    high20: 188,
    low20: 174,
    volume: 42000,
    avgVolume20: 39000,
    ma5: 183,
    ma20: 180,
    ma60: 172,
    rsi14: 58,
    return20d: 5.1,
    return60d: 12.6,
    nasdaqReturn1d: 1.1,
    soxReturn1d: 1.8,
    taifexAfterHoursReturn: 0.6,
    vixChange1d: -3.2,
    foreign3d: 0,
    trust3d: 0,
    dealer3d: 0,
    foreign20d: 0,
    trust20d: 0,
    marginChange5dPct: 0,
    marginChange20dPct: 0,
    revenueYoY: 0,
    revenueMoM: 0,
    epsGrowthYoY: 0,
    grossMargin: 0,
    operatingMargin: 0,
    roe: 0,
    debtRatio: 0,
    per: 0,
    pbr: 0,
    dividendYield: 3.1,
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>{children}</div>;
}

function Button({
  children,
  disabled,
  onClick,
  variant = "primary",
  type = "button",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  variant?: "primary" | "outline";
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={
        variant === "outline"
          ? "h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          : "h-9 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300",
        props.className || ""
      )}
    />
  );
}

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={cx("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", className)}>{children}</span>;
}

function pct(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-";
  return `${Number(value).toFixed(1)}%`;
}

function number(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-";
  return Number(value).toLocaleString("zh-TW");
}

function compactNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-";
  const n = Number(value);
  if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(1)}億`;
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}萬`;
  return n.toLocaleString("zh-TW");
}

function scoreTone(score: number) {
  if (score >= 85) return "bg-emerald-100 text-emerald-800";
  if (score >= 70) return "bg-lime-100 text-lime-800";
  if (score >= 55) return "bg-yellow-100 text-yellow-800";
  if (score >= 40) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

function statusTone(status: string) {
  if (status === "通過") return "bg-emerald-100 text-emerald-800";
  if (status === "需檢查") return "bg-orange-100 text-orange-800";
  return "bg-slate-100 text-slate-700";
}

function normalizeStockSymbol(value: unknown) {
  const raw = String(value || "").trim().toUpperCase();
  let cleaned = raw;
  if (cleaned.startsWith("TPE:")) cleaned = cleaned.slice(4);
  if (cleaned.startsWith("TWO:")) cleaned = cleaned.slice(4);
  if (cleaned.endsWith(".TW")) cleaned = cleaned.slice(0, -3);
  if (cleaned.endsWith(".TWO")) cleaned = cleaned.slice(0, -4);
  cleaned = cleaned.split("").filter((ch) => /[0-9A-Z]/.test(ch)).join("");
  if (/^[0-9]{1,4}$/.test(cleaned)) return cleaned.padStart(4, "0");
  return cleaned;
}

function createAssetTemplate(input: NewAssetInput): Stock {
  const symbol = normalizeStockSymbol(input.symbol);
  const type = input.type === "ETF" ? "ETF" : "股票";
  return {
    symbol,
    name: input.name.trim() || symbol,
    type,
    market: input.market || "TWSE",
    price: 100,
    prevClose: 100,
    high20: 105,
    low20: 95,
    volume: 10000,
    avgVolume20: 10000,
    ma5: 100,
    ma20: 100,
    ma60: 98,
    rsi14: 50,
    return20d: 0,
    return60d: 0,
    nasdaqReturn1d: 1.1,
    soxReturn1d: 1.8,
    taifexAfterHoursReturn: 0.6,
    vixChange1d: -3.2,
    foreign3d: 0,
    trust3d: 0,
    dealer3d: 0,
    foreign20d: 0,
    trust20d: 0,
    marginChange5dPct: 0,
    marginChange20dPct: 0,
    revenueYoY: type === "ETF" ? 0 : 1,
    revenueMoM: 0,
    epsGrowthYoY: type === "ETF" ? 0 : 1,
    grossMargin: type === "ETF" ? 0 : 20,
    operatingMargin: type === "ETF" ? 0 : 10,
    roe: type === "ETF" ? 0 : 10,
    debtRatio: type === "ETF" ? 0 : 40,
    per: type === "ETF" ? 0 : 15,
    pbr: type === "ETF" ? 0 : 1.5,
    dividendYield: 0,
  };
}

function getGoogleFinanceTicker(stock: Stock) {
  const prefix = stock.market === "TPEx" ? "TWO" : "TPE";
  return `${prefix}:${stock.symbol}`;
}

function buildGoogleVerifySheetTemplate(stocks: Stock[]) {
  const tab = "\t";
  const newline = "\n";
  const rows = [
    [
      "symbol",
      "name",
      "ticker",
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
      "updatedAt",
      "sourceNote",
    ],
  ];

  stocks.forEach((stock, index) => {
    const row = index + 2;
    const sheetSymbol = stock.symbol.startsWith("0") ? `'${stock.symbol}` : stock.symbol;

    rows.push([
      sheetSymbol,
      stock.name,
      getGoogleFinanceTicker(stock),
      `=IFERROR(GOOGLEFINANCE(C${row},"price"),"")`,
      `=IFERROR(GOOGLEFINANCE(C${row},"closeyest"),"")`,
      `=IFERROR(GOOGLEFINANCE(C${row},"volume"),"")`,
      `=IFERROR(GOOGLEFINANCE(C${row},"pe"),"")`,
      `=IFERROR(GOOGLEFINANCE(C${row},"eps"),"")`,
      `=IFERROR(AVERAGE(QUERY(GOOGLEFINANCE(C${row},"close",TODAY()-10,TODAY()),"select Col2 order by Col1 desc limit 5",1)),"")`,
      `=IFERROR(AVERAGE(QUERY(GOOGLEFINANCE(C${row},"close",TODAY()-40,TODAY()),"select Col2 order by Col1 desc limit 20",1)),"")`,
      "",
      "",
      "",
      "",
      "",
      `=IFERROR(GOOGLEFINANCE("INDEXNASDAQ:.IXIC","changepct")/100,"")`,
      `=IFERROR(GOOGLEFINANCE("INDEXNASDAQ:SOX","changepct")/100,"")`,
      "",
      `=IFERROR(GOOGLEFINANCE("INDEXCBOE:VIX","changepct")/100,"")`,
      "=NOW()",
      "GoogleFinance",
    ]);
  });

  return rows.map((row) => row.join(tab)).join(newline);
}

function cloneWeightConfig(): WeightConfig {
  return JSON.parse(JSON.stringify(DEFAULT_WEIGHT_CONFIG));
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function passScore(condition: boolean) {
  return condition ? 1 : 0;
}

function getDerived(stock: Stock) {
  const todayReturn = stock.prevClose > 0 ? ((stock.price - stock.prevClose) / stock.prevClose) * 100 : 0;
  const volumeRatio = stock.avgVolume20 > 0 ? stock.volume / stock.avgVolume20 : 1;
  const range20 = stock.high20 - stock.low20;
  const closePosition20 = range20 > 0 ? clamp(((stock.price - stock.low20) / range20) * 100) : 50;
  const institutional3d = stock.foreign3d + stock.trust3d + stock.dealer3d;
  const institutional20d = stock.foreign20d + stock.trust20d;
  return { todayReturn, volumeRatio, closePosition20, institutional3d, institutional20d };
}

function buildShortV1Rows(stock: Stock, weights = DEFAULT_WEIGHT_CONFIG.short): ScoreRow[] {
  const d = getDerived(stock);
  return [
    {
      weightKey: "ma5",
      dimension: "技術面",
      item: "股價站上 5MA",
      source: "FinMind 技術面 / TaiwanStockPrice 自算",
      weight: weights.ma5,
      score: passScore(stock.price > stock.ma5),
      rule: `${number(stock.price)} > ${number(stock.ma5)}`,
      status: weights.ma5 > 0 ? "計分" : "資料確認，不計分",
    },
    {
      weightKey: "ma20",
      dimension: "技術面",
      item: "股價站上 20MA",
      source: "FinMind 技術面 / TaiwanStockPrice 自算",
      weight: weights.ma20,
      score: passScore(stock.price > stock.ma20),
      rule: `${number(stock.price)} > ${number(stock.ma20)}`,
      status: weights.ma20 > 0 ? "計分" : "資料確認，不計分",
    },
    {
      weightKey: "rsi",
      dimension: "技術面",
      item: "RSI(14) 未過熱",
      source: "FinMind 技術面 / close 自算 RSI",
      weight: weights.rsi,
      score: passScore(stock.rsi14 < 70),
      rule: `${stock.rsi14} < 70`,
      status: weights.rsi > 0 ? "計分" : "資料確認，不計分",
    },
    {
      weightKey: "institutional3d",
      dimension: "籌碼面",
      item: "三大法人近 3 日買超",
      source: "FinMind 籌碼面 / Institutional",
      weight: weights.institutional3d,
      score: passScore(d.institutional3d > 0),
      rule: `三大法人合計 ${number(d.institutional3d)}`,
      status: weights.institutional3d > 0 ? "計分" : "資料確認，不計分",
    },
    {
      weightKey: "margin5d",
      dimension: "籌碼面",
      item: "融資未異常暴增",
      source: "FinMind 籌碼面 / Margin",
      weight: weights.margin5d,
      score: passScore(stock.marginChange5dPct <= 8),
      rule: `${pct(stock.marginChange5dPct)} <= 8%`,
      status: weights.margin5d > 0 ? "計分" : "資料確認，不計分",
    },
    {
      weightKey: "usMarket",
      dimension: "市場面",
      item: "Nasdaq / SOX 至少一項收紅",
      source: "GoogleFinance / 市場面驗證",
      weight: weights.usMarket,
      score: passScore(stock.nasdaqReturn1d > 0 || stock.soxReturn1d > 0),
      rule: `Nasdaq ${pct(stock.nasdaqReturn1d)} / SOX ${pct(stock.soxReturn1d)}`,
      status: weights.usMarket > 0 ? "計分" : "資料確認，不計分",
    },
    {
      weightKey: "futuresVix",
      dimension: "市場面",
      item: "台指期盤後上漲或 VIX 回落",
      source: "TAIFEX / GoogleFinance VIX",
      weight: weights.futuresVix,
      score: passScore(stock.taifexAfterHoursReturn > 0 || stock.vixChange1d < 0),
      rule: `台指期 ${pct(stock.taifexAfterHoursReturn)} / VIX ${pct(stock.vixChange1d)}`,
      status: weights.futuresVix > 0 ? "計分" : "資料確認，不計分",
    },
    {
      weightKey: "fundamentalsData",
      dimension: "基本面",
      item: "月營收 / EPS 資料可抓取",
      source: "FinMind 基本面",
      weight: weights.fundamentalsData,
      score: passScore(Number.isFinite(stock.revenueYoY) && Number.isFinite(stock.epsGrowthYoY)),
      rule: `營收YoY ${pct(stock.revenueYoY)} / EPS YoY ${pct(stock.epsGrowthYoY)}`,
      status: weights.fundamentalsData > 0 ? "計分" : "資料確認，不計分",
    },
    {
      weightKey: "derivativesData",
      dimension: "衍生性金融商品",
      item: "台指期 / 選擇權資料預留",
      source: "TAIFEX / FinMind",
      weight: weights.derivativesData,
      score: passScore(Number.isFinite(stock.taifexAfterHoursReturn)),
      rule: `台指期盤後 ${pct(stock.taifexAfterHoursReturn)}`,
      status: weights.derivativesData > 0 ? "計分" : "資料確認，不計分",
    },
  ];
}

function buildMidV1Rows(stock: Stock, weights = DEFAULT_WEIGHT_CONFIG.mid): ScoreRow[] {
  const d = getDerived(stock);
  return [
    {
      weightKey: "trendData",
      dimension: "技術面",
      item: "20MA / 60MA / 60日報酬資料可抓取",
      source: "FinMind 技術面 / TaiwanStockPrice 自算",
      weight: weights.trendData,
      score: passScore(Number.isFinite(stock.ma20) && Number.isFinite(stock.ma60) && Number.isFinite(stock.return60d)),
      rule: `20MA ${number(stock.ma20)} / 60MA ${number(stock.ma60)} / 60日 ${pct(stock.return60d)}`,
      status: weights.trendData > 0 ? "計分" : "資料確認，不計分",
    },
    {
      weightKey: "chipData",
      dimension: "籌碼面",
      item: "法人 20 日與融資 20 日資料可抓取",
      source: "FinMind 籌碼面",
      weight: weights.chipData,
      score: passScore(Number.isFinite(d.institutional20d) && Number.isFinite(stock.marginChange20dPct)),
      rule: `法人20日 ${number(d.institutional20d)} / 融資20日 ${pct(stock.marginChange20dPct)}`,
      status: weights.chipData > 0 ? "計分" : "資料確認，不計分",
    },
    {
      weightKey: "fundamentalData",
      dimension: "基本面",
      item: "月營收 / EPS / PER 資料可抓取",
      source: "FinMind 基本面",
      weight: weights.fundamentalData,
      score: passScore(Number.isFinite(stock.revenueYoY) && Number.isFinite(stock.epsGrowthYoY) && Number.isFinite(stock.per)),
      rule: `營收YoY ${pct(stock.revenueYoY)} / EPS YoY ${pct(stock.epsGrowthYoY)} / PER ${number(stock.per)}`,
      status: weights.fundamentalData > 0 ? "計分" : "資料確認，不計分",
    },
    {
      weightKey: "derivativesData",
      dimension: "衍生性金融商品",
      item: "台指期 / 選擇權中線風險資料預留",
      source: "TAIFEX / FinMind",
      weight: weights.derivativesData,
      score: passScore(Number.isFinite(stock.taifexAfterHoursReturn)),
      rule: `台指期 ${pct(stock.taifexAfterHoursReturn)}`,
      status: weights.derivativesData > 0 ? "計分" : "資料確認，不計分",
    },
    {
      weightKey: "marketData",
      dimension: "其他 / 市場面",
      item: "市場與總經資料預留",
      source: "GoogleFinance / FinMind",
      weight: weights.marketData,
      score: passScore(Number.isFinite(stock.nasdaqReturn1d) && Number.isFinite(stock.vixChange1d)),
      rule: `Nasdaq ${pct(stock.nasdaqReturn1d)} / VIX ${pct(stock.vixChange1d)}`,
      status: weights.marketData > 0 ? "計分" : "資料確認，不計分",
    },
  ];
}

function buildLongV1Rows(stock: Stock, weights = DEFAULT_WEIGHT_CONFIG.long): ScoreRow[] {
  return [
    {
      weightKey: "priceData",
      dimension: "技術面",
      item: "長期價量資料預留",
      source: "FinMind 長期日線",
      weight: weights.priceData,
      score: passScore(Number.isFinite(stock.return60d)),
      rule: `60日報酬 ${pct(stock.return60d)}，後續可改 1Y / 3Y`,
      status: weights.priceData > 0 ? "計分" : "資料確認，不計分",
    },
    {
      weightKey: "chipData",
      dimension: "籌碼面",
      item: "長期持股 / 法人資料預留",
      source: "FinMind 籌碼面",
      weight: weights.chipData,
      score: passScore(Number.isFinite(stock.foreign20d)),
      rule: `外資20日 ${number(stock.foreign20d)}`,
      status: weights.chipData > 0 ? "計分" : "資料確認，不計分",
    },
    {
      weightKey: "qualityData",
      dimension: "基本面",
      item: "品質 / 成長 / 財務安全資料可抓取",
      source: "FinMind 財報三表",
      weight: weights.qualityData,
      score: passScore(Number.isFinite(stock.roe) && Number.isFinite(stock.grossMargin) && Number.isFinite(stock.debtRatio)),
      rule: `ROE ${pct(stock.roe)} / 毛利率 ${pct(stock.grossMargin)} / 負債比 ${pct(stock.debtRatio)}`,
      status: weights.qualityData > 0 ? "計分" : "資料確認，不計分",
    },
    {
      weightKey: "derivativesData",
      dimension: "衍生性金融商品",
      item: "長線通常不使用，先保留",
      source: "TAIFEX / FinMind",
      weight: weights.derivativesData,
      score: 0,
      rule: "長線暫不測",
      status: weights.derivativesData > 0 ? "計分" : "預留，不測",
    },
    {
      weightKey: "macroData",
      dimension: "其他 / 市場面",
      item: "利率 / 匯率 / 總經資料預留",
      source: "外部總經資料",
      weight: weights.macroData,
      score: passScore(Number.isFinite(stock.vixChange1d)),
      rule: `VIX ${pct(stock.vixChange1d)}`,
      status: weights.macroData > 0 ? "計分" : "資料確認，不計分",
    },
  ];
}

function scoreRows(rows: ScoreRow[]): ScoreResult {
  const scoringRows = rows.filter((row) => row.weight > 0);
  const totalWeight = scoringRows.reduce((sum, row) => sum + row.weight, 0);
  const total = scoringRows.reduce((sum, row) => sum + row.weight * row.score, 0);
  const dimensions = Object.values(
    rows.reduce<Record<string, ScoreResult["dimensions"][number]>>((acc, row) => {
      if (!acc[row.dimension]) {
        acc[row.dimension] = {
          dimension: row.dimension,
          weight: 0,
          points: 0,
          pass: 0,
          count: 0,
          dataCount: 0,
          scorePct: 0,
        };
      }

      acc[row.dimension].weight += row.weight;
      acc[row.dimension].points += row.weight * row.score;
      acc[row.dimension].pass += row.score === 1 ? 1 : 0;
      acc[row.dimension].count += row.weight > 0 ? 1 : 0;
      acc[row.dimension].dataCount += row.weight === 0 ? 1 : 0;
      acc[row.dimension].scorePct =
        acc[row.dimension].weight > 0
          ? (acc[row.dimension].points / acc[row.dimension].weight) * 100
          : 0;

      return acc;
    }, {})
  );

  return {
    rows,
    dimensions,
    totalWeight,
    total,
    score100: total * 100,
  };
}

function getStopLossState(stock: Stock) {
  const breakMa20 = stock.price < stock.ma20;
  const nearLow20 = stock.price <= stock.low20 * 1.02;
  const pullbackFromHigh20 = stock.high20 > 0 ? ((stock.high20 - stock.price) / stock.high20) * 100 : 0;
  const deepPullback = pullbackFromHigh20 >= 8;
  const triggered = breakMa20 || nearLow20 || deepPullback;
  const reasons: string[] = [];

  if (breakMa20) reasons.push("跌破20MA");
  if (nearLow20) reasons.push("接近20日低點");
  if (deepPullback) reasons.push(`距20日高點回落${pct(pullbackFromHigh20)}`);

  return { triggered, reasons, pullbackFromHigh20 };
}

function applyStopLossGate(result: ScoreResult, stock: Stock): ScoreResult {
  const stopLoss = getStopLossState(stock);
  const rawScore100 = result.score100;
  const cappedScore100 = stopLoss.triggered ? Math.min(rawScore100, 55) : rawScore100;

  return {
    ...result,
    rawScore100,
    score100: cappedScore100,
    total: cappedScore100 / 100,
    stopLoss,
  };
}

function scoreShortV1(stock: Stock, weightConfig: WeightConfig) {
  return applyStopLossGate(scoreRows(buildShortV1Rows(stock, weightConfig.short)), stock);
}

function scoreMidV1(stock: Stock, weightConfig: WeightConfig) {
  return scoreRows(buildMidV1Rows(stock, weightConfig.mid));
}

function scoreLongV1(stock: Stock, weightConfig: WeightConfig) {
  return scoreRows(buildLongV1Rows(stock, weightConfig.long));
}

function getShortRecommendation(total: number, stopLoss?: ScoreResult["stopLoss"]) {
  if (stopLoss?.triggered) return { label: "停損警示 / 不追價", tone: "bg-red-100 text-red-800" };
  if (total >= 0.85) return { label: "強力買入 / 適合短線做多", tone: "bg-emerald-100 text-emerald-800" };
  if (total >= 0.7) return { label: "偏多 / 可分批試單", tone: "bg-lime-100 text-lime-800" };
  if (total >= 0.55) return { label: "橫盤觀望 / 等確認", tone: "bg-yellow-100 text-yellow-800" };
  if (total >= 0.4) return { label: "偏弱 / 不追價", tone: "bg-orange-100 text-orange-800" };
  return { label: "避開 / 等待轉強", tone: "bg-red-100 text-red-800" };
}

function getShortV1Analysis(result: ScoreResult) {
  const tech = result.dimensions.find((d) => d.dimension === "技術面");
  const chip = result.dimensions.find((d) => d.dimension === "籌碼面");
  const market = result.dimensions.find((d) => d.dimension === "市場面");
  const rec = getShortRecommendation(result.total, result.stopLoss);
  const parts = [`短線總分 ${result.score100.toFixed(0)} 分，系統建議為「${rec.label}」。`];

  if (result.stopLoss?.triggered) {
    parts.push(
      `停損閘門已觸發：${result.stopLoss.reasons.join("、")}；原始分數 ${
        result.rawScore100?.toFixed(0) || "-"
      } 分被限制在 ${result.score100.toFixed(0)} 分。`
    );
  }

  if ((tech?.scorePct || 0) >= 80) parts.push("技術面偏多，股價站上短均線且 RSI 尚未過熱，短線價格結構健康。");
  else if ((tech?.scorePct || 0) >= 50) parts.push("技術面中性偏多，但仍有部分條件未完全確認。");
  else parts.push("技術面偏弱或過熱，短線不適合單靠價格追進。");

  if ((chip?.scorePct || 0) >= 80) parts.push("籌碼面偏多，法人近 3 日買超且融資未明顯失控。");
  else if ((chip?.scorePct || 0) >= 50) parts.push("籌碼面普通，法人或融資條件只有部分通過。");
  else parts.push("籌碼面偏弱，法人未明顯站在買方或融資升溫過快。");

  if ((market?.scorePct || 0) >= 80) parts.push("市場面有支撐，昨晚美股/SOX 與台指期/VIX 條件偏正向。");
  else if ((market?.scorePct || 0) >= 50) parts.push("市場面尚可，但隔夜條件只有部分通過。");
  else parts.push("市場面不支援，隔夜外部環境偏弱，短線要降低部位。");

  parts.push("基本面與衍生性商品目前只做資料確認，預設不影響短線原公式。");
  return parts.join(" ");
}

function getFrameworkAnalysis(horizon: string, stock: Stock, result: ScoreResult) {
  const ready = result.rows.filter((row) => row.score === 1).length;
  return `${stock.symbol} ${stock.name} 的${horizon} V1 目前是資料架構版，共 ${ready}/${result.rows.length} 項 mock 資料可用。此頁尚未啟用正式投資分數，只用來確認 API 欄位是否可抓。`;
}

function compareSourceValue(
  label: string,
  mainValue: number | null,
  googleValue: number | null,
  tolerancePct: number,
  note: string
): CompareRow {
  const f = Number(mainValue);
  const g = Number(googleValue);
  const hasBoth =
    googleValue !== null &&
    googleValue !== undefined &&
    mainValue !== null &&
    mainValue !== undefined &&
    Number.isFinite(f) &&
    Number.isFinite(g) &&
    f !== 0;

  const diffPct = hasBoth ? ((g - f) / f) * 100 : null;
  const absDiffPct = diffPct === null ? null : Math.abs(diffPct);
  const status: CompareRow["status"] = !hasBoth
    ? "無法取得"
    : absDiffPct !== null && absDiffPct <= tolerancePct
      ? "通過"
      : "需檢查";

  return { label, mainValue, googleValue, diffPct, tolerancePct, status, note };
}

function getSourceValidationRows(stock: Stock, google?: GoogleRawData): CompareRow[] {
  return [
    compareSourceValue("現價 price", stock.price, google?.price ?? null, 0.5, "GoogleFinance 行情驗證；驗證來源無法取得時只保留主資料。"),
    compareSourceValue("昨收 prevClose", stock.prevClose, google?.prevClose ?? null, 0.5, "昨收理論上應高度一致，若偏差大優先檢查交易日與除權息。"),
    compareSourceValue("成交量 volume", stock.volume, google?.volume ?? null, 5, "成交量可能因單位、更新時間或延遲而有差異。"),
    compareSourceValue("本益比 PER", stock.per, google?.per ?? null, 8, "PER 可能因資料源 EPS 口徑不同而偏差，只做輔助驗證。"),
    compareSourceValue("EPS", stock.epsGrowthYoY, google?.eps ?? null, 8, "EPS 口徑可能不同，只做輔助驗證。"),
    compareSourceValue("5MA", stock.ma5, google?.ma5 ?? null, 1, "短線技術面驗證欄位。"),
    compareSourceValue("20MA", stock.ma20, google?.ma20 ?? null, 1, "波段均線驗證欄位。"),
    compareSourceValue("Nasdaq 一日變化", stock.nasdaqReturn1d, google?.nasdaqReturn1d ?? null, 5, "市場面驗證欄位。"),
    compareSourceValue("SOX 一日變化", stock.soxReturn1d, google?.soxReturn1d ?? null, 5, "半導體市場面驗證欄位。"),
    compareSourceValue("VIX 一日變化", stock.vixChange1d, google?.vixChange1d ?? null, 5, "風險面驗證欄位。"),
  ];
}

function getValidationState(rows: CompareRow[]) {
  const total = rows.length;
  const missing = rows.filter((row) => row.status === "無法取得").length;
  const failed = rows.filter((row) => row.status === "需檢查").length;
  const passed = rows.filter((row) => row.status === "通過").length;

  if (failed > 0) return { label: "需檢查", tone: "bg-orange-100 text-orange-800", failed, missing, passed };
  if (passed > 0 && missing === 0) return { label: "可信", tone: "bg-emerald-100 text-emerald-800", failed, missing, passed };
  if (passed > 0) return { label: "部分驗證", tone: "bg-yellow-100 text-yellow-800", failed, missing, passed };
  return { label: "無法取得", tone: "bg-slate-100 text-slate-700", failed, missing: total, passed: 0 };
}

function validationSummary(rows: CompareRow[]) {
  const state = getValidationState(rows);
  if (state.label === "可信") return "可驗證欄位皆在容忍範圍內，主資料可信。";
  if (state.label === "部分驗證") return `已有 ${state.passed} 項通過驗證，仍有 ${state.missing} 項無法從驗證來源取得；該欄位僅保留主資料，不判定為驗證失敗。`;
  if (state.label === "需檢查") return `有 ${state.failed} 項超過容忍值，需檢查資料日期、單位或除權息口徑。`;
  return "目前驗證來源無法取得可比對欄位；系統先保留主資料，不判定為驗證失敗。";
}

function getSourceConnectorPlan(config: ApiConfig) {
  return [
    {
      name: "FinMind API",
      role: "主資料源",
      status: config.finmindProxyUrl ? "可測試" : "待接 proxy",
      fields: "日線、法人、融資、月營收、財報、PER/PBR",
      method: "後續走 /api/finmind，不直接把 token 放在前端。",
    },
    {
      name: "GoogleFinance / Google Sheet",
      role: "驗證來源",
      status: config.googleCsvUrl ? "可測試" : "待填公開 CSV URL",
      fields: "price、prevClose、volume、PER、EPS、MA5、MA20、市場面",
      method: "前端呼叫 /api/google/verify，由 Vercel 後端讀取 CSV。",
    },
    {
      name: "TWSE OpenAPI",
      role: "官方上市資料",
      status: config.twseProxyUrl ? "可測試" : "需 proxy",
      fields: "上市收盤行情、PER、PBR、殖利率",
      method: "後續走 /api/twse/stocks proxy。",
    },
  ];
}

function getDataModeLabel(mode: string) {
  if (mode === "google_verify_api") return "Google 驗證 API";
  if (mode === "finmind_proxy") return "FinMind Proxy";
  if (mode === "twse_proxy") return "TWSE Proxy";
  return "mock / 內建測試資料";
}

function buildGoogleApiUrl(csvUrl: string, stocks: Stock[]) {
  const symbols = stocks.map((stock) => stock.symbol).join(",");
  return `/api/google/verify?url=${encodeURIComponent(csvUrl)}&symbols=${encodeURIComponent(symbols)}`;
}

function canRefreshSource(lastFetchMap: Record<string, number>, source: keyof typeof SOURCE_REFRESH_POLICY) {
  const policy = SOURCE_REFRESH_POLICY[source];
  const last = lastFetchMap[source] || 0;
  const remainMs = Math.max(0, policy.cooldownMs - (Date.now() - last));
  return { ok: remainMs <= 0, remainSec: Math.ceil(remainMs / 1000) };
}

function markSourceFetched(lastFetchMap: Record<string, number>, source: string) {
  return { ...lastFetchMap, [source]: Date.now() };
}

function formatLastFetch(lastFetchMap: Record<string, number>, source: string) {
  const time = lastFetchMap[source];
  if (!time) return "尚未抓取";
  return new Date(time).toLocaleTimeString("zh-TW", { hour12: false });
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Timeout ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function addAssetToList(stocks: Stock[], assetInput: NewAssetInput) {
  const asset = createAssetTemplate(assetInput);

  if (!asset.symbol) return { ok: false, stocks, asset: null, error: "請輸入股票或 ETF 代號。" };
  if (stocks.some((stock) => stock.symbol === asset.symbol)) {
    return { ok: false, stocks, asset: null, error: `${asset.symbol} 已在總覽中。` };
  }

  return { ok: true, stocks: [...stocks, asset], asset, error: "" };
}

function removeAssetFromList(stocks: Stock[], symbol: string) {
  if (stocks.length <= 1) return { ok: false, stocks, nextSelected: stocks[0]?.symbol || "", error: "至少需要保留一個標的。" };

  const nextStocks = stocks.filter((stock) => stock.symbol !== symbol);

  if (nextStocks.length === stocks.length) {
    return { ok: false, stocks, nextSelected: stocks[0]?.symbol || "", error: `${symbol} 不在總覽中。` };
  }

  return { ok: true, stocks: nextStocks, nextSelected: nextStocks[0]?.symbol || "", error: "" };
}

export default function Page() {
  const [stocks, setStocks] = useState<Stock[]>(initialStocks);
  const [selectedSymbol, setSelectedSymbol] = useState("2330");
  const [activeTab, setActiveTab] = useState<"overview" | "score" | "validation" | "sources" | "weights">("overview");
  const [detailMode, setDetailMode] = useState<Horizon>("short");
  const [weightConfig, setWeightConfig] = useState<WeightConfig>(() => cloneWeightConfig());
  const [apiConfig, setApiConfig] = useState<ApiConfig>({
    googleCsvUrl: DEFAULT_GOOGLE_SHEET_CSV_URL,
    finmindProxyUrl: DEFAULT_FINMIND_PROXY_URL,
    twseProxyUrl: DEFAULT_TWSE_PROXY_URL,
  });
  const [apiLoading, setApiLoading] = useState(false);
  const [apiMessage, setApiMessage] = useState("");
  const [dataMode, setDataMode] = useState(DEFAULT_DATA_MODE);
  const [validationMap, setValidationMap] = useState<Record<string, { google: GoogleRawData }>>({});
  const [rawDataMap, setRawDataMap] = useState<GoogleVerifyResponse["rawDataMap"]>({});
  const [googleDebug, setGoogleDebug] = useState<GoogleVerifyResponse | null>(null);
  const [lastFetchMap, setLastFetchMap] = useState<Record<string, number>>({});
  const [newAsset, setNewAsset] = useState<NewAssetInput>({ symbol: "", name: "", type: "股票", market: "TWSE" });

  const selectedStock = stocks.find((stock) => stock.symbol === selectedSymbol) || stocks[0];

  const scoredStocks = useMemo(() => {
    return stocks
      .map((stock) => {
        const short = scoreShortV1(stock, weightConfig);
        const mid = scoreMidV1(stock, weightConfig);
        const long = scoreLongV1(stock, weightConfig);
        const validationRows = getSourceValidationRows(stock, validationMap[stock.symbol]?.google);
        const validation = getValidationState(validationRows);

        return { stock, short, mid, long, validationRows, validation };
      })
      .sort((a, b) => b.short.score100 - a.short.score100);
  }, [stocks, weightConfig, validationMap]);

  const selectedScore = useMemo(() => {
    const short = scoreShortV1(selectedStock, weightConfig);
    const mid = scoreMidV1(selectedStock, weightConfig);
    const long = scoreLongV1(selectedStock, weightConfig);
    return { short, mid, long };
  }, [selectedStock, weightConfig]);

  const currentResult = selectedScore[detailMode];
  const currentAnalysis =
    detailMode === "short"
      ? getShortV1Analysis(currentResult)
      : getFrameworkAnalysis(detailMode === "mid" ? "中線" : "長線", selectedStock, currentResult);

  const template = useMemo(() => buildGoogleVerifySheetTemplate(stocks), [stocks]);

  const sourcePlan = useMemo(() => getSourceConnectorPlan(apiConfig), [apiConfig]);
  const selectedValidationRows = getSourceValidationRows(selectedStock, validationMap[selectedStock.symbol]?.google);
  const selectedValidationSummary = validationSummary(selectedValidationRows);

  async function loadGoogleCsv() {
    const source = "google_csv" as const;
    const policy = SOURCE_REFRESH_POLICY[source];
    const refresh = canRefreshSource(lastFetchMap, source);

    if (!refresh.ok) {
      setApiMessage(`Google CSV 冷卻中：${refresh.remainSec} 秒`);
      return;
    }

    if (!apiConfig.googleCsvUrl.trim()) {
      setApiMessage("請先貼上 Google Sheet 發佈 CSV URL。");
      return;
    }

    setApiLoading(true);
    setApiMessage("讀取中...");

    try {
      const res = await fetchWithTimeout(buildGoogleApiUrl(apiConfig.googleCsvUrl.trim(), stocks), { cache: "no-store" }, policy.timeoutMs);
      const json = (await res.json()) as GoogleVerifyResponse;

      if (!res.ok || !json.ok) {
        throw new Error(json.message || json.error || `HTTP ${res.status}`);
      }

      setValidationMap(json.validationMap || {});
      setRawDataMap(json.rawDataMap || {});
      setGoogleDebug(json);
      setDataMode("google_verify_api");
      setLastFetchMap((prev) => markSourceFetched(prev, source));
      setApiMessage(`Google 驗證成功：${json.matchedSymbols?.length || 0}/${json.parsedRows || 0} 檔（API route）`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setGoogleDebug({ ok: false, error: message });
      setApiMessage(`Google CSV 失敗：${message}`);
    } finally {
      setApiLoading(false);
    }
  }

  function handleAddAsset() {
    const result = addAssetToList(stocks, newAsset);

    if (!result.ok) {
      setApiMessage(result.error);
      return;
    }

    setStocks(result.stocks);
    if (result.asset) setSelectedSymbol(result.asset.symbol);
    setNewAsset({ symbol: "", name: "", type: "股票", market: "TWSE" });
    setApiMessage(`${result.asset?.symbol} 已加入，請更新 Google Sheet 模板後重新發佈 CSV。`);
  }

  function handleRemoveAsset(symbol: string) {
    const result = removeAssetFromList(stocks, symbol);

    if (!result.ok) {
      setApiMessage(result.error);
      return;
    }

    setStocks(result.stocks);
    if (selectedSymbol === symbol) setSelectedSymbol(result.nextSelected);
    setApiMessage(`${symbol} 已移除。`);
  }

  function updateWeight(horizon: Horizon, key: string, value: string) {
    const nextValue = Number(value);

    if (!Number.isFinite(nextValue)) return;

    setWeightConfig((prev) => ({
      ...prev,
      [horizon]: {
        ...prev[horizon],
        [key]: nextValue / 100,
      },
    }));
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Stock Multi Horizon Scoring App</h1>
          <p className="text-sm text-slate-500">
            主資料目前為 mock / 內建測試資料；Google Sheet 是驗證來源。下一階段會把主資料源改成 FinMind。
          </p>
        </header>

        <Card className="p-4">
          <div className="flex flex-wrap gap-2">
            {[
              ["overview", "全部股票 / ETF 總覽"],
              ["score", "短中長評分"],
              ["validation", "資料驗證"],
              ["sources", "資料源"],
              ["weights", "權重設定"],
            ].map(([key, label]) => (
              <Button
                key={key}
                variant={activeTab === key ? "primary" : "outline"}
                onClick={() => setActiveTab(key as typeof activeTab)}
              >
                {label}
              </Button>
            ))}
          </div>
        </Card>

        {activeTab === "overview" && (
          <Card className="p-4">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-bold">全部股票 / ETF 總覽</h2>
                <p className="text-sm text-slate-500">目前主資料：{getDataModeLabel(dataMode)}。Google 只做驗證，不覆蓋主資料。</p>
              </div>
              <Badge className="bg-slate-100 text-slate-700">目前 {stocks.length} 檔</Badge>
            </div>

            <div className="max-h-[360px] overflow-auto rounded-xl border">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="sticky top-0 bg-white text-left text-slate-500">
                  <tr className="border-b">
                    <th className="px-3 py-2">排名</th>
                    <th>標的</th>
                    <th>類型</th>
                    <th>市場</th>
                    <th>現價</th>
                    <th>今日</th>
                    <th>短線</th>
                    <th>中線</th>
                    <th>長線</th>
                    <th>建議</th>
                    <th>驗證</th>
                    <th>可用欄位</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {scoredStocks.map((row, index) => {
                    const rec = getShortRecommendation(row.short.total, row.short.stopLoss);
                    const raw = rawDataMap?.[row.stock.symbol];

                    return (
                      <tr
                        key={row.stock.symbol}
                        className={cx("cursor-pointer border-b last:border-0 hover:bg-slate-50", selectedSymbol === row.stock.symbol && "bg-slate-100")}
                        onClick={() => setSelectedSymbol(row.stock.symbol)}
                      >
                        <td className="px-3 py-2 font-semibold">{index + 1}</td>
                        <td className="font-semibold">
                          {row.stock.symbol} {row.stock.name}
                        </td>
                        <td>{row.stock.type}</td>
                        <td>{row.stock.market}</td>
                        <td>{number(row.stock.price)}</td>
                        <td>{pct(getDerived(row.stock).todayReturn)}</td>
                        <td><Badge className={scoreTone(row.short.score100)}>{row.short.score100.toFixed(0)}</Badge></td>
                        <td><Badge className={scoreTone(row.mid.score100)}>{row.mid.score100.toFixed(0)}</Badge></td>
                        <td><Badge className={scoreTone(row.long.score100)}>{row.long.score100.toFixed(0)}</Badge></td>
                        <td><Badge className={rec.tone}>{rec.label}</Badge></td>
                        <td><Badge className={row.validation.tone}>{row.validation.label}</Badge></td>
                        <td>
                          {raw
                            ? `${raw.dataAvailability.availableCount}/${raw.dataAvailability.availableCount + raw.dataAvailability.unavailableCount}`
                            : "-"}
                        </td>
                        <td>
                          <Button variant="outline" onClick={() => handleRemoveAsset(row.stock.symbol)}>移除</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === "score" && (
          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <Card className="p-4">
              <h2 className="mb-3 text-lg font-bold">標的與評分</h2>
              <select
                className="mb-3 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
              >
                {stocks.map((stock) => (
                  <option key={stock.symbol} value={stock.symbol}>
                    {stock.symbol} {stock.name}
                  </option>
                ))}
              </select>

              <div className="space-y-2">
                {[
                  ["short", "短線", selectedScore.short],
                  ["mid", "中線", selectedScore.mid],
                  ["long", "長線", selectedScore.long],
                ].map(([key, label, result]) => (
                  <button
                    key={String(key)}
                    onClick={() => setDetailMode(key as Horizon)}
                    className={cx(
                      "w-full rounded-xl border p-3 text-left",
                      detailMode === key ? "border-slate-900 bg-slate-100" : "bg-white"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{String(label)}</span>
                      <Badge className={scoreTone((result as ScoreResult).score100)}>{(result as ScoreResult).score100.toFixed(0)}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-3">
                <h2 className="text-lg font-bold">
                  {selectedStock.symbol} {selectedStock.name}｜{detailMode === "short" ? "短線" : detailMode === "mid" ? "中線" : "長線"}分析
                </h2>
                <p className="mt-1 text-sm text-slate-600">{currentAnalysis}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {currentResult.dimensions.map((dim) => (
                  <div key={dim.dimension} className="rounded-xl border bg-slate-50 p-3">
                    <div className="text-sm font-semibold">{dim.dimension}</div>
                    <div className="mt-2 text-2xl font-bold">{dim.scorePct.toFixed(0)}</div>
                    <div className="text-xs text-slate-500">
                      通過 {dim.pass} / 計分 {dim.count} / 資料確認 {dim.dataCount}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 overflow-auto rounded-xl border">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-white text-left text-slate-500">
                    <tr className="border-b">
                      <th className="px-3 py-2">面向</th>
                      <th>指標</th>
                      <th>權重</th>
                      <th>分數</th>
                      <th>規則</th>
                      <th>狀態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentResult.rows.map((row) => (
                      <tr key={`${row.dimension}-${row.item}`} className="border-b last:border-0">
                        <td className="px-3 py-2">{row.dimension}</td>
                        <td className="font-semibold">{row.item}</td>
                        <td>{(row.weight * 100).toFixed(0)}%</td>
                        <td>{row.score}</td>
                        <td>{row.rule}</td>
                        <td>{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {activeTab === "validation" && (
          <Card className="p-4">
            <div className="mb-3">
              <h2 className="text-lg font-bold">
                {selectedStock.symbol} {selectedStock.name}｜主資料 vs Google 驗證
              </h2>
              <p className="text-sm text-slate-500">{selectedValidationSummary}</p>
            </div>

            <div className="overflow-auto rounded-xl border">
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="bg-white text-left text-slate-500">
                  <tr className="border-b">
                    <th className="px-3 py-2">欄位</th>
                    <th>主資料</th>
                    <th>Google 驗證</th>
                    <th>偏差</th>
                    <th>容忍值</th>
                    <th>狀態</th>
                    <th>備註</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedValidationRows.map((row) => (
                    <tr key={row.label} className="border-b last:border-0">
                      <td className="px-3 py-2 font-semibold">{row.label}</td>
                      <td>{number(row.mainValue)}</td>
                      <td>{number(row.googleValue)}</td>
                      <td>{row.diffPct === null ? "-" : `${row.diffPct.toFixed(2)}%`}</td>
                      <td>±{row.tolerancePct}%</td>
                      <td><Badge className={statusTone(row.status)}>{row.status}</Badge></td>
                      <td className="max-w-md text-slate-500">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border bg-slate-50 p-3">
                <div className="font-semibold">Google rawDataMap</div>
                <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                  {JSON.stringify(rawDataMap?.[selectedStock.symbol] || null, null, 2)}
                </pre>
              </div>
              <div className="rounded-xl border bg-slate-50 p-3">
                <div className="font-semibold">API 診斷</div>
                <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                  {JSON.stringify(
                    googleDebug
                      ? {
                          ok: googleDebug.ok,
                          version: googleDebug.version,
                          parsedRows: googleDebug.parsedRows,
                          headers: googleDebug.headers,
                          matchedSymbols: googleDebug.matchedSymbols,
                          unmatchedSymbols: googleDebug.unmatchedSymbols,
                          valuePreview: googleDebug.valuePreview,
                        }
                      : null,
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          </Card>
        )}

        {activeTab === "sources" && (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-lg font-bold">資料源串接</h2>
                  <p className="text-sm text-slate-500">目前 Google 已改走 /api/google/verify；FinMind 尚未接，主資料仍是 mock。</p>
                </div>
                <Badge className="bg-slate-100 text-slate-700">目前資料模式：{getDataModeLabel(dataMode)}</Badge>
              </div>

              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <Input
                  value={apiConfig.googleCsvUrl}
                  onChange={(e) => setApiConfig((prev) => ({ ...prev, googleCsvUrl: e.target.value }))}
                  placeholder="貼上 Google Sheet 發佈 CSV URL"
                />
                <Button onClick={loadGoogleCsv} disabled={apiLoading || !apiConfig.googleCsvUrl.trim()}>
                  {apiLoading ? "讀取中..." : "讀取 Google Sheet CSV URL"}
                </Button>
              </div>

              {apiMessage && <div className="mt-3 rounded-xl border bg-slate-50 p-3 text-sm text-slate-700">{apiMessage}</div>}

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {sourcePlan.map((source) => (
                  <div key={source.name} className="rounded-xl border bg-slate-50 p-3">
                    <div className="font-semibold">{source.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{source.role}</div>
                    <Badge className="mt-2 bg-white text-slate-700">{source.status}</Badge>
                    <div className="mt-2 text-xs text-slate-600">{source.fields}</div>
                    <div className="mt-2 text-xs text-slate-500">{source.method}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border bg-slate-50 p-3 text-xs text-slate-600">
                <div>Google 最後抓取：{formatLastFetch(lastFetchMap, "google_csv")}</div>
                <div>{SOURCE_REFRESH_POLICY.google_csv.cacheNote}</div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Google 驗證模板 V2</h2>
                  <p className="text-sm text-slate-500">複製下方 TSV 到 Google Sheet A1，發佈成 CSV 後貼回上方。</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(buildGoogleVerifySheetTemplate(stocks));
                    setApiMessage("Google 模板已複製。");
                  }}
                >
                  複製模板
                </Button>
              </div>
              <textarea
                readOnly
                value={template}
                className="h-72 w-full rounded-xl border bg-slate-950 p-3 font-mono text-xs text-slate-100"
              />
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 text-lg font-bold">新增股票 / ETF</h2>
              <div className="grid gap-2 md:grid-cols-[140px_1fr_120px_120px_auto]">
                <Input
                  placeholder="代號"
                  value={newAsset.symbol}
                  onChange={(e) => setNewAsset((prev) => ({ ...prev, symbol: e.target.value }))}
                />
                <Input
                  placeholder="名稱"
                  value={newAsset.name}
                  onChange={(e) => setNewAsset((prev) => ({ ...prev, name: e.target.value }))}
                />
                <select
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                  value={newAsset.type}
                  onChange={(e) => setNewAsset((prev) => ({ ...prev, type: e.target.value as AssetType }))}
                >
                  <option value="股票">股票</option>
                  <option value="ETF">ETF</option>
                </select>
                <select
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                  value={newAsset.market}
                  onChange={(e) => setNewAsset((prev) => ({ ...prev, market: e.target.value as MarketType }))}
                >
                  <option value="TWSE">TWSE</option>
                  <option value="TPEx">TPEx</option>
                </select>
                <Button onClick={handleAddAsset}>加入</Button>
              </div>
            </Card>
          </div>
        )}

        {activeTab === "weights" && (
          <Card className="p-4">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-bold">權重設定</h2>
                <p className="text-sm text-slate-500">可以手動調整短中長權重；按回預設值可復原。</p>
              </div>
              <Button variant="outline" onClick={() => setWeightConfig(cloneWeightConfig())}>回預設值</Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {WEIGHT_SECTIONS.map((section) => (
                <div key={section.horizon} className="rounded-xl border bg-slate-50 p-3">
                  <div className="font-semibold">{section.title}</div>
                  <div className="mb-3 text-xs text-slate-500">{section.note}</div>
                  <div className="space-y-2">
                    {Object.entries(weightConfig[section.horizon]).map(([key, value]) => (
                      <label key={key} className="grid grid-cols-[1fr_90px] items-center gap-2 text-sm">
                        <span>{WEIGHT_LABELS[key] || key}</span>
                        <Input
                          type="number"
                          value={Math.round(value * 100)}
                          onChange={(e) => updateWeight(section.horizon, key, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}