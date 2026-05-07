// @ts-nocheck
"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Card({ className = "", children }) {
  return <div className={cx("border bg-white", className)}>{children}</div>;
}

function CardContent({ className = "", children }) {
  return <div className={className}>{children}</div>;
}

function Button({ className = "", variant = "default", size = "default", disabled, children, ...props }) {
  const base = "inline-flex items-center justify-center rounded-md font-medium transition disabled:pointer-events-none disabled:opacity-50";
  const variants = {
    default: "bg-slate-900 text-white hover:bg-slate-800",
    outline: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
  };
  const sizes = {
    default: "h-10 px-4 py-2 text-sm",
    sm: "h-8 px-3 text-xs",
  };
  return <button className={cx(base, variants[variant] || variants.default, sizes[size] || sizes.default, className)} disabled={disabled} {...props}>{children}</button>;
}

function Input({ className = "", ...props }) {
  return <input className={cx("h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300", className)} {...props} />;
}

function Badge({ className = "", children }) {
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", className)}>{children}</span>;
}

const TabsContext = createContext(null);

function Tabs({ defaultValue, className = "", children }) {
  const [value, setValue] = useState(defaultValue);
  return <TabsContext.Provider value={{ value, setValue }}><div className={className}>{children}</div></TabsContext.Provider>;
}

function TabsList({ className = "", children }) {
  return <div className={cx("inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1", className)}>{children}</div>;
}

function TabsTrigger({ value, className = "", children }) {
  const ctx = useContext(TabsContext);
  const active = ctx?.value === value;
  return <button type="button" onClick={() => ctx?.setValue(value)} className={cx("w-full min-w-0 whitespace-nowrap rounded-lg px-2 py-2 text-base font-medium transition", active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900", className)}>{children}</button>;
}

function TabsContent({ value, className = "", children }) {
  const ctx = useContext(TabsContext);
  if (ctx?.value !== value) return null;
  return <div className={className}>{children}</div>;
}

function Icon({ name, className = "h-4 w-4" }) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  if (name === "trend") return <svg {...common}><path d="m3 17 6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>;
  if (name === "bar") return <svg {...common}><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20V8" /></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
  if (name === "doc") return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h5" /></svg>;
  if (name === "alert") return <svg {...common}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
}

const DEFAULT_DATA_MODE = "mock";
const DEFAULT_GOOGLE_SHEET_CSV_URL = "";
const DEFAULT_FINMIND_PROXY_URL = "";
const DEFAULT_TWSE_PROXY_URL = ["", "api", "twse", "stocks"].join("/");
const TWSE_STOCK_DAY_ALL_URL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
const TWSE_BWIBBU_ALL_URL = "https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL";
const CORS_PROXY_RAW_URL = "https://api.allorigins.win/raw?url=";
const SOURCE_REFRESH_POLICY = {
  google_csv: { label: "Google 驗證", timeoutMs: 6000, cooldownMs: 5 * 60 * 1000, cacheNote: "只做偏差驗證，5 分鐘內不重抓，不覆蓋主資料。" },
  finmind_proxy: { label: "FinMind Proxy", timeoutMs: 10000, cooldownMs: 10 * 60 * 1000, cacheNote: "主資料源，10 分鐘內不重抓，避免浪費 API 額度。" },
  twse_proxy: { label: "TWSE Proxy", timeoutMs: 8000, cooldownMs: 15 * 60 * 1000, cacheNote: "官方盤後/延遲資料，15 分鐘內不重抓。" },
};
const DEFAULT_FETCH_TIMEOUT_MS = 8000;
const DEFAULT_REFRESH_COOLDOWN_MS = 60000;

const initialStocks = [
  { symbol: "2330", name: "台積電", type: "股票", market: "TWSE", price: 980, prevClose: 965, high20: 990, low20: 880, volume: 62000, avgVolume20: 51000, ma5: 955, ma20: 930, ma60: 885, rsi14: 63, return20d: 8.5, return60d: 17.2, nasdaqReturn1d: 1.1, soxReturn1d: 1.8, taifexAfterHoursReturn: 0.6, vixChange1d: -3.2, foreign3d: 3800, trust3d: 1200, dealer3d: 600, foreign20d: 12000, trust20d: 3500, marginChange5dPct: 1.8, marginChange20dPct: 2.4, revenueYoY: 33, revenueMoM: 4, epsGrowthYoY: 28, grossMargin: 54, operatingMargin: 43, roe: 27, debtRatio: 24, per: 24, pbr: 5.7, dividendYield: 1.2 },
  { symbol: "2454", name: "聯發科", type: "股票", market: "TWSE", price: 1240, prevClose: 1265, high20: 1320, low20: 1180, volume: 9800, avgVolume20: 8700, ma5: 1260, ma20: 1235, ma60: 1190, rsi14: 56, return20d: 3.8, return60d: 9.1, nasdaqReturn1d: 1.1, soxReturn1d: 1.8, taifexAfterHoursReturn: 0.6, vixChange1d: -3.2, foreign3d: -900, trust3d: 450, dealer3d: -120, foreign20d: -2200, trust20d: 900, marginChange5dPct: 0.7, marginChange20dPct: 1.4, revenueYoY: 18, revenueMoM: -2, epsGrowthYoY: 12, grossMargin: 48, operatingMargin: 23, roe: 20, debtRatio: 28, per: 19, pbr: 3.8, dividendYield: 4.1 },
  { symbol: "3231", name: "緯創", type: "股票", market: "TWSE", price: 116, prevClose: 109, high20: 118, low20: 96, volume: 145000, avgVolume20: 90000, ma5: 107, ma20: 101, ma60: 93, rsi14: 76, return20d: 19.5, return60d: 34.2, nasdaqReturn1d: 1.1, soxReturn1d: 1.8, taifexAfterHoursReturn: 0.6, vixChange1d: -3.2, foreign3d: 6000, trust3d: 2400, dealer3d: 900, foreign20d: 18000, trust20d: 7200, marginChange5dPct: 18, marginChange20dPct: 24, revenueYoY: 12, revenueMoM: 8, epsGrowthYoY: 10, grossMargin: 8, operatingMargin: 4.5, roe: 18, debtRatio: 62, per: 28, pbr: 3.2, dividendYield: 2.5 },
  { symbol: "2317", name: "鴻海", type: "股票", market: "TWSE", price: 198, prevClose: 201, high20: 215, low20: 184, volume: 82000, avgVolume20: 76000, ma5: 202, ma20: 195, ma60: 176, rsi14: 61, return20d: 6.2, return60d: 22.5, nasdaqReturn1d: 1.1, soxReturn1d: 1.8, taifexAfterHoursReturn: 0.6, vixChange1d: -3.2, foreign3d: 2600, trust3d: -800, dealer3d: 300, foreign20d: 8900, trust20d: -1200, marginChange5dPct: 4.5, marginChange20dPct: 8.1, revenueYoY: 9, revenueMoM: 3, epsGrowthYoY: 8, grossMargin: 6.5, operatingMargin: 3.2, roe: 12, debtRatio: 49, per: 18, pbr: 1.7, dividendYield: 2.7 },
  { symbol: "6446", name: "藥華藥", type: "股票", market: "TPEx", price: 620, prevClose: 640, high20: 690, low20: 590, volume: 3200, avgVolume20: 4100, ma5: 635, ma20: 648, ma60: 610, rsi14: 48, return20d: -2.8, return60d: 5.6, nasdaqReturn1d: 1.1, soxReturn1d: 1.8, taifexAfterHoursReturn: 0.6, vixChange1d: -3.2, foreign3d: -300, trust3d: 120, dealer3d: -80, foreign20d: 700, trust20d: 600, marginChange5dPct: -2.1, marginChange20dPct: 3.2, revenueYoY: 26, revenueMoM: 7, epsGrowthYoY: 35, grossMargin: 72, operatingMargin: 21, roe: 10, debtRatio: 18, per: 62, pbr: 7.2, dividendYield: 0 },
  { symbol: "0050", name: "元大台灣50", type: "ETF", market: "TWSE", price: 184, prevClose: 183, high20: 188, low20: 174, volume: 42000, avgVolume20: 39000, ma5: 183, ma20: 180, ma60: 172, rsi14: 58, return20d: 5.1, return60d: 12.6, nasdaqReturn1d: 1.1, soxReturn1d: 1.8, taifexAfterHoursReturn: 0.6, vixChange1d: -3.2, foreign3d: 0, trust3d: 0, dealer3d: 0, foreign20d: 0, trust20d: 0, marginChange5dPct: 0, marginChange20dPct: 0, revenueYoY: 0, revenueMoM: 0, epsGrowthYoY: 0, grossMargin: 0, operatingMargin: 0, roe: 0, debtRatio: 0, per: 0, pbr: 0, dividendYield: 3.1 },
];

const mockSourceValidation = {
  "2330": { finmind: { price: 980, prevClose: 965, volume: 62000, per: 24, eps: 40.8 }, google: { price: 979, prevClose: 965, volume: 62150, per: 24.1, eps: 40.7 } },
  "2454": { finmind: { price: 1240, prevClose: 1265, volume: 9800, per: 19, eps: 65.3 }, google: { price: 1243, prevClose: 1265, volume: 9760, per: 19.2, eps: 64.8 } },
  "3231": { finmind: { price: 116, prevClose: 109, volume: 145000, per: 28, eps: 4.14 }, google: { price: 115.5, prevClose: 109, volume: 146500, per: 28.5, eps: 4.05 } },
  "2317": { finmind: { price: 198, prevClose: 201, volume: 82000, per: 18, eps: 11 }, google: { price: 198.5, prevClose: 201, volume: 81900, per: 18.1, eps: 10.9 } },
  "6446": { finmind: { price: 620, prevClose: 640, volume: 3200, per: 62, eps: 10 }, google: { price: 621, prevClose: 640, volume: 3180, per: 63, eps: 9.9 } },
  "0050": { finmind: { price: 184, prevClose: 183, volume: 42000, per: 0, eps: 0 }, google: { price: 184.2, prevClose: 183, volume: 42100, per: 0, eps: 0 } },
};

function getSourceConnectorPlan(config) {
  return [
    { name: "FinMind API", role: "主資料源", status: config.finmindProxyUrl ? "可測試" : "待接 proxy", fields: "日線、法人、融資、月營收、財報、PER/PBR", method: "前端呼叫自己的 proxy，不直接放 FinMind token。" },
    { name: "GoogleFinance / Google Sheet", role: "驗證來源", status: config.googleCsvUrl ? "可測試" : "待填公開 CSV URL", fields: "price、prevClose、volume、PER、EPS、ma5、ma20、rsi14、法人、融資、Nasdaq、SOX、台指期、VIX、updatedAt、sourceNote", method: "前端只貼 CSV URL；App 走 /api/google/verify 讀取。Google 只做主資料偏差驗證，不覆蓋總覽主資料。" },
    { name: "TWSE OpenAPI", role: "官方上市資料", status: config.twseProxyUrl ? "可測試" : "需 proxy", fields: "上市收盤行情、PER、PBR、殖利率", method: "預設走 /api/twse/stocks proxy，後端負責打 TWSE OpenAPI 並回傳 stocks。" },
  ];
}

const finmindAspectPlan = [
  {
    aspect: "技術面",
    datasets: "TaiwanStockPrice / TaiwanStockPriceAdj / TaiwanStockPER",
    fields: "price、prevClose、volume、MA、RSI、報酬率、PER/PBR",
    calcNote: "price、prevClose、volume、PER/PBR 先吃 FinMind；MA、RSI、報酬率由歷史 close 自算。",
    verifyRef: "TWSE STOCK_DAY_ALL / BWIBBU_ALL、GoogleFinance 可驗證 price / volume / PER / PBR。",
    shortRole: "短線 V1 已進公式。",
    midRole: "中線 V1 已納入架構，先用資料分。",
    longRole: "長線 V1 已納入架構，先用資料分。"
  },
  {
    aspect: "籌碼面",
    datasets: "TaiwanStockInstitutionalInvestorsBuySell / TaiwanStockMarginPurchaseShortSale",
    fields: "外資、投信、自營商、融資融券",
    calcNote: "短線用近 3 日法人合計與融資變化；中線可拉長到 20 日。",
    verifyRef: "後續若接到 TWSE / TPEx 官方同欄位，再做驗證；目前先標記主資料。",
    shortRole: "短線 V1 已進公式。",
    midRole: "中線 V1 已納入架構，先用資料分。",
    longRole: "長線 V1 已納入架構，先用資料分。"
  },
  {
    aspect: "基本面",
    datasets: "TaiwanStockMonthRevenue / FinancialStatements / BalanceSheet / CashFlowsStatement",
    fields: "月營收、EPS、毛利率、營益率、ROE、負債比、現金流",
    calcNote: "短線只做資料檢查；中長線公式才會正式使用。",
    verifyRef: "後續接 MOPS 公開資訊觀測站 / TWSE 財報資料作官方驗證。",
    shortRole: "短線 V1 新增為資料檢查維度，不計分。",
    midRole: "中線 V1 已納入架構，先用資料分。",
    longRole: "長線 V1 已納入架構，先用資料分。"
  },
  {
    aspect: "衍生性金融商品",
    datasets: "期貨、選擇權、三大法人期貨選擇權資料；必要時外接 TAIFEX",
    fields: "台指期、選擇權、期貨法人、Put/Call 類資料",
    calcNote: "台指期盤後、選擇權與期貨法人資料先作市場風險輔助；短線只做資料確認。",
    verifyRef: "TAIFEX 官方資料優先；FinMind 可作整合來源。",
    shortRole: "短線 V1 新增為資料檢查維度，不計分。",
    midRole: "中線 V1 已納入架構，先用資料分。",
    longRole: "長線 V1 已納入架構，先用資料分。"
  },
  {
    aspect: "其他 / 市場面",
    datasets: "國際市場、加權/櫃買指數、匯率、利率、商品、美債殖利率；必要時 GoogleFinance 驗證",
    fields: "Nasdaq、SOX、台指期盤後、VIX、指數、匯率、利率",
    calcNote: "短線先用昨晚美股/SOX、VIX、台指期方向；不能驗證就先標記主資料。",
    verifyRef: "GoogleFinance / 官方或行情商來源。",
    shortRole: "短線 V1 已進公式。",
    midRole: "中線 V1 已納入架構，先用資料分。",
    longRole: "長線 V1 已納入架構，先用資料分。"
  },
];

const DEFAULT_WEIGHT_CONFIG = {
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

const WEIGHT_SECTIONS = [
  { horizon: "short", title: "短線權重", note: "預設貼齊圖片版短線三大面向；基本面與衍生性商品預設 0，只做資料確認。" },
  { horizon: "mid", title: "中線權重", note: "目前先作資料可用分與架構測試；之後可替換成正式中線公式。" },
  { horizon: "long", title: "長線權重", note: "目前先作資料可用分與架構測試；ETF 長線未來應改用 ETF 專屬權重。" },
];

const WEIGHT_LABELS = {
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

function cloneWeightConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_WEIGHT_CONFIG));
}

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
const pct = (value) => `${Number(value || 0).toFixed(1)}%`;
const number = (value) => Number(value || 0).toLocaleString("zh-TW");
const passScore = (condition) => (condition ? 1 : 0);

function createAssetTemplate({ symbol, name, type, market }) {
  const normalizedSymbol = normalizeStockSymbol(symbol);
  const normalizedType = type === "ETF" ? "ETF" : "股票";
  return { symbol: normalizedSymbol, name: String(name || normalizedSymbol || "新標的").trim(), type: normalizedType, market: market || "TWSE", price: 100, prevClose: 100, high20: 105, low20: 95, volume: 10000, avgVolume20: 10000, ma5: 100, ma20: 100, ma60: 98, rsi14: 50, return20d: 0, return60d: 0, nasdaqReturn1d: 1.1, soxReturn1d: 1.8, taifexAfterHoursReturn: 0.6, vixChange1d: -3.2, foreign3d: 0, trust3d: 0, dealer3d: 0, foreign20d: 0, trust20d: 0, marginChange5dPct: 0, marginChange20dPct: 0, revenueYoY: normalizedType === "ETF" ? 0 : 1, revenueMoM: 0, epsGrowthYoY: normalizedType === "ETF" ? 0 : 1, grossMargin: normalizedType === "ETF" ? 0 : 20, operatingMargin: normalizedType === "ETF" ? 0 : 10, roe: normalizedType === "ETF" ? 0 : 10, debtRatio: normalizedType === "ETF" ? 0 : 40, per: normalizedType === "ETF" ? 0 : 15, pbr: normalizedType === "ETF" ? 0 : 1.5, dividendYield: 0 };
}

function parseNum(value, fallback = 0) {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (raw === "" || raw === "-" || raw === "--" || raw.toUpperCase() === "N/A") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function parseOptionalNum(value) {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (raw === "" || raw === "-" || raw === "--" || raw.toUpperCase() === "N/A") return null;
  const direct = Number(raw);
  if (Number.isFinite(direct)) return direct;
  const match = raw.match(/[-+]?[0-9]*[.]?[0-9]+/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  return Number.isFinite(n) ? number(n) : "-";
}

function splitDelimitedLine(line, delimiter = ",") {
  if (delimiter === String.fromCharCode(9)) return String(line || "").split(delimiter).map((cell) => cell.trim());
  const cells = [];
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

function splitCsvLine(line) {
  return splitDelimitedLine(line, ",");
}

function detectDelimiter(headerLine) {
  const text = String(headerLine || "");
  const tab = String.fromCharCode(9);
  const tabCount = text.split(tab).length - 1;
  const commaCount = text.split(",").length - 1;
  return tabCount > commaCount ? tab : ",";
}

function parseCsv(text) {
  const cleanText = String(text || "").trim();
  if (!cleanText) return [];
  const newline = String.fromCharCode(10);
  const carriageReturn = String.fromCharCode(13);
  const rows = cleanText.split(newline).map((row) => row.replaceAll(carriageReturn, "")).filter(Boolean);
  if (rows.length < 2) return [];
  const delimiter = detectDelimiter(rows[0]);
  const headers = splitDelimitedLine(rows[0], delimiter).map((h) => h.replace(/^﻿/, "").trim());
  return rows.slice(1).map((line) => {
    const cols = splitDelimitedLine(line, delimiter);
    return headers.reduce((obj, header, index) => ({ ...obj, [header]: cols[index] ?? "" }), { __cols: cols });
  });
}

function normalizeStockSymbol(value) {
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

function chooseBestSymbol(rawSymbol, rawTicker) {
  const symbolFromColumn = normalizeStockSymbol(rawSymbol);
  const symbolFromTicker = normalizeStockSymbol(rawTicker);
  if (!symbolFromColumn && symbolFromTicker) return symbolFromTicker;
  if (!symbolFromTicker && symbolFromColumn) return symbolFromColumn;
  if (symbolFromColumn && symbolFromTicker && symbolFromColumn !== symbolFromTicker && symbolFromTicker.endsWith(symbolFromColumn)) return symbolFromTicker;
  return symbolFromColumn || symbolFromTicker;
}

function getRowValue(row, keys, fallback = "") {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return fallback;
}

function normalizeExternalStock(row) {
  const symbol = normalizeStockSymbol(getRowValue(row, ["symbol", "Symbol", "stock_id", "data_id", "code", "Code", "ticker", "Ticker", "代號", "股票代號"]));
  const type = row.type === "ETF" || /^00/.test(symbol) ? "ETF" : "股票";
  const base = createAssetTemplate({ symbol, name: getRowValue(row, ["name", "Name", "stock_name", "股票名稱", "名稱"], symbol), type, market: row.market || row.exchange || "TWSE" });
  return {
    ...base,
    price: parseNum(getRowValue(row, ["price", "Price", "close", "Close", "現價", "價格", "收盤價"]), base.price),
    prevClose: parseNum(getRowValue(row, ["prevClose", "prev_close", "previous_close", "closeyest", "CloseYest", "昨收", "昨日收盤"]), base.prevClose),
    volume: parseNum(getRowValue(row, ["volume", "Volume", "Trading_Volume", "成交量"]), base.volume),
    per: parseNum(getRowValue(row, ["per", "PER", "pe", "PE", "本益比"]), base.per),
    pbr: parseNum(getRowValue(row, ["pbr", "PBR", "股價淨值比"]), base.pbr),
    dividendYield: parseNum(getRowValue(row, ["dividendYield", "dividend_yield", "DividendYield", "殖利率"]), base.dividendYield),
  };
}

function normalizeGoogleValidationRow(row) {
  const cols = Array.isArray(row.__cols) ? row.__cols : [];
  const rawSymbol = getRowValue(row, ["symbol", "Symbol"], cols[0] || "");
  const name = getRowValue(row, ["name", "Name"], cols[1] || "");
  const rawTicker = getRowValue(row, ["ticker", "Ticker", "googleTicker", "GoogleTicker"], cols[2] || "");
  const symbol = chooseBestSymbol(rawSymbol, rawTicker);
  return {
    symbol,
    name,
    ticker: rawTicker,
    rawSymbol,
    rawTicker,
    google: {
      price: parseOptionalNum(getRowValue(row, ["price", "Price"], cols[3] || "")),
      prevClose: parseOptionalNum(getRowValue(row, ["prevClose", "PrevClose", "prev_close", "closeyest", "CloseYest"], cols[4] || "")),
      volume: parseOptionalNum(getRowValue(row, ["volume", "Volume"], cols[5] || "")),
      per: parseOptionalNum(getRowValue(row, ["per", "PER", "pe", "PE"], cols[6] || "")),
      eps: parseOptionalNum(getRowValue(row, ["eps", "EPS"], cols[7] || "")),
      ma5: parseOptionalNum(getRowValue(row, ["ma5", "MA5"], cols[8] || "")),
      ma20: parseOptionalNum(getRowValue(row, ["ma20", "MA20"], cols[9] || "")),
      rsi14: parseOptionalNum(getRowValue(row, ["rsi14", "RSI14"], cols[10] || "")),
      foreign3d: parseOptionalNum(getRowValue(row, ["foreign3d", "Foreign3d"], cols[11] || "")),
      trust3d: parseOptionalNum(getRowValue(row, ["trust3d", "Trust3d"], cols[12] || "")),
      dealer3d: parseOptionalNum(getRowValue(row, ["dealer3d", "Dealer3d"], cols[13] || "")),
      marginChange5dPct: parseOptionalNum(getRowValue(row, ["marginChange5dPct", "MarginChange5dPct"], cols[14] || "")),
      nasdaqReturn1d: parseOptionalNum(getRowValue(row, ["nasdaqReturn1d", "NasdaqReturn1d"], cols[15] || "")),
      soxReturn1d: parseOptionalNum(getRowValue(row, ["soxReturn1d", "SoxReturn1d", "SOXReturn1d"], cols[16] || "")),
      taifexAfterHoursReturn: parseOptionalNum(getRowValue(row, ["taifexAfterHoursReturn", "TaifexAfterHoursReturn"], cols[17] || "")),
      vixChange1d: parseOptionalNum(getRowValue(row, ["vixChange1d", "VixChange1d", "VIXChange1d"], cols[18] || "")),
      updatedAt: getRowValue(row, ["updatedAt", "UpdatedAt"], cols[19] || ""),
      sourceNote: getRowValue(row, ["sourceNote", "SourceNote"], cols[20] || ""),
    },
  };
}

function getAnyField(row, keys, fallback = "") {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return fallback;
}

function normalizeTwseStockDayRow(row) {
  const symbol = String(getAnyField(row, ["Code", "code", "證券代號", "股票代號", "stockNo", "stock_id"])).trim().toUpperCase();
  if (!symbol) return null;
  const name = String(getAnyField(row, ["Name", "name", "證券名稱", "股票名稱", "stock_name"], symbol)).trim();
  const close = parseNum(getAnyField(row, ["ClosingPrice", "Closing Price", "收盤價", "close", "Close"]), 100);
  const high = parseNum(getAnyField(row, ["HighestPrice", "Highest Price", "最高價", "high", "High"]), close);
  const low = parseNum(getAnyField(row, ["LowestPrice", "Lowest Price", "最低價", "low", "Low"]), close);
  const volume = parseNum(getAnyField(row, ["TradeVolume", "Trade Volume", "成交股數", "成交量", "volume"]), 0);
  const change = parseNum(getAnyField(row, ["Change", "漲跌價差", "漲跌", "change"]), 0);
  const prevClose = close - change;
  const type = /^00/.test(symbol) ? "ETF" : "股票";
  return { ...createAssetTemplate({ symbol, name, type, market: "TWSE" }), price: close, prevClose: prevClose > 0 ? prevClose : close, high20: Math.max(high, close), low20: Math.min(low, close), volume, avgVolume20: volume || 10000 };
}

function normalizeTwseBwibbuRow(row) {
  const symbol = String(getAnyField(row, ["Code", "code", "證券代號", "股票代號", "stockNo", "stock_id"])).trim().toUpperCase();
  if (!symbol) return null;
  return {
    symbol,
    per: parseNum(getAnyField(row, ["PEratio", "PER", "本益比", "殖利率", "本益比(倍)"]), 0),
    pbr: parseNum(getAnyField(row, ["PBratio", "PBR", "股價淨值比", "股價淨值比(倍)"]), 0),
    dividendYield: parseNum(getAnyField(row, ["DividendYield", "Dividend Yield", "殖利率", "殖利率(%)"]), 0),
  };
}

function mergeTwseRows(stockRows, valuationRows) {
  const valuationMap = new Map(valuationRows.filter(Boolean).map((row) => [row.symbol, row]));
  return stockRows.filter(Boolean).map((stock) => ({ ...stock, ...(valuationMap.get(stock.symbol) || {}) }));
}

async function fetchJsonViaCorsProxy(url, timeoutMs) {
  const proxyUrl = `${CORS_PROXY_RAW_URL}${encodeURIComponent(url)}`;
  const res = await fetchWithTimeout(proxyUrl, {}, timeoutMs);
  if (!res.ok) throw new Error(`CORS proxy HTTP ${res.status}`);
  return await res.json();
}

async function fetchTextViaCorsProxy(url, timeoutMs) {
  const proxyUrl = `${CORS_PROXY_RAW_URL}${encodeURIComponent(url)}`;
  const res = await fetchWithTimeout(proxyUrl, {}, timeoutMs);
  if (!res.ok) throw new Error(`CORS proxy HTTP ${res.status}`);
  return await res.text();
}

async function fetchCsvText(url, timeoutMs) {
  try {
    const res = await fetchWithTimeout(url, {}, timeoutMs);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { text: await res.text(), mode: "direct" };
  } catch (directError) {
    return { text: await fetchTextViaCorsProxy(url, timeoutMs), mode: "cors_fallback" };
  }
}

function buildGoogleValidationResult(csvText, stocks, mode = "manual") {
  const rows = parseCsv(csvText);
  const currentMap = new Map(stocks.map((stock) => [normalizeStockSymbol(stock.symbol), stock]));
  const incoming = rows.map((row) => normalizeGoogleValidationRow(row)).filter((item) => item.symbol);
  const valuePreview = incoming.slice(0, 6).map((item) => ({ symbol: item.symbol, price: item.google.price, prevClose: item.google.prevClose, volume: item.google.volume, per: item.google.per, eps: item.google.eps }));
  const unmatched = [];
  const nextValidation = incoming.reduce((acc, item) => {
    const base = currentMap.get(item.symbol);
    if (!base) { unmatched.push(item.symbol); return acc; }
    acc[item.symbol] = {
      finmind: { price: base.price, prevClose: base.prevClose, volume: base.volume, per: base.per, eps: base.epsGrowthYoY },
      google: item.google,
    };
    return acc;
  }, {});
  const debug = { mode, parsedRows: rows.length, headers: rows[0] ? Object.keys(rows[0]).filter((key) => key !== "__cols") : [], rawPreview: rows.slice(0, 3).map((row) => row.__cols || []), incomingSymbols: incoming.map((item) => item.symbol).filter(Boolean), matchedSymbols: Object.keys(nextValidation), unmatchedSymbols: unmatched.filter(Boolean), valuePreview };
  return { rows, incoming, nextValidation, debug };
}

async function fetchTwseDirectFallback(policy) {
  const [priceJson, valuationJson] = await Promise.all([
    fetchJsonViaCorsProxy(TWSE_STOCK_DAY_ALL_URL, policy.timeoutMs),
    fetchJsonViaCorsProxy(TWSE_BWIBBU_ALL_URL, policy.timeoutMs),
  ]);
  const priceList = Array.isArray(priceJson) ? priceJson : Array.isArray(priceJson.data) ? priceJson.data : [];
  const valuationList = Array.isArray(valuationJson) ? valuationJson : Array.isArray(valuationJson.data) ? valuationJson.data : [];
  return mergeTwseRows(priceList.map(normalizeTwseStockDayRow), valuationList.map(normalizeTwseBwibbuRow));
}

function mergeStocksBySymbol(currentStocks, incomingStocks) {
  const map = new Map(currentStocks.map((stock) => [stock.symbol, stock]));
  incomingStocks.forEach((incoming) => {
    if (!incoming.symbol) return;
    const previous = map.get(incoming.symbol) || {};
    map.set(incoming.symbol, { ...previous, ...incoming });
  });
  return Array.from(map.values());
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`Timeout ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function canRefreshSource(lastFetchMap, source, cooldownMs = DEFAULT_REFRESH_COOLDOWN_MS) {
  const last = lastFetchMap[source] || 0;
  const remainMs = Math.max(0, cooldownMs - (Date.now() - last));
  return { ok: remainMs <= 0, remainMs, remainSec: Math.ceil(remainMs / 1000) };
}

function markSourceFetched(lastFetchMap, source) {
  return { ...lastFetchMap, [source]: Date.now() };
}

function getSourcePolicy(source) {
  return SOURCE_REFRESH_POLICY[source] || { label: source, timeoutMs: DEFAULT_FETCH_TIMEOUT_MS, cooldownMs: DEFAULT_REFRESH_COOLDOWN_MS, cacheNote: "預設 60 秒冷卻。" };
}

function getGoogleFinanceTicker(stock) {
  const prefix = stock.market === "TPEx" ? "TWO" : "TPE";
  return `${prefix}:${stock.symbol}`;
}

function buildGoogleVerifySheetTemplate(stocks) {
  const tab = String.fromCharCode(9);
  const newline = String.fromCharCode(10);
  const rows = [[
    "symbol", "name", "ticker", "price", "prevClose", "volume", "per", "eps",
    "ma5", "ma20", "rsi14", "foreign3d", "trust3d", "dealer3d", "marginChange5dPct",
    "nasdaqReturn1d", "soxReturn1d", "taifexAfterHoursReturn", "vixChange1d", "updatedAt", "sourceNote"
  ]];
  stocks.forEach((stock, index) => {
    const row = index + 2;
    const sheetSymbol = String(stock.symbol).startsWith("0") ? `'${stock.symbol}` : stock.symbol;
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

function formatLastFetch(lastFetchMap, source) {
  const time = lastFetchMap[source];
  if (!time) return "尚未抓取";
  return new Date(time).toLocaleTimeString("zh-TW", { hour12: false });
}

function addAssetToList(stocks, assetInput) {
  const asset = createAssetTemplate(assetInput);
  if (!asset.symbol) return { ok: false, stocks, asset: null, error: "請輸入股票或 ETF 代號。" };
  if (stocks.some((stock) => stock.symbol === asset.symbol)) return { ok: false, stocks, asset: null, error: `${asset.symbol} 已在總覽中。` };
  return { ok: true, stocks: [...stocks, asset], asset, error: "" };
}

function removeAssetFromList(stocks, symbol) {
  if (stocks.length <= 1) return { ok: false, stocks, nextSelected: stocks[0]?.symbol || "", error: "至少需要保留一個標的。" };
  const nextStocks = stocks.filter((stock) => stock.symbol !== symbol);
  if (nextStocks.length === stocks.length) return { ok: false, stocks, nextSelected: stocks[0]?.symbol || "", error: `${symbol} 不在總覽中。` };
  return { ok: true, stocks: nextStocks, nextSelected: nextStocks[0]?.symbol || "", error: "" };
}

function compareSourceValue(label, finmindValue, googleValue, tolerancePct, note = "") {
  const f = Number(finmindValue);
  const g = Number(googleValue);
  const hasBoth = googleValue !== null && googleValue !== undefined && Number.isFinite(f) && Number.isFinite(g) && f !== 0;
  const diffPct = hasBoth ? ((g - f) / f) * 100 : 0;
  const absDiffPct = Math.abs(diffPct);
  const status = !hasBoth ? "無法取得" : absDiffPct <= tolerancePct ? "通過" : "需檢查";
  return { label, finmindValue, googleValue, diffPct, tolerancePct, status, note };
}

function getSourceValidationRows(symbol, stock, validationMap = {}) {
  const main = stock ? {
    price: stock.price,
    prevClose: stock.prevClose,
    volume: stock.volume,
    per: stock.per,
    eps: stock.eps ?? stock.epsGrowthYoY,
    ma5: stock.ma5,
    ma20: stock.ma20,
    nasdaqReturn1d: stock.nasdaqReturn1d,
    soxReturn1d: stock.soxReturn1d,
    vixChange1d: stock.vixChange1d,
  } : { price: 0, prevClose: 0, volume: 0, per: 0, eps: 0, ma5: 0, ma20: 0, nasdaqReturn1d: 0, soxReturn1d: 0, vixChange1d: 0 };
  const google = validationMap[symbol]?.google || validationMap[symbol]?.verify || { price: null, prevClose: null, volume: null, per: null, eps: null, ma5: null, ma20: null, nasdaqReturn1d: null, soxReturn1d: null, vixChange1d: null };
  return [
    compareSourceValue("現價 price", main.price, google.price, 0.5, "可由 GoogleFinance / TWSE 官方行情驗證；驗證來源無法取得時只保留主資料。"),
    compareSourceValue("昨收 prevClose", main.prevClose, google.prevClose, 0.2, "昨收理論上應高度一致，若偏差大優先檢查交易日與除權息。"),
    compareSourceValue("成交量 volume", main.volume, google.volume, 3, "成交量常因單位、更新時間、延遲造成差異，容忍度比價格高。"),
    compareSourceValue("本益比 PER", main.per, google.per, 5, "PER 可能因資料源 EPS 口徑不同而偏差，只做輔助驗證。"),
    compareSourceValue("EPS", main.eps, google.eps, 5, "EPS 口徑可能不同；驗證來源無法取得時只保留主資料。"),
    compareSourceValue("5MA", main.ma5, google.ma5, 1, "短線技術面驗證欄位；正式 RSI 後續由後端或 FinMind close series 計算。"),
    compareSourceValue("20MA", main.ma20, google.ma20, 1, "波段均線驗證欄位。"),
    compareSourceValue("Nasdaq 一日變化", main.nasdaqReturn1d, google.nasdaqReturn1d, 5, "市場面驗證欄位。"),
    compareSourceValue("SOX 一日變化", main.soxReturn1d, google.soxReturn1d, 5, "半導體市場面驗證欄位。"),
    compareSourceValue("VIX 一日變化", main.vixChange1d, google.vixChange1d, 5, "風險面驗證欄位。"),
  ];
}

function getValidationState(rows) {
  const total = rows.length;
  const missing = rows.filter((row) => row.status === "無法取得").length;
  const failed = rows.filter((row) => row.status === "需檢查").length;
  const passed = rows.filter((row) => row.status === "通過").length;
  if (failed > 0) return { label: "需檢查", tone: "bg-orange-100 text-orange-800", failed, missing, passed };
  if (passed > 0 && missing === 0) return { label: "可信", tone: "bg-emerald-100 text-emerald-800", failed, missing, passed };
  if (passed > 0) return { label: "部分驗證", tone: "bg-yellow-100 text-yellow-800", failed, missing, passed };
  return { label: "未驗證", tone: "bg-slate-100 text-slate-700", failed, missing: total, passed: 0 };
}

function validationSummary(rows) {
  const state = getValidationState(rows);
  if (state.label === "可信") return "可驗證欄位皆在容忍範圍內，主資料可信。";
  if (state.label === "部分驗證") return `已有 ${state.passed} 項通過驗證，仍有 ${state.missing} 項無法從驗證來源取得；該欄位僅保留主資料，不判定為驗證失敗。`;
  if (state.label === "需檢查") return `有 ${state.failed} 項超過容忍值，需檢查資料日期、單位或除權息口徑；未能確認前不應完全信任該欄位。`;
  return "目前驗證來源無法取得可比對欄位；系統先保留 FinMind / 主資料，不判定為驗證失敗。";
}

function getDerived(stock) {
  const todayReturn = stock.prevClose > 0 ? ((stock.price - stock.prevClose) / stock.prevClose) * 100 : 0;
  const volumeRatio = stock.avgVolume20 > 0 ? stock.volume / stock.avgVolume20 : 1;
  const range20 = stock.high20 - stock.low20;
  const closePosition20 = range20 > 0 ? clamp(((stock.price - stock.low20) / range20) * 100) : 50;
  const institutional3d = (stock.foreign3d || 0) + (stock.trust3d || 0) + (stock.dealer3d || 0);
  const institutional20d = (stock.foreign20d || 0) + (stock.trust20d || 0);
  return { todayReturn, volumeRatio, closePosition20, institutional3d, institutional20d };
}

function buildShortV1Rows(stock, weights = DEFAULT_WEIGHT_CONFIG.short) {
  const d = getDerived(stock);
  return [
    { weightKey: "ma5", dimension: "技術面", item: "股價站上 5MA（短線轉強）", source: "FinMind 技術面 / TaiwanStockPrice 自算", weight: weights.ma5, score: passScore(stock.price > stock.ma5), rule: `${number(stock.price)} > ${number(stock.ma5)}`, status: weights.ma5 > 0 ? "計分" : "資料確認，不計分" },
    { weightKey: "ma20", dimension: "技術面", item: "股價站上 20MA（波段不弱）", source: "FinMind 技術面 / TaiwanStockPrice 自算", weight: weights.ma20, score: passScore(stock.price > stock.ma20), rule: `${number(stock.price)} > ${number(stock.ma20)}`, status: weights.ma20 > 0 ? "計分" : "資料確認，不計分" },
    { weightKey: "rsi", dimension: "技術面", item: "RSI(14) 未過熱（< 70）", source: "FinMind 技術面 / close 自算 RSI", weight: weights.rsi, score: passScore(stock.rsi14 < 70), rule: `${stock.rsi14} < 70`, status: weights.rsi > 0 ? "計分" : "資料確認，不計分" },
    { weightKey: "institutional3d", dimension: "籌碼面", item: "三大法人近 3 日買超", source: "FinMind 籌碼面 / Institutional Investors Buy Sell", weight: weights.institutional3d, score: passScore(d.institutional3d > 0), rule: `外資+投信+自營商 = ${number(d.institutional3d)}`, status: weights.institutional3d > 0 ? "計分" : "資料確認，不計分" },
    { weightKey: "margin5d", dimension: "籌碼面", item: "融資未異常暴增", source: "FinMind 籌碼面 / Margin Purchase Short Sale", weight: weights.margin5d, score: passScore(stock.marginChange5dPct <= 8), rule: `${pct(stock.marginChange5dPct)} <= 8%`, status: weights.margin5d > 0 ? "計分" : "資料確認，不計分" },
    { weightKey: "usMarket", dimension: "市場面", item: "昨晚 Nasdaq / SOX 至少一項收紅", source: "其他 / 市場面；V1 先 mock，後續接外部行情或 FinMind 可用資料", weight: weights.usMarket, score: passScore(stock.nasdaqReturn1d > 0 || stock.soxReturn1d > 0), rule: `Nasdaq ${pct(stock.nasdaqReturn1d)} / SOX ${pct(stock.soxReturn1d)}`, status: weights.usMarket > 0 ? "計分" : "資料確認，不計分" },
    { weightKey: "futuresVix", dimension: "市場面", item: "台指期盤後上漲或 VIX 回落", source: "其他 / 市場面；V1 先 mock，後續接 TAIFEX / VIX 外部行情", weight: weights.futuresVix, score: passScore(stock.taifexAfterHoursReturn > 0 || stock.vixChange1d < 0), rule: `台指期盤後 ${pct(stock.taifexAfterHoursReturn)} / VIX ${pct(stock.vixChange1d)}`, status: weights.futuresVix > 0 ? "計分" : "資料確認，不計分" },
    { weightKey: "fundamentalsData", dimension: "基本面", item: "月營收 / EPS 資料可抓取", source: "FinMind 基本面 / MonthRevenue + FinancialStatements", weight: weights.fundamentalsData, score: passScore(Number.isFinite(stock.revenueYoY) && Number.isFinite(stock.epsGrowthYoY)), rule: `營收YoY ${pct(stock.revenueYoY)} / EPS YoY ${pct(stock.epsGrowthYoY)}`, status: weights.fundamentalsData > 0 ? "計分" : "資料確認，不計分" },
    { weightKey: "derivativesData", dimension: "衍生性金融商品", item: "台指期 / 選擇權資料預留", source: "FinMind 衍生性資料或 TAIFEX；目前用台指期盤後 proxy", weight: weights.derivativesData, score: passScore(Number.isFinite(stock.taifexAfterHoursReturn)), rule: `台指期盤後 ${pct(stock.taifexAfterHoursReturn)}`, status: weights.derivativesData > 0 ? "計分" : "資料確認，不計分" },
  ];
}

function buildMidV1Rows(stock, weights = DEFAULT_WEIGHT_CONFIG.mid) {
  const d = getDerived(stock);
  return [
    { weightKey: "trendData", dimension: "技術面", item: "20MA / 60MA / 60日報酬資料可抓取", source: "FinMind 技術面 / TaiwanStockPrice 自算", weight: weights.trendData, score: passScore(Number.isFinite(stock.ma20) && Number.isFinite(stock.ma60) && Number.isFinite(stock.return60d)), rule: `20MA ${number(stock.ma20)} / 60MA ${number(stock.ma60)} / 60日 ${pct(stock.return60d)}`, status: weights.trendData > 0 ? "計分" : "資料確認，不計分" },
    { weightKey: "chipData", dimension: "籌碼面", item: "法人 20 日與融資 20 日資料可抓取", source: "FinMind 籌碼面 / Institutional + Margin", weight: weights.chipData, score: passScore(Number.isFinite(d.institutional20d) && Number.isFinite(stock.marginChange20dPct)), rule: `法人20日 ${number(d.institutional20d)} / 融資20日 ${pct(stock.marginChange20dPct)}`, status: weights.chipData > 0 ? "計分" : "資料確認，不計分" },
    { weightKey: "fundamentalData", dimension: "基本面", item: "月營收 / EPS / PER 資料可抓取", source: "FinMind 基本面 / MonthRevenue + FinancialStatements + TaiwanStockPER", weight: weights.fundamentalData, score: passScore(Number.isFinite(stock.revenueYoY) && Number.isFinite(stock.epsGrowthYoY) && Number.isFinite(stock.per)), rule: `營收YoY ${pct(stock.revenueYoY)} / EPS YoY ${pct(stock.epsGrowthYoY)} / PER ${number(stock.per)}`, status: weights.fundamentalData > 0 ? "計分" : "資料確認，不計分" },
    { weightKey: "derivativesData", dimension: "衍生性金融商品", item: "台指期 / 選擇權中線風險資料預留", source: "FinMind 衍生性資料或 TAIFEX", weight: weights.derivativesData, score: passScore(Number.isFinite(stock.taifexAfterHoursReturn)), rule: `台指期 proxy ${pct(stock.taifexAfterHoursReturn)}`, status: weights.derivativesData > 0 ? "計分" : "資料確認，不計分" },
    { weightKey: "marketData", dimension: "其他 / 市場面", item: "市場與總經資料預留", source: "FinMind 其他 / 指數、匯率、利率；必要時 GoogleFinance 驗證", weight: weights.marketData, score: passScore(Number.isFinite(stock.nasdaqReturn1d) && Number.isFinite(stock.vixChange1d)), rule: `Nasdaq ${pct(stock.nasdaqReturn1d)} / VIX ${pct(stock.vixChange1d)}`, status: weights.marketData > 0 ? "計分" : "資料確認，不計分" },
  ];
}

function buildLongV1Rows(stock, weights = DEFAULT_WEIGHT_CONFIG.long) {
  return [
    { weightKey: "priceData", dimension: "技術面", item: "長期價量資料預留", source: "FinMind 技術面 / TaiwanStockPriceAdj / 長期日線", weight: weights.priceData, score: passScore(Number.isFinite(stock.return60d)), rule: `60日報酬 ${pct(stock.return60d)}，後續可改 1Y/3Y`, status: weights.priceData > 0 ? "計分" : "資料確認，不計分" },
    { weightKey: "chipData", dimension: "籌碼面", item: "長期持股 / 法人資料預留", source: "FinMind 籌碼面 / 外資持股、借券、法人資料候選", weight: weights.chipData, score: passScore(Number.isFinite(stock.foreign20d)), rule: `外資20日 proxy ${number(stock.foreign20d)}`, status: weights.chipData > 0 ? "計分" : "資料確認，不計分" },
    { weightKey: "qualityData", dimension: "基本面", item: "品質 / 成長 / 財務安全資料可抓取", source: "FinMind 基本面 / 財報三表 + 月營收 + PER", weight: weights.qualityData, score: passScore(Number.isFinite(stock.roe) && Number.isFinite(stock.grossMargin) && Number.isFinite(stock.debtRatio)), rule: `ROE ${pct(stock.roe)} / 毛利率 ${pct(stock.grossMargin)} / 負債比 ${pct(stock.debtRatio)}`, status: weights.qualityData > 0 ? "計分" : "資料確認，不計分" },
    { weightKey: "derivativesData", dimension: "衍生性金融商品", item: "長線通常不使用，先保留", source: "FinMind 衍生性資料或 TAIFEX", weight: weights.derivativesData, score: 0, rule: "長線暫不測", status: weights.derivativesData > 0 ? "計分" : "預留，不測" },
    { weightKey: "macroData", dimension: "其他 / 市場面", item: "利率 / 匯率 / 商品 / 總經資料預留", source: "FinMind 其他；必要時外部總經資料", weight: weights.macroData, score: passScore(Number.isFinite(stock.vixChange1d)), rule: `VIX proxy ${pct(stock.vixChange1d)}`, status: weights.macroData > 0 ? "計分" : "資料確認，不計分" },
  ];
}

function scoreRows(rows) {
  const scoringRows = rows.filter((row) => row.weight > 0);
  const totalWeight = scoringRows.reduce((sum, row) => sum + row.weight, 0);
  const total = scoringRows.reduce((sum, row) => sum + row.weight * row.score, 0);
  const dimensions = Object.values(rows.reduce((acc, row) => {
    if (!acc[row.dimension]) acc[row.dimension] = { dimension: row.dimension, weight: 0, points: 0, pass: 0, count: 0, dataCount: 0 };
    acc[row.dimension].weight += row.weight;
    acc[row.dimension].points += row.weight * row.score;
    acc[row.dimension].pass += row.score === 1 ? 1 : 0;
    acc[row.dimension].count += row.weight > 0 ? 1 : 0;
    acc[row.dimension].dataCount += row.weight === 0 ? 1 : 0;
    return acc;
  }, {})).map((dim) => ({ ...dim, scorePct: dim.weight > 0 ? (dim.points / dim.weight) * 100 : 0 }));
  return { rows, dimensions, totalWeight, total, score100: total * 100 };
}

function getStopLossState(stock) {
  const breakMa20 = stock.price < stock.ma20;
  const nearLow20 = stock.price <= stock.low20 * 1.02;
  const pullbackFromHigh20 = stock.high20 > 0 ? ((stock.high20 - stock.price) / stock.high20) * 100 : 0;
  const deepPullback = pullbackFromHigh20 >= 8;
  const triggered = breakMa20 || nearLow20 || deepPullback;
  const reasons = [];
  if (breakMa20) reasons.push("跌破20MA");
  if (nearLow20) reasons.push("接近20日低點");
  if (deepPullback) reasons.push(`距20日高點回落${pct(pullbackFromHigh20)}`);
  return { triggered, reasons, pullbackFromHigh20 };
}

function applyStopLossGate(result, stock) {
  const stopLoss = getStopLossState(stock);
  const rawScore100 = result.score100;
  const cappedScore100 = stopLoss.triggered ? Math.min(rawScore100, 55) : rawScore100;
  return { ...result, rawScore100, score100: cappedScore100, total: cappedScore100 / 100, stopLoss };
}

function scoreShortV1(stock, weightConfig = DEFAULT_WEIGHT_CONFIG) { return applyStopLossGate(scoreRows(buildShortV1Rows(stock, weightConfig.short)), stock); }
function scoreMidV1(stock, weightConfig = DEFAULT_WEIGHT_CONFIG) { return scoreRows(buildMidV1Rows(stock, weightConfig.mid)); }
function scoreLongV1(stock, weightConfig = DEFAULT_WEIGHT_CONFIG) { return scoreRows(buildLongV1Rows(stock, weightConfig.long)); }

function getShortRecommendation(total, stopLoss) {
  if (stopLoss?.triggered) return { label: "停損警示 / 不追價", tone: "bg-red-100 text-red-800" };
  if (total >= 0.85) return { label: "強力買入 / 適合短線做多", tone: "bg-emerald-100 text-emerald-800" };
  if (total >= 0.7) return { label: "偏多 / 可分批試單", tone: "bg-lime-100 text-lime-800" };
  if (total >= 0.55) return { label: "橫盤觀望 / 等確認", tone: "bg-yellow-100 text-yellow-800" };
  if (total >= 0.4) return { label: "偏弱 / 不追價", tone: "bg-orange-100 text-orange-800" };
  return { label: "避開 / 等待轉強", tone: "bg-red-100 text-red-800" };
}

function getShortV1Analysis(result) {
  const tech = result.dimensions.find((d) => d.dimension === "技術面");
  const chip = result.dimensions.find((d) => d.dimension === "籌碼面");
  const market = result.dimensions.find((d) => d.dimension === "市場面");
  const rec = getShortRecommendation(result.total, result.stopLoss);
  const parts = [`短線總分 ${result.score100.toFixed(0)} 分，系統建議為「${rec.label}」。`];
  if (result.stopLoss?.triggered) parts.push(`停損閘門已觸發：${result.stopLoss.reasons.join("、")}；原始分數 ${result.rawScore100.toFixed(0)} 分被限制在 ${result.score100.toFixed(0)} 分。`);
  if ((tech?.scorePct || 0) >= 80) parts.push("技術面偏多，股價站上短均線且 RSI 尚未過熱，短線價格結構健康。");
  else if ((tech?.scorePct || 0) >= 50) parts.push("技術面中性偏多，但仍有部分條件未完全確認，需觀察是否能續站均線。");
  else parts.push("技術面偏弱或過熱，短線不適合單靠價格追進。");
  if ((chip?.scorePct || 0) >= 80) parts.push("籌碼面偏多，法人近 3 日買超且融資未明顯失控。");
  else if ((chip?.scorePct || 0) >= 50) parts.push("籌碼面普通，法人或融資條件只有部分通過。");
  else parts.push("籌碼面偏弱，法人未明顯站在買方或融資升溫過快。");
  if ((market?.scorePct || 0) >= 80) parts.push("市場面有支撐，昨晚美股/SOX 與台指期/VIX 條件都偏正向。");
  else if ((market?.scorePct || 0) >= 50) parts.push("市場面尚可，但隔夜美股/SOX 與台指期/VIX 只有部分條件通過。");
  else parts.push("市場面不支援，隔夜外部環境偏弱，短線要降低部位。");
  parts.push("基本面與衍生性金融商品已加入短線 V1 版面作資料抓取確認，但目前權重為 0，不影響原三大面向公式。");
  return parts.join(" ");
}

function getFrameworkAnalysis(horizon, result) {
  return `${horizon} V1 目前是資料架構版，已列入 FinMind 五大面向，共 ${result.rows.length} 項資料檢查，其中 ${result.rows.filter((row) => row.score === 1).length} 項 mock 資料可用。此頁尚未啟用正式投資分數，只用來確認 API 欄位是否可抓。`;
}

function getMidV1Analysis(stock, result) {
  const ready = result.rows.filter((row) => row.score === 1).length;
  const parts = [`${stock.symbol} ${stock.name} 的中線 V1 目前尚未啟用正式分數。`];
  parts.push(`目前只檢查資料可用性：五大面向中有 ${ready}/${result.rows.length} 項資料可用。`);
  parts.push("中線後續會以趨勢延續、法人建倉、月營收/EPS 變化、估值空間與市場風險作為正式公式主軸。");
  if (stock.return60d > 10) parts.push("目前 mock 資料顯示 60 日趨勢偏強，可作為後續中線趨勢分的候選加分項。");
  if ((stock.foreign20d || 0) + (stock.trust20d || 0) > 0) parts.push("法人 20 日合計偏買，後續可納入中線籌碼分。");
  if (stock.revenueYoY > 0 && stock.epsGrowthYoY > 0) parts.push("營收與 EPS 成長為正，後續可納入中線基本面變化分。");
  return parts.join(" ");
}

function getLongV1Analysis(stock, result) {
  const ready = result.rows.filter((row) => row.score === 1).length;
  const parts = [`${stock.symbol} ${stock.name} 的長線 V1 目前尚未啟用正式分數。`];
  parts.push(`目前只檢查資料可用性：五大面向中有 ${ready}/${result.rows.length} 項資料可用。`);
  parts.push("長線後續會以品質、成長、估值安全邊際、財務安全與穩定性作為正式公式主軸。短線技術分不應直接拿來代表長線價值。 ");
  if (stock.type === "ETF") parts.push("此標的是 ETF，長線公式應改用成分股品質、折溢價、費用率、殖利率、追蹤誤差與波動控制，不應套用個股財報公式。");
  else {
    if (stock.roe >= 15) parts.push("ROE 偏高，後續可納入品質分。 ");
    if (stock.debtRatio <= 40) parts.push("負債比相對可控，後續可納入財務安全分。 ");
    if (stock.grossMargin >= 30) parts.push("毛利率具備一定品質基礎，後續可納入長線競爭力檢查。 ");
  }
  return parts.join(" ");
}

function getHorizonInsight(row, horizon) {
  if (!row) return null;
  if (horizon === "short") return { title: `${row.stock.symbol} ${row.stock.name}｜短線評語`, body: getShortV1Analysis(row.short), badge: `${Math.round(row.short.score100)} 分`, tone: row.recommendation.tone };
  if (horizon === "mid") return { title: `${row.stock.symbol} ${row.stock.name}｜中線評語`, body: getMidV1Analysis(row.stock, row.mid), badge: "待公式", tone: "bg-slate-100 text-slate-700" };
  return { title: `${row.stock.symbol} ${row.stock.name}｜長線評語`, body: getLongV1Analysis(row.stock, row.long), badge: "待公式", tone: "bg-slate-100 text-slate-700" };
}

function buildOverviewRows(stocks, validationMap = {}, weightConfig = DEFAULT_WEIGHT_CONFIG) {
  return stocks.map((stock) => {
    const short = scoreShortV1(stock, weightConfig);
    const mid = scoreMidV1(stock, weightConfig);
    const long = scoreLongV1(stock, weightConfig);
    const derived = getDerived(stock);
    const validationRows = getSourceValidationRows(stock.symbol, stock, validationMap);
    const validationState = getValidationState(validationRows);
    const scoringDims = short.dimensions.filter((dim) => dim.weight > 0);
    return { stock, derived, short, mid, long, recommendation: getShortRecommendation(short.total, short.stopLoss), validationState, tech: scoringDims.find((dim) => dim.dimension === "技術面")?.scorePct || 0, chip: scoringDims.find((dim) => dim.dimension === "籌碼面")?.scorePct || 0, market: scoringDims.find((dim) => dim.dimension === "市場面")?.scorePct || 0 };
  }).sort((a, b) => b.short.score100 - a.short.score100);
}

function compareBadge(score) { return score ? <Badge className="bg-emerald-100 text-emerald-800">1 / 是</Badge> : <Badge className="bg-slate-100 text-slate-700">0 / 否</Badge>; }
function StatusBadge({ text }) { const cls = text.includes("計分") && !text.includes("不計") ? "bg-emerald-100 text-emerald-800" : text.includes("不測") ? "bg-slate-100 text-slate-700" : "bg-blue-100 text-blue-800"; return <Badge className={cls}>{text}</Badge>; }
function getScoreTone(score) {
  if (score >= 85) return { badge: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-500", track: "bg-emerald-50", card: "border-emerald-200 bg-emerald-50/70", text: "text-emerald-800", ring: "ring-emerald-100" };
  if (score >= 70) return { badge: "bg-lime-100 text-lime-800", bar: "bg-lime-500", track: "bg-lime-50", card: "border-lime-200 bg-lime-50/70", text: "text-lime-800", ring: "ring-lime-100" };
  if (score >= 55) return { badge: "bg-yellow-100 text-yellow-800", bar: "bg-yellow-500", track: "bg-yellow-50", card: "border-yellow-200 bg-yellow-50/70", text: "text-yellow-800", ring: "ring-yellow-100" };
  if (score >= 40) return { badge: "bg-orange-100 text-orange-800", bar: "bg-orange-500", track: "bg-orange-50", card: "border-orange-200 bg-orange-50/70", text: "text-orange-800", ring: "ring-orange-100" };
  return { badge: "bg-red-100 text-red-800", bar: "bg-red-500", track: "bg-red-50", card: "border-red-200 bg-red-50/70", text: "text-red-800", ring: "ring-red-100" };
}

function ScoreBadge({ score }) {
  const tone = getScoreTone(score);
  return <Badge className={cx("text-sm px-3 py-1", tone.badge)}>{Math.round(score)}</Badge>;
}

function ScoreBar({ label, score }) {
  const tone = getScoreTone(score);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[15px]">
        <span className="text-slate-600">{label}</span>
        <span className={`inline-flex min-w-[44px] items-center justify-center rounded-full px-2.5 py-1 text-sm font-bold ${tone.badge}`}>{Math.round(score)}</span>
      </div>
      <div className={`h-2 overflow-hidden rounded-full ${tone.track}`}>
        <div className={`h-full rounded-full transition-all duration-500 ${tone.bar}`} style={{ width: `${clamp(score)}%` }} />
      </div>
    </div>
  );
}

function DimensionScoreCard({ dim }) {
  const hasScore = dim.weight > 0;
  const tone = getScoreTone(hasScore ? dim.scorePct : dim.pass === dim.dataCount ? 85 : dim.pass > 0 ? 60 : 30);
  return (
    <Card className={`rounded-xl border shadow-sm ring-2 ${tone.card} ${tone.ring}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className={`text-lg font-bold ${tone.text}`}>{dim.dimension}</div>
          {hasScore ? <Badge className={tone.badge}>{Math.round(dim.scorePct)}</Badge> : <Badge className="bg-blue-100 text-blue-800">資料</Badge>}
        </div>
        {hasScore ? <ScoreBar label="面向分數" score={dim.scorePct} /> : <div className="rounded-xl bg-white/70 p-3 text-[15px] text-slate-600">資料確認：<span className="font-bold text-slate-900">{dim.pass}/{dim.dataCount}</span> 項可用</div>}
        <div className="text-[15px] text-slate-600">權重 {dim.weight.toFixed(2)}，加權得分 {dim.points.toFixed(2)}</div>
      </CardContent>
    </Card>
  );
}

function AddAssetForm({ value, onChange, onAdd, error }) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="p-3 space-y-2">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-lg font-semibold">新增股票 / ETF</h3>
            <p className="text-xs text-slate-500 mt-0.5">先建立標的列，之後由資料源補真實資料。</p>
          </div>
          <Badge className="bg-slate-100 text-slate-700">支援股票與 ETF</Badge>
        </div>
        <div className="grid gap-2 md:grid-cols-5">
          <Input placeholder="代號，例如 006208" value={value.symbol} onChange={(e) => onChange({ ...value, symbol: e.target.value })} />
          <Input placeholder="名稱，例如 富邦台50" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
          <select className="h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-[15px]" value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value })}>
            <option value="股票">股票</option>
            <option value="ETF">ETF</option>
          </select>
          <select className="h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-[15px]" value={value.market} onChange={(e) => onChange({ ...value, market: e.target.value })}>
            <option value="TWSE">TWSE</option>
            <option value="TPEx">TPEx</option>
          </select>
          <Button onClick={onAdd}>加入總覽</Button>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </CardContent>
    </Card>
  );
}

function InsightPanel({ insight }) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">評語區塊</h3>
            <p className="text-xs text-slate-500 mt-0.5">點擊總覽表的短線、中線、長線欄位後顯示。</p>
          </div>
          {insight && <Badge className={insight.tone}>{insight.badge}</Badge>}
        </div>
        {insight ? (
          <div className="rounded-lg border bg-white p-3 text-[15px] leading-7 text-slate-600">
            <div className="mb-2 font-semibold text-slate-900">{insight.title}</div>
            <p>{insight.body}</p>
          </div>
        ) : (
          <div className="rounded-xl border bg-white p-4 text-[15px] text-slate-500">尚未選擇評語。請在總覽表點擊短線、中線或長線。</div>
        )}
      </CardContent>
    </Card>
  );
}

function OverviewTable({ rows, selected, onSelect, onInsight, onRemove, dataMode }) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="p-3 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><h3 className="text-lg font-semibold flex items-center gap-2"><Icon name="bar" /> 全部股票 / ETF 總覽</h3><p className="text-xs text-slate-500 mt-0.5">依短線 V1 排序；鎖定約 5 檔高度。點擊短線、中線或長線查看評語。</p></div><Badge className="bg-slate-100 text-slate-700">資料模式：{dataMode}</Badge></div>
        <div className="max-h-[260px] overflow-y-scroll overflow-x-auto rounded-lg border border-slate-200 bg-white pr-1 [scrollbar-gutter:stable]"><table className="w-full min-w-[1140px] text-[15px]"><thead className="sticky top-0 z-10 bg-white"><tr className="border-b text-left text-slate-500"><th className="w-14 px-2 py-2 text-center">排名</th><th>標的</th><th>類型</th><th>市場</th><th>現價</th><th>今日</th><th>短線</th><th>中線</th><th>長線</th><th>技術</th><th>籌碼</th><th>市場</th><th>建議</th><th>資料驗證</th><th className="w-20 text-center">操作</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.stock.symbol} className={`border-b last:border-0 cursor-pointer hover:bg-slate-50 ${selected === row.stock.symbol ? "bg-slate-100" : ""}`} onClick={() => onSelect(row.stock.symbol)}><td className="px-2 py-2 text-center font-medium tabular-nums">{index + 1}</td><td className="font-medium">{row.stock.symbol} {row.stock.name}</td><td>{row.stock.type}</td><td>{row.stock.market}</td><td>{number(row.stock.price)}</td><td>{pct(row.derived.todayReturn)}</td><td><button type="button" onClick={(e) => { e.stopPropagation(); onInsight(row.stock.symbol, "short"); }}><ScoreBadge score={row.short.score100} /></button></td><td><button type="button" onClick={(e) => { e.stopPropagation(); onInsight(row.stock.symbol, "mid"); }}><Badge className="bg-slate-100 text-slate-700">待公式</Badge></button></td><td><button type="button" onClick={(e) => { e.stopPropagation(); onInsight(row.stock.symbol, "long"); }}><Badge className="bg-slate-100 text-slate-700">待公式</Badge></button></td><td>{Math.round(row.tech)}</td><td>{Math.round(row.chip)}</td><td>{Math.round(row.market)}</td><td><Badge className={row.recommendation.tone}>{row.recommendation.label}</Badge></td><td><Badge className={row.validationState.tone}>{row.validationState.label}</Badge></td><td className="text-center"><Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onRemove(row.stock.symbol); }}>移除</Button></td></tr>)}</tbody></table></div>
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>顯示區已鎖定約 5 檔高度；若標的超過可視範圍，請在表格內上下滾動。</span>
          <span>{rows.length} 檔標的</span>
        </div>
      </CardContent>
    </Card>
  );
}

function FrameworkTable({ title, subtitle, result, showScore = false, horizon, onWeightChange, onResetHorizon }) {
  return <Card className="rounded-xl shadow-sm"><CardContent className="p-3 space-y-3"><div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between"><div><h3 className="text-lg font-semibold">{title}</h3><p className="text-[15px] text-slate-500 mt-1">{subtitle}</p></div>{horizon && onResetHorizon && <Button variant="outline" size="sm" onClick={() => onResetHorizon(horizon)} className="shrink-0">恢復預設值</Button>}</div><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[1320px] text-[15px]"><colgroup><col className="w-[112px]" /><col className="w-[360px]" /><col className="w-[104px]" /><col className="w-[150px]" /><col className="w-[150px]" /><col className="w-[220px]" /><col className="w-[340px]" /></colgroup><thead className="bg-white"><tr className="border-b text-left text-slate-500"><th className="px-3 py-3">維度</th><th className="px-3 py-3 whitespace-nowrap">指標 / 資料檢查</th><th className="px-3 py-3 text-center">權重</th><th className="px-3 py-3 text-center">狀態</th><th className="px-3 py-3 text-center">今日現況</th><th className="px-3 py-3">規則 / 數據</th><th className="px-3 py-3">資料來源</th></tr></thead><tbody>{result.rows.map((row) => <tr key={`${row.dimension}-${row.item}`} className="border-b last:border-0"><td className="px-3 py-3 align-top font-medium whitespace-nowrap">{row.dimension}</td><td className="px-3 py-3 align-top whitespace-nowrap leading-6">{row.item}</td><td className="px-3 py-3 align-top text-center">{horizon && row.weightKey && onWeightChange ? <Input type="number" step="0.01" min="0" max="1" value={row.weight} onChange={(e) => onWeightChange(horizon, row.weightKey, e.target.value)} className="mx-auto h-8 w-20 rounded-lg border-slate-300 px-2 text-right text-[15px] font-medium" /> : row.weight.toFixed(2)}</td><td className="px-3 py-3 align-top"><div className="flex min-h-[32px] items-center justify-center"><StatusBadge text={row.status} /></div></td><td className="px-3 py-3 align-top text-center">{compareBadge(row.score)}</td><td className="px-3 py-3 align-top text-slate-600 leading-6">{row.rule}</td><td className="px-3 py-3 align-top text-slate-500 leading-6">{row.source}</td></tr>)}{showScore && <tr className="bg-slate-50 font-semibold"><td className="px-3 py-3" colSpan={2}>權重合計 / 加權得分</td><td className="px-3 py-3 text-center">{result.totalWeight.toFixed(2)}</td><td className="px-3 py-3"></td><td className="px-3 py-3"></td><td className="px-3 py-3">{result.total.toFixed(2)}</td><td className="px-3 py-3">直接修改上方權重欄位；合計建議維持 1.00。</td></tr>}</tbody></table></div></CardContent></Card>;
}

function WeightSettingsPanel({ weightConfig, onWeightChange, onReset }) {
  const totalFor = (horizon) => Object.values(weightConfig[horizon]).reduce((sum, value) => sum + Number(value || 0), 0);
  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="p-3 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="font-semibold">權重設定</h3>
            <p className="text-sm text-slate-500 mt-1">預設已給一組短中長權重；你可以手動調整。權重建議合計為 1.00，系統會即時套用到總覽與各分頁。</p>
          </div>
          <Button variant="outline" onClick={onReset}>恢復預設權重</Button>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {WEIGHT_SECTIONS.map((section) => {
            const total = totalFor(section.horizon);
            return (
              <div key={section.horizon} className="rounded-xl border bg-white p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900">{section.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{section.note}</div>
                  </div>
                  <Badge className={Math.abs(total - 1) < 0.001 ? "bg-emerald-100 text-emerald-800" : "bg-yellow-100 text-yellow-800"}>合計 {total.toFixed(2)}</Badge>
                </div>
                <div className="space-y-2">
                  {Object.entries(weightConfig[section.horizon]).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-[1fr_88px] items-center gap-2">
                      <label className="text-sm text-slate-600">{WEIGHT_LABELS[key] || key}</label>
                      <Input type="number" step="0.01" min="0" max="1" value={value} onChange={(e) => onWeightChange(section.horizon, key, e.target.value)} className="h-8 text-right" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function SourceConnectorTable({ config, onConfigChange, onLoadGoogle, onLoadFinMind, onLoadTwse, loading, apiMessage, lastFetchMap, stocks, googleDebug }) {
  const plan = getSourceConnectorPlan(config);
  const policies = ["google_csv", "finmind_proxy", "twse_proxy"].map((source) => ({ source, ...getSourcePolicy(source), lastFetch: formatLastFetch(lastFetchMap, source) }));
  const googleTemplate = buildGoogleVerifySheetTemplate(stocks);
  return <Card className="rounded-xl shadow-sm"><CardContent className="p-3 space-y-3"><h3 className="font-semibold flex items-center gap-2"><Icon name="doc" /> 資料來源串接層</h3><p className="text-xs text-slate-500">正式流程以 Google Sheet 發佈 CSV URL 為準；App 只讀取公開 CSV，不寫入或重建 Google Sheet。</p><div className="grid gap-2 md:grid-cols-3"><Input placeholder="Google Sheet 公開 CSV URL" value={config.googleCsvUrl} onChange={(e) => onConfigChange({ ...config, googleCsvUrl: e.target.value })} /><Input placeholder="FinMind proxy URL，例如 /api/finmind/stocks" value={config.finmindProxyUrl} onChange={(e) => onConfigChange({ ...config, finmindProxyUrl: e.target.value })} /><Input placeholder="TWSE proxy URL，例如 /api/twse/stocks" value={config.twseProxyUrl} onChange={(e) => onConfigChange({ ...config, twseProxyUrl: e.target.value })} /></div><div className="flex flex-wrap gap-2"><Button onClick={onLoadGoogle} disabled={loading || !config.googleCsvUrl}>讀取 Google Sheet CSV URL</Button><Button onClick={onLoadFinMind} disabled={loading || !config.finmindProxyUrl}>讀取 FinMind Proxy</Button><Button onClick={onLoadTwse} disabled={loading || !config.twseProxyUrl}>讀取 TWSE Proxy</Button>{apiMessage && <Badge className={apiMessage.includes("成功") ? "bg-emerald-100 text-emerald-800" : "bg-yellow-100 text-yellow-800"}>{apiMessage}</Badge>}</div><div className="grid gap-2 md:grid-cols-3">{policies.map((item) => <div key={item.source} className="rounded-lg border bg-white p-3 text-xs text-slate-600"><div className="mb-1 font-semibold text-slate-900">{item.label}</div><div>Timeout：{item.timeoutMs / 1000} 秒</div><div>冷卻：{Math.round(item.cooldownMs / 60000)} 分鐘</div><div>上次：{item.lastFetch}</div><div className="mt-1 text-slate-400">{item.cacheNote}</div></div>)}</div><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-sm"><thead className="bg-white"><tr className="border-b text-left text-slate-500"><th className="py-2">來源</th><th>角色</th><th>狀態</th><th>欄位</th><th>串接方式</th></tr></thead><tbody>{plan.map((item) => <tr key={item.name} className="border-b last:border-0"><td className="py-2 font-medium">{item.name}</td><td>{item.role}</td><td><Badge className={item.status.includes("可") ? "bg-emerald-100 text-emerald-800" : item.status.includes("待") ? "bg-yellow-100 text-yellow-800" : "bg-slate-100 text-slate-700"}>{item.status}</Badge></td><td className="max-w-sm text-slate-600">{item.fields}</td><td className="max-w-md text-slate-500">{item.method}</td></tr>)}</tbody></table></div>{googleDebug && <div className="rounded-xl border bg-white p-3 text-xs text-slate-600"><div className="font-semibold text-slate-900">Google CSV 讀取診斷</div>{googleDebug.error ? <div className="text-red-600">錯誤：{googleDebug.error}</div> : <div className="space-y-1"><div>讀取方式：{googleDebug.mode}</div><div>CSV 列數：{googleDebug.parsedRows}</div><div>已對上：{googleDebug.matchedSymbols?.join(", ") || "無"}</div><div>未對上：{googleDebug.unmatchedSymbols?.join(", ") || "無"}</div><div>欄位：{googleDebug.headers?.join(" / ") || "無"}</div><div>rawDataMap：{googleDebug.rawDataMap ? Object.keys(googleDebug.rawDataMap).join(" / ") : "無"}</div><div>原始前 3 列：{googleDebug.rawPreview?.map((row) => `[${row.join(" | ")}]`).join(" ／ ") || "無"}</div><div>數值預覽：{googleDebug.valuePreview?.map((x) => `${x.symbol}: price=${x.price ?? "-"}, prev=${x.prevClose ?? "-"}, volume=${x.volume ?? "-"}, per=${x.per ?? "-"}, eps=${x.eps ?? "-"}, ma5=${x.ma5 ?? "-"}, ma20=${x.ma20 ?? "-"}, nasdaq=${x.nasdaqReturn1d ?? "-"}, sox=${x.soxReturn1d ?? "-"}, vix=${x.vixChange1d ?? "-"}`).join("｜") || "無"}</div></div>}</div>}<div className="rounded-xl border bg-slate-50 p-3 space-y-2"><div className="font-semibold text-slate-900">Google 驗證模板</div><p className="text-xs text-slate-500">複製下方內容貼到 Google Sheet A1，等待 GOOGLEFINANCE 公式跑出數字後，將試算表發佈成 CSV，再把公開 CSV URL 貼回上方讀取。正式讀取只會讀 CSV URL，不會寫入或重建 Google Sheet。</p><textarea className="h-36 w-full rounded-lg border bg-white p-2 font-mono text-xs text-slate-700" readOnly value={googleTemplate} /></div></CardContent></Card>;
}

function runSelfTests(stocks = initialStocks) {
  const results = [];
  const assert = (name, pass, detail) => results.push({ name, pass, detail });
  const sample = stocks[0];
  const short = scoreShortV1(sample);
  const mid = scoreMidV1(sample);
  const long = scoreLongV1(sample);
  const overview = buildOverviewRows(stocks);
  const added = createAssetTemplate({ symbol: "006208", name: "富邦台50", type: "ETF", market: "TWSE" });
  assert("短線 V1 計分權重仍為 1", Math.abs(short.totalWeight - 1) < 0.0001, "新增基本面/衍生資料檢查後，原三大面向權重仍應合計 100%。");
  assert("短線 V1 已包含 FinMind 五大面向", new Set(short.rows.map((row) => row.dimension)).size === 5, "短線 V1 需列出技術、籌碼、基本、衍生、市場五大面向。");
  assert("全部股票總覽已建立", overview.length === stocks.length && overview.every((row) => Number.isFinite(row.short.score100) && row.mid && row.long), "總覽應包含全部股票；中線與長線先保留架構，不顯示正式分數。");
  assert("短中長評語可由總覽呼叫", ["short", "mid", "long"].every((h) => getHorizonInsight(overview[0], h)?.body?.length > 20), "點擊短線、中線、長線欄位時應可產生對應評語。");
  assert("短線停損閘門已加入", typeof short.stopLoss?.triggered === "boolean" && Number.isFinite(short.rawScore100), "短線分數應先算原始分，再由停損閘門決定是否限制分數。");
  assert("可新增股票或 ETF", added.symbol === "006208" && added.type === "ETF" && Number.isFinite(scoreShortV1(added).score100), "新增標的應能進入同一套評分資料結構。");
  assert("新增流程可把標的加入清單", (() => {
    const result = addAssetToList(stocks, { symbol: "006208", name: "富邦台50", type: "ETF", market: "TWSE" });
    return result.ok && result.stocks.length === stocks.length + 1 && result.stocks.some((stock) => stock.symbol === "006208" && stock.type === "ETF");
  })(), "輸入新代號後應新增到總覽。");
  assert("新增流程會阻擋重複代號", (() => {
    const result = addAssetToList(stocks, { symbol: stocks[0].symbol, name: "重複測試", type: "股票", market: "TWSE" });
    return !result.ok && result.stocks.length === stocks.length && result.error.includes("已在總覽中");
  })(), "重複股票或 ETF 不應被加入。");
  assert("移除流程可從清單刪除標的", (() => {
    const addedResult = addAssetToList(stocks, { symbol: "006208", name: "富邦台50", type: "ETF", market: "TWSE" });
    const removedResult = removeAssetFromList(addedResult.stocks, "006208");
    return removedResult.ok && removedResult.stocks.length === stocks.length && !removedResult.stocks.some((stock) => stock.symbol === "006208");
  })(), "移除按鈕應能把標的從總覽刪掉。");
  assert("移除流程會保留至少一檔", (() => {
    const result = removeAssetFromList([stocks[0]], stocks[0].symbol);
    return !result.ok && result.stocks.length === 1 && result.error.includes("至少需要保留");
  })(), "不能把最後一檔標的移除。 ");
  assert("串接層已預留", getSourceConnectorPlan({ googleCsvUrl: "x", finmindProxyUrl: "y", twseProxyUrl: "/api/twse/stocks" }).length === 3, "FinMind、GoogleFinance、TWSE/TPEx OpenAPI 都應有串接規劃。");
  assert("TWSE Proxy 預設路徑已設定", DEFAULT_TWSE_PROXY_URL === "/api/twse/stocks", "前端應預設呼叫本機 TWSE proxy，而不是瀏覽器直連官方 OpenAPI。");
  assert("三個資料源各自有 cache 策略", SOURCE_REFRESH_POLICY.google_csv.cooldownMs !== SOURCE_REFRESH_POLICY.finmind_proxy.cooldownMs && SOURCE_REFRESH_POLICY.finmind_proxy.cooldownMs !== SOURCE_REFRESH_POLICY.twse_proxy.cooldownMs, "Google、FinMind、TWSE 應分開設定 timeout / cooldown / cache 說明。");
  assert("CSV 可解析並正規化", (() => {
    const rows = parseCsv(["symbol,name,price,prevClose", "006208,富邦台50,110,109"].join(String.fromCharCode(10)));
    const normalized = normalizeExternalStock(rows[0]);
    const google = normalizeGoogleValidationRow(rows[0]);
    return normalized.symbol === "006208" && normalized.price === 110 && normalized.prevClose === 109 && google.google.price === 110;
  })(), "Google Sheet CSV 應能轉成 App 標準 stock schema。");
  assert("CSV 可解析引號與逗號", (() => {
    const rows = parseCsv(["symbol,name,price", "2330,\"台積電, TSMC\",980"].join(String.fromCharCode(10)));
    return rows[0].name === "台積電, TSMC" && Number(rows[0].price) === 980;
  })(), "Google 發佈 CSV 若包含引號或逗號，解析器仍應可讀。");
  assert("TSV 可解析 Google Sheet 複製內容", (() => {
    const tab = String.fromCharCode(9);
    const rows = parseCsv([["symbol", "name", "ticker", "price", "prevClose", "volume", "per", "eps"].join(tab), ["2330", "台積電", "TPE:2330", "2250", "2250", "34152963", "30.25", "74.38"].join(tab)].join(String.fromCharCode(10)));
    const google = normalizeGoogleValidationRow(rows[0]);
    return google.symbol === "2330" && google.google.price === 2250 && google.google.eps === 74.38;
  })(), "手動從 Google Sheet 複製貼上的 TSV 也應能解析。 ");
  assert("TWSE OpenAPI 可正規化", (() => {
    const price = normalizeTwseStockDayRow({ Code: "2330", Name: "台積電", ClosingPrice: "980", Change: "15", TradeVolume: "62000" });
    const valuation = normalizeTwseBwibbuRow({ Code: "2330", PEratio: "24", PBratio: "5.7", DividendYield: "1.2" });
    const merged = mergeTwseRows([price], [valuation])[0];
    return merged.symbol === "2330" && merged.price === 980 && merged.prevClose === 965 && merged.per === 24;
  })(), "TWSE STOCK_DAY_ALL / BWIBBU_ALL 應能轉成 App 標準 stock schema。 ");
  assert("短線分析文字可產生", getShortV1Analysis(short).length > 30, "短線分析應產生可讀文字。");
  assert("驗證列會產出可判讀狀態", getSourceValidationRows("2330", sample).every((row) => ["通過", "需檢查", "無法取得"].includes(row.status)), "主資料 vs 驗證來源應能標記通過/需檢查/無法取得。");
  assert("無驗證來源時不阻擋主資料", getValidationState(getSourceValidationRows("2330", sample)).label === "未驗證", "驗證來源無法取得時應先保留 FinMind / 主資料，但不判定為驗證失敗。 ");
  return results;
}

export default function StockShortV1App() {
  const [stocks, setStocks] = useState(initialStocks);
  const [selected, setSelected] = useState("2330");
  const [newAsset, setNewAsset] = useState({ symbol: "", name: "", type: "股票", market: "TWSE" });
  const [addError, setAddError] = useState("");
  const [insightTarget, setInsightTarget] = useState(null);
  const [dataMode, setDataMode] = useState(DEFAULT_DATA_MODE);
  const [apiConfig, setApiConfig] = useState({ googleCsvUrl: DEFAULT_GOOGLE_SHEET_CSV_URL, finmindProxyUrl: DEFAULT_FINMIND_PROXY_URL, twseProxyUrl: DEFAULT_TWSE_PROXY_URL });
  const [apiLoading, setApiLoading] = useState(false);
  const [apiMessage, setApiMessage] = useState("");
  const [lastFetchMap, setLastFetchMap] = useState({});
  const [validationMap, setValidationMap] = useState({});
  const [googleDebug, setGoogleDebug] = useState(null);
    const [weightConfig, setWeightConfig] = useState(cloneWeightConfig());
  const current = stocks.find((s) => s.symbol === selected) || stocks[0];
  const derived = getDerived(current);
  const overviewRows = useMemo(() => buildOverviewRows(stocks, validationMap, weightConfig), [stocks, validationMap, weightConfig]);
  const activeInsightRow = insightTarget ? overviewRows.find((row) => row.stock.symbol === insightTarget.symbol) : null;
  const activeInsight = insightTarget ? getHorizonInsight(activeInsightRow, insightTarget.horizon) : null;
  const shortV1 = useMemo(() => scoreShortV1(current, weightConfig), [current, weightConfig]);
  const midV1 = useMemo(() => scoreMidV1(current, weightConfig), [current, weightConfig]);
  const longV1 = useMemo(() => scoreLongV1(current, weightConfig), [current, weightConfig]);
  const recommendation = getShortRecommendation(shortV1.total);
  const selfTests = useMemo(() => runSelfTests(stocks), [stocks]);

  function updateWeight(horizon, key, value) {
    const parsed = Math.max(0, Number(value));
    setWeightConfig((prev) => ({ ...prev, [horizon]: { ...prev[horizon], [key]: Number.isFinite(parsed) ? parsed : 0 } }));
  }

  function resetWeights() {
    setWeightConfig(cloneWeightConfig());
  }

  function resetHorizonWeights(horizon) {
    setWeightConfig((prev) => ({ ...prev, [horizon]: { ...DEFAULT_WEIGHT_CONFIG[horizon] } }));
  }

  function addAsset() {
    const symbol = normalizeStockSymbol(newAsset.symbol);
    if (!symbol) { setAddError("請輸入股票或 ETF 代號。"); return; }
    if (stocks.some((stock) => stock.symbol === symbol)) { setAddError(`${symbol} 已在總覽中。`); return; }
    const asset = createAssetTemplate({ ...newAsset, symbol });
    setStocks((prev) => [...prev, asset]);
    setSelected(asset.symbol);
    setNewAsset({ symbol: "", name: "", type: "股票", market: "TWSE" });
    setAddError("");
  }

  function removeAsset(symbol) {
    if (stocks.length <= 1) { setAddError("至少需要保留一個標的。"); return; }
    const nextStocks = stocks.filter((stock) => stock.symbol !== symbol);
    setStocks(nextStocks);
    if (selected === symbol) setSelected(nextStocks[0]?.symbol || "");
    if (insightTarget?.symbol === symbol) setInsightTarget(null);
    setAddError("");
  }

  async function loadGoogleCsv() {
    const source = "google_csv";
    const policy = getSourcePolicy(source);
    const refresh = canRefreshSource(lastFetchMap, source, policy.cooldownMs);
    if (!refresh.ok) { setApiMessage(`Google CSV 冷卻中：${refresh.remainSec} 秒`); return; }
    if (!apiConfig.googleCsvUrl) { setApiMessage("請先貼上 Google Sheet 發佈 CSV URL"); return; }
    setApiLoading(true);
    setApiMessage("讀取中...");
    try {
      const symbols = stocks.map((stock) => stock.symbol).join(",");
      const url = `/api/google/verify?url=${encodeURIComponent(apiConfig.googleCsvUrl)}&symbols=${encodeURIComponent(symbols)}`;
      const res = await fetchWithTimeout(url, { cache: "no-store" }, policy.timeoutMs);
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`);
      setValidationMap((prev) => ({ ...prev, ...(json.validationMap || {}) }));
      setGoogleDebug({
        mode: "api_route",
        version: json.version,
        parsedRows: json.parsedRows,
        headers: json.headers,
        rawPreview: json.rawPreview,
        matchedSymbols: json.matchedSymbols,
        unmatchedSymbols: json.unmatchedSymbols,
        valuePreview: json.valuePreview,
        rawDataMap: json.rawDataMap,
      });
      setDataMode("google_verify_api");
      setLastFetchMap((prev) => markSourceFetched(prev, source));
      setApiMessage(`Google 驗證成功：${json.matchedSymbols?.length || 0}/${json.parsedRows || 0} 檔（API route）`);
    } catch (error) {
      setGoogleDebug({ error: error.message });
      setApiMessage(`Google CSV 失敗：${error.message}`);
    } finally {
      setApiLoading(false);
    }
  }


  async function loadFinMindProxy() {
    const source = "finmind_proxy";
    const policy = getSourcePolicy(source);
    const refresh = canRefreshSource(lastFetchMap, source, policy.cooldownMs);
    if (!refresh.ok) { setApiMessage(`FinMind Proxy 冷卻中：${refresh.remainSec} 秒`); return; }
    setApiLoading(true);
    setApiMessage("讀取中...");
    try {
      const symbols = stocks.map((stock) => stock.symbol).join(",");
      const url = apiConfig.finmindProxyUrl.includes("?") ? `${apiConfig.finmindProxyUrl}&symbols=${symbols}` : `${apiConfig.finmindProxyUrl}?symbols=${symbols}`;
      const res = await fetchWithTimeout(url, {}, policy.timeoutMs);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list = Array.isArray(json) ? json : Array.isArray(json.stocks) ? json.stocks : [];
      const incoming = list.map(normalizeExternalStock).filter((stock) => stock.symbol);
      setStocks((prev) => mergeStocksBySymbol(prev, incoming));
      setDataMode("finmind_proxy");
      setLastFetchMap((prev) => markSourceFetched(prev, source));
      setApiMessage(`FinMind Proxy 成功：${incoming.length} 檔`);
    } catch (error) {
      setApiMessage(`FinMind Proxy 失敗：${error.message}`);
    } finally {
      setApiLoading(false);
    }
  }

  async function loadTwseOpenApi() {
    const source = "twse_proxy";
    const policy = getSourcePolicy(source);
    const refresh = canRefreshSource(lastFetchMap, source, policy.cooldownMs);
    if (!refresh.ok) { setApiMessage(`TWSE 冷卻中：${refresh.remainSec} 秒`); return; }
    setApiLoading(true);
    setApiMessage("讀取中...");
    try {
      const symbols = stocks.map((stock) => stock.symbol).join(",");
      const url = apiConfig.twseProxyUrl.includes("?") ? `${apiConfig.twseProxyUrl}&symbols=${symbols}` : `${apiConfig.twseProxyUrl}?symbols=${symbols}`;
      let incoming = [];
      let mode = "twse_proxy";
      try {
        const res = await fetchWithTimeout(url, {}, policy.timeoutMs);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (Array.isArray(json.stocks)) {
          incoming = json.stocks.map(normalizeExternalStock).filter((stock) => stock.symbol);
        } else {
          const priceList = Array.isArray(json.stockDayAll) ? json.stockDayAll : Array.isArray(json.priceList) ? json.priceList : [];
          const valuationList = Array.isArray(json.bwibbuAll) ? json.bwibbuAll : Array.isArray(json.valuationList) ? json.valuationList : [];
          incoming = mergeTwseRows(priceList.map(normalizeTwseStockDayRow), valuationList.map(normalizeTwseBwibbuRow));
        }
      } catch (proxyError) {
        incoming = await fetchTwseDirectFallback(policy);
        mode = "twse_cors_fallback";
      }
      const allow = new Set(stocks.map((stock) => stock.symbol));
      const filtered = incoming.filter((stock) => allow.has(stock.symbol));
      setStocks((prev) => mergeStocksBySymbol(prev, filtered.length ? filtered : incoming));
      setDataMode(mode);
      setLastFetchMap((prev) => markSourceFetched(prev, source));
      setApiMessage(`${mode === "twse_proxy" ? "TWSE Proxy" : "TWSE CORS 備援"} 成功：${filtered.length || incoming.length} 檔`);
    } catch (error) {
      setApiMessage(`TWSE 失敗：${error.message}`);
    } finally {
      setApiLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 text-[15px] text-slate-900"><div className="mx-auto max-w-7xl space-y-3">
      <div><h1 className="text-3xl font-bold tracking-tight">股票短中長分析 App — V1</h1><p className="text-[15px] text-slate-500 mt-1">先做全部股票 / ETF 總覽，再點進單檔細節。短線 V1 維持原三大面向，並加入停損閘門；中線與長線公式尚未啟用。</p></div>
      <AddAssetForm value={newAsset} onChange={setNewAsset} onAdd={addAsset} error={addError} />
      <OverviewTable rows={overviewRows} selected={selected} onSelect={setSelected} onInsight={(symbol, horizon) => { setSelected(symbol); setInsightTarget({ symbol, horizon }); }} onRemove={removeAsset} dataMode={dataMode} />
      <InsightPanel insight={activeInsight} />
      <Tabs defaultValue="short" className="space-y-3"><TabsList className="grid w-full grid-cols-6 rounded-xl p-1.5"><TabsTrigger value="short" className="py-2.5">短線V1</TabsTrigger><TabsTrigger value="mid" className="py-2.5">中線V1</TabsTrigger><TabsTrigger value="long" className="py-2.5">長線V1</TabsTrigger><TabsTrigger value="sources" className="py-2.5">資料源</TabsTrigger><TabsTrigger value="validate" className="py-2.5">資料驗證</TabsTrigger><TabsTrigger value="tests" className="py-2.5">測試</TabsTrigger></TabsList>
        <TabsContent value="short"><FrameworkTable title="圖片版短線評分表" subtitle="可直接在表格的權重欄位手動調整；新增基本面與衍生性金融商品預設權重為 0。" result={shortV1} showScore horizon="short" onWeightChange={updateWeight} onResetHorizon={resetHorizonWeights} /><div className="grid gap-3 md:grid-cols-5 mt-3">{shortV1.dimensions.map((dim) => <DimensionScoreCard key={dim.dimension} dim={dim} />)}</div></TabsContent>
        <TabsContent value="mid"><FrameworkTable title="中線 V1 架構表" subtitle={getFrameworkAnalysis("中線", midV1)} result={midV1} showScore horizon="mid" onWeightChange={updateWeight} onResetHorizon={resetHorizonWeights} /></TabsContent>
        <TabsContent value="long"><FrameworkTable title="長線 V1 架構表" subtitle={getFrameworkAnalysis("長線", longV1)} result={longV1} showScore horizon="long" onWeightChange={updateWeight} onResetHorizon={resetHorizonWeights} /></TabsContent>
        <TabsContent value="sources"><div className="space-y-4"><SourceConnectorTable config={apiConfig} onConfigChange={setApiConfig} onLoadGoogle={loadGoogleCsv} onLoadFinMind={loadFinMindProxy} onLoadTwse={loadTwseOpenApi} loading={apiLoading} apiMessage={apiMessage} lastFetchMap={lastFetchMap} stocks={stocks} googleDebug={googleDebug} /><Card className="rounded-xl shadow-sm"><CardContent className="p-3 space-y-3"><h3 className="font-semibold flex items-center gap-2"><Icon name="doc" /> FinMind 五大面向總覽</h3><div className="rounded-lg border bg-slate-50 p-3 text-xs leading-6 text-slate-600"><div className="font-semibold text-slate-900">資料原則</div><div>主資料統一先吃 FinMind；能用 TWSE / TPEx / MOPS / TAIFEX / GoogleFinance 驗證的欄位就驗證；驗證來源無法取得的欄位先保留主資料，不判定為驗證失敗。</div></div><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[1300px] text-sm"><thead className="bg-white"><tr className="border-b text-left text-slate-500"><th className="py-2">面向</th><th>FinMind Dataset</th><th>主要欄位</th><th>怎麼算 / 使用方式</th><th>驗證 / 備援來源</th><th>短線角色</th><th>中線角色</th><th>長線角色</th></tr></thead><tbody>{finmindAspectPlan.map((item) => <tr key={item.aspect} className="border-b last:border-0 align-top"><td className="py-2 font-medium">{item.aspect}</td><td className="max-w-xs text-slate-600">{item.datasets}</td><td className="max-w-xs text-slate-600">{item.fields}</td><td className="max-w-sm text-slate-500">{item.calcNote}</td><td className="max-w-xs text-slate-500">{item.verifyRef}</td><td className="max-w-sm text-slate-500">{item.shortRole}</td><td className="max-w-sm text-slate-500">{item.midRole}</td><td className="max-w-sm text-slate-500">{item.longRole}</td></tr>)}</tbody></table></div></CardContent></Card></div></TabsContent>
        <TabsContent value="validate"><Card className="rounded-xl shadow-sm"><CardContent className="p-3 space-y-3"><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold flex items-center gap-2"><Icon name="doc" /> 主資料 vs 驗證來源</h3><p className="text-sm text-slate-500 mt-2">FinMind / TWSE 作主資料源，GoogleFinance 只作行情/估值輔助驗證，不覆蓋總覽主資料。</p></div><Badge className="bg-slate-100 text-slate-700">策略：能驗證就驗證，不能驗證先用主資料</Badge></div><div className="rounded-xl bg-white border p-4 text-sm text-slate-700"><span className="font-medium text-slate-900">驗證結論：</span>{validationSummary(getSourceValidationRows(selected, current, validationMap))}</div><div className="max-h-[340px] overflow-y-scroll overflow-x-auto rounded-xl border border-slate-200 bg-white pr-1 [scrollbar-gutter:stable]"><table className="w-full text-sm"><thead className="sticky top-0 z-10 bg-white"><tr className="border-b text-left text-slate-500"><th className="py-2">欄位</th><th>主資料</th><th>驗證來源</th><th>偏差</th><th>容忍值</th><th>狀態</th><th>備註</th></tr></thead><tbody>{getSourceValidationRows(selected, current, validationMap).map((row) => <tr key={row.label} className="border-b last:border-0"><td className="py-2 font-medium">{row.label}</td><td>{displayValue(row.finmindValue)}</td><td>{displayValue(row.googleValue)}</td><td>{pct(row.diffPct)}</td><td>±{row.tolerancePct}%</td><td><Badge className={row.status === "通過" ? "bg-emerald-100 text-emerald-800" : row.status === "需檢查" ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-700"}>{row.status}</Badge></td><td className="max-w-md text-slate-500">{row.note}</td></tr>)}</tbody></table></div></CardContent></Card></TabsContent>
        <TabsContent value="tests"><Card className="rounded-xl shadow-sm"><CardContent className="p-3 space-y-2"><h3 className="font-semibold">內建 Smoke Tests</h3><div className="space-y-1.5">{selfTests.map((t) => <div key={t.name} className="flex items-start justify-between gap-3 rounded-xl border bg-white p-3"><div><div className="font-medium">{t.name}</div><div className="text-sm text-slate-500">{t.detail}</div></div><Badge className={t.pass ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>{t.pass ? "PASS" : "FAIL"}</Badge></div>)}</div></CardContent></Card></TabsContent>
      </Tabs>
    </div></div>
  );
}
