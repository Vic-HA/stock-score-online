// @ts-nocheck
"use client";
// BUILD_V73A13_GOOGLE_DEDUP_TWSE_IMPLIED_EPS
// BUILD_PHASE_D_PREOPEN_VALIDATION_STATUS_MINIMAL
// BUILD_V73A12_OHLCV_SNAPSHOT_AND_FINMIND_ONLY_CLEANUP
// BUILD_V73A9_FINMIND_MARKET_MAIN_GOOGLE_VERIFY
// BUILD_V73A6_TWSE_SNAPSHOT_VOLUME_BASE_FIRST
// BUILD_V71K_SHORT_VOLUME_LABEL_NO_SOURCE
// BUILD_V71J_VOLUME10MA_GOOGLE_FALLBACK_COMPARE
// BUILD_V71I_FINMIND_VOLUME10_BASE
// BUILD_V71H_VOLUME_RATIO_LABEL_CLARITY
// BUILD_V71G_VOLUME_RATIO_RUNTIME_VALIDATION_FIX
// BUILD_V71F_TWSE_OFFICIAL_NO_INTRADAY_ROLLBACK
// BUILD_V71E_SOURCE_PRIORITY_NO_ROLLBACK
// BUILD_V71D_INTRADAY_QUOTE_READY_GATE
// BUILD_V71C_STOPLOSS_GATE_FIX
// BUILD_V71B_TWSE_MASTER_VALIDATION_VALUES
// BUILD_71A_PAGE_CONNECT_PROFILE_SCORE_AND_DATA_TIME
// BUILD_28U_OVERVIEW_ALWAYS_SHOW_MARKET_INDEX
// BUILD_28T_SOURCE_INPUT_ORDER_FIX
// BUILD_28S_SOURCE_ROLE_OVERVIEW_UNIFIED
// BUILD_28R_SOURCE_CARD_GROUP_SORT
// BUILD_28Q_STARTUP_WARMUP_APPLY_VALIDATION
// BUILD_28P_CONSOLIDATED_SOURCE_RULES
// BUILD_28N_RECONNECT_FINMIND_SMART_REFRESH_NO_AUTO
// BUILD_28M_DISABLE_FINMIND_SMART_REFRESH
// BUILD_28L_REMOVE_FINMIND_MINUTE_ASPECT_ROW
// BUILD_28K_REMOVE_FINMIND_MINUTE_POLICY
// BUILD_28J_STARTUP_CACHE_WARMUP_NON_FINMIND
// BUILD_28I_MAX_50_ASSETS_AND_CACHE2_UI
// BUILD_28H_SOURCE_RUNTIME_LABEL_FIX
// BUILD_28G_SOURCE_SORT_AND_STAGE2_PREP
// BUILD_28F_SOURCE_RUNTIME_CACHE_STATUS

// BUILD_28C_FRONTEND_PRIVATE_OVERVIEW_OFFICIAL_ETF_INAV: friend-facing overview + official ETF iNAV wiring.

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  getFieldSource,
  getSourceValue,
  getSourceName,
  compareSourceValue,
  pickCompare,
  pickYahooAlignedCompare,
  yahooAlignedCompareOptions,
  normalizePercentCompareValue,
  reconcileVixPercentPointWithReference,
  normalizeValidationDate,
  sourceDateCompareOptions,
  getValidationState,
  validationSummary,
  validationStatusClass,
  validationDiffText,
  validationToleranceText,
  compactValidationNote,
  validationGroupRows,
  cleanupFinMindOnlyValidationRows,
  withSourceDate,
  attachValidationDateLabels,
} from "@/lib/validationRows";
import {
  volumeRatioRuntimeSourceLabel,
} from "@/lib/volumeLabels";
import {
  formatDurationMs,
  formatLastFetch,
  compactSourceTime,
  buildApiSourceRuntime,
  formatSourceRuntimeInfo,
  formatPolicyAutoRefresh,
  explainCacheRuntime,
  pickTwseMisDataTime,
  pickEtfInavDataTime,
} from "@/lib/sourceRuntime";
import {
  OFFICIAL_SCHEDULED_CHECK_INTERVAL_MS,
  DEFAULT_FETCH_TIMEOUT_MS,
  getScheduledOfficialCacheSlot,
  canRefreshSource,
  markSourceFetched,
  getSourcePolicy,
} from "@/lib/sourcePolicies";

import {
  createAssetTemplate,
  parseNum,
  normalizeStockSymbol,
  normalizeExternalStock,
  normalizeTwseStockDayRow,
  normalizeTwseBwibbuRow,
  mergeTwseRows,
  mergeTwseMisBySymbol,
  parseGoogleTradeTimeMs,
  isTwseMisAutoWindow,
  getIntradayQuoteReadiness,
  normalizeSourceRowsForValidation,
  mergeSourceMap,
  fillNamesFromValidationMap,
  mergeTwseOfficialBySymbol,
  normalizeTwseHistorySnapshotItem,
  mergeTwseHistorySnapshotBySymbol,
  mergeFinMindDailyBySymbol,
  mergeGoogleQuotesBySymbol,
  mergeYahooEtfToStocks,
  mergeOfficialEtfInavToStocks,
  mergeMarketToStocks,
  mergeDerivativesToStocks,
} from "@/lib/sourceMergers";
import {
  DEFAULT_WEIGHT_CONFIG,
  cloneWeightConfig,
  clamp,
  pct,
  number,
  compactNumber,
  getDerived,
  scoreShortV1,
  scoreMidV1,
  scoreLongV1,
} from "@/lib/horizonScoreEngine";


function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Card({ className = "", children, ...props }) {
  const hasOwnBg = /(^|\s)!?bg-/.test(className);
  return <div {...props} className={cx("border", hasOwnBg ? "" : "bg-white", className)}>{children}</div>;
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
  if (name === "price") return <svg {...common}><path d="M12 3v18" /><path d="M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.5 2.5 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3" /></svg>;
  if (name === "close") return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2.5" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
}

const DEFAULT_DATA_MODE = "mock";
const STOCKS_STORAGE_KEY = "stock_score_online_assets_v2";
const MAX_TRACKED_ASSETS = 50;
// Debug panel is intentionally hidden from normal users.
// It is enabled by URL only: ?debug=1 or ?debug=true. No user-facing toggle is rendered.
const DEBUG_QUERY_KEYS = new Set(["1", "true", "yes", "source", "sources", "validate", "validation"]);

function loadPersistedStocks() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STOCKS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return null;
    return parsed.filter((stock) => stock && stock.symbol).slice(0, MAX_TRACKED_ASSETS).map((stock) => ({
      ...createAssetTemplate({
        symbol: stock.symbol,
        name: stock.name || stock.symbol,
        type: stock.type || (/^00/.test(String(stock.symbol)) ? "ETF" : "股票"),
        market: stock.market || "TWSE",
      }),
      ...stock,
      symbol: normalizeStockSymbol(stock.symbol),
    }));
  } catch {
    return null;
  }
}

const DEFAULT_GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTwI6HZIQcKRt3H9MCDW4kRynUlkMtR1KnzUYpGpXMhNErX-LrO3ejwbJ7hD9R_BfaOXtCaSo6nhhf_/pub?output=csv";
const DEFAULT_FINMIND_PROXY_URL = "/api/finmind/stocks";
const DEFAULT_FINMIND_MARKET_PROXY_URL = "/api/finmind/market";
const DEFAULT_FINMIND_DERIVATIVES_PROXY_URL = "/api/finmind/derivatives";
const DEFAULT_TWSE_PROXY_URL = ["", "api", "twse", "stocks"].join("/");
const DEFAULT_TWSE_HISTORY_PROXY_URL = "/api/twse/history";
const DEFAULT_TWSE_MIS_PROXY_URL = "/api/twse/mis";
const DEFAULT_YAHOO_OHLCV_PROXY_URL = "/api/yahoo/ohlcv";
const DEFAULT_YAHOO_ETF_PROXY_URL = "/api/yahoo/etf";
const DEFAULT_ETF_INAV_PROXY_URL = "/api/etf/inav";
const initialStocks = [
  createAssetTemplate({ symbol: "2330", name: "台積電", type: "股票", market: "TWSE" }),
  createAssetTemplate({ symbol: "0050", name: "元大台灣50", type: "ETF", market: "TWSE" }),
];

const finmindAspectPlan = [
  {
    group: "即時區",
    aspect: "TWSE MIS",
    datasets: "getStockInfo.jsp",
    fields: "盤中 / 收盤 price、prevClose、累積成交量 volume、tradetime、quoteAgeSec、navUrl",
    calcNote: "官方 MIS 近即時行情端點；作盤中 price / volume 主參考與 ETF/TWSE 即時驗證，不覆蓋 FinMind 技術資料。",
    verifyRef: "GoogleFinance volume / tradetime；TWSE OpenAPI 盤後官方資料。",
    shortRole: "成交量 sanity check 與盤中主價量參考。",
    midRole: "通常不使用。",
    longRole: "不使用。"
  },
  {
    group: "即時區",
    aspect: "ETF 即時估值",
    datasets: "/api/etf/inav",
    fields: "即時估值、市價、折溢價、前日淨值/市價",
    calcNote: "ETF 專用估值資料；只補 ETF 小卡與驗證表，不覆蓋主行情、不參與短線分數。",
    verifyRef: "搭配 TWSE MIS 主價量觀察市價一致性；官方 iNAV 優先於 Yahoo ETF 備援。",
    shortRole: "ETF 折溢價與追價風險觀察。",
    midRole: "ETF 輔助觀察，不是主評分。",
    longRole: "不作長線核心依據。"
  },
  {
    group: "即時區",
    aspect: "GoogleFinance",
    datasets: "Google Sheet CSV / GOOGLEFINANCE（選填）",
    fields: "price、prevClose、volume、PER、EPS、Nasdaq、SOX、VIX、tradetime、updatedAt",
    calcNote: "選填外部參考來源；V73A13 後不再作主資料依賴。volumeRatio / 技術均線 / 市場風險 / EPS 估值口徑都不以 Google 為主，只保留參考差異與 debug。",
    verifyRef: "TWSE MIS 作盤中主價量；TWSE OpenAPI 作盤後官方估值；TWSE Snapshot 作日線技術；FinMind 作驗證、籌碼、財報與市場資料。",
    shortRole: "選填參考與 debug，不作主分數資料。",
    midRole: "市場驗證參考。",
    longRole: "長線不作依據。"
  },
  {
    group: "非即時資料區",
    aspect: "TWSE OpenAPI",
    datasets: "STOCK_DAY_ALL / BWIBBU_ALL",
    fields: "官方 price、prevClose、volume、PER、PBR、殖利率",
    calcNote: "免費、免 token、官方盤後校正資料；固定時段 cache：08:30 / 14:10 / 15:30 / 18:00 / 22:00。其他時間吃 cache；第一次進頁面會預熱補驗證表；APP 開著跨過固定時段會低頻補跑一次，不覆蓋 TWSE MIS 盤中主行情。",
    verifyRef: "FinMind Daily 驗證日量與收盤；GoogleFinance 只作即時參考，不作盤後基準。",
    shortRole: "官方盤後價量校正。",
    midRole: "估值與盤後基準。",
    longRole: "PER / PBR / 殖利率基準。"
  },
  {
    group: "非即時資料區",
    aspect: "TWSE Snapshot",
    datasets: "/api/twse/history（local snapshot-first）",
    fields: "TWSE STOCK_DAY OHLCV、自算 volume10ma / avgVolume20、MA5/10/20/60、RSI、MACD、KD、ATR、20日高低點、20/60日報酬",
    calcNote: "V73A：TWSE STOCK_DAY 小批次寫入本機 snapshot；route 預設讀 local snapshot，不再開頁 full fetch。技術指標由 App / route 自算，作為日線與技術主資料。",
    verifyRef: "FinMind Daily 做同日 OHLCV / 技術驗證；Yahoo OHLCV 只作救援抽樣。",
    shortRole: "短線日線與技術主資料。",
    midRole: "中線趨勢主資料。",
    longRole: "長線趨勢背景資料。"
  },
  {
    group: "非即時資料區",
    aspect: "FinMind Daily",
    datasets: "TaiwanStockPrice + 籌碼 / 基本面 datasets",
    fields: "OHLCV 與技術驗證、三大法人、融資融券、月營收、財報、資產負債",
    calcNote: "V73A 後日線技術主值改由 TWSE Snapshot 自算；FinMind Daily 保留為驗證 / 備援，同時仍供籌碼與基本面資料。route 端保留 1 小時 cache + stale-if-error。",
    verifyRef: "TWSE Snapshot 技術主值與 TWSE OpenAPI 盤後量；Yahoo OHLCV 僅作外部救援抽樣。",
    shortRole: "技術驗證與籌碼資料來源。",
    midRole: "籌碼與基本面輔助。",
    longRole: "品質與基本面輔助。"
  },
  {
    group: "非即時資料區",
    aspect: "FinMind Market",
    datasets: "/api/finmind/market",
    fields: "Nasdaq、SOX、S&P500、VIX、匯率 / 利率 / 商品等市場參考",
    calcNote: "市場風險主資料；啟動預熱 / 主更新 / 手動觸發，route 端 1 小時 cache，不做 interval 自動刷新。Nasdaq / SOX / VIX 以 FinMind Market 日收盤口徑作主值。",
    verifyRef: "GoogleFinance Nasdaq / SOX / VIX 只作同向驗證 / 參考；日收盤與盤中口徑不同時不硬判。",
    shortRole: "美股與市場風險主資料。",
    midRole: "市場環境輔助。",
    longRole: "總體背景參考。"
  },
  {
    group: "非即時資料區",
    aspect: "FinMind Derivatives",
    datasets: "/api/finmind/derivatives",
    fields: "台指期、期貨法人、選擇權 Put/Call、盤後風險參考",
    calcNote: "隔夜與衍生性風險補資料；啟動預熱 / 主更新 / 手動觸發，route 端 1 小時 cache，不做 interval 自動刷新。",
    verifyRef: "有資料才顯示與比對；不覆蓋 TWSE MIS / Google 主行情。",
    shortRole: "隔夜風險與期權風險參考。",
    midRole: "市場風險輔助。",
    longRole: "通常不使用。"
  },
  {
    group: "救援區",
    aspect: "Yahoo OHLCV 備援驗證",
    datasets: "/api/yahoo/ohlcv",
    fields: "Open / High / Low / Close、MACD / KD / ATR 同公式重算結果",
    calcNote: "外部 raw OHLCV 救援抽樣；固定時段 cache，只更新救援驗證層，不覆蓋 TWSE Snapshot / FinMind，不參與分數。",
    verifyRef: "主要驗證改由 TWSE Snapshot 對 FinMind；Yahoo 僅在救援與抽樣時使用。",
    shortRole: "技術驗證，不進短線分數。",
    midRole: "可作中線技術抽樣驗證。",
    longRole: "通常不使用。"
  },
  {
    group: "救援區",
    aspect: "Yahoo ETF 備援資料",
    datasets: "/api/yahoo/etf",
    fields: "ETF 市價、漲跌、漲跌幅、區間高低、區間差、折溢價%",
    calcNote: "ETF 備援輔助資料；固定時段 cache，只在投信官方 iNAV 缺值或 debug 時參考，不覆蓋官方 iNAV、不參與分數。",
    verifyRef: "若備援 parser 未匹配到標的，欄位維持缺值。",
    shortRole: "備援觀察。",
    midRole: "備援觀察。",
    longRole: "不作長線核心依據。"
  },
];

const sourceRoleOverviewGroups = [
  { title: "即時區", description: "短 TTL / 盤中或即時輔助；不作日線技術主值。", tone: "bg-emerald-50 text-emerald-800 border-emerald-100" },
  { title: "非即時資料區", description: "啟動預熱與手動更新；TWSE official 走固定時段，FinMind 走 1 小時 TTL。", tone: "bg-sky-50 text-sky-800 border-sky-100" },
  { title: "救援區", description: "備援與抽樣驗證：不覆蓋主資料、不參與短線分數。", tone: "bg-amber-50 text-amber-800 border-amber-100" },
].map((group) => ({
  ...group,
  items: finmindAspectPlan.filter((item) => item.group === group.title),
}));


function displayValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  return Number.isFinite(n) ? number(n) : "-";
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

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getTwseMisUsablePrice(row) {
  const price = parseNum(row?.price, null);
  if (price !== null && price > 0) return price;
  const displayPrice = parseNum(row?.displayPrice, null);
  if (displayPrice !== null && displayPrice > 0) return displayPrice;
  const quoteMidPrice = parseNum(row?.quoteMidPrice, null);
  if (quoteMidPrice !== null && quoteMidPrice > 0) return quoteMidPrice;
  return null;
}

function summarizeTwseMisRows(rows = [], normalizedSymbols = []) {
  const requested = normalizedSymbols.map(normalizeStockSymbol).filter(Boolean);
  const rowSymbols = new Set(rows.map((row) => normalizeStockSymbol(row?.symbol || row?.stock_id || row?.c)).filter(Boolean));
  const priceSymbols = new Set(rows.filter((row) => getTwseMisUsablePrice(row) !== null).map((row) => normalizeStockSymbol(row?.symbol || row?.stock_id || row?.c)).filter(Boolean));
  return {
    requestedCount: requested.length,
    rowCount: rowSymbols.size,
    usablePriceCount: priceSymbols.size,
    missingSymbols: requested.filter((symbol) => !rowSymbols.has(symbol)),
    priceMissingSymbols: requested.filter((symbol) => !priceSymbols.has(symbol)),
  };
}

function shouldRetryTwseMisRows(rows = [], normalizedSymbols = []) {
  const summary = summarizeTwseMisRows(rows, normalizedSymbols);
  if (!summary.requestedCount) return false;
  if (!summary.rowCount) return true;
  if (summary.missingSymbols.length) return true;
  return summary.priceMissingSymbols.length > 0;
}

function chooseBetterTwseMisRows(currentRows = [], nextRows = [], normalizedSymbols = []) {
  const currentSummary = summarizeTwseMisRows(currentRows, normalizedSymbols);
  const nextSummary = summarizeTwseMisRows(nextRows, normalizedSymbols);
  if (nextSummary.usablePriceCount > currentSummary.usablePriceCount) return nextRows;
  if (nextSummary.usablePriceCount === currentSummary.usablePriceCount && nextSummary.rowCount > currentSummary.rowCount) return nextRows;
  return currentRows;
}

async function fetchTwseMisRows(symbols = [], timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, proxyUrl = DEFAULT_TWSE_MIS_PROXY_URL) {
  const normalizedSymbols = symbols.map(normalizeStockSymbol).filter(Boolean);
  if (!normalizedSymbols.length) return [];

  const query = encodeURIComponent(normalizedSymbols.join(","));
  const baseUrl = proxyUrl || DEFAULT_TWSE_MIS_PROXY_URL;
  const attempts = 3;
  let bestRows = [];
  let bestJson = null;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const sep = baseUrl.includes("?") ? "&" : "?";
    const forcePart = attempt > 1 ? "&force=1&cacheTtlMs=0" : "";
    const url = `${baseUrl}${sep}symbols=${query}${forcePart}&_=${Date.now()}`;

    try {
      const res = await fetchWithTimeout(url, {
        cache: "no-store",
        headers: { "Accept": "application/json,text/plain,*/*" },
      }, timeoutMs);

      if (!res.ok) throw new Error(`TWSE MIS proxy HTTP ${res.status}`);
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "TWSE MIS proxy failed");

      const rows = Array.isArray(json.rows) ? json.rows : Array.isArray(json.data) ? json.data : [];
      const requested = new Set(normalizedSymbols);
      const seen = new Set();
      const filteredRows = rows
        .filter(Boolean)
        .filter((row) => requested.has(normalizeStockSymbol(row.symbol || row.stock_id || row.c)))
        .filter((row) => getTwseMisUsablePrice(row) !== null || row.volume !== null || row.tradetime)
        .filter((row) => {
          const symbol = normalizeStockSymbol(row.symbol || row.stock_id || row.c);
          if (seen.has(symbol)) return false;
          seen.add(symbol);
          return true;
        });

      bestRows = chooseBetterTwseMisRows(bestRows, filteredRows, normalizedSymbols);
      bestJson = json;

      if (!shouldRetryTwseMisRows(filteredRows, normalizedSymbols)) break;
      if (attempt < attempts) await sleep(450 * attempt);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(450 * attempt);
    }
  }

  if (!bestJson && lastError) throw lastError;

  const summary = summarizeTwseMisRows(bestRows, normalizedSymbols);
  bestRows.sourceRuntime = buildApiSourceRuntime({
    source: "twse_mis",
    json: bestJson || {},
    dataTime: pickTwseMisDataTime(bestJson || {}, bestRows),
    count: bestRows.length,
    note: [
      bestJson?.marketIndex?.tradetime ? `大盤 ${compactSourceTime(bestJson.marketIndex.tradetime)}` : "",
      summary.priceMissingSymbols.length ? `MIS price待補 ${summary.priceMissingSymbols.join(",")}` : "",
    ].filter(Boolean).join("；"),
  });
  return bestRows;
}


async function fetchTwseMarketIndex(timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, proxyUrl = DEFAULT_TWSE_MIS_PROXY_URL) {
  // BUILD_28E: /api/twse/mis now supports marketIndex via symbols=t00 / TAIEX.
  // Do not show fake loading text. If marketIndex is unavailable, return null and hide the badge.
  const baseUrl = proxyUrl || DEFAULT_TWSE_MIS_PROXY_URL;

  try {
    const sep = baseUrl.includes("?") ? "&" : "?";
    const url = `${baseUrl}${sep}symbols=t00&_=${Date.now()}`;
    const res = await fetchWithTimeout(url, {
      cache: "no-store",
      headers: { "Accept": "application/json,text/plain,*/*" },
    }, timeoutMs);

    if (!res.ok) return null;

    const json = await res.json();
    const index = json?.marketIndex || null;
    if (!index) return null;

    const price = parseNum(index.price, null);
    const prevClose = parseNum(index.prevClose, null);
    const change = parseNum(index.change, null);
    const changePct = parseNum(index.changePct, null);

    if (!Number.isFinite(Number(price))) return null;

    return {
      label: "加權指數",
      price: Number(price),
      prevClose: Number.isFinite(Number(prevClose)) ? Number(prevClose) : null,
      change: Number.isFinite(Number(change)) ? Number(change) : null,
      changePct: Number.isFinite(Number(changePct)) ? Number(changePct) : null,
      time: index.tradetime || index.updatedAt || "",
      source: "market_index",
      sourceRuntime: buildApiSourceRuntime({
        source: "twse_mis",
        json,
        dataTime: index.tradetime || index.updatedAt || "",
        count: 1,
        note: "加權指數",
      }),
    };
  } catch {
    return null;
  }
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


function getGoogleFinanceTicker(stock) {
  const prefix = stock.market === "TPEx" ? "TWO" : "TPE";
  return `${prefix}:${stock.symbol}`;
}

function buildGoogleVerifySheetTemplate(stocks) {
  const tab = String.fromCharCode(9);
  const newline = String.fromCharCode(10);
  const rows = [[
    "symbol", "name", "ticker",
    "price", "prevClose", "volume", "volume10ma", "volumeRatio",
    "ma5", "ma20", "rsi14",
    "per", "eps", "earningsYield", "yield",
    "high52", "low52", "drawdown52", "pricePosition52", "roc20",
    "marketcap", "beta", "datadelay",
    "nasdaqReturn1d", "soxReturn1d", "taifexAfterHoursReturn", "vixChange1d",
    "foreign3d", "trust3d", "dealer3d", "marginChange5dPct",
    "tradetime", "updatedAt", "sourceNote"
  ]];
  stocks.forEach((stock, index) => {
    const row = index + 2;
    const sheetSymbol = String(stock.symbol).startsWith("0") ? `'${stock.symbol}` : stock.symbol;
    rows.push([
      sheetSymbol,
      stock.name,
      getGoogleFinanceTicker(stock),
      `=IFERROR(GOOGLEFINANCE($C${row},"price"),"")`,
      `=IFERROR(GOOGLEFINANCE($C${row},"closeyest"),"")`,
      `=IFERROR(GOOGLEFINANCE($C${row},"volume"),"")`,
      `=IFERROR(AVERAGE(QUERY(GOOGLEFINANCE($C${row},"volume",TODAY()-20,TODAY()),"select Col2 order by Col1 desc limit 10 label Col2 ''")),"")`,
      `=IFERROR(IF(G${row}>0,F${row}/G${row},""),"")`,
      `=IFERROR(AVERAGE(QUERY(GOOGLEFINANCE($C${row},"price",TODAY()-15,TODAY()),"select Col2 order by Col1 desc limit 5 label Col2 ''")),"")`,
      `=IFERROR(AVERAGE(QUERY(GOOGLEFINANCE($C${row},"price",TODAY()-40,TODAY()),"select Col2 order by Col1 desc limit 20 label Col2 ''")),"")`,
      "",
      `=IFERROR(GOOGLEFINANCE($C${row},"pe"),"")`,
      `=IFERROR(GOOGLEFINANCE($C${row},"eps"),"")`,
      `=IFERROR(1/$L${row},"")`,
      `=IFERROR(GOOGLEFINANCE($C${row},"yieldpct"),"")`,
      `=IFERROR(GOOGLEFINANCE($C${row},"high52"),"")`,
      `=IFERROR(GOOGLEFINANCE($C${row},"low52"),"")`,
      `=IFERROR(($D${row}-$P${row})/$P${row},"")`,
      `=IFERROR(($D${row}-$Q${row})/($P${row}-$Q${row}),"")`,
      `=IFERROR(LET(prices,QUERY(GOOGLEFINANCE($C${row},"price",TODAY()-60,TODAY()),"select Col2 where Col2 is not null order by Col1 desc limit 21 label Col2 ''",1),old,INDEX(prices,21,1),IF(old>0,($D${row}-old)/old,"")),"")`,
      `=IFERROR(GOOGLEFINANCE($C${row},"marketcap"),"")`,
      `=IFERROR(GOOGLEFINANCE($C${row},"beta"),"")`,
      `=IFERROR(GOOGLEFINANCE($C${row},"datadelay"),"")`,
      `=IFERROR((GOOGLEFINANCE("INDEXNASDAQ:.IXIC","price")-GOOGLEFINANCE("INDEXNASDAQ:.IXIC","closeyest"))/GOOGLEFINANCE("INDEXNASDAQ:.IXIC","closeyest"),"")`,
      `=IFERROR((GOOGLEFINANCE("INDEXNASDAQ:SOX","price")-GOOGLEFINANCE("INDEXNASDAQ:SOX","closeyest"))/GOOGLEFINANCE("INDEXNASDAQ:SOX","closeyest"),"")`,
      "",
      `=IFERROR((GOOGLEFINANCE("INDEXCBOE:VIX","price")-GOOGLEFINANCE("INDEXCBOE:VIX","closeyest"))/GOOGLEFINANCE("INDEXCBOE:VIX","closeyest"),"")`,
      "",
      "",
      "",
      "",
      `=IFERROR(TEXT(GOOGLEFINANCE($C${row},"tradetime"),"yyyy/MM/dd HH:mm:ss"),"")`,
      "=NOW()",
      "GoogleFinance",
    ]);
  });
  return rows.map((row) => row.join(tab)).join(newline);
}

function appendRouteQuery(url, params = {}) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && String(value) !== "");
  if (!entries.length) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join("&")}`;
}


const TWSE_PREOPEN_STATUS = "盤前待開盤";
const TWSE_PREOPEN_REFERENCE_STATUS = "盤前參考";

function getMinuteOfDayFromTimeText(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const match = raw.match(/(?:^|[T\s])(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function isTwsePreOpenByTradeTime(value) {
  const minuteOfDay = getMinuteOfDayFromTimeText(value);
  if (minuteOfDay === null) return false;
  return minuteOfDay < 9 * 60;
}

function isPreOpenValidationStatus(status) {
  return String(status || "").includes("盤前");
}

function validationStatusClassForDisplay(status) {
  const label = String(status || "");
  if (isPreOpenValidationStatus(label)) return "bg-sky-100 text-sky-800";
  if (label.includes("日期")) return "bg-blue-100 text-blue-800";
  if (label.includes("參考")) return "bg-indigo-100 text-indigo-800";
  if (label.includes("已補") || label.includes("接入")) return "bg-sky-100 text-sky-800";
  if (label.includes("不比對")) return "bg-slate-100 text-slate-700";
  return validationStatusClass(label);
}

function validationDiffTextForDisplay(row) {
  if (isPreOpenValidationStatus(row?.status)) return "-";
  return validationDiffText(row);
}

function validationToleranceTextForDisplay(row) {
  if (isPreOpenValidationStatus(row?.status)) return "-";
  return validationToleranceText(row);
}

function compactValidationNoteForDisplay(row) {
  if (isPreOpenValidationStatus(row?.status) && row?.note) return row.note;
  return compactValidationNote(row);
}

function hasPreOpenValidationRow(rows = []) {
  return rows.some((row) => isPreOpenValidationStatus(row?.status));
}

const VALIDATION_DISPLAY_NEUTRAL_KEYWORDS = ["通過", "日期", "參考", "已補", "接入", "不比對"];
const VALIDATION_DISPLAY_HARD_KEYWORDS = ["資料異常", "差異偏大", "需查", "需檢查"];
const VALIDATION_CRITICAL_MISSING_LABEL_KEYWORDS = [
  "現價",
  "昨收",
  "成交量 volume",
  "TWSE MIS",
  "收盤價",
  "開盤價",
  "最高價",
  "最低價",
  "均量",
  "MA",
  "RSI",
  "MACD",
  "KD",
  "ATR",
  "priceRowCount",
];

function includesAnyText(value, keywords = []) {
  const text = String(value || "");
  return keywords.some((keyword) => text.includes(keyword));
}

function hasDisplayValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function isReferenceOrNeutralValidationStatus(status) {
  const label = String(status || "");
  return includesAnyText(label, VALIDATION_DISPLAY_NEUTRAL_KEYWORDS) || isPreOpenValidationStatus(label);
}

function isCriticalMissingValidationRow(row) {
  const status = String(row?.status || "");
  if (!status.includes("缺")) return false;
  if (includesAnyText(row?.compareSource, ["尚無比對來源", "不比對"])) return false;
  if (includesAnyText(row?.currentSource, ["尚無比對來源"])) return false;
  if (hasDisplayValue(row?.finmindValue)) return false;
  return includesAnyText(row?.label, VALIDATION_CRITICAL_MISSING_LABEL_KEYWORDS);
}

function isHardValidationIssueForDisplay(row) {
  const status = String(row?.status || "");
  if (!status || isReferenceOrNeutralValidationStatus(status)) return false;
  if (status.includes("缺")) return isCriticalMissingValidationRow(row);
  return includesAnyText(status, VALIDATION_DISPLAY_HARD_KEYWORDS);
}

function getValidationStateForDisplay(rows = []) {
  const state = getValidationState(rows);
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  const hardRows = list.filter(isHardValidationIssueForDisplay);
  const hardMissing = hardRows.filter((row) => String(row?.status || "").includes("缺")).length;
  const hardFailed = Math.max(0, hardRows.length - hardMissing);
  const hasDateMismatch = list.some((row) => String(row?.status || "").includes("日期"));
  const hasReferenceDiff = list.some((row) => String(row?.status || "").includes("參考"));
  const hasSupplemented = list.some((row) => String(row?.status || "").includes("已補") || String(row?.status || "").includes("接入"));
  const softPassed = Math.max(0, list.length - hardRows.length);

  if (hasPreOpenValidationRow(list) && hardFailed === 0 && hardMissing === 0) {
    return {
      ...state,
      label: TWSE_PREOPEN_STATUS,
      tone: "bg-sky-100 text-sky-800",
      passed: softPassed,
      failed: 0,
      missing: 0,
    };
  }

  if (hardFailed === 0 && hardMissing === 0) {
    if (hasDateMismatch) {
      return {
        ...state,
        label: "日期未對齊",
        tone: "bg-blue-100 text-blue-800",
        passed: softPassed,
        failed: 0,
        missing: 0,
      };
    }
    if (hasReferenceDiff) {
      return {
        ...state,
        label: "參考差異",
        tone: "bg-indigo-100 text-indigo-800",
        passed: softPassed,
        failed: 0,
        missing: 0,
      };
    }
    if (hasSupplemented) {
      return {
        ...state,
        label: "通過",
        tone: "bg-emerald-100 text-emerald-800",
        passed: softPassed,
        failed: 0,
        missing: 0,
      };
    }
  }

  return {
    ...state,
    failed: hardFailed || state.failed,
    missing: hardMissing || state.missing,
  };
}

function validationSummaryForDisplay(rows = []) {
  const state = getValidationStateForDisplay(rows);
  if (state.label === TWSE_PREOPEN_STATUS) {
    return "目前尚未開盤，盤中價量缺值屬正常盤前狀態；日線、技術、籌碼與盤後資料仍可正常驗證。";
  }
  return validationSummary(rows);
}

function applyTwsePreOpenValidationStatus(rows = [], isPreOpen = false, tradetime = "") {
  if (!isPreOpen) return rows;
  const timeText = String(tradetime || "").trim();
  const preOpenNote = `TWSE MIS 時間${timeText ? ` ${timeText}` : ""} 尚在 09:00 前，盤中成交價量未開盤屬正常盤前狀態；先保留昨日日線與外部參考，不判定為資料異常。`;
  const prevCloseNote = `盤前 GoogleFinance 可能仍是外部快照或即時口徑未更新；TWSE 官方昨收主值保留，不在開盤前判定差異偏大。${timeText ? `MIS 時間 ${timeText}。` : ""}`;

  return rows.map((row) => {
    if (!row) return row;
    const label = String(row.label || "");
    if (["現價 price", "成交量 volume", "TWSE MIS 盤中價量"].includes(label)) {
      return {
        ...row,
        status: TWSE_PREOPEN_STATUS,
        diffPct: 0,
        tolerancePct: 0,
        toleranceLabel: "盤前",
        note: preOpenNote,
        currentSource: "TWSE MIS（盤前未開盤）",
        compareSource: label === "TWSE MIS 盤中價量" ? "不比對" : row.compareSource,
      };
    }
    if (label === "昨收 prevClose" && ["差異偏大", "需檢查"].includes(row.status)) {
      return {
        ...row,
        status: TWSE_PREOPEN_REFERENCE_STATUS,
        diffPct: 0,
        tolerancePct: 0,
        toleranceLabel: "盤前參考",
        note: prevCloseNote,
      };
    }
    return row;
  });
}

function getSourceValidationRows(symbol, stock, validationMap = {}) {
  const main = stock || {};
  const noCompare = "尚無比對來源";
  const isEtf = isEtfAsset(main);
  const finiteOrNull = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const positiveOrNull = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const shouldShowEtfOptional = (...values) => values.some((value) => positiveOrNull(value) !== null);
  let volumeRatioValidationValue = null;
  let volumeRatioValidationSource = getFieldSource(main, "volumeRatio");

  const twsePrevClose = pickCompare(validationMap, symbol, "twse", "prevClose");
  const twseClose = pickCompare(validationMap, symbol, "twse", "price");
  const twseVolume = pickCompare(validationMap, symbol, "twse", "volume");
  const twsePer = pickCompare(validationMap, symbol, "twse", "per");
  const twsePbr = pickCompare(validationMap, symbol, "twse", "pbr");
  const twseDividendYield = pickCompare(validationMap, symbol, "twse", "dividendYield");
  const twseUpdatedAt = pickCompare(validationMap, symbol, "twse", "updatedAt");
  const twseDataTime = getSourceValue(validationMap, symbol, "twse", "dataTime") || {};
  const twseOfficialDate = twseDataTime.stockDayDateIso || twseDataTime.bwibbuDateIso || twseUpdatedAt.value || main.twseUpdatedAt || "";
  const twseHistoryAvgVolume10 = pickCompare(validationMap, symbol, "twse_history", "avgVolume10TwseSnapshot");
  const twseHistoryAvgVolume10Fallback = pickCompare(validationMap, symbol, "twse_history", "avgVolume10");
  const twseHistoryAvgVolume20 = pickCompare(validationMap, symbol, "twse_history", "avgVolume20TwseSnapshot");
  const twseHistoryAvgVolume10Value = positiveOrNull(twseHistoryAvgVolume10.value) !== null ? positiveOrNull(twseHistoryAvgVolume10.value) : positiveOrNull(twseHistoryAvgVolume10Fallback.value);
  const twseHistoryAvgVolume10Source = twseHistoryAvgVolume10.value !== null ? twseHistoryAvgVolume10.source : twseHistoryAvgVolume10Fallback.value !== null ? twseHistoryAvgVolume10Fallback.source : noCompare;
  const twseHistoryAvgVolume20Value = positiveOrNull(twseHistoryAvgVolume20.value);
  const twseHistoryAvgVolume20Source = twseHistoryAvgVolume20.value !== null ? twseHistoryAvgVolume20.source : noCompare;
  const twseMisVolume = pickCompare(validationMap, symbol, "twse_mis", "volume");
  const twseMisTradetime = pickCompare(validationMap, symbol, "twse_mis", "tradetime");
  const twseMisPrice = pickCompare(validationMap, symbol, "twse_mis", "displayPrice");
  const twseMisPriceFallback = pickCompare(validationMap, symbol, "twse_mis", "price");
  const twseMisQuoteMidPrice = pickCompare(validationMap, symbol, "twse_mis", "quoteMidPrice");
  const twseMisDisplayPriceType = pickCompare(validationMap, symbol, "twse_mis", "displayPriceType");
  const twseMisQuoteAgeSec = pickCompare(validationMap, symbol, "twse_mis", "quoteAgeSec");

  // 驗證表只讀各來源原始 validationMap，不讀已 merge 後的 main 欄位，避免主資料與驗證資料混在一起。
  const googlePrice = pickCompare(validationMap, symbol, "google", "price");
  const googlePrevClose = pickCompare(validationMap, symbol, "google", "prevClose");
  const googleVolume = pickCompare(validationMap, symbol, "google", "volume");
  const googleVolume10ma = pickCompare(validationMap, symbol, "google", "volume10ma");
  const googleVolume10maFromMap = positiveOrNull(googleVolume10ma.value);
  const googleVolume10maFromMain = positiveOrNull(main.volume10ma);
  const googleVolume10maValue = googleVolume10maFromMap !== null ? googleVolume10maFromMap : googleVolume10maFromMain;
  const googleVolume10maSource = googleVolume10maFromMap !== null
    ? googleVolume10ma.source
    : googleVolume10maFromMain !== null
      ? `${getFieldSource(main, "volume10ma")}（merged main fallback）`
      : noCompare;
  const googlePer = pickCompare(validationMap, symbol, "google", "per");
  const googleEps = pickCompare(validationMap, symbol, "google", "eps");

  const finDailyClose = pickCompare(validationMap, symbol, "finmind", "dailyClose");
  const finDailyOpen = pickCompare(validationMap, symbol, "finmind", "dailyOpen");
  const finDailyHigh = pickCompare(validationMap, symbol, "finmind", "dailyHigh");
  const finDailyLow = pickCompare(validationMap, symbol, "finmind", "dailyLow");
  const finDailyVolume = pickCompare(validationMap, symbol, "finmind", "dailyVolume");
  const twseHistoryDailyClose = pickCompare(validationMap, symbol, "twse_history", "dailyClose");
  const twseHistoryDailyOpen = pickCompare(validationMap, symbol, "twse_history", "dailyOpen");
  const twseHistoryDailyHigh = pickCompare(validationMap, symbol, "twse_history", "dailyHigh");
  const twseHistoryDailyLow = pickCompare(validationMap, symbol, "twse_history", "dailyLow");
  const finUpdatedAt = pickCompare(validationMap, symbol, "finmind", "updatedAt");

  const yahooUpdatedAt = pickCompare(validationMap, symbol, "yahoo", "updatedAt");
  // ETF 有時 FinMind validationMap 內沒有 updatedAt，但主表仍有 FinMind 最新日資料。
  // Yahoo OHLCV 驗證應與主表/FinMind 的最新日資料對齊，不能因 finUpdatedAt 缺值就退回「待外部 OHLCV」。
  const yahooTargetDate = finUpdatedAt.value || main.finmindUpdatedAt || main.dailyDate || main.date || main.updatedAt || yahooUpdatedAt.value;
  const yahooDailyClose = pickYahooAlignedCompare(validationMap, symbol, yahooTargetDate, "dailyClose");
  const yahooDailyOpen = pickYahooAlignedCompare(validationMap, symbol, yahooTargetDate, "dailyOpen");
  const yahooDailyHigh = pickYahooAlignedCompare(validationMap, symbol, yahooTargetDate, "dailyHigh");
  const yahooDailyLow = pickYahooAlignedCompare(validationMap, symbol, yahooTargetDate, "dailyLow");

  const googleMa5 = pickCompare(validationMap, symbol, "google", "ma5");
  const googleMa20 = pickCompare(validationMap, symbol, "google", "ma20");
  const googleMa5Value = main.googleMa5 ?? googleMa5.value;
  const googleMa20Value = main.googleMa20 ?? googleMa20.value;
  const googleMa5Source = main.googleMa5 !== null && main.googleMa5 !== undefined ? "GoogleFinance" : googleMa5.value !== null ? googleMa5.source : noCompare;
  const googleMa20Source = main.googleMa20 !== null && main.googleMa20 !== undefined ? "GoogleFinance" : googleMa20.value !== null ? googleMa20.source : noCompare;
  const googleNasdaq = pickCompare(validationMap, symbol, "google", "nasdaqReturn1d");
  const googleSox = pickCompare(validationMap, symbol, "google", "soxReturn1d");
  const googleVix = pickCompare(validationMap, symbol, "google", "vixChange1d");
  const googleTaifex = pickCompare(validationMap, symbol, "google", "taifexAfterHoursReturn");
  const googleNasdaqPct = normalizePercentCompareValue(googleNasdaq.value);
  const googleSoxPct = normalizePercentCompareValue(googleSox.value);
  const googleVixPctRaw = normalizePercentCompareValue(googleVix.value, "vix");
  const googleTaifexPct = normalizePercentCompareValue(googleTaifex.value);
  const mainNasdaqPct = normalizePercentCompareValue(main.nasdaqReturn1d);
  const mainSoxPct = normalizePercentCompareValue(main.soxReturn1d);
  const mainTaifexPct = normalizePercentCompareValue(main.taifexAfterHoursReturn);
  const mainVixPctRaw = normalizePercentCompareValue(main.vixChange1d, "vix");
  const finmindNasdaqPct = normalizePercentCompareValue(main.finmindNasdaqReturn1d);
  const finmindSoxPct = normalizePercentCompareValue(main.finmindSoxReturn1d);
  const finmindVixPct = normalizePercentCompareValue(main.finmindVixChange1d, "vix");
  const googleVixPct = googleVixPctRaw !== null ? reconcileVixPercentPointWithReference(googleVixPctRaw, mainVixPctRaw ?? finmindVixPct) : null;

  const finPer = pickCompare(validationMap, symbol, "finmind", "per");
  const finPbr = pickCompare(validationMap, symbol, "finmind", "pbr");
  const finDividendYield = pickCompare(validationMap, symbol, "finmind", "dividendYield");

  const googlePerValue = positiveOrNull(googlePer.value);
  const twsePerValue = positiveOrNull(twsePer.value);
  const finPerValue = positiveOrNull(finPer.value);
  const twsePbrValue = positiveOrNull(twsePbr.value);
  const finPbrValue = positiveOrNull(finPbr.value);
  const twseDividendYieldValue = isEtf ? positiveOrNull(twseDividendYield.value) : finiteOrNull(twseDividendYield.value);
  const finDividendYieldValue = positiveOrNull(finDividendYield.value);
  const showValuationRows = !isEtf || shouldShowEtfOptional(googlePer.value, twsePer.value, finPer.value, twsePbr.value, finPbr.value, twseDividendYield.value, finDividendYield.value);
  const twseImpliedEpsTtmValue = twseClose.value !== null && twsePerValue !== null && twsePerValue > 0
    ? Number((Number(twseClose.value) / twsePerValue).toFixed(4))
    : null;
  const twseImpliedEpsTtmSource = twseImpliedEpsTtmValue !== null
    ? `TWSE（close / PER 隱含${twseOfficialDate ? `，${normalizeValidationDate(twseOfficialDate)}` : ""}）`
    : noCompare;

  const finMa5 = pickCompare(validationMap, symbol, "finmind", "ma5");
  const finMa20 = pickCompare(validationMap, symbol, "finmind", "ma20");
  const finMa60 = pickCompare(validationMap, symbol, "finmind", "ma60");
  const finRsi14 = pickCompare(validationMap, symbol, "finmind", "rsi14");
  const finHigh20 = pickCompare(validationMap, symbol, "finmind", "high20");
  const finLow20 = pickCompare(validationMap, symbol, "finmind", "low20");
  const finAvgVolume10 = pickCompare(validationMap, symbol, "finmind", "avgVolume10");
  const finVolume10maFinMind = pickCompare(validationMap, symbol, "finmind", "volume10maFinMind");
  const finAvgVolume10Value = positiveOrNull(finVolume10maFinMind.value) !== null ? positiveOrNull(finVolume10maFinMind.value) : positiveOrNull(finAvgVolume10.value);
  const finAvgVolume10Source = finVolume10maFinMind.value !== null ? finVolume10maFinMind.source : finAvgVolume10.value !== null ? finAvgVolume10.source : noCompare;
  const volume10maMainValue = twseHistoryAvgVolume10Value !== null ? twseHistoryAvgVolume10Value : finAvgVolume10Value;
  const volume10maMainSource = twseHistoryAvgVolume10Value !== null ? twseHistoryAvgVolume10Source : finAvgVolume10Source;
  const volume10maVerifyValue = finAvgVolume10Value !== null ? finAvgVolume10Value : googleVolume10maValue;
  const volume10maVerifySource = finAvgVolume10Value !== null ? `${finAvgVolume10Source}（FinMind 驗證）` : googleVolume10maValue !== null ? `${googleVolume10maSource}（Google 參考）` : noCompare;
  const ratioMainVolumeValue = positiveOrNull(main.volume) ?? positiveOrNull(twseVolume.value) ?? positiveOrNull(main.officialVolume) ?? positiveOrNull(main.dailyVolume);
  const storedVolumeRatioValue = positiveOrNull(main.volumeRatio);
  if (ratioMainVolumeValue !== null && volume10maMainValue !== null) {
    volumeRatioValidationValue = ratioMainVolumeValue / volume10maMainValue;
    volumeRatioValidationSource = volumeRatioRuntimeSourceLabel(volume10maMainSource || "TWSE snapshot 自算10日均量");
  } else if (storedVolumeRatioValue !== null) {
    volumeRatioValidationValue = storedVolumeRatioValue;
    volumeRatioValidationSource = getFieldSource(main, "volumeRatio");
  }
  const finAvgVolume20 = pickCompare(validationMap, symbol, "finmind", "avgVolume20");
  const finReturn20d = pickCompare(validationMap, symbol, "finmind", "return20d");
  const finReturn60d = pickCompare(validationMap, symbol, "finmind", "return60d");

  const twseHistoryMa5 = pickCompare(validationMap, symbol, "twse_history", "ma5");
  const twseHistoryMa20 = pickCompare(validationMap, symbol, "twse_history", "ma20");
  const twseHistoryMa60 = pickCompare(validationMap, symbol, "twse_history", "ma60");
  const twseHistoryRsi14 = pickCompare(validationMap, symbol, "twse_history", "rsi14");
  const twseHistoryHigh20 = pickCompare(validationMap, symbol, "twse_history", "high20");
  const twseHistoryLow20 = pickCompare(validationMap, symbol, "twse_history", "low20");
  const twseHistoryReturn20d = pickCompare(validationMap, symbol, "twse_history", "return20d");
  const twseHistoryReturn60d = pickCompare(validationMap, symbol, "twse_history", "return60d");
  const twseHistoryPriceRowCount = pickCompare(validationMap, symbol, "twse_history", "priceRowCount");
  const finMacd = pickCompare(validationMap, symbol, "finmind", "macd");
  const finMacdSignal = pickCompare(validationMap, symbol, "finmind", "macdSignal");
  const finMacdHist = pickCompare(validationMap, symbol, "finmind", "macdHist");
  const finMacdHistDelta3 = pickCompare(validationMap, symbol, "finmind", "macdHistDelta3");
  const finK9 = pickCompare(validationMap, symbol, "finmind", "k9");
  const finD9 = pickCompare(validationMap, symbol, "finmind", "d9");
  const finJ9 = pickCompare(validationMap, symbol, "finmind", "j9");
  const finAtr14 = pickCompare(validationMap, symbol, "finmind", "atr14");
  const finAtrPct = pickCompare(validationMap, symbol, "finmind", "atrPct");
  const finAtrPctAvg20 = pickCompare(validationMap, symbol, "finmind", "atrPctAvg20");
  const finAtrPctVsAvg20 = pickCompare(validationMap, symbol, "finmind", "atrPctVsAvg20");

  const twseHistoryMacd = pickCompare(validationMap, symbol, "twse_history", "macd");
  const twseHistoryMacdSignal = pickCompare(validationMap, symbol, "twse_history", "macdSignal");
  const twseHistoryMacdHist = pickCompare(validationMap, symbol, "twse_history", "macdHist");
  const twseHistoryMacdHistDelta3 = pickCompare(validationMap, symbol, "twse_history", "macdHistDelta3");
  const twseHistoryK9 = pickCompare(validationMap, symbol, "twse_history", "k9");
  const twseHistoryD9 = pickCompare(validationMap, symbol, "twse_history", "d9");
  const twseHistoryJ9 = pickCompare(validationMap, symbol, "twse_history", "j9");
  const twseHistoryAtr14 = pickCompare(validationMap, symbol, "twse_history", "atr14");
  const twseHistoryAtrPct = pickCompare(validationMap, symbol, "twse_history", "atrPct");
  const twseHistoryAtrPctAvg20 = pickCompare(validationMap, symbol, "twse_history", "atrPctAvg20");
  const twseHistoryAtrPctVsAvg20 = pickCompare(validationMap, symbol, "twse_history", "atrPctVsAvg20");

  const yahooMacd = pickYahooAlignedCompare(validationMap, symbol, yahooTargetDate, "macd");
  const yahooMacdSignal = pickYahooAlignedCompare(validationMap, symbol, yahooTargetDate, "macdSignal");
  const yahooMacdHist = pickYahooAlignedCompare(validationMap, symbol, yahooTargetDate, "macdHist");
  const yahooMacdHistDelta3 = pickYahooAlignedCompare(validationMap, symbol, yahooTargetDate, "macdHistDelta3");
  const yahooK9 = pickYahooAlignedCompare(validationMap, symbol, yahooTargetDate, "k9");
  const yahooD9 = pickYahooAlignedCompare(validationMap, symbol, yahooTargetDate, "d9");
  const yahooJ9 = pickYahooAlignedCompare(validationMap, symbol, yahooTargetDate, "j9");
  const yahooAtr14 = pickYahooAlignedCompare(validationMap, symbol, yahooTargetDate, "atr14");
  const yahooAtrPct = pickYahooAlignedCompare(validationMap, symbol, yahooTargetDate, "atrPct");
  const yahooAtrPctAvg20 = pickYahooAlignedCompare(validationMap, symbol, yahooTargetDate, "atrPctAvg20");
  const yahooAtrPctVsAvg20 = pickYahooAlignedCompare(validationMap, symbol, yahooTargetDate, "atrPctVsAvg20");
  const yahooCompareOptions = yahooAlignedCompareOptions(yahooTargetDate, yahooUpdatedAt.value, yahooDailyClose.date || yahooMacdHist.date || yahooK9.date || yahooAtrPct.date);

  const yahooEtfMarketPrice = pickCompare(validationMap, symbol, "yahoo_etf", "etfMarketPrice");
  const yahooEtfChangePct = pickCompare(validationMap, symbol, "yahoo_etf", "etfChangePct");
  const yahooEtfRangeSpread = pickCompare(validationMap, symbol, "yahoo_etf", "etfRangeSpread");
  const yahooEtfPremiumDiscountPct = pickCompare(validationMap, symbol, "yahoo_etf", "etfPremiumDiscountPct");

  const officialEtfEstimatedNav = pickCompare(validationMap, symbol, "official_etf_inav", "estimatedNav");
  const officialEtfLatestPrice = pickCompare(validationMap, symbol, "official_etf_inav", "latestPrice");
  const officialEtfReferenceNav = pickCompare(validationMap, symbol, "official_etf_inav", "referenceNav");
  const officialEtfYesterdayPrice = pickCompare(validationMap, symbol, "official_etf_inav", "yesterdayPrice");
  const officialEtfPremiumDiscountPct = pickCompare(validationMap, symbol, "official_etf_inav", "premiumDiscountPct");
  const officialEtfSourceType = getSourceValue(validationMap, symbol, "official_etf_inav", "sourceType");
  const officialEtfNavDate = getSourceValue(validationMap, symbol, "official_etf_inav", "navDate");
  const officialEtfAdapter = getSourceValue(validationMap, symbol, "official_etf_inav", "adapter");
  const officialEtfSourceLabel = main.officialEtfInavEstimatedNav !== null && main.officialEtfInavEstimatedNav !== undefined
    ? `ETF 即時估值${main.officialEtfInavNavDate ? `（${main.officialEtfInavNavDate}）` : ""}`
    : officialEtfEstimatedNav.value !== null
      ? `ETF 即時估值${officialEtfNavDate ? `（${officialEtfNavDate}）` : ""}`
      : noCompare;
  const officialEtfDisplay = {
    estimatedNav: main.officialEtfInavEstimatedNav ?? officialEtfEstimatedNav.value,
    latestPrice: main.officialEtfInavLatestPrice ?? officialEtfLatestPrice.value,
    referenceNav: main.officialEtfInavReferenceNav ?? officialEtfReferenceNav.value,
    yesterdayPrice: main.officialEtfInavYesterdayPrice ?? officialEtfYesterdayPrice.value,
    premiumDiscountPct: main.officialEtfInavPremiumDiscountPct ?? officialEtfPremiumDiscountPct.value,
    navDate: main.officialEtfInavNavDate || officialEtfNavDate || "",
    sourceType: main.officialEtfInavSourceType || officialEtfSourceType || "",
    adapter: main.officialEtfInavAdapter || officialEtfAdapter || "",
    source: officialEtfSourceLabel,
  };

  const finForeign3d = pickCompare(validationMap, symbol, "finmind", "foreign3d");
  const finTrust3d = pickCompare(validationMap, symbol, "finmind", "trust3d");
  const finDealer3d = pickCompare(validationMap, symbol, "finmind", "dealer3d");
  const finInstitutional3d = pickCompare(validationMap, symbol, "finmind", "institutional3d");
  const finForeign20d = pickCompare(validationMap, symbol, "finmind", "foreign20d");
  const finTrust20d = pickCompare(validationMap, symbol, "finmind", "trust20d");
  const finDealer20d = pickCompare(validationMap, symbol, "finmind", "dealer20d");
  const finInstitutional20d = pickCompare(validationMap, symbol, "finmind", "institutional20d");

  const finMargin5 = pickCompare(validationMap, symbol, "finmind", "marginChange5dPct");
  const finMargin20 = pickCompare(validationMap, symbol, "finmind", "marginChange20dPct");
  const finShort5 = pickCompare(validationMap, symbol, "finmind", "shortSaleChange5dPct");
  const finShort20 = pickCompare(validationMap, symbol, "finmind", "shortSaleChange20dPct");

  const finRevenueMoM = pickCompare(validationMap, symbol, "finmind", "revenueMoM");
  const finRevenueYoY = pickCompare(validationMap, symbol, "finmind", "revenueYoY");
  const finEps = pickCompare(validationMap, symbol, "finmind", "eps");
  const finEpsGrowth = pickCompare(validationMap, symbol, "finmind", "epsGrowthYoY");
  const finGrossMargin = pickCompare(validationMap, symbol, "finmind", "grossMargin");
  const finGrossMarginQoQ = pickCompare(validationMap, symbol, "finmind", "grossMarginQoQ");
  const finOperatingMargin = pickCompare(validationMap, symbol, "finmind", "operatingMargin");
  const finOperatingMarginQoQ = pickCompare(validationMap, symbol, "finmind", "operatingMarginQoQ");
  const finNetMargin = pickCompare(validationMap, symbol, "finmind", "netMargin");
  const finEpsTtm = pickCompare(validationMap, symbol, "finmind", "epsTtm");
  const finEpsTtmGrowth = pickCompare(validationMap, symbol, "finmind", "epsTtmGrowthYoY");
  const finRoeTtm = pickCompare(validationMap, symbol, "finmind", "roeTtm");
  const finDebtRatio = pickCompare(validationMap, symbol, "finmind", "debtRatio");
  const finFinancialQuarterCount = pickCompare(validationMap, symbol, "finmind", "financialQuarterCount");

  const dailyCloseCheck = sourceDateCompareOptions(twseOfficialDate, finUpdatedAt.value || main.finmindUpdatedAt || main.updatedAt, "TWSE", "FinMind");
  const dailyVolumeCheck = sourceDateCompareOptions(twseOfficialDate, finUpdatedAt.value || main.finmindUpdatedAt || main.updatedAt, "TWSE", "FinMind");

  const twseMisMainPriceValue = twseMisPrice.value !== null ? twseMisPrice.value : twseMisPriceFallback.value !== null ? twseMisPriceFallback.value : twseMisQuoteMidPrice.value;
  const twseMisMainPriceSource = twseMisPrice.value !== null ? twseMisPrice.source : twseMisPriceFallback.value !== null ? twseMisPriceFallback.source : twseMisQuoteMidPrice.value !== null ? `${twseMisQuoteMidPrice.source} 五檔中間價` : noCompare;
  const twseMisTimeLabel = twseMisTradetime.value ? `（${twseMisTradetime.value}${twseMisQuoteAgeSec.value !== null ? ` / age ${twseMisQuoteAgeSec.value}s` : ""}）` : "";
  const isTwseMisPreOpen = isTwsePreOpenByTradeTime(twseMisTradetime.value);

  const finmindDataTime = main.finmindDataTime || {};
  const finmindProfileDataTime = main.finmindProfileDataTime || {};
  const finmindScoreDate = normalizeValidationDate(finmindDataTime.priceDate || finUpdatedAt.value || main.finmindUpdatedAt || main.updatedAt || finmindProfileDataTime.score);
  const finmindInstitutionalDate = normalizeValidationDate(finmindDataTime.institutionalDate || finmindScoreDate);
  const finmindMarginDate = normalizeValidationDate(finmindDataTime.marginDate || finmindScoreDate);
  const finmindFinancialDate = normalizeValidationDate(finmindDataTime.financialDate || finmindDataTime.financialQuarter || finmindDataTime.balanceDate || finmindDataTime.balanceQuarter || finmindProfileDataTime.fundamental || finmindScoreDate);
  const finmindRevenueDate = normalizeValidationDate(finmindDataTime.revenueMonth || (main.revenueYear && main.revenueMonth ? `${main.revenueYear}-${String(main.revenueMonth).padStart(2, "0")}` : "") || finmindScoreDate);
  const twseHistoryDate = normalizeValidationDate(main.twseHistoryDataTime?.latestDate || main.twseHistoryDataTime?.snapshotSourceLatestDate || main.twseHistoryLatestDate || getSourceValue(validationMap, symbol, "twse_history", "latestDate") || getSourceValue(validationMap, symbol, "twse_history", "dataTime")?.latestDate);
  const twseMisDate = normalizeValidationDate(twseMisTradetime.value);
  const officialEtfDataDate = normalizeValidationDate(officialEtfDisplay.navDate || main.officialEtfInavNavDate || officialEtfNavDate || main.officialEtfInavUpdatedAt);
  const marketDataTimeSummary = main.marketDataTimeSummary || {};
  const marketUsDate = normalizeValidationDate(main.marketLatestUsMarketDate || marketDataTimeSummary.latestUsMarketDate || main.marketDataTime || main.marketUpdatedAt);
  const derivativesDataTimeSummary = main.derivativesDataTimeSummary || {};
  const derivativesDate = normalizeValidationDate(main.derivativesFuturesDate || derivativesDataTimeSummary.futuresDate || derivativesDataTimeSummary.latestDate || main.derivativesDataTime || main.derivativesUpdatedAt);
  const googleMarketDate = normalizeValidationDate(main.googleUpdatedAt || main.tradetime || main.updatedAt);

  const rows = [
    compareSourceValue("現價 price", twseMisMainPriceValue, googlePrice.value, 0.5, `TWSE MIS 為盤中主值；GoogleFinance 僅作外部參考差異，不再判定通過 / 需檢查。${twseMisDisplayPriceType.value === "mid" ? "目前 MIS 使用五檔中間價作參考價，非正式成交價。" : ""}`, twseMisMainPriceValue !== null ? `${twseMisMainPriceSource}${twseMisTimeLabel}` : getFieldSource(main, "price"), googlePrice.value !== null ? `${googlePrice.source}（參考）` : noCompare, googlePrice.value !== null && twseMisMainPriceValue !== null ? { statusOverrideAfterCompare: "參考差異", toleranceLabel: "參考" } : { statusOverride: twseMisMainPriceValue !== null ? "已補值" : undefined }),
    compareSourceValue("昨收 prevClose", twsePrevClose.value, googlePrevClose.value, 0.2, "昨收主值收斂到 TWSE 官方；GoogleFinance 保留為驗證值。若差異出現，優先檢查 Google CSV 是否仍為舊快照或昨收口徑未更新。", twsePrevClose.value !== null ? `${twsePrevClose.source}${twseOfficialDate ? `（${normalizeValidationDate(twseOfficialDate)}）` : ""}` : noCompare, googlePrevClose.value !== null ? googlePrevClose.source : noCompare),
    compareSourceValue("成交量 volume", twseMisVolume.value, googleVolume.value, 5, `盤中成交量主來源改用 TWSE MIS；GoogleFinance 保留輔助比對。${twseMisTradetime.value ? `MIS 時間 ${twseMisTradetime.value}` : ""}`, twseMisVolume.value !== null ? `${twseMisVolume.source}${twseMisTimeLabel}` : getFieldSource(main, "volume"), googleVolume.value !== null ? googleVolume.source : noCompare, googleVolume.value !== null && twseMisVolume.value !== null ? { statusOverride: "參考差異", toleranceLabel: "參考" } : { statusOverride: twseMisVolume.value !== null ? "已補值" : undefined }),
    compareSourceValue("TWSE MIS 盤中價量", twseMisVolume.value, null, 0, `TWSE MIS 已作為盤中價量主來源候選；僅改價量來源，不改短線分數公式。${twseMisMainPriceValue !== null ? ` MIS 價 ${twseMisMainPriceValue}` : ""}${twseMisTradetime.value ? `，MIS 時間 ${twseMisTradetime.value}` : ""}`, twseMisVolume.value !== null ? `${twseMisVolume.source}${twseMisTimeLabel}` : noCompare, getSourceName("none"), { statusOverride: "已補值" }),
    compareSourceValue("官方收盤 close", twseClose.value, finDailyClose.value, 0.2, dailyCloseCheck.dateNote || "盤後收盤主值收斂到 TWSE OpenAPI；FinMind 日 K 保留為技術序列與驗證值。日期一致才判通過/失敗，不覆蓋盤中 TWSE MIS 主行情。", twseClose.value !== null ? `${twseClose.source}${twseOfficialDate ? `（${normalizeValidationDate(twseOfficialDate)}）` : ""}` : noCompare, finDailyClose.value !== null ? `${finDailyClose.source}${finUpdatedAt.value ? `（${normalizeValidationDate(finUpdatedAt.value)}）` : ""}` : getFieldSource(main, "dailyClose"), dailyCloseCheck.noCompare ? { noCompare: true } : {}),
    compareSourceValue("官方成交量 volume", twseVolume.value, finDailyVolume.value, 1, dailyVolumeCheck.dateNote || "盤後成交量主值收斂到 TWSE OpenAPI；FinMind 日量保留為技術序列與驗證值。日期一致才判通過/失敗。", twseVolume.value !== null ? `${twseVolume.source}${twseOfficialDate ? `（${normalizeValidationDate(twseOfficialDate)}）` : ""}` : noCompare, finDailyVolume.value !== null ? `${finDailyVolume.source}${finUpdatedAt.value ? `（${normalizeValidationDate(finUpdatedAt.value)}）` : ""}` : getFieldSource(main, "dailyVolume"), dailyVolumeCheck.noCompare ? { noCompare: true } : {}),
    compareSourceValue("10日均量 volume10ma", volume10maMainValue, volume10maVerifyValue, 3, "10日均量主值改用 TWSE STOCK_DAY snapshot 自算；FinMind 做驗證 / 備援，GoogleFinance 只作參考，不再當主量能基準。", volume10maMainValue !== null ? `${volume10maMainSource}（TWSE snapshot 自算10日量均）` : noCompare, volume10maVerifyValue !== null ? volume10maVerifySource : noCompare, volume10maMainValue !== null && volume10maVerifyValue !== null ? {} : { statusOverride: volume10maMainValue !== null ? "已補值" : undefined }),
    compareSourceValue("量能爆發比 volumeRatio", volumeRatioValidationValue, null, 0.5, "原始量比 = 目前主成交量 ÷ 歷史均量；盤中主成交量優先 MIS，盤後主成交量優先 TWSE official/snapshot，歷史均量優先 TWSE snapshot 自算10日均量，FinMind 驗證/備援，Google 只作參考。短線主表仍會依 tradetime 進行 V1.1 時間係數校正。", volumeRatioValidationValue !== null ? volumeRatioValidationSource : getFieldSource(main, "volumeRatio"), "接入確認", { statusOverride: "接入確認" }),

    showValuationRows ? compareSourceValue("本益比 PER", twsePerValue, finPerValue !== null ? finPerValue : googlePerValue, 10, "PER 主值收斂到 TWSE 官方 BWIBBU；FinMind 若有值作驗證 / 備援，GoogleFinance 僅作 optional 估值參考。ETF 若無有效估值資料不列為已補值。", twsePerValue !== null ? `${twsePer.source}${twseOfficialDate ? `（${normalizeValidationDate(twseOfficialDate)}）` : ""}` : noCompare, finPerValue !== null ? `${finPer.source}（FinMind 驗證）` : googlePerValue !== null ? `${googlePer.source}（參考）` : noCompare, twsePerValue !== null && (finPerValue !== null || googlePerValue !== null) ? {} : { statusOverride: twsePerValue !== null ? "已補值" : undefined }) : null,
    showValuationRows ? compareSourceValue("PBR", twsePbrValue, finPbrValue, 5, "PBR 主值收斂到 TWSE 官方 BWIBBU；FinMind 僅作驗證或 fallback 參考。ETF 若來源值為 0 或空值視為缺值，不列為已補值。", twsePbrValue !== null ? `${twsePbr.source}${twseOfficialDate ? `（${normalizeValidationDate(twseOfficialDate)}）` : ""}` : noCompare, finPbrValue !== null ? finPbr.source : noCompare, twsePbrValue !== null && finPbrValue !== null ? {} : { statusOverride: twsePbrValue !== null ? "已補值" : undefined }) : null,
    showValuationRows ? compareSourceValue("殖利率 dividendYield", twseDividendYieldValue, finDividendYieldValue, 5, "殖利率主值收斂到 TWSE 官方 BWIBBU；FinMind 財報/估值欄位只在有有效正值時作驗證，0/null 視為缺值不硬比。", twseDividendYieldValue !== null ? `${twseDividendYield.source}${twseOfficialDate ? `（${normalizeValidationDate(twseOfficialDate)}）` : ""}` : noCompare, finDividendYieldValue !== null ? `${finDividendYield.source}（FinMind 驗證）` : noCompare, twseDividendYieldValue !== null && finDividendYieldValue !== null ? {} : { noCompare: twseDividendYieldValue !== null, statusOverride: twseDividendYieldValue !== null ? "不比對" : undefined }) : null,

    (!isEtf ? compareSourceValue("季度 EPS", finEps.value, null, 0, "FinMind 財報單季 EPS；GoogleFinance EPS 常是估值 / TTM 口徑，已從主要比對列移除，避免單季 EPS 與估值口徑混比。", finEps.value !== null ? `${finEps.source}（財報單季）` : "FinMind 財報 EPS（待 fundamental）", noCompare, { noCompare: true, statusOverride: finEps.value !== null ? "已補值" : undefined }) : null),

    compareSourceValue("5MA", twseHistoryMa5.value !== null ? twseHistoryMa5.value : main.ma5, finMa5.value !== null ? finMa5.value : googleMa5Value, 1.5, "主值改用 TWSE snapshot 自算；FinMind 做驗證 / 備援，Google 只作參考。", twseHistoryMa5.value !== null ? `${twseHistoryMa5.source}（TWSE snapshot 自算）` : getFieldSource(main, "ma5"), finMa5.value !== null ? `${finMa5.source}（FinMind 驗證）` : googleMa5Source),
    compareSourceValue("20MA", twseHistoryMa20.value !== null ? twseHistoryMa20.value : main.ma20, finMa20.value !== null ? finMa20.value : googleMa20Value, 1.5, "主值改用 TWSE snapshot 自算；FinMind 做驗證 / 備援，Google 只作參考。", twseHistoryMa20.value !== null ? `${twseHistoryMa20.source}（TWSE snapshot 自算）` : getFieldSource(main, "ma20"), finMa20.value !== null ? `${finMa20.source}（FinMind 驗證）` : googleMa20Source),
    compareSourceValue("60MA", twseHistoryMa60.value !== null ? twseHistoryMa60.value : main.ma60, finMa60.value, 1, "主值改用 TWSE snapshot 自算；FinMind 做驗證 / 備援。", twseHistoryMa60.value !== null ? `${twseHistoryMa60.source}（TWSE snapshot 自算）` : getFieldSource(main, "ma60"), finMa60.value !== null ? `${finMa60.source}（FinMind 驗證）` : noCompare, { statusOverride: twseHistoryMa60.value !== null ? undefined : "已補值" }),
    compareSourceValue("RSI14", twseHistoryRsi14.value !== null ? twseHistoryRsi14.value : main.rsi14, finRsi14.value, 3, "TWSE Snapshot 本機日線自算 RSI14；FinMind RSI 為不同口徑驗證，偏差僅供觀察，不代表 TWSE 自算錯。", twseHistoryRsi14.value !== null ? `${twseHistoryRsi14.source}（TWSE snapshot 自算）` : getFieldSource(main, "rsi14"), finRsi14.value !== null ? `${finRsi14.source}（FinMind 驗證）` : noCompare, { compareMode: "abs", toleranceLabel: "±3點", statusOverrideAfterCompare: twseHistoryRsi14.value !== null && finRsi14.value !== null ? "口徑差異" : undefined, statusOverride: twseHistoryRsi14.value !== null && finRsi14.value === null ? "已補值" : undefined }),
    compareSourceValue("20日高點 high20", twseHistoryHigh20.value !== null ? twseHistoryHigh20.value : main.high20, finHigh20.value, 1, "主值改用 TWSE snapshot 自算；FinMind 做驗證 / 備援。", twseHistoryHigh20.value !== null ? `${twseHistoryHigh20.source}（TWSE snapshot 自算）` : getFieldSource(main, "high20"), finHigh20.value !== null ? `${finHigh20.source}（FinMind 驗證）` : noCompare, { statusOverride: twseHistoryHigh20.value !== null ? undefined : "已補值" }),
    compareSourceValue("20日低點 low20", twseHistoryLow20.value !== null ? twseHistoryLow20.value : main.low20, finLow20.value, 1, "主值改用 TWSE snapshot 自算；FinMind 做驗證 / 備援。", twseHistoryLow20.value !== null ? `${twseHistoryLow20.source}（TWSE snapshot 自算）` : getFieldSource(main, "low20"), finLow20.value !== null ? `${finLow20.source}（FinMind 驗證）` : noCompare, { statusOverride: twseHistoryLow20.value !== null ? undefined : "已補值" }),
    compareSourceValue("20日均量 avgVolume20", twseHistoryAvgVolume20Value !== null ? twseHistoryAvgVolume20Value : main.avgVolume20, finAvgVolume20.value, 3, "20日均量主值同步改用 TWSE STOCK_DAY snapshot 自算；FinMind 做驗證 / 備援，Google 不作主量能基準。", twseHistoryAvgVolume20Value !== null ? `${twseHistoryAvgVolume20Source}（TWSE snapshot 自算20日量均）` : getFieldSource(main, "avgVolume20"), finAvgVolume20.value !== null ? `${finAvgVolume20.source}（FinMind 驗證）` : noCompare, twseHistoryAvgVolume20Value !== null && finAvgVolume20.value !== null ? {} : { statusOverride: twseHistoryAvgVolume20Value !== null || main.avgVolume20 ? "已補值" : undefined }),
    compareSourceValue("20日報酬 return20d", twseHistoryReturn20d.value !== null ? twseHistoryReturn20d.value : main.return20d, finReturn20d.value, 3, "主值改用 TWSE snapshot 自算；FinMind 做驗證 / 備援。", twseHistoryReturn20d.value !== null ? `${twseHistoryReturn20d.source}（TWSE snapshot 自算）` : getFieldSource(main, "return20d"), finReturn20d.value !== null ? `${finReturn20d.source}（FinMind 驗證）` : noCompare, { statusOverride: twseHistoryReturn20d.value !== null ? undefined : "已補值" }),
    compareSourceValue("60日報酬 return60d", twseHistoryReturn60d.value !== null ? twseHistoryReturn60d.value : main.return60d, finReturn60d.value, 3, "主值改用 TWSE snapshot 自算；FinMind 做驗證 / 備援。", twseHistoryReturn60d.value !== null ? `${twseHistoryReturn60d.source}（TWSE snapshot 自算）` : getFieldSource(main, "return60d"), finReturn60d.value !== null ? `${finReturn60d.source}（FinMind 驗證）` : noCompare, { statusOverride: twseHistoryReturn60d.value !== null ? undefined : "已補值" }),
    compareSourceValue("技術預熱 priceRowCount", twseHistoryPriceRowCount.value !== null ? twseHistoryPriceRowCount.value : main.priceRowCount, null, 0, "確認 TWSE snapshot row count 是否達 MACD / KD / ATR warm-up 有效評分門檻；MACD / ATR 至少 100 筆、KD 至少 40 筆交易日。", twseHistoryPriceRowCount.value !== null ? withSourceDate(twseHistoryPriceRowCount.source, twseHistoryDate, "snapshot rows") : withSourceDate(getFieldSource(main, "priceRowCount"), twseHistoryDate), "接入確認", { statusOverride: "接入確認", toleranceLabel: "需達門檻" }),
    compareSourceValue("收盤價抽樣", twseHistoryDailyClose.value !== null ? twseHistoryDailyClose.value : finDailyClose.value, finDailyClose.value, 0.1, "TWSE Snapshot OHLCV 已作為本機日線主資料；FinMind OHLCV 作驗證 / 備援。Yahoo OHLCV 降級為 debug / rescue，不作主要驗證列。", twseHistoryDailyClose.value !== null ? `${twseHistoryDailyClose.source}（TWSE snapshot OHLCV）` : "FinMind OHLCV 備援", finDailyClose.value !== null ? `${finDailyClose.source}（FinMind 驗證）` : noCompare, { toleranceLabel: "±0.1%", statusOverride: twseHistoryDailyClose.value !== null && finDailyClose.value === null ? "已補值" : undefined }),
    compareSourceValue("開盤價抽樣", twseHistoryDailyOpen.value !== null ? twseHistoryDailyOpen.value : finDailyOpen.value, finDailyOpen.value, 0.1, "TWSE Snapshot OHLCV 已作為本機日線主資料；FinMind OHLCV 作驗證 / 備援。", twseHistoryDailyOpen.value !== null ? `${twseHistoryDailyOpen.source}（TWSE snapshot OHLCV）` : "FinMind OHLCV 備援", finDailyOpen.value !== null ? `${finDailyOpen.source}（FinMind 驗證）` : noCompare, { toleranceLabel: "±0.1%", statusOverride: twseHistoryDailyOpen.value !== null && finDailyOpen.value === null ? "已補值" : undefined }),
    compareSourceValue("最高價抽樣", twseHistoryDailyHigh.value !== null ? twseHistoryDailyHigh.value : finDailyHigh.value, finDailyHigh.value, 0.1, "TWSE Snapshot OHLCV 已作為本機日線主資料；FinMind OHLCV 作驗證 / 備援。", twseHistoryDailyHigh.value !== null ? `${twseHistoryDailyHigh.source}（TWSE snapshot OHLCV）` : "FinMind OHLCV 備援", finDailyHigh.value !== null ? `${finDailyHigh.source}（FinMind 驗證）` : noCompare, { toleranceLabel: "±0.1%", statusOverride: twseHistoryDailyHigh.value !== null && finDailyHigh.value === null ? "已補值" : undefined }),
    compareSourceValue("最低價抽樣", twseHistoryDailyLow.value !== null ? twseHistoryDailyLow.value : finDailyLow.value, finDailyLow.value, 0.1, "TWSE Snapshot OHLCV 已作為本機日線主資料；FinMind OHLCV 作驗證 / 備援。", twseHistoryDailyLow.value !== null ? `${twseHistoryDailyLow.source}（TWSE snapshot OHLCV）` : "FinMind OHLCV 備援", finDailyLow.value !== null ? `${finDailyLow.source}（FinMind 驗證）` : noCompare, { toleranceLabel: "±0.1%", statusOverride: twseHistoryDailyLow.value !== null && finDailyLow.value === null ? "已補值" : undefined }),

    (isEtf ? compareSourceValue("ETF TWSE MIS displayPrice", twseMisMainPriceValue, null, 0, twseMisDisplayPriceType.value === "mid" ? "TWSE MIS z 缺值時，以五檔中間價作參考；不視為正式成交價。" : "TWSE MIS ETF 即時成交價 / 顯示價。", twseMisMainPriceValue !== null ? `${twseMisMainPriceSource}${twseMisTimeLabel}` : noCompare, "輔助資料", { statusOverride: twseMisMainPriceValue !== null ? "已補值" : undefined, toleranceLabel: "輔助" }) : null),
    (isEtf ? compareSourceValue("ETF TWSE MIS 成交量", twseMisVolume.value, null, 0, "TWSE MIS ETF 盤中成交量；用於流動性與價差陷阱判斷，不進短線分數。", twseMisVolume.value !== null ? `${twseMisVolume.source}${twseMisTimeLabel}` : noCompare, "輔助資料", { statusOverride: twseMisVolume.value !== null ? "已補值" : undefined, toleranceLabel: "輔助" }) : null),
    (isEtf ? compareSourceValue("ETF displayPriceType", twseMisDisplayPriceType.value ? 1 : null, null, 0, twseMisDisplayPriceType.value ? `顯示價型態：${twseMisDisplayPriceType.value}；last 為成交價，mid 為五檔中間參考價。` : "尚未取得 ETF 顯示價型態。", twseMisDisplayPriceType.value ? `TWSE MIS ${twseMisDisplayPriceType.value}` : noCompare, "輔助資料", { statusOverride: twseMisDisplayPriceType.value ? "已補值" : undefined, toleranceLabel: "輔助" }) : null),
    (isEtf ? compareSourceValue("ETF 即時估值", officialEtfDisplay.estimatedNav, null, 0, "ETF 官方即時估值；用於折溢價與追價風險判斷，不進短線分數。", officialEtfDisplay.estimatedNav !== null && officialEtfDisplay.estimatedNav !== undefined ? officialEtfDisplay.source : noCompare, "輔助資料", { statusOverride: officialEtfDisplay.estimatedNav !== null && officialEtfDisplay.estimatedNav !== undefined ? "已補值" : undefined, toleranceLabel: "輔助" }) : null),
    (isEtf ? compareSourceValue("ETF 即時市價", officialEtfDisplay.latestPrice, twseMisMainPriceValue, 0.3, "ETF 官方即時市價需接近 TWSE MIS 主行情；兩者接近代表小卡市價口徑可信。", officialEtfDisplay.latestPrice !== null && officialEtfDisplay.latestPrice !== undefined ? officialEtfDisplay.source : noCompare, twseMisMainPriceValue !== null ? `${twseMisMainPriceSource}${twseMisTimeLabel}` : noCompare, { statusOverride: officialEtfDisplay.latestPrice !== null && officialEtfDisplay.latestPrice !== undefined ? undefined : "缺值", toleranceLabel: "±0.3%" }) : null),
    (isEtf ? compareSourceValue("ETF 前日淨值", officialEtfDisplay.referenceNav, null, 0, officialEtfDisplay.navDate ? `官方前日淨值日期：${officialEtfDisplay.navDate}。` : "官方前日淨值日期尚未更新。", officialEtfDisplay.referenceNav !== null && officialEtfDisplay.referenceNav !== undefined ? officialEtfDisplay.source : noCompare, "輔助資料", { statusOverride: officialEtfDisplay.referenceNav !== null && officialEtfDisplay.referenceNav !== undefined ? "已補值" : undefined, toleranceLabel: "輔助" }) : null),
    (isEtf ? compareSourceValue("ETF 折溢價%", officialEtfDisplay.premiumDiscountPct, null, 0, "官方即時折溢價；用於觀察追價或折價，不作短線分數。", officialEtfDisplay.premiumDiscountPct !== null && officialEtfDisplay.premiumDiscountPct !== undefined ? officialEtfDisplay.source : noCompare, "輔助資料", { statusOverride: officialEtfDisplay.premiumDiscountPct !== null && officialEtfDisplay.premiumDiscountPct !== undefined ? "已補值" : undefined, compareMode: "abs", toleranceLabel: "輔助" }) : null),
    (isEtf ? compareSourceValue("ETF 估值來源", officialEtfDisplay.estimatedNav !== null && officialEtfDisplay.estimatedNav !== undefined ? 1 : null, null, 0, officialEtfDisplay.adapter ? "官方即時估值已同步；可用於折溢價與市價一致性檢查。" : "官方即時估值尚未同步。", officialEtfDisplay.estimatedNav !== null && officialEtfDisplay.estimatedNav !== undefined ? "ETF 即時估值" : noCompare, "輔助資料", { statusOverride: officialEtfDisplay.estimatedNav !== null && officialEtfDisplay.estimatedNav !== undefined ? "已補值" : undefined, toleranceLabel: "輔助" }) : null),

    compareSourceValue("MACD", twseHistoryMacd.value !== null ? twseHistoryMacd.value : finMacd.value, finMacd.value, 2, "TWSE Snapshot 本機日線自算 MACD；FinMind 同指標作驗證 / 備援。Yahoo OHLCV 保留救援抽樣，不作主驗證列。", twseHistoryMacd.value !== null ? `${twseHistoryMacd.source}（TWSE snapshot 自算）` : "FinMind 備援", finMacd.value !== null ? `${finMacd.source}（FinMind 驗證）` : noCompare, { compareMode: "abs", toleranceLabel: "±2.00", statusOverride: twseHistoryMacd.value !== null ? undefined : "已補值" }),
    compareSourceValue("MACD Signal", twseHistoryMacdSignal.value !== null ? twseHistoryMacdSignal.value : finMacdSignal.value, finMacdSignal.value, 2, "TWSE Snapshot 本機日線自算 MACD Signal；FinMind 同指標作驗證 / 備援。", twseHistoryMacdSignal.value !== null ? `${twseHistoryMacdSignal.source}（TWSE snapshot 自算）` : "FinMind 備援", finMacdSignal.value !== null ? `${finMacdSignal.source}（FinMind 驗證）` : noCompare, { compareMode: "abs", toleranceLabel: "±2.00", statusOverride: twseHistoryMacdSignal.value !== null ? undefined : "已補值" }),
    compareSourceValue("MACD Hist", twseHistoryMacdHist.value !== null ? twseHistoryMacdHist.value : finMacdHist.value, finMacdHist.value, 1, "TWSE Snapshot 本機日線自算 MACD Hist；FinMind 同指標作驗證 / 備援。", twseHistoryMacdHist.value !== null ? `${twseHistoryMacdHist.source}（TWSE snapshot 自算）` : "FinMind 備援", finMacdHist.value !== null ? `${finMacdHist.source}（FinMind 驗證）` : noCompare, { compareMode: "abs", toleranceLabel: "±1.00", statusOverride: twseHistoryMacdHist.value !== null ? undefined : "已補值" }),
    compareSourceValue("MACD 3日Δ", twseHistoryMacdHistDelta3.value !== null ? twseHistoryMacdHistDelta3.value : finMacdHistDelta3.value, finMacdHistDelta3.value, 1.5, "TWSE Snapshot 本機日線自算 MACD 3日變化；FinMind 同指標作驗證 / 備援。", twseHistoryMacdHistDelta3.value !== null ? `${twseHistoryMacdHistDelta3.source}（TWSE snapshot 自算）` : "FinMind 備援", finMacdHistDelta3.value !== null ? `${finMacdHistDelta3.source}（FinMind 驗證）` : noCompare, { compareMode: "abs", toleranceLabel: "±1.50", statusOverride: twseHistoryMacdHistDelta3.value !== null ? undefined : "已補值" }),
    compareSourceValue("KD K9", twseHistoryK9.value !== null ? twseHistoryK9.value : finK9.value, finK9.value, 2, "TWSE Snapshot 本機日線自算 KD K；FinMind 同指標作驗證 / 備援。", twseHistoryK9.value !== null ? `${twseHistoryK9.source}（TWSE snapshot 自算）` : "FinMind 備援", finK9.value !== null ? `${finK9.source}（FinMind 驗證）` : noCompare, { compareMode: "abs", toleranceLabel: "±2點", statusOverride: twseHistoryK9.value !== null ? undefined : "已補值" }),
    compareSourceValue("KD D9", twseHistoryD9.value !== null ? twseHistoryD9.value : finD9.value, finD9.value, 2, "TWSE Snapshot 本機日線自算 KD D；FinMind 同指標作驗證 / 備援。", twseHistoryD9.value !== null ? `${twseHistoryD9.source}（TWSE snapshot 自算）` : "FinMind 備援", finD9.value !== null ? `${finD9.source}（FinMind 驗證）` : noCompare, { compareMode: "abs", toleranceLabel: "±2點", statusOverride: twseHistoryD9.value !== null ? undefined : "已補值" }),
    compareSourceValue("KD J9", twseHistoryJ9.value !== null ? twseHistoryJ9.value : finJ9.value, finJ9.value, 2.5, "TWSE Snapshot 本機日線自算 KD J；FinMind 同指標作驗證 / 備援。", twseHistoryJ9.value !== null ? `${twseHistoryJ9.source}（TWSE snapshot 自算）` : "FinMind 備援", finJ9.value !== null ? `${finJ9.source}（FinMind 驗證）` : noCompare, { compareMode: "abs", toleranceLabel: "±2.5點", statusOverride: twseHistoryJ9.value !== null ? undefined : "已補值" }),
    compareSourceValue("ATR14", twseHistoryAtr14.value !== null ? twseHistoryAtr14.value : finAtr14.value, finAtr14.value, 5, "TWSE Snapshot 本機日線自算 ATR14；FinMind 同指標作驗證 / 備援。", twseHistoryAtr14.value !== null ? `${twseHistoryAtr14.source}（TWSE snapshot 自算）` : "FinMind 備援", finAtr14.value !== null ? `${finAtr14.source}（FinMind 驗證）` : noCompare, { toleranceLabel: "±5%", statusOverride: twseHistoryAtr14.value !== null ? undefined : "已補值" }),
    compareSourceValue("ATR%", twseHistoryAtrPct.value !== null ? twseHistoryAtrPct.value : finAtrPct.value, finAtrPct.value, 0.2, "TWSE Snapshot 本機日線自算 ATR%；FinMind 同指標作驗證 / 備援。", twseHistoryAtrPct.value !== null ? `${twseHistoryAtrPct.source}（TWSE snapshot 自算）` : "FinMind 備援", finAtrPct.value !== null ? `${finAtrPct.source}（FinMind 驗證）` : noCompare, { compareMode: "abs", toleranceLabel: "±0.20點", statusOverride: twseHistoryAtrPct.value !== null ? undefined : "已補值" }),
    compareSourceValue("ATR% 20日均值", twseHistoryAtrPctAvg20.value !== null ? twseHistoryAtrPctAvg20.value : finAtrPctAvg20.value, finAtrPctAvg20.value, 0.2, "TWSE Snapshot 本機日線自算 ATR% 20日均值；FinMind 同指標作驗證 / 備援。", twseHistoryAtrPctAvg20.value !== null ? `${twseHistoryAtrPctAvg20.source}（TWSE snapshot 自算）` : "FinMind 備援", finAtrPctAvg20.value !== null ? `${finAtrPctAvg20.source}（FinMind 驗證）` : noCompare, { compareMode: "abs", toleranceLabel: "±0.20點", statusOverride: twseHistoryAtrPctAvg20.value !== null ? undefined : "已補值" }),
    compareSourceValue("ATR% 偏離20均", twseHistoryAtrPctVsAvg20.value !== null ? twseHistoryAtrPctVsAvg20.value : finAtrPctVsAvg20.value, finAtrPctVsAvg20.value, 2, "TWSE Snapshot 本機日線自算 ATR% 偏離；FinMind 同指標作驗證 / 備援。", twseHistoryAtrPctVsAvg20.value !== null ? `${twseHistoryAtrPctVsAvg20.source}（TWSE snapshot 自算）` : "FinMind 備援", finAtrPctVsAvg20.value !== null ? `${finAtrPctVsAvg20.source}（FinMind 驗證）` : noCompare, { compareMode: "abs", toleranceLabel: "±2點", statusOverride: twseHistoryAtrPctVsAvg20.value !== null ? undefined : "已補值" }),

        compareSourceValue("外資3日 foreign3d", main.foreign3d, finForeign3d.value, 0.1, "FinMind 三大法人資料。", getFieldSource(main, "foreign3d"), finForeign3d.value !== null ? finForeign3d.source : noCompare, { statusOverride: "已補值" }),
    compareSourceValue("投信3日 trust3d", main.trust3d, finTrust3d.value, 0.1, "FinMind 三大法人資料。", getFieldSource(main, "trust3d"), finTrust3d.value !== null ? finTrust3d.source : noCompare, { statusOverride: "已補值" }),
    compareSourceValue("自營商3日 dealer3d", main.dealer3d, finDealer3d.value, 0.1, "FinMind 三大法人資料。", getFieldSource(main, "dealer3d"), finDealer3d.value !== null ? finDealer3d.source : noCompare, { statusOverride: "已補值" }),
    compareSourceValue("三大法人3日 institutional3d", main.institutional3d, finInstitutional3d.value, 0.1, "FinMind 三大法人合計。", getFieldSource(main, "institutional3d"), finInstitutional3d.value !== null ? finInstitutional3d.source : noCompare, { statusOverride: "已補值" }),
    compareSourceValue("外資20日 foreign20d", main.foreign20d, finForeign20d.value, 0.1, "FinMind 三大法人資料。", getFieldSource(main, "foreign20d"), finForeign20d.value !== null ? finForeign20d.source : noCompare, { statusOverride: "已補值" }),
    compareSourceValue("投信20日 trust20d", main.trust20d, finTrust20d.value, 0.1, "FinMind 三大法人資料。", getFieldSource(main, "trust20d"), finTrust20d.value !== null ? finTrust20d.source : noCompare, { statusOverride: "已補值" }),
    compareSourceValue("自營商20日 dealer20d", main.dealer20d, finDealer20d.value, 0.1, "FinMind 三大法人資料。", getFieldSource(main, "dealer20d"), finDealer20d.value !== null ? finDealer20d.source : noCompare, { statusOverride: "已補值" }),
    compareSourceValue("三大法人20日 institutional20d", main.institutional20d, finInstitutional20d.value, 0.1, "FinMind 三大法人合計。", getFieldSource(main, "institutional20d"), finInstitutional20d.value !== null ? finInstitutional20d.source : noCompare, { statusOverride: "已補值" }),

    compareSourceValue("融資5日 marginChange5dPct", main.marginChange5dPct, finMargin5.value, 0.1, "FinMind 融資融券資料。", getFieldSource(main, "marginChange5dPct"), finMargin5.value !== null ? finMargin5.source : noCompare, { statusOverride: "已補值" }),
    compareSourceValue("融資20日 marginChange20dPct", main.marginChange20dPct, finMargin20.value, 0.1, "FinMind 融資融券資料。", getFieldSource(main, "marginChange20dPct"), finMargin20.value !== null ? finMargin20.source : noCompare, { statusOverride: "已補值" }),
    compareSourceValue("融券5日 shortSaleChange5dPct", main.shortSaleChange5dPct, finShort5.value, 0.1, "FinMind 融資融券資料。", getFieldSource(main, "shortSaleChange5dPct"), finShort5.value !== null ? finShort5.source : noCompare, { statusOverride: "已補值" }),
    compareSourceValue("融券20日 shortSaleChange20dPct", main.shortSaleChange20dPct, finShort20.value, 0.1, "FinMind 融資融券資料。", getFieldSource(main, "shortSaleChange20dPct"), finShort20.value !== null ? finShort20.source : noCompare, { statusOverride: "已補值" }),

    (!isEtf ? compareSourceValue("月營收 MoM revenueMoM", main.revenueMoM, finRevenueMoM.value, 0.1, "FinMind 月營收資料。ETF 可能無此欄位。", getFieldSource(main, "revenueMoM"), finRevenueMoM.value !== null ? finRevenueMoM.source : noCompare, { statusOverride: "已補值" }) : null),
    (!isEtf ? compareSourceValue("月營收 YoY revenueYoY", main.revenueYoY, finRevenueYoY.value, 0.1, "FinMind 月營收資料。ETF 可能無此欄位。", getFieldSource(main, "revenueYoY"), finRevenueYoY.value !== null ? finRevenueYoY.source : noCompare, { statusOverride: "已補值" }) : null),
    (!isEtf ? compareSourceValue("EPS 成長 epsGrowthYoY", main.epsGrowthYoY, finEpsGrowth.value, 0.1, "FinMind 財報資料。ETF 可能無此欄位。", getFieldSource(main, "epsGrowthYoY"), finEpsGrowth.value !== null ? finEpsGrowth.source : noCompare, { statusOverride: "已補值" }) : null),
    (!isEtf ? compareSourceValue("TWSE 隱含 EPS TTM", twseImpliedEpsTtmValue, finEpsTtm.value, 0.2, "TWSE official close / PER 反推近四季 EPS TTM；FinMind EPS TTM 作驗證。這列取代 GoogleFinance EPS 口徑，避免單季 EPS 與估值 EPS 混比。", twseImpliedEpsTtmValue !== null ? twseImpliedEpsTtmSource : noCompare, finEpsTtm.value !== null ? `${finEpsTtm.source}（FinMind 驗證）` : noCompare, twseImpliedEpsTtmValue !== null && finEpsTtm.value !== null ? { compareMode: "abs", toleranceLabel: "±0.2" } : { statusOverride: twseImpliedEpsTtmValue !== null ? "已補值" : undefined }) : null),
    (!isEtf ? compareSourceValue("EPS TTM 成長 epsTtmGrowthYoY", main.epsTtmGrowthYoY, finEpsTtmGrowth.value, 0.1, "近四季 EPS 年增率；用於觀察獲利趨勢，不進短線分數。", getFieldSource(main, "epsTtmGrowthYoY"), finEpsTtmGrowth.value !== null ? finEpsTtmGrowth.source : noCompare, { statusOverride: "已補值" }) : null),
    (!isEtf ? compareSourceValue("ROE TTM", main.roeTtm ?? main.roe, finRoeTtm.value, 0.1, "以近四季稅後淨利與最新股東權益估算 ROE；用於品質檢查，不進短線分數。", getFieldSource(main, "roeTtm"), finRoeTtm.value !== null ? finRoeTtm.source : noCompare, { statusOverride: "已補值" }) : null),
    (!isEtf ? compareSourceValue("毛利率 grossMargin", main.grossMargin, finGrossMargin.value, 0.1, "FinMind 財報資料。ETF 可能無此欄位。", getFieldSource(main, "grossMargin"), finGrossMargin.value !== null ? finGrossMargin.source : noCompare, { statusOverride: "已補值" }) : null),
    (!isEtf ? compareSourceValue("毛利率 QoQ 變化", main.grossMarginQoQ, finGrossMarginQoQ.value, 0.1, "最新季度毛利率較前一季變化，單位為百分點；用於觀察品質趨勢。", getFieldSource(main, "grossMarginQoQ"), finGrossMarginQoQ.value !== null ? finGrossMarginQoQ.source : noCompare, { statusOverride: "已補值", compareMode: "abs", toleranceLabel: "資料補值" }) : null),
    (!isEtf ? compareSourceValue("營益率 operatingMargin", main.operatingMargin, finOperatingMargin.value, 0.1, "FinMind 財報資料。ETF 可能無此欄位。", getFieldSource(main, "operatingMargin"), finOperatingMargin.value !== null ? finOperatingMargin.source : noCompare, { statusOverride: "已補值" }) : null),
    (!isEtf ? compareSourceValue("營益率 QoQ 變化", main.operatingMarginQoQ, finOperatingMarginQoQ.value, 0.1, "最新季度營益率較前一季變化，單位為百分點；用於觀察營運效率趨勢。", getFieldSource(main, "operatingMarginQoQ"), finOperatingMarginQoQ.value !== null ? finOperatingMarginQoQ.source : noCompare, { statusOverride: "已補值", compareMode: "abs", toleranceLabel: "資料補值" }) : null),
    (!isEtf ? compareSourceValue("淨利率 netMargin", main.netMargin, finNetMargin.value, 0.1, "最新季度淨利率；用於獲利品質背景，不進短線分數。", getFieldSource(main, "netMargin"), finNetMargin.value !== null ? finNetMargin.source : noCompare, { statusOverride: "已補值" }) : null),
    (!isEtf ? compareSourceValue("負債比 debtRatio", main.debtRatio, finDebtRatio.value, 0.1, "FinMind 資產負債資料。ETF 可能無此欄位。", getFieldSource(main, "debtRatio"), finDebtRatio.value !== null ? finDebtRatio.source : noCompare, { statusOverride: "已補值" }) : null),
    (!isEtf ? compareSourceValue("財報季度數 financialQuarterCount", main.financialQuarterCount, finFinancialQuarterCount.value, 0, "確認近四季 EPS / TTM / ROE 是否有足夠財報序列；不作交叉驗證。", getFieldSource(main, "financialQuarterCount"), finFinancialQuarterCount.value !== null ? finFinancialQuarterCount.source : noCompare, { statusOverride: "接入確認", toleranceLabel: "需足夠" }) : null),

    compareSourceValue("Nasdaq 一日變化", mainNasdaqPct, googleNasdaqPct, 0.05, "FinMind Market 為市場風險主資料；GoogleFinance 僅作 optional 參考差異，不判定主資料錯誤。", withSourceDate(getFieldSource(main, "nasdaqReturn1d"), marketUsDate), googleNasdaqPct !== null ? withSourceDate(googleNasdaq.source, googleMarketDate, "參考") : noCompare, googleNasdaqPct !== null ? { compareMode: "abs", toleranceLabel: "參考", statusOverrideAfterCompare: "參考差異" } : { compareMode: "abs", toleranceLabel: "參考" } ),
    compareSourceValue("SOX 一日變化", mainSoxPct, googleSoxPct, 0.05, "FinMind Market 為市場風險主資料；GoogleFinance 僅作 optional 參考差異，不判定主資料錯誤。", withSourceDate(getFieldSource(main, "soxReturn1d"), marketUsDate), googleSoxPct !== null ? withSourceDate(googleSox.source, googleMarketDate, "參考") : noCompare, googleSoxPct !== null ? { compareMode: "abs", toleranceLabel: "參考", statusOverrideAfterCompare: "參考差異" } : { compareMode: "abs", toleranceLabel: "參考" } ),
    compareSourceValue("台指期盤後 taifexAfterHoursReturn", mainTaifexPct, googleTaifexPct, 0.1, "主資料用 FinMind Derivatives；GoogleFinance 沒有穩定台指期盤後欄位時不比對，只列參考。若 Sheet 有填，會先統一為百分點格式。", withSourceDate(getFieldSource(main, "taifexAfterHoursReturn"), derivativesDate), googleTaifexPct !== null ? withSourceDate(googleTaifex.source, googleMarketDate, "參考，不比對") : getSourceName("none"), { compareMode: "abs", toleranceLabel: "±0.10點", noCompare: true }),
    compareSourceValue("VIX 一日變化", mainVixPctRaw, googleVixPct, 0.1, "FinMind Market 為 VIX 風險主資料；GoogleFinance 僅作 optional 參考差異，並保留小數點位移防呆。", withSourceDate(getFieldSource(main, "vixChange1d"), marketUsDate), googleVixPct !== null ? withSourceDate(googleVix.source, googleMarketDate, "參考") : getSourceName("none"), googleVixPct !== null ? { compareMode: "abs", toleranceLabel: "參考", statusOverrideAfterCompare: "參考差異" } : { compareMode: "abs", toleranceLabel: "參考" } ),
  ];

  const validationDateLabelContext = {
    noCompare,
    twseHistoryDate,
    finmindScoreDate,
    finmindInstitutionalDate,
    finmindMarginDate,
    finmindRevenueDate,
    finmindFinancialDate,
    twseMisTradetime: twseMisTradetime.value,
    officialEtfDisplay,
    officialEtfDataDate,
    twseMisDate,
    twseMisDisplayPriceType: twseMisDisplayPriceType.value,
  };

  const normalizedRows = cleanupFinMindOnlyValidationRows(rows.filter(Boolean)).map((row) => attachValidationDateLabels(row, validationDateLabelContext));
  return applyTwsePreOpenValidationStatus(normalizedRows, isTwseMisPreOpen, twseMisTradetime.value);
}


function getShortRecommendation(total, stopLoss) {
  if (stopLoss?.quotePending) return { label: "等待盤中價", tone: "bg-slate-100 text-slate-700" };
  if (stopLoss?.triggered) return { label: "停損警示 / 不追價", tone: "bg-red-100 text-red-800" };
  if (total >= 0.85) return { label: "強力買入 / 適合短線做多", tone: "bg-emerald-100 text-emerald-800" };
  if (total >= 0.7) return { label: "偏多 / 可分批試單", tone: "bg-lime-100 text-lime-800" };
  if (total >= 0.55) return { label: "橫盤觀望 / 等確認", tone: "bg-yellow-100 text-yellow-800" };
  if (total >= 0.4) return { label: "偏弱 / 不追價", tone: "bg-orange-100 text-orange-800" };
  return { label: "避開 / 等待轉強", tone: "bg-red-100 text-red-800" };
}

function getCompactRecommendation(recommendation) {
  const label = String(recommendation?.label || "");
  if (label.includes("等待盤中")) return "待價";
  if (label.includes("停損")) return "不追";
  if (label.includes("強力")) return "買進";
  if (label.includes("偏多")) return "偏多";
  if (label.includes("觀望")) return "觀望";
  if (label.includes("偏弱")) return "偏弱";
  if (label.includes("避開")) return "避開";
  return label.split("/")[0]?.trim() || "觀察";
}


function getDimensionShortPhrase(name, scorePct) {
  const score = Number(scorePct);
  const label = String(name || "");
  const subject = label.includes("市場") ? "市場" : label.includes("資金") ? "資金" : label.includes("籌碼") ? "籌碼" : "技術";
  if (!Number.isFinite(score)) return `${subject}待確認`;
  if (subject === "市場") {
    if (score >= 70) return "市場支撐";
    if (score >= 50) return "市場中性";
    return "市場偏弱";
  }
  if (subject === "資金") {
    if (score >= 70) return "資金支撐";
    if (score >= 50) return "資金中性";
    return "資金偏弱";
  }
  if (subject === "籌碼") {
    if (score >= 70) return "籌碼支撐";
    if (score >= 50) return "籌碼中性";
    return "籌碼偏弱";
  }
  if (score >= 70) return "技術偏多";
  if (score >= 50) return "技術中性";
  return "技術偏弱";
}

function getValidationCompactLabel(validationState) {
  const label = String(validationState?.label || "");
  if (!label) return "未確認";
  if (label.includes("盤前")) return TWSE_PREOPEN_STATUS;
  if (label.includes("通過")) return "通過";
  if (label.includes("日期")) return "日期未對齊";
  if (label.includes("參考")) return "參考差異";
  if (label.includes("需查") || label.includes("需")) return "需查";
  if (label.includes("缺")) return "缺資料";
  if (label.includes("已補")) return "已補值";
  if (label.includes("接入")) return "接入確認";
  if (label.includes("不比對")) return "不比對";
  return label.replace(/\s+/g, "");
}

function getValidationCompactTone(validationState) {
  return validationStatusClassForDisplay(getValidationCompactLabel(validationState));
}

function getValidationProductMeta(validationState) {
  const label = getValidationCompactLabel(validationState);
  if (label.includes("盤前")) {
    return {
      pill: "border border-sky-200/85 bg-[linear-gradient(180deg,rgba(240,249,255,0.98)_0%,rgba(224,242,254,0.88)_100%)] text-sky-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_4px_10px_rgba(14,165,233,0.11)]",
      dot: "bg-sky-500 shadow-[0_0_0_3px_rgba(14,165,233,0.14)]",
    };
  }
  if (label.includes("通過")) {
    return {
      pill: "border border-emerald-200/85 bg-[linear-gradient(180deg,rgba(236,253,245,0.98)_0%,rgba(209,250,229,0.86)_100%)] text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_4px_10px_rgba(16,185,129,0.12)]",
      dot: "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.16)]",
    };
  }
  if (label.includes("日期")) {
    return {
      pill: "border border-blue-200/85 bg-[linear-gradient(180deg,rgba(239,246,255,0.98)_0%,rgba(219,234,254,0.86)_100%)] text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_4px_10px_rgba(59,130,246,0.11)]",
      dot: "bg-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.14)]",
    };
  }
  if (label.includes("參考")) {
    return {
      pill: "border border-indigo-200/85 bg-[linear-gradient(180deg,rgba(238,242,255,0.98)_0%,rgba(224,231,255,0.86)_100%)] text-indigo-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_4px_10px_rgba(99,102,241,0.11)]",
      dot: "bg-indigo-500 shadow-[0_0_0_3px_rgba(99,102,241,0.14)]",
    };
  }
  if (label.includes("需查")) {
    return {
      pill: "border border-amber-200/85 bg-[linear-gradient(180deg,rgba(255,251,235,0.98)_0%,rgba(254,243,199,0.88)_100%)] text-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_4px_10px_rgba(245,158,11,0.12)]",
      dot: "bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.16)]",
    };
  }
  if (label.includes("缺")) {
    return {
      pill: "border border-rose-200/85 bg-[linear-gradient(180deg,rgba(255,241,242,0.98)_0%,rgba(255,228,230,0.88)_100%)] text-rose-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_4px_10px_rgba(244,63,94,0.12)]",
      dot: "bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.16)]",
    };
  }
  if (label.includes("已補") || label.includes("接入")) {
    return {
      pill: "border border-sky-200/85 bg-[linear-gradient(180deg,rgba(240,249,255,0.98)_0%,rgba(224,242,254,0.88)_100%)] text-sky-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_4px_10px_rgba(14,165,233,0.11)]",
      dot: "bg-sky-500 shadow-[0_0_0_3px_rgba(14,165,233,0.14)]",
    };
  }
  if (label.includes("不比對")) {
    return {
      pill: "border border-slate-200/85 bg-[linear-gradient(180deg,rgba(248,250,252,0.98)_0%,rgba(241,245,249,0.9)_100%)] text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_10px_rgba(15,23,42,0.07)]",
      dot: "bg-slate-400 shadow-[0_0_0_3px_rgba(148,163,184,0.14)]",
    };
  }
  return {
    pill: "border border-slate-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.9)_100%)] text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_10px_rgba(15,23,42,0.07)]",
    dot: "bg-slate-400 shadow-[0_0_0_3px_rgba(148,163,184,0.14)]",
  };
}

function getRecommendationCompactTone(recommendation) {
  const label = getCompactRecommendation(recommendation);
  if (label.includes("買進") || label.includes("偏多")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (label.includes("觀望") || label.includes("待價")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (label.includes("偏弱") || label.includes("不追")) return "border-orange-200 bg-orange-50 text-orange-700";
  if (label.includes("避開")) return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function getObservationSummary(row) {
  const recommendation = getCompactRecommendation(row?.recommendation);
  const dims = getShortDisplayDimensions(row?.short?.dimensions || [], row?.stock);
  const phrases = dims.slice(0, 3).map((dim) => getDimensionShortPhrase(dim.dimension, dim.scorePct));
  return {
    title: `短線${recommendation}`,
    reason: phrases.join("，"),
    validation: getValidationCompactLabel(row?.validationState),
    validationTone: getValidationCompactTone(row?.validationState),
    validationMeta: getValidationProductMeta(row?.validationState),
    recommendationTone: getRecommendationCompactTone(row?.recommendation),
  };
}


function getShortV1Analysis(result) {
  if (result?.quotePending) {
    const raw = Number.isFinite(Number(result.rawScoreBeforeQuoteReady)) ? `原始盤後/舊價分數 ${Number(result.rawScoreBeforeQuoteReady).toFixed(0)} 分已暫停顯示。` : "";
    const reason = result.quoteReadiness?.reason || "盤中即時價尚未到位。";
    return `${reason}${raw ? ` ${raw}` : ""}請等待 TWSE MIS 或 GoogleFinance 盤中價更新後再看短線建議，避免用昨收/盤後收盤價產生過度樂觀分數。`;
  }

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
  parts.push("基本面已接入 FinMind 月營收、財報與資產負債資料；短線主表收斂為技術、籌碼、市場三大面向，期權避險併入市場面作風險濾網。");
  return parts.join(" ");
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
    const short = scoreShortV1Display(stock, weightConfig);
    const mid = scoreMidV1(stock, weightConfig);
    const long = scoreLongV1(stock, weightConfig);
    const derived = getDerived(stock);
    const validationRows = getSourceValidationRows(stock.symbol, stock, validationMap);
    const validationState = getValidationStateForDisplay(validationRows);
    const scoringDims = short.dimensions.filter((dim) => dim.weight > 0);
    return { stock, derived, short, mid, long, recommendation: getShortRecommendation(short.total, short.stopLoss), validationState, tech: scoringDims.find((dim) => dim.dimension === "技術面")?.scorePct || 0, chip: scoringDims.find((dim) => dim.dimension === "籌碼面")?.scorePct || 0, market: scoringDims.find((dim) => dim.dimension === "市場面")?.scorePct || 0 };
  }).sort((a, b) => b.short.score100 - a.short.score100);
}

function compareBadge(score) {
  const value = Number(score || 0);
  if (value >= 0.85) return <Badge className="bg-emerald-100 text-emerald-800">{value.toFixed(2)}</Badge>;
  if (value >= 0.55) return <Badge className="bg-lime-100 text-lime-800">{value.toFixed(2)}</Badge>;
  if (value > 0) return <Badge className="bg-yellow-100 text-yellow-800">{value.toFixed(2)}</Badge>;
  return <Badge className="bg-slate-100 text-slate-700">0.00</Badge>;
}
function StatusBadge({ text }) { const cls = text.includes("計分") && !text.includes("不計") ? "bg-emerald-100 text-emerald-800" : text.includes("不測") ? "bg-slate-100 text-slate-700" : "bg-blue-100 text-blue-800"; return <Badge className={cls}>{text}</Badge>; }
function getScoreTone(score) {
  if (score >= 85) return { badge: "bg-emerald-100/95 text-emerald-800", bar: "bg-[linear-gradient(90deg,#6ee7b7_0%,#34d399_35%,#10b981_72%,#059669_100%)]", track: "bg-[linear-gradient(90deg,rgba(209,250,229,0.55)_0%,rgba(236,253,245,0.9)_100%)]", card: "border-emerald-200/85 bg-emerald-50/52", text: "text-emerald-800", ring: "ring-emerald-100" };
  if (score >= 70) return { badge: "bg-lime-100/95 text-lime-800", bar: "bg-[linear-gradient(90deg,#d9f99d_0%,#bef264_35%,#84cc16_72%,#65a30d_100%)]", track: "bg-[linear-gradient(90deg,rgba(236,252,203,0.55)_0%,rgba(247,254,231,0.9)_100%)]", card: "border-lime-200/85 bg-lime-50/50", text: "text-lime-800", ring: "ring-lime-100" };
  if (score >= 55) return { badge: "bg-yellow-100/95 text-yellow-800", bar: "bg-[linear-gradient(90deg,#fde68a_0%,#fcd34d_38%,#f2c94c_72%,#eab308_100%)]", track: "bg-[linear-gradient(90deg,rgba(254,243,199,0.55)_0%,rgba(255,251,235,0.92)_100%)]", card: "border-yellow-200/85 bg-yellow-50/52", text: "text-yellow-800", ring: "ring-yellow-100" };
  if (score >= 40) return { badge: "bg-orange-100/95 text-orange-800", bar: "bg-[linear-gradient(90deg,#fdba74_0%,#fb923c_38%,#f97316_72%,#ea580c_100%)]", track: "bg-[linear-gradient(90deg,rgba(255,237,213,0.55)_0%,rgba(255,247,237,0.92)_100%)]", card: "border-orange-200/85 bg-orange-50/52", text: "text-orange-800", ring: "ring-orange-100" };
  return { badge: "bg-rose-100/95 text-rose-800", bar: "bg-[linear-gradient(90deg,#fda4af_0%,#fb7185_38%,#ef4444_72%,#dc2626_100%)]", track: "bg-[linear-gradient(90deg,rgba(ffe4e6,0.55)_0%,rgba(255,241,242,0.92)_100%)]", card: "border-rose-200/85 bg-rose-50/52", text: "text-rose-800", ring: "ring-rose-100" };
}

const DESKTOP_SCORE_RING_SIZE = 56;
const DESKTOP_SCORE_RING_VIEWBOX = 44;
const DESKTOP_SCORE_RING_RADIUS = 17;
const DESKTOP_SCORE_RING_STROKE = 3.2;

// Desktop score ring only. Mobile cards use the separate short-score mini line.
function getScoreRingStyle(score) {
  const value = clamp(Number(score) || 0, 0, 100);
  if (value >= 85) return { start: "#10b981", end: "#bbf7d0", track: "rgba(209,250,229,0.58)", text: "#065f46", fill: "rgba(236,253,245,0.90)" };
  if (value >= 70) return { start: "#84cc16", end: "#ecfccb", track: "rgba(236,252,203,0.62)", text: "#3f6212", fill: "rgba(247,254,231,0.90)" };
  if (value >= 55) return { start: "#eab308", end: "#fef3c7", track: "rgba(254,243,199,0.66)", text: "#92400e", fill: "rgba(255,251,235,0.92)" };
  if (value >= 40) return { start: "#f97316", end: "#ffedd5", track: "rgba(255,237,213,0.68)", text: "#9a3412", fill: "rgba(255,247,237,0.92)" };
  return { start: "#ef4444", end: "#ffe4e6", track: "rgba(254,226,226,0.68)", text: "#991b1b", fill: "rgba(255,241,242,0.92)" };
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const safe = normalized.length === 3 ? normalized.split("").map((ch) => ch + ch).join("") : normalized;
  const value = Number.parseInt(safe, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function mixHexColor(a, b, t) {
  const colorA = hexToRgb(a);
  const colorB = hexToRgb(b);
  const ratio = clamp(t, 0, 1);
  const r = Math.round(colorA.r + (colorB.r - colorA.r) * ratio);
  const g = Math.round(colorA.g + (colorB.g - colorA.g) * ratio);
  const bValue = Math.round(colorA.b + (colorB.b - colorA.b) * ratio);
  return `rgb(${r}, ${g}, ${bValue})`;
}

function ScoreRing({ score, pending = false }) {
  const raw = Number(score) || 0;
  const value = clamp(raw, 0, 100);
  const ring = getScoreRingStyle(value);
  const gradientId = React.useId().replace(/:/g, "");
  const circumference = 2 * Math.PI * DESKTOP_SCORE_RING_RADIUS;
  const progressLength = circumference * (value / 100);
  const arcSegmentCount = 20;
  const arcGap = 0.16;
  const totalGap = arcGap * Math.max(0, arcSegmentCount - 1);
  const unitLength = Math.max(0.1, (progressLength - totalGap) / arcSegmentCount);
  const activeSegmentCount = Math.max(1, Math.min(arcSegmentCount, Math.round(progressLength / (unitLength + arcGap))));
  const arcRotation = -90;

  if (pending) {
    return (
      <svg
        width={DESKTOP_SCORE_RING_SIZE}
        height={DESKTOP_SCORE_RING_SIZE}
        viewBox={`0 0 ${DESKTOP_SCORE_RING_VIEWBOX} ${DESKTOP_SCORE_RING_VIEWBOX}`}
        className="block h-[56px] w-[56px] shrink-0 overflow-visible"
        aria-label="觀察分數待即時"
        title="觀察分數待即時"
      >
        <defs>
          <filter id={`${gradientId}-pending-shadow`} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.8" floodColor="rgba(148,163,184,0.14)" />
          </filter>
        </defs>
        <circle cx="22" cy="22" r={DESKTOP_SCORE_RING_RADIUS + 2.6} fill="rgba(255,255,255,0.56)" />
        <circle cx="22" cy="22" r={DESKTOP_SCORE_RING_RADIUS} fill="rgba(250,251,252,0.96)" stroke="rgba(203,213,225,0.60)" strokeWidth={DESKTOP_SCORE_RING_STROKE} filter={`url(#${gradientId}-pending-shadow)`} />
        <circle cx="22" cy="22" r="11" fill="rgba(255,255,255,0.90)" />
        <text x="22" y="22" textAnchor="middle" dominantBaseline="central" className="fill-slate-500 text-[10px] font-black">待</text>
      </svg>
    );
  }

  return (
    <svg
      width={DESKTOP_SCORE_RING_SIZE}
      height={DESKTOP_SCORE_RING_SIZE}
      viewBox={`0 0 ${DESKTOP_SCORE_RING_VIEWBOX} ${DESKTOP_SCORE_RING_VIEWBOX}`}
      className="block h-[56px] w-[56px] shrink-0 overflow-visible"
      aria-label={`觀察分數 ${Math.round(raw)}`}
      title={`觀察分數 ${Math.round(raw)}`}
    >
      <defs>
        <filter id={`${gradientId}-ring-shadow`} x="-42%" y="-42%" width="184%" height="184%">
          <feDropShadow dx="0" dy="1.3" stdDeviation="1.45" floodColor="rgba(15,23,42,0.05)" />
        </filter>
      </defs>
      <circle cx="22" cy="22" r={DESKTOP_SCORE_RING_RADIUS + 2.7} fill="rgba(255,255,255,0.54)" />
      <circle cx="22" cy="22" r={DESKTOP_SCORE_RING_RADIUS} fill="rgba(255,255,255,0.88)" stroke="rgba(255,255,255,0.82)" strokeWidth="1" />
      <circle cx="22" cy="22" r={DESKTOP_SCORE_RING_RADIUS} fill="none" stroke={ring.track} strokeWidth={DESKTOP_SCORE_RING_STROKE} />
      {Array.from({ length: activeSegmentCount }).map((_, index) => {
        const t = activeSegmentCount <= 1 ? 1 : index / (activeSegmentCount - 1);
        const stroke = mixHexColor(ring.start, ring.end, t);
        const dashOffset = -(index * (unitLength + arcGap));
        const opacity = 1 - 0.32 * t;
        return (
          <circle
            key={`${gradientId}-seg-${index}`}
            cx="22"
            cy="22"
            r={DESKTOP_SCORE_RING_RADIUS}
            fill="none"
            stroke={stroke}
            strokeOpacity={opacity}
            strokeWidth={DESKTOP_SCORE_RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${unitLength} ${circumference - unitLength}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(${arcRotation} 22 22)`}
            filter={index === 0 ? `url(#${gradientId}-ring-shadow)` : undefined}
          />
        );
      })}
      <circle cx="22" cy="22" r="11" fill="rgba(255,255,255,0.94)" />
      <circle cx="22" cy="22" r="11" fill="none" stroke="rgba(255,255,255,0.80)" strokeWidth="0.75" />
      <text x="22" y="22" textAnchor="middle" dominantBaseline="central" style={{ fill: ring.text }} className="text-[14px] font-black tabular-nums tracking-[-0.02em]">
        {Math.round(raw)}
      </text>
    </svg>
  );
}

function AddAssetForm({ value, onChange, onAdd, error }) {
  return (
    <Card className="mx-auto max-w-6xl rounded-xl border-slate-200/80 bg-white/95 shadow-[0_10px_22px_rgba(15,23,42,0.06)] backdrop-blur md:rounded-2xl md:shadow-[0_12px_28px_rgba(15,23,42,0.07)]">
      <CardContent className="p-1 md:p-3">
        <div className="flex w-full min-w-0 flex-nowrap items-center gap-1 md:gap-2">
          <Input
            placeholder="代號"
            value={value.symbol}
            onChange={(e) => onChange({ ...value, symbol: e.target.value })}
            className="!h-8 min-w-0 flex-1 px-2 text-[12px] md:!h-10 md:text-[14px]"
          />
          <Input
            placeholder="名稱可選填"
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            className="hidden !h-10 min-w-0 flex-1 text-[14px] md:block"
          />
          <select className="h-8 w-[58px] shrink-0 rounded-md border border-slate-300 bg-white px-1.5 py-1 text-[12px] outline-none focus:ring-2 focus:ring-slate-300 md:h-10 md:w-[90px] md:px-2 md:py-1.5 md:text-[14px]" value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value })}>
            <option value="股票">股票</option>
            <option value="ETF">ETF</option>
          </select>
          <select className="h-8 w-[66px] shrink-0 rounded-md border border-slate-300 bg-white px-1.5 py-1 text-[12px] outline-none focus:ring-2 focus:ring-slate-300 md:h-10 md:w-[92px] md:px-2 md:py-1.5 md:text-[14px]" value={value.market} onChange={(e) => onChange({ ...value, market: e.target.value })}>
            <option value="TWSE">TWSE</option>
            <option value="TPEx">TPEx</option>
          </select>
          <Button onClick={onAdd} className="!h-8 w-[48px] shrink-0 whitespace-nowrap px-0 text-[12px] font-black leading-none md:!h-10 md:w-[64px] md:text-[14px]">加入</Button>
        </div>
        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
      </CardContent>
    </Card>
  );
}

function pickPrevClose(stock) {
  const candidates = [
    stock?.prevClose,
    stock?.previousClose,
    stock?.referencePrice,
    stock?.twsePrevClose,
    stock?.officialPrevClose,
    stock?.googlePrevClose,
  ];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function getPriceMove(stock) {
  const price = Number(stock?.price);
  const prevClose = pickPrevClose(stock);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(prevClose) || prevClose <= 0) {
    return { price: Number.isFinite(price) && price > 0 ? price : null, prevClose, change: null, changePct: null, direction: "flat" };
  }
  const change = price - prevClose;
  const changePct = (change / prevClose) * 100;
  return {
    price,
    prevClose,
    change,
    changePct,
    direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
  };
}

function formatArrowNumber(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return number(Math.abs(n), digits);
}

function formatArrowPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${Math.abs(n).toFixed(2)}%`;
}

function priceMoveClass(direction) {
  if (direction === "up") return "text-rose-600";
  if (direction === "down") return "text-emerald-600";
  return "text-slate-500";
}

function getDimensionPanelTone(dimension) {
  const text = String(dimension || "");
  if (text.includes("市場")) return "border-emerald-200/80 bg-emerald-50/34";
  if (text.includes("籌碼") || text.includes("資金")) return "border-sky-200/80 bg-sky-50/34";
  return "border-violet-200/80 bg-violet-50/34";
}


function getDimensionIconMeta(dimension) {
  const text = String(dimension || "");
  if (text.includes("市場")) {
    return {
      name: "shield",
      wrap: "bg-emerald-100/80 text-emerald-700 ring-1 ring-inset ring-emerald-200/80",
      label: "text-emerald-900",
    };
  }
  if (text.includes("籌碼") || text.includes("資金")) {
    return {
      name: "bar",
      wrap: "bg-sky-100/85 text-sky-700 ring-1 ring-inset ring-sky-200/80",
      label: "text-sky-900",
    };
  }
  return {
    name: "trend",
    wrap: "bg-violet-100/85 text-violet-700 ring-1 ring-inset ring-violet-200/80",
    label: "text-violet-900",
  };
}


function MobileOverviewCards({ rows, selected, onSelect, onInsight, onRemove, dataMode, lastFetchMap = {}, marketIndex = null, selectedDetail = null }) {
  const refreshTime = formatLastFetch(lastFetchMap, "twse_mis") !== "尚未抓取" ? formatLastFetch(lastFetchMap, "twse_mis") : formatLastFetch(lastFetchMap, "google_csv");
  const hasMarketIndex = marketIndex?.price !== null && marketIndex?.price !== undefined && Number.isFinite(Number(marketIndex.price));
  const marketDirection = Number(marketIndex?.change || 0) > 0 || Number(marketIndex?.changePct || 0) > 0 ? "up" : Number(marketIndex?.change || 0) < 0 || Number(marketIndex?.changePct || 0) < 0 ? "down" : "flat";
  const marketTime = marketIndex?.time ? compactSourceTime(marketIndex.time) : refreshTime;

  return (
    <div className="space-y-3">
      <Card
        className="overflow-hidden rounded-[20px] border-transparent text-white shadow-[0_18px_38px_rgba(15,23,42,0.20)]"
        style={{ background: "radial-gradient(circle at top left, #355d91 0%, #1c3d68 26%, #0b1930 62%, #040a18 100%)" }}
      >
        <CardContent className="relative overflow-hidden p-3">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.02)_30%,rgba(255,255,255,0)_52%)]" />
          <div className="relative space-y-2.5">
            <div className="flex items-center justify-between gap-3 text-[11px] font-semibold tracking-[0.02em] text-slate-300">
              <span>台股大盤</span>
              <span className="font-medium text-slate-400">更新 {marketTime}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[28px] font-black leading-none tracking-[-0.025em]">
                  {hasMarketIndex ? displayValue(marketIndex.price) : "待更新"}
                </div>
                <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[12px] text-slate-400">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/6 text-slate-300/85 ring-1 ring-inset ring-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                    <Icon name="close" className="h-3 w-3" />
                  </span>
                  <span className="truncate">昨收 {hasMarketIndex && marketIndex.prevClose ? number(marketIndex.prevClose) : "-"}</span>
                </div>
              </div>
              <div className={cx(
                "flex w-[138px] shrink-0 items-center justify-center gap-2 rounded-2xl border px-2.5 py-2 text-right backdrop-blur-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_10px_22px_rgba(0,0,0,0.12)]",
                marketDirection === "up" ? "border-rose-300/18 bg-[linear-gradient(180deg,rgba(251,113,133,0.08)_0%,rgba(251,113,133,0.03)_100%)] text-rose-200" : marketDirection === "down" ? "border-emerald-300/18 bg-[linear-gradient(180deg,rgba(52,211,153,0.08)_0%,rgba(52,211,153,0.03)_100%)] text-emerald-200" : "border-white/10 bg-white/5 text-slate-300"
              )}>
                {hasMarketIndex ? (
                  <span className={cx(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.20),0_4px_10px_rgba(15,23,42,0.10)]",
                    marketDirection === "up" ? "border-rose-300/26 bg-rose-300/10 text-rose-100" : marketDirection === "down" ? "border-emerald-300/26 bg-emerald-300/10 text-emerald-100" : "border-white/15 bg-white/8 text-slate-200"
                  )}>
                    {marketDirection === "up" ? <span className="text-[14px] leading-none">▲</span> : marketDirection === "down" ? <span className="text-[14px] leading-none">▼</span> : <span className="text-[11px] leading-none">▪</span>}
                  </span>
                ) : null}
                <div className="min-w-0">
                  <div className="truncate text-[26px] font-black leading-none tracking-[-0.025em]">{hasMarketIndex ? formatArrowNumber(marketIndex.change) : "-"}</div>
                  <div className="mt-1 text-[12px] font-black leading-none text-current/92">{hasMarketIndex ? formatArrowPercent(marketIndex.changePct) : "-"}</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[20px] border-slate-200/80 bg-white/92 shadow-[0_18px_38px_rgba(15,23,42,0.075)] backdrop-blur-sm">
        <CardContent className="p-3">
          <div className="mb-2.5">
            <div className="text-[18px] font-black tracking-[-0.02em] text-slate-950">排行</div>
            <div className="mt-0.5 text-[12px] leading-5 text-slate-500">依觀察分數排序，點選標的查看詳情；再點一次可收合。</div>
          </div>
          <div className="space-y-2.5">
            {rows.map((row, index) => {
              const move = getPriceMove(row.stock);
              const isSelected = selected === row.stock.symbol;
              const summary = getObservationSummary(row);
              const dims = getShortDisplayDimensions(row.short.dimensions, row.stock);
              const ring = getScoreRingStyle(row.short.score100);
              const rowSurfaceStyle = {
                background: move.direction === "up"
                  ? "linear-gradient(90deg, rgba(30,41,59,0.040) 0%, rgba(255,255,255,0.985) 42%, rgba(255, 247, 249, 0.98) 68%, rgba(255, 225, 231, 0.68) 100%)"
                  : move.direction === "down"
                    ? "linear-gradient(90deg, rgba(30,41,59,0.040) 0%, rgba(255,255,255,0.985) 44%, rgba(247, 254, 250, 0.96) 72%, rgba(220, 252, 231, 0.50) 100%)"
                    : "linear-gradient(90deg, rgba(30,41,59,0.030) 0%, rgba(248,250,252,0.96) 44%, rgba(255,255,255,0.99) 100%)",
              };
              return (
                <div key={row.stock.symbol} className="rounded-lg border border-slate-200/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_10px_22px_rgba(15,23,42,0.04)]" style={rowSurfaceStyle}>
                  <button
                    type="button"
                    onClick={() => onSelect(row.stock.symbol)}
                    className="w-full text-left outline-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 shrink-0 text-center text-[14px] font-black tabular-nums text-slate-300/95">{index + 1}</span>
                      <span className="inline-flex shrink-0 items-center rounded-md border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(241,245,249,0.78)_100%)] px-1.5 py-1 text-[11px] font-black leading-none tracking-[0.08em] text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.68),0_1px_4px_rgba(15,23,42,0.035)]"><span className="tabular-nums">{row.stock.symbol}</span></span>
                      <span className="min-w-0 flex-1 truncate text-[17px] font-[850] leading-none tracking-[-0.024em] text-slate-900">{row.stock.name}</span>
                      {isEtfAsset(row.stock) ? <Badge className="shrink-0 self-center bg-blue-50/88 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-inset ring-blue-100/90">ETF</Badge> : null}
                    </div>

                    <div className="mt-2.5 flex min-w-0 items-center justify-between gap-2 rounded-xl bg-white/54 px-2.5 py-1.5" style={{ border: "0", outline: "0", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.84), 0 5px 12px rgba(15,23,42,0.025)" }}>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-500 ring-1 ring-inset ring-indigo-100/90">
                          <Icon name="price" className="h-3.5 w-3.5" />
                        </span>
                        <span className="shrink-0 tabular-nums text-[16px] font-black tracking-[-0.02em] text-slate-950">{move.price !== null ? number(move.price) : "待即時"}</span>
                        {move.change !== null ? (
                          <span className={cx("inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-black tabular-nums leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.62)]", move.direction === "up" ? "border-rose-200/80 bg-rose-50/85 text-rose-600" : move.direction === "down" ? "border-emerald-200/80 bg-emerald-50/85 text-emerald-600" : "border-slate-200/80 bg-slate-50/85 text-slate-500")}>
                            <span style={{ fontSize: 11, lineHeight: "12px" }}>{move.direction === "up" ? "▲" : move.direction === "down" ? "▼" : "▪"}</span>
                            <span style={{ marginLeft: 3, fontSize: 15, lineHeight: "15px", letterSpacing: "-0.01em" }}>{formatArrowNumber(move.change, 1)}</span>
                            {move.changePct !== null ? <span style={{ marginLeft: 9, fontSize: 7, lineHeight: "10px", fontWeight: 700, opacity: 0.62 }}>{formatArrowPercent(move.changePct)}</span> : null}
                          </span>
                        ) : null}
                      </div>
                      <div className="ml-auto flex shrink-0 items-center justify-end gap-1 text-slate-400">
                        <Icon name="close" className="h-3 w-3 shrink-0" />
                        <span className="tabular-nums text-[11px] font-bold tracking-[-0.01em] text-slate-500">{move.prevClose !== null ? number(move.prevClose) : "-"}</span>
                      </div>
                    </div>

                    <div className="mt-2 flex w-full items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/60 px-2 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.62)]">
                      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200/80">
                        <Icon name="trend" className="h-2.5 w-2.5" />
                      </span>
                      <span className="shrink-0 text-[12px] font-black tabular-nums leading-none" style={{ color: ring.text }}>短線 {row.short.quotePending ? "待" : Math.round(Number(row.short.score100) || 0)}</span>
                      <span className={cx("ml-1 h-[3px] min-w-[72px] flex-1 overflow-hidden rounded-full", getScoreTone(row.short.score100).track)}>
                        <span className={cx("block h-full rounded-full", getScoreTone(row.short.score100).bar)} style={{ width: `${clamp(row.short.score100)}%` }} />
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] leading-5">
                      <span className={cx("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-black leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]", summary.recommendationTone)}>{summary.title}</span>
                      <span className="min-w-0 text-slate-700">{summary.reason}</span>
                    </div>
                    <div className="mt-2.5 flex w-full flex-nowrap gap-1.5">
                      {dims.map((dim) => {
                        const dimTone = getScoreTone(dim.scorePct || 0);
                        const dimMeta = getDimensionIconMeta(dim.dimension);
                        const dimLabel = String(dim.dimension || "").replace("面", "");
                        return (
                          <div key={`${row.stock.symbol}-mobile-${dim.dimension}`} className={cx("min-w-0 flex-1 rounded-lg border px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.48)]", getDimensionPanelTone(dim.dimension))}>
                            <div className="flex min-w-0 items-center justify-center gap-1 leading-none">
                              <span className={cx("inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-md", dimMeta.wrap)}>
                                <Icon name={dimMeta.name} className="h-2.5 w-2.5" />
                              </span>
                              <span className={cx("truncate text-[11px] font-black", dimMeta.label)}>{dimLabel}</span>
                              <span className={cx("text-[12px] font-black tabular-nums", dimTone.text)}>{Math.round(dim.scorePct)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-1.5 flex items-center justify-end gap-1.5 leading-none opacity-80">
                      <span className="font-medium tracking-[0.02em] text-slate-300/75" style={{ fontSize: 7, lineHeight: "14px" }}>驗證</span>
                      <div className={cx("inline-flex h-[16px] shrink-0 items-center gap-1 rounded-full border px-2 font-semibold leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]", summary.validationMeta.pill)} style={{ fontSize: 9, lineHeight: "16px" }}>
                        <span className={cx("grid h-[6px] w-[6px] place-items-center rounded-full border border-white/35", summary.validationMeta.dot)}><span className="h-[2px] w-[2px] rounded-full bg-current/85" /></span>
                        <span className="tracking-[-0.01em]">{summary.validation}</span>
                      </div>
                    </div>
                  </button>
                  {isSelected && selectedDetail ? (
                    <div className="mt-3 border-t border-slate-200/75 pt-3">
                      {selectedDetail}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OverviewTable({ rows, selected, onSelect, onInsight, onRemove, dataMode, lastFetchMap = {}, marketIndex = null, selectedDetail = null }) {
  const refreshTime = formatLastFetch(lastFetchMap, "twse_mis") !== "尚未抓取" ? formatLastFetch(lastFetchMap, "twse_mis") : formatLastFetch(lastFetchMap, "google_csv");
  const hasMarketIndex = marketIndex?.price !== null && marketIndex?.price !== undefined && Number.isFinite(Number(marketIndex.price));
  const marketDirection = Number(marketIndex?.change || 0) > 0 || Number(marketIndex?.changePct || 0) > 0 ? "up" : Number(marketIndex?.change || 0) < 0 || Number(marketIndex?.changePct || 0) < 0 ? "down" : "flat";
  const marketTime = marketIndex?.time ? compactSourceTime(marketIndex.time) : refreshTime;

  return (
    <div className="space-y-3 md:space-y-4">
      <Card className="overflow-hidden rounded-2xl border-transparent bg-[radial-gradient(circle_at_top_left,#355d91_0%,#1c3d68_24%,#0b1930_60%,#040a18_100%)] text-white shadow-[0_20px_44px_rgba(15,23,42,0.20)] md:rounded-[22px]">
        <CardContent className="relative overflow-hidden p-4 md:p-5">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.02)_26%,rgba(255,255,255,0)_48%)]" />
          <div className="pointer-events-none absolute -right-10 top-[-24px] h-28 w-40 rounded-full bg-rose-300/8 blur-2xl" />
          <div className="pointer-events-none absolute -left-10 bottom-[-28px] h-28 w-40 rounded-full bg-sky-300/8 blur-2xl" />
          <div className="relative grid gap-1.5">
            <div className="flex items-center justify-between gap-4 text-[12px] font-semibold tracking-[0.02em] text-slate-300 md:text-[13px]">
              <span>台股大盤</span>
              <span className="font-medium text-slate-400">更新 {marketTime}</span>
            </div>
            <div className="flex items-center justify-between gap-5 md:gap-6">
              <div className="flex min-h-[82px] flex-col justify-between self-stretch py-1 md:min-h-[88px]">
                <div className="text-[40px] font-black leading-none tracking-[-0.02em] md:text-[46px]">
                  {hasMarketIndex ? displayValue(marketIndex.price) : "待更新"}
                </div>
                <div className="flex items-center gap-2 text-[14px] text-slate-400 md:text-[15px]">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/6 text-slate-300/85 ring-1 ring-inset ring-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                    <Icon name="close" className="h-3 w-3" />
                  </span>
                  <span>昨收 {hasMarketIndex && marketIndex.prevClose ? number(marketIndex.prevClose) : "-"}</span>
                </div>
              </div>
              <div className={cx(
                "flex items-center gap-4 rounded-[20px] border px-4 py-3 text-right backdrop-blur-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_12px_26px_rgba(0,0,0,0.12)] md:gap-5 md:px-5",
                marketDirection === "up" ? "border-rose-300/18 bg-[linear-gradient(180deg,rgba(251,113,133,0.08)_0%,rgba(251,113,133,0.03)_100%)] text-rose-200" : marketDirection === "down" ? "border-emerald-300/18 bg-[linear-gradient(180deg,rgba(52,211,153,0.08)_0%,rgba(52,211,153,0.03)_100%)] text-emerald-200" : "border-white/10 bg-white/5 text-slate-300"
              )}>
                {hasMarketIndex ? (
                  <span className={cx(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.26),0_8px_18px_rgba(15,23,42,0.16)] md:h-11 md:w-11",
                    marketDirection === "up" ? "border-rose-300/26 bg-rose-300/10 text-rose-100" : marketDirection === "down" ? "border-emerald-300/26 bg-emerald-300/10 text-emerald-100" : "border-white/15 bg-white/8 text-slate-200"
                  )}>
                    {marketDirection === "up" ? <span className="text-[24px] leading-none md:text-[26px]">▲</span> : marketDirection === "down" ? <span className="text-[24px] leading-none md:text-[26px]">▼</span> : <span className="text-[19px] leading-none md:text-[21px]">▪</span>}
                  </span>
                ) : null}
                <div>
                  <div className="text-[34px] font-black leading-none tracking-[-0.024em] md:text-[40px]">{hasMarketIndex ? formatArrowNumber(marketIndex.change) : "-"}</div>
                  <div className="mt-1.5 text-[15px] font-semibold leading-none text-current/92 md:text-[16px]">{hasMarketIndex ? formatArrowPercent(marketIndex.changePct) : "-"}</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200/80 bg-white/90 shadow-[0_18px_42px_rgba(15,23,42,0.075)] backdrop-blur-sm md:rounded-[22px]">
        <CardContent className="p-3.5 md:p-4">
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-base font-bold tracking-tight text-slate-900 md:text-lg">排行</h3>
            <p className="text-[12px] text-slate-500 md:text-[13px]">依觀察分數排序，點選標的查看詳情；再點一次可收合。</p>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-sm">
            <div className="hidden grid-cols-[44px_minmax(250px,1.35fr)_170px_120px_78px_64px] gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-50/95 via-white to-blue-50/45 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.04em] text-slate-500 md:grid">
              <div className="text-center">#</div>
              <div>標的</div>
              <div>價格</div>
              <div>漲跌</div>
              <div className="text-center">觀察</div>
              <div className="text-right">操作</div>
            </div>

            <div>
              {rows.map((row, index) => {
                const move = getPriceMove(row.stock);
                const isSelected = selected === row.stock.symbol;
                const scoreTone = getScoreTone(row.short.score100);
                const rowSurfaceStyle = {
                  background: move.direction === "up"
                    ? "linear-gradient(90deg, rgba(15,23,42,0.043) 0%, rgba(255,255,255,0.985) 42%, rgba(255, 247, 249, 0.97) 68%, rgba(255, 225, 231, 0.64) 100%)"
                    : move.direction === "down"
                      ? "linear-gradient(90deg, rgba(15,23,42,0.043) 0%, rgba(255,255,255,0.985) 44%, rgba(247, 254, 250, 0.95) 72%, rgba(220, 252, 231, 0.46) 100%)"
                      : "linear-gradient(90deg, rgba(15,23,42,0.032) 0%, rgba(248,250,252,0.96) 44%, rgba(255,255,255,0.99) 100%)",
                };
                const rowSurfaceChrome = isSelected
                  ? move.direction === "up"
                    ? "ring-1 ring-inset ring-rose-200/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.80)]"
                    : move.direction === "down"
                      ? "ring-1 ring-inset ring-emerald-200/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.80)]"
                      : "ring-1 ring-inset ring-blue-200/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
                  : "shadow-[inset_0_1px_0_rgba(255,255,255,0.74)] backdrop-blur-[1px]";
                return (
                  <React.Fragment key={row.stock.symbol}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelect(row.stock.symbol)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(row.stock.symbol); }}
                      className={cx(
                        "border-b border-slate-100/80 px-3 py-3.5 outline-none transition md:px-4 md:py-4",
                        rowSurfaceChrome
                      )}
                      style={rowSurfaceStyle}
                    >
                      <div className="grid grid-cols-[28px_1fr_auto] items-start gap-2 md:grid-cols-[44px_minmax(250px,1.35fr)_170px_120px_78px_64px] md:items-center md:gap-4">
                        <div className="pt-0.5 text-center text-[15px] font-black tabular-nums text-slate-300/95 md:pt-0 md:text-base">{index + 1}</div>

                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="inline-flex shrink-0 items-center rounded-md border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(241,245,249,0.78)_100%)] px-2 py-1 text-[12px] font-black leading-none tracking-[0.08em] text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.68),0_1px_4px_rgba(15,23,42,0.035)] md:px-2.5 md:text-[13px]"><span className="tabular-nums">{row.stock.symbol}</span></span>
                            <span className="truncate text-[22px] font-[850] leading-none tracking-[-0.024em] text-slate-900 md:text-[25px]">{row.stock.name}</span>
                            {isEtfAsset(row.stock) ? <Badge className="self-center bg-blue-50/88 px-2 py-0.5 text-[11px] font-bold text-blue-700 ring-1 ring-inset ring-blue-100/90">ETF</Badge> : null}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onInsight(row.stock.symbol, "short"); }}
                          className="flex h-[56px] w-[56px] min-h-[56px] min-w-[56px] max-h-[56px] max-w-[56px] shrink-0 items-center justify-center rounded-full bg-transparent p-0 shadow-none ring-0 transition hover:bg-transparent md:order-5 md:justify-self-center"
                          title={row.recommendation?.label || "查看短線評語"}
                        >
                          <ScoreRing score={row.short.score100} pending={row.short.quotePending} />
                        </button>

                        <div className="col-span-3 ml-[36px] mt-1 grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-[15px] md:order-3 md:col-span-1 md:ml-0 md:mt-0 md:block md:text-base">
                          <div className="flex items-center gap-2 text-[15px] md:text-[17px]">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 text-indigo-500 ring-1 ring-inset ring-indigo-100/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
                              <Icon name="price" className="h-3.5 w-3.5" />
                            </span>
                            <span className="text-[12px] font-semibold tracking-[0.02em] text-slate-400 md:text-[13px]">現價</span>
                            <span className="tabular-nums text-[17px] font-black tracking-[-0.02em] text-slate-950 md:text-[20px]">{move.price !== null ? number(move.price) : "待即時"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[12px] font-medium text-slate-400 md:mt-0.5 md:text-[13px]">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100/90 text-slate-400 ring-1 ring-inset ring-slate-200/80">
                              <Icon name="close" className="h-3 w-3" />
                            </span>
                            <span className="text-[11px] tracking-[0.01em] text-slate-400 md:text-[12px]">昨收</span>
                            <span className="tabular-nums text-[13px] font-semibold text-slate-500 md:text-[14px]">{move.prevClose !== null ? number(move.prevClose) : "-"}</span>
                          </div>
                        </div>

                        <div className={cx("col-span-3 ml-[36px] mt-1 flex items-center gap-3 text-[16px] font-black tracking-tight md:order-4 md:col-span-1 md:ml-0 md:mt-0 md:text-[18px]", priceMoveClass(move.direction))}>
                          {move.change !== null ? (
                            <>
                              <span className={cx(
                                "grid h-8 w-8 shrink-0 place-items-center rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.52),0_3px_8px_rgba(15,23,42,0.045)] md:h-8 md:w-8",
                                move.direction === "up" ? "border-rose-200/85 bg-rose-50/88 text-rose-500" : move.direction === "down" ? "border-emerald-200/85 bg-emerald-50/88 text-emerald-500" : "border-slate-200/85 bg-slate-50/88 text-slate-400"
                              )}>
                                {move.direction === "up" ? <span className="text-[13px] leading-none md:text-[15px]">▲</span> : move.direction === "down" ? <span className="text-[13px] leading-none md:text-[15px]">▼</span> : <span className="text-[11px] leading-none md:text-[13px]">▪</span>}
                              </span>
                              <div className="leading-none">
                                <div>{formatArrowNumber(move.change)}</div>
                                <div className="mt-1 text-[12px] font-semibold opacity-85 md:text-[13px]">{formatArrowPercent(move.changePct)}</div>
                              </div>
                            </>
                          ) : (
                            <div>{pct(row.derived.todayReturn)}</div>
                          )}
                        </div>

                        <div className="hidden text-right md:order-6 md:block">
                          <Button variant="outline" size="sm" className="h-7 rounded-md border-slate-200/70 bg-white/60 px-2.5 text-[11px] font-semibold text-slate-400 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600" onClick={(e) => { e.stopPropagation(); onRemove(row.stock.symbol); }}>移除</Button>
                        </div>
                      </div>

                      {(() => {
                        const summary = getObservationSummary(row);
                        return (
                          <div className="mt-2 ml-[36px] md:ml-[60px]">
                            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-md bg-[linear-gradient(180deg,rgba(255,255,255,0.68)_0%,rgba(248,250,252,0.52)_100%)] px-2 py-1 text-[13px] shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_1px_2px_rgba(15,23,42,0.03)] md:text-sm">
                              <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-slate-600">
                                <span className={cx("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:text-[13px]", summary.recommendationTone)}>
                                  {summary.title}
                                </span>
                                <span className="min-w-0 leading-5 text-slate-700">{summary.reason}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold tracking-[0.02em] text-slate-400 md:text-[12px]">資料驗證</span>
                                <div className={cx("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black leading-none tracking-[0.01em] shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_4px_10px_rgba(15,23,42,0.04)] md:text-xs", summary.validationMeta.pill)}>
                                  <span className={cx("grid h-3.5 w-3.5 place-items-center rounded-full border border-white/55", summary.validationMeta.dot)}><span className="h-1.5 w-1.5 rounded-full bg-current/90" /></span>
                                  <span>{summary.validation}</span>
                                </div>
                              </div>
                            </div>
                            <div className="grid gap-1 md:grid-cols-3 md:gap-1.5">
                        {getShortDisplayDimensions(row.short.dimensions, row.stock).map((dim) => {
                          const dimTone = getScoreTone(dim.scorePct || 0);
                          const dimMeta = getDimensionIconMeta(dim.dimension);
                          return (
                            <div key={`${row.stock.symbol}-${dim.dimension}`} className={cx("rounded-md border px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.58)] backdrop-blur-[1px]", getDimensionPanelTone(dim.dimension))}>
                              <div className="flex items-center gap-2">
                                <div className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-md", dimMeta.wrap)}>
                                  <Icon name={dimMeta.name} className="h-3 w-3" />
                                </div>
                                <div className={cx("w-[40px] shrink-0 text-[12px] font-semibold md:w-[46px] md:text-[13px]", dimMeta.label)}>{dim.dimension}</div>
                                <div className={cx("h-[2px] min-w-0 flex-1 overflow-hidden rounded-full opacity-90 shadow-inner", dimTone.track)}>
                                  <div className={cx("h-full rounded-full opacity-68", dimTone.bar)} style={{ width: `${clamp(dim.scorePct)}%` }} />
                                </div>
                                <div className={cx("min-w-[32px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-black tabular-nums shadow-sm opacity-90 md:text-xs", dimTone.badge)}>{Math.round(dim.scorePct)}</div>
                              </div>
                            </div>
                          );
                        })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    {isSelected && selectedDetail ? (
                      <div className="border-b border-slate-200 bg-white px-3 pb-3 md:px-5 md:pb-4">
                        {selectedDetail}
                      </div>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getShortFrameworkRowDataText(row) {
  return row.dataText || row.rule || "-";
}

function getShortFrameworkRowRuleText(row) {
  return row.ruleText || row.source || row.explain || "";
}

function isEtfAsset(stock) {
  return String(stock?.type || "").toUpperCase() === "ETF" || /^00/.test(String(stock?.symbol || ""));
}

function getEtfDisplayRow(row) {
  if (!row || typeof row !== "object") return row;
  const next = { ...row };

  if (row.dimension === "籌碼面") next.dimension = "資金面";
  if (row.weightKey === "institutional3d") {
    next.item = "法人買賣參考";
    next.source = `ETF 法人買賣可反映短線資金流與交易需求，但可能同時包含造市、套利、申購贖回或避險部位，不宜完全等同個股籌碼。

顯示原則：
保留三大法人淨額與占均量比重，作為 ETF 短線資金面參考。
合計買超偏正向；合計賣超偏保守；若與價格、量能背離，需搭配技術面判斷。`;
  }
  if (row.weightKey === "margin5d") {
    next.item = "槓桿熱度參考";
    next.source = `ETF 融資變化主要作為交易熱度與槓桿溫度參考，不宜直接等同個股籌碼壓力。

顯示原則：
融資快速增加代表槓桿交易升溫，短線波動風險提高。
融資下降或穩定代表槓桿壓力較低。`;
  }
  if (row.weightKey === "usMarket") {
    next.item = "外部風向";
    next.source = `以 Nasdaq 與 SOX 作外部風險參考。對市值型、科技型、半導體型 ETF 參考性較高；對高股息、債券或非科技曝險 ETF，僅作市場情緒濾網。

評分標準維持原短線觀察：
雙指數同步轉強為正向；同步轉弱則提高短線風險。`;
  }
  if (row.weightKey === "derivativesData") {
    next.item = "大盤避險";
    next.source = `以期貨法人淨額、Put/Call 成交量與 Put/Call 未平倉結構衡量大盤避險壓力。此項不是 ETF 本身基本面，而是台股短線風險濾網。

評分標準維持原短線觀察：
法人偏多、避險需求下降為正向；避險升溫或法人偏空為負向。`;
  }
  return next;
}

function getShortFrameworkDisplayRows(rows = [], stock = null) {
  const isEtf = isEtfAsset(stock);
  return rows
    .filter((row) => row.weightKey !== "fundamentalsData")
    .map((row) => isEtf ? getEtfDisplayRow(row) : row);
}

function getShortFrameworkFundamentalRow(rows = [], stock = null) {
  if (isEtfAsset(stock)) return null;
  return rows.find((row) => row.weightKey === "fundamentalsData");
}

function getShortDisplayDimensions(dimensions = [], stock = null) {
  const isEtf = isEtfAsset(stock);
  return dimensions
    .filter((dim) => dim.weight > 0)
    .map((dim) => isEtf && dim.dimension === "籌碼面" ? { ...dim, dimension: "資金面" } : dim);
}

function getShortFrameworkSubtitle(stock) {
  if (isEtfAsset(stock)) {
    return "短線觀察：ETF 主表收斂為技術、資金、市場三大面向；MACD / KD / ATR 納入技術面，基本面檢查不套用 ETF。";
  }
  return "短線觀察：主表收斂為技術、籌碼、市場三大面向；MACD / KD / ATR 納入技術面，基本面改為獨立檢查。";
}

function hasYahooEtfData(stock) {
  return isEtfAsset(stock) && (
    Number.isFinite(Number(stock?.yahooEtfPremiumDiscountPct)) ||
    Number.isFinite(Number(stock?.yahooEtfMarketPrice)) ||
    Number.isFinite(Number(stock?.yahooEtfRangeSpread))
  );
}

function yahooEtfPremiumDetail(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return {
      state: "待資料",
      level: "neutral",
      summary: "尚未取得 ETF 折溢價資料；不影響短線主分數。",
      action: "先以 FinMind 技術面與價量資料為主。",
    };
  }

  if (n > 0.8) {
    return {
      state: "高溢價",
      level: "danger",
      summary: "市價明顯高於淨值，短線追價風險偏高。",
      action: "不宜用市價追高，優先等待溢價收斂或改用限價。",
    };
  }

  if (n > 0.3) {
    return {
      state: "小幅溢價",
      level: "warning",
      summary: "市價略高於淨值，追價成本上升但未達高風險。",
      action: "可觀察，但不建議在短線急漲後追價。",
    };
  }

  if (n < -0.8) {
    return {
      state: "高折價",
      level: "warning",
      summary: "市價明顯低於淨值，可能反映賣壓、流動性或成分資產波動。",
      action: "不可直接視為便宜，需搭配成交量、技術面與市場風險確認。",
    };
  }

  if (n < -0.3) {
    return {
      state: "小幅折價",
      level: "neutral",
      summary: "市價略低於淨值，可能是短線賣壓或正常折價波動。",
      action: "可列入觀察，但不單獨構成買進理由。",
    };
  }

  return {
    state: "接近淨值",
    level: "good",
    summary: "市價與淨值接近，ETF 交易價格相對正常。",
    action: "折溢價風險低，可回到技術面、量能與市場風險判斷。",
  };
}


function yahooEtfIntradayRangeDetail(rangeSpread, marketPrice) {
  const spread = Number(rangeSpread);
  const price = Number(marketPrice);
  if (!Number.isFinite(spread) || spread <= 0 || !Number.isFinite(price) || price <= 0) {
    return {
      state: "待資料",
      ratioText: "-",
      summary: "尚未取得完整日內區間資料。",
    };
  }

  const ratio = (spread / price) * 100;
  const ratioText = `${ratio.toFixed(2)}%`;

  if (ratio >= 2.5) {
    return {
      state: "波動偏大",
      ratioText,
      summary: "日內區間明顯放大，若同時高溢價，追價風險會上升。",
    };
  }

  if (ratio >= 1.2) {
    return {
      state: "波動升高",
      ratioText,
      summary: "日內價格波動較明顯，適合用限價避免滑價。",
    };
  }

  return {
    state: "波動可控",
    ratioText,
    summary: "日內區間不大，交易價格相對穩定。",
  };
}

function etfPriceConsistencyDetail(stock) {
  const yahooPrice = Number(stock?.yahooEtfMarketPrice);
  const mainPrice = Number(stock?.price);

  if (!Number.isFinite(yahooPrice) || yahooPrice <= 0 || !Number.isFinite(mainPrice) || mainPrice <= 0) {
    return {
      state: "待資料",
      level: "neutral",
      diffText: "-",
      summary: "ETF 即時市價或主行情尚未完整，折溢價資料可靠度需保守看待。",
    };
  }

  const diffPct = ((yahooPrice - mainPrice) / mainPrice) * 100;
  const diffText = `${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(2)}%`;

  if (Math.abs(diffPct) > 1) {
    return {
      state: "來源差異大",
      level: "danger",
      diffText,
      summary: "ETF 即時市價與主行情差距偏大，折溢價參考性下降，需先確認資料時點。",
    };
  }

  if (Math.abs(diffPct) > 0.3) {
    return {
      state: "來源小差異",
      level: "warning",
      diffText,
      summary: "ETF 即時市價與主行情略有差異，可參考但不宜單獨判斷追價或折價。",
    };
  }

  return {
    state: "市價一致",
    level: "good",
    diffText,
    summary: "ETF 即時市價與主行情接近，折溢價資料可靠度較高。",
  };
}

function etfLiquidityDetail(stock) {
  const ratio = Number(stock?.volumeRatio);
  const volume = Number(stock?.volume);
  const volumeText = Number.isFinite(volume) && volume > 0 ? compactNumber(volume, 1) : "-";

  if (!Number.isFinite(ratio) || ratio <= 0) {
    return {
      state: "量能待補",
      level: "neutral",
      ratioText: "-",
      summary: `目前成交量 ${volumeText}，但缺少 10 日均量或量比，折溢價需保守解讀。`,
    };
  }

  const ratioText = `${ratio.toFixed(2)}x`;

  if (ratio < 0.3) {
    return {
      state: "流動性不足",
      level: "danger",
      ratioText,
      summary: `目前成交量 ${volumeText}，量比 ${ratioText}；低量 ETF 容易被買賣價差與造市報價影響，折溢價參考性低。`,
    };
  }

  if (ratio < 0.8) {
    return {
      state: "流動性普通",
      level: "warning",
      ratioText,
      summary: `目前成交量 ${volumeText}，量比 ${ratioText}；可參考折溢價，但仍需搭配限價與技術面。`,
    };
  }

  return {
    state: "流動性較正常",
    level: "good",
    ratioText,
    summary: `目前成交量 ${volumeText}，量比 ${ratioText}；折溢價資料的可參考性較高。`,
  };
}

function etfTechnicalTrendDetail(stock) {
  const price = Number(stock?.price);
  const ma20 = Number(stock?.ma20);
  const ma5 = Number(stock?.ma5);
  const macdState = String(stock?.macdState || "");
  const kdState = String(stock?.kdState || "");
  const volatilityState = String(stock?.volatilityState || "");
  const atrPct = Number(stock?.atrPct);

  const hasTrendData = Number.isFinite(price) && price > 0 && (Number.isFinite(ma20) || Number.isFinite(ma5) || macdState || kdState);
  if (!hasTrendData) {
    return {
      state: "技術待補",
      level: "neutral",
      summary: "ETF 技術資料尚未完整，折溢價暫時只能當輔助資訊。",
    };
  }

  const belowMa20 = Number.isFinite(ma20) && ma20 > 0 && price < ma20;
  const aboveMa20 = Number.isFinite(ma20) && ma20 > 0 && price >= ma20;
  const macdWeak = /轉弱|空方|收斂/.test(macdState);
  const kdWeak = /轉弱|偏弱|低檔弱勢/.test(kdState);
  const volatilityHigh = /升高|過大/.test(volatilityState) || (Number.isFinite(atrPct) && atrPct >= 4);

  if ((belowMa20 && (macdWeak || kdWeak)) || volatilityHigh) {
    return {
      state: volatilityHigh ? "波動風險升高" : "技術偏弱",
      level: "warning",
      summary: "ETF 技術面或波動風險轉弱，折價不宜直接解讀為便宜，溢價則更要避免追價。",
    };
  }

  if (aboveMa20 && !macdWeak && !kdWeak) {
    return {
      state: "技術穩定",
      level: "good",
      summary: "ETF 技術面相對穩定，折溢價可作為輔助觀察，但仍不進短線總分。",
    };
  }

  return {
    state: "技術中性",
    level: "neutral",
    summary: "ETF 技術面未明顯轉強或轉弱，折溢價不宜單獨作判斷。",
  };
}

function etfAuxiliaryRiskSummary({ premium, consistency, liquidity, intraday, technical }) {
  const warningCount = [premium, consistency, liquidity, technical].filter((item) => item?.level === "warning").length;
  const premiumState = String(premium?.state || "");
  const intradayState = String(intraday?.state || "");
  const liquidityGood = liquidity?.level === "good";
  const liquidityWeak = liquidity?.level === "danger" || liquidity?.level === "warning";
  const technicalGood = technical?.level === "good";
  const technicalWeak = technical?.level === "warning";
  const priceMismatch = consistency?.level === "danger";
  const hasPremiumData = premiumState && premiumState !== "待資料";

  if (priceMismatch) {
    return {
      state: "資料可靠度偏低",
      level: "danger",
      summary: "ETF：資料可靠度偏低，市價來源落差過大，折溢價暫不作判斷。",
    };
  }

  if (!hasPremiumData) {
    return {
      state: "折溢價待資料",
      level: "neutral",
      summary: "ETF：折溢價資料不足，暫不判斷價差陷阱，先看量能與技術面。",
    };
  }

  if (premiumState.includes("高溢價")) {
    return {
      state: "高溢價警示",
      level: "danger",
      summary: "ETF：溢價偏高，追價價差風險升高，短線不宜急追。",
    };
  }

  if (premiumState.includes("高折價") && liquidityWeak) {
    return {
      state: "流動性陷阱警示",
      level: "warning",
      summary: "ETF：折價但量能不足，需防流動性陷阱，折價不等於真的便宜。",
    };
  }

  if ((premiumState.includes("高折價") || premiumState.includes("小幅折價")) && technicalWeak) {
    return {
      state: "弱勢折價警示",
      level: "warning",
      summary: "ETF：折價但技術尚未轉強，先列觀察，不宜只因折價進場。",
    };
  }

  if (intradayState.includes("波動偏大") || intradayState.includes("波動升高")) {
    return {
      state: "日內波動警示",
      level: intradayState.includes("偏大") ? "warning" : "neutral",
      summary: "ETF：日內波動偏大，折溢價容易失真，需等價格收斂後再評估。",
    };
  }

  if (premiumState.includes("小幅溢價") && liquidityGood) {
    return {
      state: "小幅溢價觀察",
      level: "neutral",
      summary: "ETF：小幅溢價但量能正常，追價風險有限，建議避免市價單急追。",
    };
  }

  if ((premiumState.includes("小幅折價") || premiumState.includes("高折價")) && liquidityGood) {
    return {
      state: "折價觀察",
      level: "good",
      summary: "ETF：小幅折價且量能正常，價差風險較低，可列入觀察。",
    };
  }

  if (premium?.level === "good" && liquidityGood && technicalGood) {
    return {
      state: "價格結構健康",
      level: "good",
      summary: "ETF：折溢價接近合理，量能正常，主要依短線分數與技術面判斷。",
    };
  }

  if (liquidityGood && technicalGood && warningCount === 0) {
    return {
      state: "輔助條件穩定",
      level: "good",
      summary: "ETF：量能正常且技術偏強，折溢價未見明顯陷阱，避免追高即可。",
    };
  }

  return {
    state: "輔助觀察中性",
    level: "neutral",
    summary: "ETF：折溢價未見異常，暫無明顯價差陷阱，主要看短線分數與量能。",
  };
}

function buildEtfRiskAnalysis(stock) {
  if (!isEtfAsset(stock)) return null;

  const sourcePage = stock.yahooEtfSource === "official_etf_inav" ? "即時估值" : stock.yahooEtfSourcePage === "premium" ? "溢價排行" : stock.yahooEtfSourcePage === "discount" ? "折價排行" : "ETF 頁";
  const hasData = hasYahooEtfData(stock);
  const premium = yahooEtfPremiumDetail(stock.yahooEtfPremiumDiscountPct);
  const intraday = yahooEtfIntradayRangeDetail(stock.yahooEtfRangeSpread, stock.yahooEtfMarketPrice);
  const consistency = etfPriceConsistencyDetail(stock);
  const liquidity = etfLiquidityDetail(stock);
  const technical = etfTechnicalTrendDetail(stock);
  const risk = etfAuxiliaryRiskSummary({ premium, consistency, liquidity, intraday, technical });

  const summaryLine = hasData
    ? risk.summary
    : "ETF：折溢價資料不足，暫不判斷價差陷阱，先看量能與技術面。";
  const level = hasData ? risk.level : "unknown";
  const levelMeta = etfRiskLevelMeta(level);
  const compactLine = `${levelMeta.shortLabel}：${summaryLine.replace(/^ETF：/, "")}`;

  return {
    hasData,
    sourcePage,
    premium,
    intraday,
    consistency,
    liquidity,
    technical,
    risk,
    level,
    levelLabel: levelMeta.label,
    levelShortLabel: levelMeta.shortLabel,
    levelDescription: levelMeta.description,
    summaryLine,
    compactLine,
  };
}

function etfRiskToneClass(level) {
  if (level === "danger") return "border-rose-200 bg-rose-50 text-rose-700";
  if (level === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (level === "neutral") return "border-amber-200 bg-amber-50 text-amber-700";
  if (level === "good") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (level === "unknown") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function etfRiskLevelMeta(level) {
  if (level === "danger") return { label: "紅燈｜價差陷阱警示", shortLabel: "ETF 紅燈", description: "追價、流動性或價格失真風險偏高。" };
  if (level === "warning") return { label: "黃燈｜注意價差", shortLabel: "ETF 黃燈", description: "可觀察，但不宜單看折溢價或急追。" };
  if (level === "good") return { label: "綠燈｜價格結構健康", shortLabel: "ETF 綠燈", description: "價差陷阱風險較低，仍需搭配短線分數與技術面。" };
  if (level === "unknown") return { label: "灰燈｜資料不足", shortLabel: "ETF 灰燈", description: "折溢價資料不足，暫不作價差陷阱判斷。" };
  return { label: "黃燈｜觀察", shortLabel: "ETF 觀察", description: "未見明確警訊，仍需搭配量能與技術面。" };
}

function yahooEtfPremiumRuleText() {
  return `ETF 不適用股票本益比、EPS、ROE、毛利率等個股基本面欄位，因此折溢價只能作 ETF 專用輔助觀察，不能單獨解讀為買賣訊號。

ETF 輔助判斷要同時看五件事：
1. 折溢價：判斷市價相對淨值是否追價或折價。
2. 市價一致性：即時市價需接近主行情，否則折溢價可靠度下降。
3. 流動性：量比過低時，折溢價可能被買賣價差或造市報價扭曲。
4. 日內波動：區間差過大時，折溢價容易失真。
5. 技術同步：折價但技術轉弱不等於便宜，溢價且技術過熱則追價風險更高。

折溢價初步標準：
-0.30% ～ +0.30%：接近淨值，價格相對正常。
+0.30% ～ +0.80%：小幅溢價，追價風險略升。
> +0.80%：高溢價，不宜追價，等待溢價收斂較佳。
-0.30% ～ -0.80%：小幅折價，需觀察是否為短線賣壓。
< -0.80%：高折價，需確認流動性、成分資產波動與市場風險。

這個 ETF 輔助風險小卡不改變主行情與短線總分，也不作為單獨買賣訊號。`;
}

function YahooEtfInfoCard({ stock }) {
  const analysis = buildEtfRiskAnalysis(stock);
  if (!analysis) return null;

  if (!analysis.hasData) {
    return (
      <details className="group rounded-2xl border border-slate-200 bg-slate-50 p-3 text-base md:p-4 md:text-lg">
        <summary className="flex cursor-pointer select-none items-center justify-between gap-3 list-none">
          <div className="min-w-0">
            <div className="text-lg font-black text-slate-900 md:text-xl">ETF 輔助資訊</div>
            <div className="mt-1 text-sm font-medium leading-6 text-slate-600 md:text-base">即時估值尚未取得，先回到主行情與技術面判斷。</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge className={cx("text-sm md:text-base", etfRiskToneClass(analysis.level))}>{analysis.levelLabel}</Badge>
            <span className="text-xl font-black text-slate-400 transition group-open:rotate-90">▸</span>
          </div>
        </summary>
        <div className={`mt-3 rounded-xl border p-3 text-base md:text-lg ${etfRiskToneClass(analysis.level)}`}>
          <div className="font-bold">{analysis.summaryLine}</div>
          <div className="mt-2 leading-7">ETF 輔助資訊只作折溢價與流動性檢查，不進短線分數。</div>
        </div>
      </details>
    );
  }

  const { sourcePage, premium, intraday, consistency, liquidity, technical, summaryLine, level, levelLabel } = analysis;
  const quickChecks = [
    { label: "折溢價", value: premium.state, tone: premium.level },
    { label: "市價", value: consistency.state, tone: consistency.level },
    { label: "量能", value: liquidity.state, tone: liquidity.level },
    { label: "波動", value: intraday.state, tone: intraday.level },
    { label: "技術", value: technical.state, tone: technical.level },
  ];

  return (
    <details className="group rounded-2xl border border-slate-200 bg-slate-50 p-3 text-base md:p-4 md:text-lg">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 list-none">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-black text-slate-900 md:text-xl">ETF 輔助資訊</span>
            <Badge className="bg-slate-100 text-sm text-slate-700 md:text-base">{sourcePage}</Badge>
          </div>
          <div className="mt-1 text-sm font-semibold leading-6 text-slate-700 md:text-base">
            折溢價 {pct(stock.yahooEtfPremiumDiscountPct)}｜即時市價 {displayValue(stock.yahooEtfMarketPrice)}｜區間差 {displayValue(stock.yahooEtfRangeSpread)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge className={cx("text-sm md:text-base", etfRiskToneClass(level))}>{levelLabel}</Badge>
          <span className="text-xl font-black text-slate-400 transition group-open:rotate-90">▸</span>
        </div>
      </summary>

      <div className="mt-3 space-y-3">
        <div className={`rounded-xl border p-3 md:p-4 ${etfRiskToneClass(level)}`}>
          <div className="text-lg font-black md:text-xl">輔助結論</div>
          <div className="mt-2 text-base font-bold leading-7 md:text-lg">{summaryLine}</div>
          <div className="mt-2 text-sm leading-6 opacity-80 md:text-base">僅輔助判斷折溢價、流動性與追價風險，不改變短線主分數。</div>
        </div>

        <div className="grid gap-2 md:grid-cols-6">
          <div className="rounded-xl bg-white p-3"><div className="text-sm font-semibold text-slate-500">主行情</div><div className="mt-1 text-lg font-black">{displayValue(stock.price)}</div></div>
          <div className="rounded-xl bg-white p-3"><div className="text-sm font-semibold text-slate-500">即時市價</div><div className="mt-1 text-lg font-black">{displayValue(stock.yahooEtfMarketPrice)}</div></div>
          <div className="rounded-xl bg-white p-3"><div className="text-sm font-semibold text-slate-500">價差</div><div className="mt-1 text-lg font-black">{consistency.diffText}</div></div>
          <div className="rounded-xl bg-white p-3"><div className="text-sm font-semibold text-slate-500">折溢價</div><div className="mt-1 text-lg font-black">{pct(stock.yahooEtfPremiumDiscountPct)}</div></div>
          <div className="rounded-xl bg-white p-3"><div className="text-sm font-semibold text-slate-500">量比</div><div className="mt-1 text-lg font-black">{liquidity.ratioText}</div></div>
          <div className="rounded-xl bg-white p-3"><div className="text-sm font-semibold text-slate-500">區間差</div><div className="mt-1 text-lg font-black">{displayValue(stock.yahooEtfRangeSpread)}</div></div>
        </div>

        <div className="grid gap-2 md:grid-cols-5">
          {quickChecks.map((item) => (
            <div key={item.label} className={cx("rounded-xl border p-3", etfRiskToneClass(item.tone))}>
              <div className="text-sm font-semibold opacity-80 md:text-base">{item.label}</div>
              <div className="mt-1 text-base font-black md:text-lg">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-600 md:text-base">
          <span className="font-black text-slate-900">操作提醒：</span>{premium.action}
          <span className="ml-1">資料時間 {stock.yahooEtfFetchedAt || "-"}。</span>
        </div>
      </div>
    </details>
  );
}

function FrameworkTable({ title, subtitle, result, showScore = false, horizon, onWeightChange, onResetHorizon, stock }) {
  const isShortDesktopTemplate = horizon === "short";

  if (isShortDesktopTemplate) {
    const displayRows = getShortFrameworkDisplayRows(result.rows, stock);
    const fundamentalRow = getShortFrameworkFundamentalRow(result.rows, stock);

    return (
      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardContent className="space-y-2.5 p-2.5 md:p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h3 className="text-base font-black tracking-tight text-slate-950 md:text-lg">{title}</h3>
              <p className="mt-0.5 text-sm leading-5 text-slate-500 md:text-[15px]">{subtitle}</p>
            </div>
            {horizon && onResetHorizon && (
              <Button variant="outline" size="sm" onClick={() => onResetHorizon(horizon)} className="h-8 shrink-0 px-3 text-sm">
                恢復預設值
              </Button>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[940px] text-sm md:text-[14px]">
              <colgroup>
                <col className="w-[86px]" />
                <col className="w-[190px]" />
                <col className="w-[116px]" />
                <col className="w-[92px]" />
                <col className="w-[86px]" />
                <col />
              </colgroup>
              <thead className="bg-slate-50/80">
                <tr className="border-b text-left text-xs font-bold text-slate-500 md:text-sm">
                  <th className="px-2.5 py-2">維度</th>
                  <th className="px-2.5 py-2 whitespace-nowrap">指標</th>
                  <th className="px-2.5 py-2 text-center">權重</th>
                  <th className="px-2.5 py-2 text-center">狀態</th>
                  <th className="px-2.5 py-2 text-center">分數</th>
                  <th className="px-2.5 py-2">數據</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => (
                  <tr key={`${row.dimension}-${row.item}`} className="border-b border-slate-200/80 last:border-0 align-top hover:bg-slate-50/60">
                    <td className="px-2.5 py-2 font-bold whitespace-nowrap text-slate-900">{row.dimension}</td>
                    <td className="px-2.5 py-2 whitespace-nowrap font-medium leading-5 text-slate-900">{row.item}</td>
                    <td className="px-2.5 py-2 text-center">
                      {horizon && row.weightKey && onWeightChange ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={row.weight}
                          onChange={(e) => onWeightChange(horizon, row.weightKey, e.target.value)}
                          className="mx-auto h-8 w-24 rounded-lg border-slate-300 px-3 text-center text-sm font-semibold tabular-nums"
                        />
                      ) : row.weight.toFixed(2)}
                    </td>
                    <td className="px-2.5 py-2 text-center"><div className="flex min-h-[28px] items-center justify-center"><StatusBadge text={row.status} /></div></td>
                    <td className="px-2.5 py-2 text-center">{compareBadge(row.score)}</td>
                    <td className="px-2.5 py-2 leading-5 text-slate-600">{getShortFrameworkRowDataText(row)}</td>
                  </tr>
                ))}
                {showScore && (
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-2.5 py-2" colSpan={2}>權重合計 / 加權得分</td>
                    <td className="px-2.5 py-2 text-center">{result.totalWeight.toFixed(2)}</td>
                    <td className="px-2.5 py-2"></td>
                    <td className="px-2.5 py-2 text-center">{result.total.toFixed(2)}</td>
                    <td className="px-2.5 py-2 leading-5 text-slate-600">MACD / KD / ATR 已納入技術面；若需觀察不計分，可將權重調為 0。</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {fundamentalRow && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm md:text-[15px]">
              <div className="font-bold text-slate-900">基本面檢查</div>
              <div className="mt-1 leading-5 text-slate-600">{getShortFrameworkRowDataText(fundamentalRow)}</div>
            </div>
          )}

          <details className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-600">
            <summary className="cursor-pointer select-none font-bold text-slate-800">完整計分規則</summary>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {[...displayRows, ...(fundamentalRow ? [fundamentalRow] : [])].map((row) => (
                <div key={`rule-${row.dimension}-${row.item}`} className="rounded-lg bg-white p-2.5 shadow-sm">
                  <div className="font-bold text-slate-900">{row.dimension}｜{row.item}</div>
                  <div className="mt-1 whitespace-pre-line leading-5 text-slate-600">{getShortFrameworkRowRuleText(row) || "此列暫無額外規則說明。"}</div>
                </div>
              ))}
            </div>
            {isEtfAsset(stock) && (
              <div className="mt-2 rounded-lg bg-white p-2.5 shadow-sm">
                <div className="font-bold text-slate-900">ETF 專用｜折溢價輔助判斷</div>
                <div className="mt-1 whitespace-pre-line leading-5 text-slate-600">{yahooEtfPremiumRuleText()}</div>
              </div>
            )}
          </details>
        </CardContent>
      </Card>
    );
  }

  return <Card className="rounded-xl shadow-sm"><CardContent className="p-3 space-y-3"><div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between"><div><h3 className="text-lg font-semibold">{title}</h3><p className="text-[15px] text-slate-500 mt-1">{subtitle}</p></div>{horizon && onResetHorizon && <Button variant="outline" size="sm" onClick={() => onResetHorizon(horizon)} className="shrink-0">恢復預設值</Button>}</div><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[1260px] text-[15px]"><colgroup><col className="w-[112px]" /><col className="w-[340px]" /><col className="w-[104px]" /><col className="w-[150px]" /><col className="w-[130px]" /><col className="w-[280px]" /><col className="w-[360px]" /></colgroup><thead className="bg-white"><tr className="border-b text-left text-slate-500"><th className="px-3 py-3">維度</th><th className="px-3 py-3 whitespace-nowrap">指標 / 資料檢查</th><th className="px-3 py-3 text-center">權重</th><th className="px-3 py-3 text-center">狀態</th><th className="px-3 py-3 text-center">分數</th><th className="px-3 py-3">規則 / 數據</th><th className="px-3 py-3">公式解釋</th></tr></thead><tbody>{result.rows.map((row) => <tr key={`${row.dimension}-${row.item}`} className="border-b last:border-0"><td className="px-3 py-3 align-top font-medium whitespace-nowrap">{row.dimension}</td><td className="px-3 py-3 align-top whitespace-nowrap leading-6">{row.item}</td><td className="px-3 py-3 align-top text-center">{horizon && row.weightKey && onWeightChange ? <Input type="number" step="0.01" min="0" max="1" value={row.weight} onChange={(e) => onWeightChange(horizon, row.weightKey, e.target.value)} className="mx-auto h-8 w-20 rounded-lg border-slate-300 px-2 text-right text-[15px] font-medium" /> : row.weight.toFixed(2)}</td><td className="px-3 py-3 align-top"><div className="flex min-h-[32px] items-center justify-center"><StatusBadge text={row.status} /></div></td><td className="px-3 py-3 align-top text-center">{compareBadge(row.score)}</td><td className="px-3 py-3 align-top text-slate-600 leading-6">{row.rule}</td><td className="px-3 py-3 align-top text-slate-500 leading-6">{row.explain || row.source}</td></tr>)}{showScore && <tr className="bg-slate-50 font-semibold"><td className="px-3 py-3" colSpan={2}>權重合計 / 加權得分</td><td className="px-3 py-3 text-center">{result.totalWeight.toFixed(2)}</td><td className="px-3 py-3"></td><td className="px-3 py-3"></td><td className="px-3 py-3">{result.total.toFixed(2)}</td><td className="px-3 py-3">分數改為 0～1 連續分；合計建議維持 1.00。</td></tr>}</tbody></table></div></CardContent></Card>;
}


function applyIntradayQuoteGateToShortScore(result, stock) {
  const readiness = getIntradayQuoteReadiness(stock);
  if (readiness.ready) {
    return { ...result, quoteReadiness: readiness, quotePending: false };
  }

  return {
    ...result,
    quotePending: true,
    quoteReadiness: readiness,
    rawScoreBeforeQuoteReady: result.score100,
    score100: 0,
    total: 0,
    stopLoss: {
      ...(result.stopLoss || {}),
      quotePending: true,
      quotePendingReason: readiness.reason,
      quoteReadiness: readiness,
    },
  };
}

function scoreShortV1Display(stock, weightConfig = DEFAULT_WEIGHT_CONFIG) {
  return applyIntradayQuoteGateToShortScore(scoreShortV1(stock, weightConfig), stock);
}


function twseMisRowsHaveNewTradeTime(rows = [], latestMap = {}) {
  return rows.some((row) => {
    const symbol = normalizeStockSymbol(row?.symbol || row?.stock_id || row?.c);
    const tradeTime = String(row?.tradetime || row?.updatedAt || "").trim();
    if (!symbol || !tradeTime) return false;
    return latestMap[symbol] !== tradeTime;
  });
}

function twseMisRowsHaveQuoteImprovement(rows = [], currentStocks = []) {
  const currentBySymbol = new Map(
    (Array.isArray(currentStocks) ? currentStocks : [])
      .map((stock) => [normalizeStockSymbol(stock?.symbol), stock])
      .filter(([symbol]) => symbol)
  );

  return rows.some((row) => {
    const symbol = normalizeStockSymbol(row?.symbol || row?.stock_id || row?.c);
    if (!symbol) return false;
    const current = currentBySymbol.get(symbol) || {};

    const incomingPrice = getTwseMisUsablePrice(row);
    const currentPrice = parseNum(current.price, null);
    if (incomingPrice !== null && !(currentPrice !== null && currentPrice > 0)) return true;

    const incomingVolume = parseNum(row?.volume, null);
    const currentVolume = parseNum(current.volume, null);
    if (incomingVolume !== null && incomingVolume > 0 && !(currentVolume !== null && currentVolume > 0)) return true;

    return false;
  });
}

function updateTwseMisLatestTradeTime(rows = [], latestRef) {
  if (!latestRef?.current) return;
  rows.forEach((row) => {
    const symbol = normalizeStockSymbol(row?.symbol || row?.stock_id || row?.c);
    const tradeTime = String(row?.tradetime || row?.updatedAt || "").trim();
    if (symbol && tradeTime) latestRef.current[symbol] = tradeTime;
  });
}


function compactGoogleCsvRowsPreview(googleDebug, maxRows = 20) {
  const rows = Array.isArray(googleDebug?.rawFieldPreview) ? googleDebug.rawFieldPreview : [];
  if (!rows.length) return "無";

  return rows.slice(0, maxRows).map((row) => {
    const symbol = row.symbol || row.ticker || "-";
    const name = row.name || "";
    const price = row.price || "-";
    const volume = row.volume || "-";
    const ratio = row.volumeRatio || "-";
    const trade = row.tradetime || "-";
    const updated = row.updatedAt || "-";
    return `${symbol}${name ? ` ${name}` : ""}｜價 ${price}｜量 ${volume}｜量比 ${ratio}｜行情 ${trade}｜Sheet ${updated}`;
  }).join("\n");
}

function compactGoogleAcceptedPreview(googleDebug, maxRows = 20) {
  const map = googleDebug?.rawDataMap || {};
  const rows = Object.entries(map).slice(0, maxRows);
  if (!rows.length) return "無";
  return rows.map(([symbol, row]) => `${normalizeStockSymbol(symbol)}｜價 ${row?.price ?? "-"}｜量 ${row?.volume ?? "-"}｜量比 ${row?.volumeRatio ?? "-"}｜行情 ${row?.tradetime || "-"}`).join("\n");
}

function compactGoogleStalePreview(googleDebug, maxRows = 20) {
  const rows = Array.isArray(googleDebug?.staleSymbols) ? googleDebug.staleSymbols : [];
  if (!rows.length) return "無";
  const shown = rows.slice(0, maxRows).join("\n");
  return rows.length > maxRows ? `${shown}\n...另 ${rows.length - maxRows} 檔` : shown;
}

function SourceConnectorTable({ config, onConfigChange, onSmartRefresh, onLoadGoogle, onLoadFinMind, onLoadTwse, onLoadTwseHistory, onLoadTwseMis, onLoadMarket, onLoadDerivatives, onLoadYahoo, onLoadYahooEtf, onLoadOfficialEtfInav, loading, apiMessage, lastFetchMap, sourceRuntimeMap = {}, stocks, googleDebug }) {
  const sourceDisplayOrder = [
    "twse_mis",
    "official_etf_inav",
    "google_csv",
    "twse_proxy",
    "twse_history_snapshot",
    "finmind_proxy",
    "finmind_market",
    "finmind_derivatives",
    "yahoo_ohlcv",
    "yahoo_etf",
  ];

  const sourceStageLabel = {
    twse_mis: "即時核心",
    official_etf_inav: "即時核心",
    google_csv: "即時輔助",
    twse_proxy: "盤後官方",
    twse_history_snapshot: "日線主資料",
    finmind_proxy: "技術驗證",
    finmind_market: "市場補資料",
    finmind_derivatives: "風險補資料",
    yahoo_ohlcv: "備援驗證",
    yahoo_etf: "備援資料",
  };

  const policies = sourceDisplayOrder.map((source) => {
    const runtime = sourceRuntimeMap[source];
    const frontFetch = formatLastFetch(lastFetchMap, source);
    return {
      source,
      stageLabel: sourceStageLabel[source] || "資料源",
      ...getSourcePolicy(source),
      lastFetch: formatSourceRuntimeInfo(runtime, frontFetch),
      frontFetch,
      runtime,
    };
  });

  const policyBySource = Object.fromEntries(policies.map((item) => [item.source, item]));
  const sourceGroups = [
    {
      title: "即時區",
      description: "短 TTL；盤中主價量、ETF 即時估值與 Google 輔助行情。",
      sources: ["twse_mis", "official_etf_inav", "google_csv"],
    },
    {
      title: "非即時資料區",
      description: "啟動預熱 / 主更新；TWSE 固定時段、FinMind 1 小時 TTL。",
      sources: ["twse_proxy", "twse_history_snapshot", "finmind_proxy", "finmind_market", "finmind_derivatives"],
    },
    {
      title: "救援區",
      description: "備援與抽樣驗證；不覆蓋主資料、不參與短線分數。",
      sources: ["yahoo_ohlcv", "yahoo_etf"],
    },
  ].map((group) => ({
    ...group,
    items: group.sources.map((source) => policyBySource[source]).filter(Boolean),
  }));
  return <Card className="rounded-xl shadow-sm"><CardContent className="p-3 space-y-3"><h3 className="font-semibold flex items-center gap-2"><Icon name="doc" /> 資料來源串接層</h3><p className="text-xs text-slate-500">此區只看 runtime 狀態：資料時間、快取命中與前端觸發；完整角色與更新規則看下方總覽。</p><div className="grid gap-2 md:grid-cols-3">
  <Input placeholder="TWSE MIS URL，例如 /api/twse/mis" value={config.twseMisProxyUrl || DEFAULT_TWSE_MIS_PROXY_URL} onChange={(e) => onConfigChange({ ...config, twseMisProxyUrl: e.target.value })} />
  <Input placeholder="ETF 即時估值 URL，例如 /api/etf/inav" value={config.etfInavProxyUrl || DEFAULT_ETF_INAV_PROXY_URL} onChange={(e) => onConfigChange({ ...config, etfInavProxyUrl: e.target.value })} />
  <Input placeholder="Google Sheet 公開 CSV URL" value={config.googleCsvUrl} onChange={(e) => onConfigChange({ ...config, googleCsvUrl: e.target.value })} />

  <Input placeholder="TWSE OpenAPI URL，例如 /api/twse/stocks" value={config.twseProxyUrl} onChange={(e) => onConfigChange({ ...config, twseProxyUrl: e.target.value })} />
  <Input placeholder="TWSE Snapshot URL，例如 /api/twse/history" value={config.twseHistoryProxyUrl || DEFAULT_TWSE_HISTORY_PROXY_URL} onChange={(e) => onConfigChange({ ...config, twseHistoryProxyUrl: e.target.value })} />
  <Input placeholder="FinMind Daily URL，例如 /api/finmind/stocks" value={config.finmindProxyUrl} onChange={(e) => onConfigChange({ ...config, finmindProxyUrl: e.target.value })} />
  <Input placeholder="FinMind Market URL，例如 /api/finmind/market" value={config.finmindMarketProxyUrl} onChange={(e) => onConfigChange({ ...config, finmindMarketProxyUrl: e.target.value })} />

  <Input placeholder="FinMind Derivatives URL，例如 /api/finmind/derivatives" value={config.finmindDerivativesProxyUrl} onChange={(e) => onConfigChange({ ...config, finmindDerivativesProxyUrl: e.target.value })} />
  <Input placeholder="Yahoo OHLCV 備援 URL，例如 /api/yahoo/ohlcv" value={config.yahooOhlcvProxyUrl} onChange={(e) => onConfigChange({ ...config, yahooOhlcvProxyUrl: e.target.value })} />
  <Input placeholder="Yahoo ETF 備援 URL，例如 /api/yahoo/etf" value={config.yahooEtfProxyUrl} onChange={(e) => onConfigChange({ ...config, yahooEtfProxyUrl: e.target.value })} />
</div><div className="flex flex-wrap items-center gap-2">
  <Button onClick={onSmartRefresh} disabled={loading || (!config.googleCsvUrl && !config.finmindProxyUrl && !config.twseProxyUrl && !config.twseHistoryProxyUrl && !config.twseMisProxyUrl && !config.finmindMarketProxyUrl && !config.finmindDerivativesProxyUrl && !config.yahooOhlcvProxyUrl && !config.yahooEtfProxyUrl)}>更新資料</Button>
  {apiMessage && <Badge className={apiMessage.includes("成功") || apiMessage.includes("已更新") ? "bg-emerald-100 text-emerald-800" : "bg-yellow-100 text-yellow-800"}>{apiMessage}</Badge>}
</div>
<details className="rounded-xl border border-dashed bg-slate-50 p-3 text-xs text-slate-600">
  <summary className="cursor-pointer select-none font-semibold text-slate-800">進階測試來源</summary>
  <div className="mt-3 flex flex-wrap gap-2">
    <Button onClick={onLoadTwse} disabled={loading || !config.twseProxyUrl}>讀取 TWSE</Button>
    <Button onClick={() => onLoadTwseHistory && onLoadTwseHistory()} disabled={loading || !config.twseHistoryProxyUrl}>TWSE Snapshot</Button>
    <Button onClick={onLoadTwseMis} disabled={loading || !config.twseMisProxyUrl}>TWSE MIS 盤中主價量</Button>
    <Button onClick={() => onLoadFinMind(null, "full")} disabled={loading || !config.finmindProxyUrl}>FinMind Full</Button><Button onClick={onLoadMarket} disabled={loading || !config.finmindMarketProxyUrl}>讀取 Market</Button><Button onClick={onLoadDerivatives} disabled={loading || !config.finmindDerivativesProxyUrl}>讀取 Derivatives</Button><Button onClick={onLoadYahoo} disabled={loading || !config.yahooOhlcvProxyUrl}>Yahoo 抽樣驗證</Button><Button onClick={onLoadOfficialEtfInav} disabled={loading || !config.etfInavProxyUrl}>ETF 即時估值</Button><Button onClick={onLoadYahooEtf} disabled={loading || !config.yahooEtfProxyUrl}>ETF 備援</Button>
  </div>
  <div className="mt-2 text-slate-400">開發測試用；GoogleFinance 已由上方「更新資料」與 20 秒自動刷新處理。FinMind 啟動預熱與主更新預設跑 profile=score 供分數使用；這裡的 FinMind Full 供 debug / 重建 lastGoodFull baseline。資料來源卡片顯示資料時間，不是抓取時間。</div>
</details>
<div className="space-y-3">
  {sourceGroups.map((group) => (
    <section key={group.title} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-900">{group.title}</div>
          <div className="mt-0.5 text-xs text-slate-500">{group.description}</div>
        </div>
        <Badge className="bg-white text-slate-700">{group.items.length} 個來源</Badge>
      </div>
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
        {group.items.map((item) => (
          <div key={item.source} className="rounded-lg border bg-white p-3 text-xs text-slate-600">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-900">{item.label}</span>
              <Badge className="bg-slate-100 text-slate-700">{item.stageLabel}</Badge>
            </div>
            <div>Timeout：{item.timeoutMs / 1000} 秒</div>
            <div>手動冷卻：{formatDurationMs(item.cooldownMs)}</div>
            <div>自動刷新：{formatPolicyAutoRefresh(item)}</div>
            <div>資料 / 快取：{item.lastFetch}</div>
            {item.runtime?.routeDataTimeText ? <div className="text-slate-500">資料時間：{item.runtime.routeDataTimeText}</div> : null}
            {item.runtime?.cache ? <div className="text-slate-500">{explainCacheRuntime(item.runtime)}</div> : null}
            <div>前端觸發：{item.frontFetch}</div>
            <div className="mt-1 text-slate-400 line-clamp-2">{item.cacheNote}</div>
          </div>
        ))}
      </div>
    </section>
  ))}

</div></CardContent></Card>;
}

function GoogleDiagnosticsSection({ googleDebug, stocks }) {
  const googleTemplate = buildGoogleVerifySheetTemplate(stocks);
  return <div className="space-y-3">
    {googleDebug && <div className="rounded-xl border bg-white p-3 text-xs text-slate-600"><div className="font-semibold text-slate-900">Google CSV 讀取診斷</div>{googleDebug.error ? <div className="text-red-600">錯誤：{googleDebug.error}</div> : <div className="space-y-1"><div>讀取方式：{googleDebug.mode}</div><div>CSV 列數：{googleDebug.parsedRows}</div><div>已對上：{googleDebug.matchedSymbols?.join(", ") || "無"}</div><div>未對上：{googleDebug.unmatchedSymbols?.join(", ") || "無"}</div><div>欄位：{googleDebug.headers?.join(" / ") || "無"}</div><div>rawDataMap：{googleDebug.rawDataMap ? Object.keys(googleDebug.rawDataMap).join(" / ") : "無"}</div>
    <div>接受更新：{Array.isArray(googleDebug.acceptedSymbols) && googleDebug.acceptedSymbols.length ? `${googleDebug.acceptedSymbols.length} 檔｜${googleDebug.acceptedSymbols.slice(0, 12).join(" / ")}${googleDebug.acceptedSymbols.length > 12 ? ` ...另 ${googleDebug.acceptedSymbols.length - 12} 檔` : ""}` : "無"}{Array.isArray(googleDebug.staleSymbols) && googleDebug.staleSymbols.length ? `；略過舊快照 ${googleDebug.staleSymbols.length} 檔` : ""}</div>
    <div className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2">CSV 關鍵摘要：{compactGoogleCsvRowsPreview(googleDebug, 20)}</div>
    <div className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2">已採用行情：{compactGoogleAcceptedPreview(googleDebug, 20)}</div>
    <div className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-amber-50 p-2 text-amber-800">略過舊快照明細：{compactGoogleStalePreview(googleDebug, 20)}</div>
    <div>欄位完整度：{googleDebug.formulaCompleteness !== undefined ? googleDebug.formulaCompleteness : "-"}{googleDebug.fetchAttempts ? `；抓取次數 ${googleDebug.fetchAttempts}` : ""}{Number(googleDebug.formulaCompleteness || 0) > 0 && Number(googleDebug.formulaCompleteness || 0) < 0.5 ? "；本輪公式欄不完整，畫面會保留上一輪成功值" : ""}</div>
    </div>}</div>}
    <div className="rounded-xl border bg-slate-50 p-3 space-y-2"><div className="font-semibold text-slate-900">Google 驗證模板</div><p className="text-xs text-slate-500">複製下方內容貼到 Google Sheet A1，等待 GOOGLEFINANCE 公式跑出數字後，將試算表發佈成 CSV，再把公開 CSV URL 貼回上方讀取。公式會依列號自動對齊，新增 2454 / 其他股票時不要讓公式固定在 C2。正式讀取會讀整份 CSV，因此重新整理頁面後也會把 CSV 裡的新股票加回 App；App 不會寫入或重建 Google Sheet。</p><textarea className="h-36 w-full rounded-lg border bg-white p-2 font-mono text-xs text-slate-700" readOnly value={googleTemplate} /></div>
  </div>;
}

export default function StockShortV1App() {
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const debugValue = new URLSearchParams(window.location.search).get("debug");
    setShowDebugPanel(DEBUG_QUERY_KEYS.has(String(debugValue || "").toLowerCase()));
  }, []);

  const [stocks, setStocks] = useState(initialStocks);
  const [selected, setSelected] = useState("");
  const [lastSelectedSymbol, setLastSelectedSymbol] = useState("");
  const [newAsset, setNewAsset] = useState({ symbol: "", name: "", type: "股票", market: "TWSE" });
  const [addError, setAddError] = useState("");
  const [insightTarget, setInsightTarget] = useState(null);
  const [dataMode, setDataMode] = useState(DEFAULT_DATA_MODE);
  const [apiConfig, setApiConfig] = useState({ googleCsvUrl: DEFAULT_GOOGLE_SHEET_CSV_URL, finmindProxyUrl: DEFAULT_FINMIND_PROXY_URL, finmindMarketProxyUrl: DEFAULT_FINMIND_MARKET_PROXY_URL, finmindDerivativesProxyUrl: DEFAULT_FINMIND_DERIVATIVES_PROXY_URL, twseProxyUrl: DEFAULT_TWSE_PROXY_URL, twseMisProxyUrl: DEFAULT_TWSE_MIS_PROXY_URL, yahooOhlcvProxyUrl: DEFAULT_YAHOO_OHLCV_PROXY_URL, yahooEtfProxyUrl: DEFAULT_YAHOO_ETF_PROXY_URL, etfInavProxyUrl: DEFAULT_ETF_INAV_PROXY_URL, twseHistoryProxyUrl: DEFAULT_TWSE_HISTORY_PROXY_URL });
  const [apiLoading, setApiLoading] = useState(false);
  const googleRefreshingRef = useRef(false);
  const googleAutoRequestSeqRef = useRef(0);
  const googleLatestTradeTimeRef = useRef({});
  const twseMisRefreshingRef = useRef(false);
  const startupCacheWarmupRef = useRef(false);
  const startupFinMindWarmupRef = useRef(false);
  const scheduledOfficialCacheSlotRef = useRef("");
  const twseMisLatestTradeTimeRef = useRef({});
  const googleLatestTradeTimeTextRef = useRef({});
  const [apiMessage, setApiMessage] = useState("");
  const [marketIndex, setMarketIndex] = useState(null);
  const [lastFetchMap, setLastFetchMap] = useState({});
  const [sourceRuntimeMap, setSourceRuntimeMap] = useState({});
  const [validationMap, setValidationMap] = useState({});
  const [googleDebug, setGoogleDebug] = useState(null);
    const [weightConfig, setWeightConfig] = useState(cloneWeightConfig());

  const [stocksHydrated, setStocksHydrated] = useState(false);

  useEffect(() => {
    const persisted = loadPersistedStocks();
    if (persisted?.length) {
      setStocks(persisted);
    }
    setStocksHydrated(true);
  }, []);

  useEffect(() => {
    if (!stocksHydrated) return;
    try {
      window.localStorage.setItem(STOCKS_STORAGE_KEY, JSON.stringify(stocks));
    } catch {
      // ignore localStorage write failures
    }
  }, [stocks, stocksHydrated]);

  useEffect(() => {
    setStocks((prev) => fillNamesFromValidationMap(prev, validationMap));
  }, [validationMap]);

  const current = stocks.find((s) => s.symbol === selected) || stocks.find((s) => s.symbol === lastSelectedSymbol) || stocks[0];
  const derived = getDerived(current);
  const overviewRows = useMemo(() => buildOverviewRows(stocks, validationMap, weightConfig), [stocks, validationMap, weightConfig]);
  const activeInsightRow = insightTarget ? overviewRows.find((row) => row.stock.symbol === insightTarget.symbol) : null;
  const activeInsight = insightTarget ? getHorizonInsight(activeInsightRow, insightTarget.horizon) : null;
  function handleSelectSymbol(symbol) {
    if (symbol) setLastSelectedSymbol(symbol);
    setSelected((prev) => (prev === symbol ? "" : symbol));
  }
  function handleInsightRequest(symbol, horizon) {
    if (symbol) setLastSelectedSymbol(symbol);
    setSelected(symbol);
    setInsightTarget({ symbol, horizon });
  }
  function recordSourceRuntime(source, runtime) {
    if (!source || !runtime) return;
    setSourceRuntimeMap((prev) => ({
      ...prev,
      [source]: {
        ...(prev[source] || {}),
        ...runtime,
        updatedAt: Date.now(),
      },
    }));
  }

  const shortV1 = useMemo(() => scoreShortV1Display(current, weightConfig), [current, weightConfig]);
  const midV1 = useMemo(() => scoreMidV1(current, weightConfig), [current, weightConfig]);
  const longV1 = useMemo(() => scoreLongV1(current, weightConfig), [current, weightConfig]);
  const recommendation = getShortRecommendation(shortV1.total, shortV1.stopLoss);

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
    if (stocks.length >= MAX_TRACKED_ASSETS) { setAddError(`目前上限為 ${MAX_TRACKED_ASSETS} 檔；若要新增，請先移除其他標的。`); return; }
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


  async function loadGoogleCsv(options = {}) {
    const { silent = false, skipCooldown = false, requestSeq = null } = options || {};
    const source = "google_csv";
    const policy = getSourcePolicy(source);
    if (!skipCooldown) {
      const refresh = canRefreshSource(lastFetchMap, source, policy.cooldownMs);
      if (!refresh.ok) {
        if (!silent) setApiMessage(`Google CSV 冷卻中：${refresh.remainSec} 秒`);
        return { ok: false, skipped: true, reason: "cooldown", remainSec: refresh.remainSec, symbols: [] };
      }
    }
    if (!apiConfig.googleCsvUrl) {
      if (!silent) setApiMessage("請先貼上 Google Sheet 發佈 CSV URL");
      return { ok: false, skipped: true, reason: "missing_google_csv_url", symbols: [] };
    }
    if (!silent) {
      setApiLoading(true);
      setApiMessage("讀取中...");
    }
    try {
      // 讀整份 Google CSV，不只讀目前 App 記憶體裡的股票。
      // 否則重新整理頁面後，initialStocks 只有預設檔，CSV 裡新增的 2454 會被 symbols filter 掉。
      const url = `/api/google/verify?url=${encodeURIComponent(apiConfig.googleCsvUrl)}&_=${Date.now()}`;
      const res = await fetchWithTimeout(url, { cache: "no-store" }, policy.timeoutMs);
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`);

      if (requestSeq !== null && requestSeq !== googleAutoRequestSeqRef.current) {
        return { ok: false, skipped: true, reason: "stale_google_response", symbols: [] };
      }

      const rawDataMap = json.rawDataMap || {};
      const acceptedRawDataMap = {};
      const staleSymbols = [];

      Object.entries(rawDataMap).forEach(([symbol, google]) => {
        const normalizedSymbol = normalizeStockSymbol(symbol);
        const incomingMs = parseGoogleTradeTimeMs(google?.tradetime);
        const previousMs = googleLatestTradeTimeRef.current[normalizedSymbol] || 0;

        if (previousMs && (!incomingMs || incomingMs < previousMs)) {
          const currentText = googleLatestTradeTimeTextRef.current[normalizedSymbol] || "current-newer";
          staleSymbols.push(`${normalizedSymbol}:${google?.tradetime || "no-tradetime"} < 已採用 ${currentText}`);
          return;
        }

        acceptedRawDataMap[symbol] = google;
        if (incomingMs && incomingMs >= previousMs) {
          googleLatestTradeTimeRef.current[normalizedSymbol] = incomingMs;
          googleLatestTradeTimeTextRef.current[normalizedSymbol] = google?.tradetime || googleLatestTradeTimeTextRef.current[normalizedSymbol] || "";
        }
      });

      const acceptedValidationMap = {};
      Object.entries(json.validationMap || {}).forEach(([symbol, sourceMap]) => {
        if (acceptedRawDataMap[symbol]) acceptedValidationMap[symbol] = sourceMap;
      });

      if (Object.keys(acceptedValidationMap).length) {
        setValidationMap((prev) =>
          mergeSourceMap(prev, acceptedValidationMap)
        );
      }

      if (Object.keys(acceptedRawDataMap).length) {
        const googleRows = Object.entries(acceptedRawDataMap).map(([symbol, google]) => ({
          symbol,
          google,
        }));
        setStocks((prev) => mergeGoogleQuotesBySymbol(prev, googleRows));
        setDataMode("google_quote_api");
      }

      setGoogleDebug({
        mode: "api_route",
        version: json.version,
        parsedRows: json.parsedRows,
        headers: json.headers,
        rawFieldPreview: json.rawFieldPreview,
        formulaCompleteness: json.formulaCompleteness,
        fetchAttempts: json.fetchAttempts,
        matchedSymbols: json.matchedSymbols,
        unmatchedSymbols: json.unmatchedSymbols,
        rawDataMap: acceptedRawDataMap,
        acceptedSymbols: Object.keys(acceptedRawDataMap),
        staleSymbols,
      });
      setLastFetchMap((prev) => markSourceFetched(prev, source));
      const csvSymbols = Object.keys(acceptedRawDataMap).map(normalizeStockSymbol).filter(Boolean);
      const completeness = Number(json.formulaCompleteness || 0);
      const preservedNote = completeness > 0 && completeness < 0.5 ? "；公式欄不完整，已保留上一輪成功值" : "";
      const firstAccepted = Object.entries(acceptedRawDataMap)[0];
      const firstTradeTime = firstAccepted?.[1]?.tradetime || "";
      recordSourceRuntime(source, buildApiSourceRuntime({
        source,
        json,
        dataTime: firstTradeTime || firstAccepted?.[1]?.updatedAt || json?.fetchedAt || "",
        count: Object.keys(acceptedRawDataMap).length,
        note: staleSymbols.length ? `舊快照 ${staleSymbols.length} 檔` : "",
      }));
      const staleNote = staleSymbols.length ? `；收到較舊 CSV，保留較新行情（${staleSymbols.length} 檔）` : "";
      if (silent) {
        const clock = new Date().toLocaleTimeString("zh-TW", { hour12: false });
        if (Object.keys(acceptedRawDataMap).length) {
          setApiMessage(`Google 自動刷新 ${clock}${firstTradeTime ? `｜行情 ${firstTradeTime}` : ""}${staleNote}`);
        } else {
          setApiMessage(`Google 自動刷新 ${clock}${staleNote || "｜沒有可更新的新行情"}`);
        }
      } else {
        setApiMessage(`Google 驗證成功：${Object.keys(acceptedRawDataMap).length}/${json.parsedRows || 0} 檔（API route）${preservedNote}${staleNote}`);
      }
      return { ok: true, symbols: csvSymbols, rawDataMap: acceptedRawDataMap, staleSymbols };
    } catch (error) {
      setGoogleDebug({ error: error.message });
      if (!silent) setApiMessage(`Google CSV 失敗：${error.message}`);
      return { ok: false, symbols: [], error };
    } finally {
      if (!silent) setApiLoading(false);
    }
  }

  useEffect(() => {
    if (!apiConfig.googleCsvUrl) return undefined;

    const policy = getSourcePolicy("google_csv");
    const intervalMs = policy.autoRefreshMs || 20 * 1000;

    let cancelled = false;

    const tick = async () => {
      if (cancelled || googleRefreshingRef.current) return;

      googleRefreshingRef.current = true;
      const requestSeq = googleAutoRequestSeqRef.current + 1;
      googleAutoRequestSeqRef.current = requestSeq;

      try {
        await loadGoogleCsv({ silent: true, skipCooldown: true, requestSeq });
      } finally {
        googleRefreshingRef.current = false;
      }
    };

    const firstTimer = window.setTimeout(tick, 1000);
    const intervalId = window.setInterval(tick, intervalMs);

    return () => {
      cancelled = true;
      window.clearTimeout(firstTimer);
      window.clearInterval(intervalId);
    };
  }, [apiConfig.googleCsvUrl]);

  useEffect(() => {
    if (!apiConfig.twseMisProxyUrl) return undefined;

    const policy = getSourcePolicy("twse_mis");
    const intervalMs = policy.autoRefreshMs || 15 * 1000;
    let cancelled = false;

    const tick = async (forceOnce = false) => {
      if (cancelled || twseMisRefreshingRef.current) return;
      if (!forceOnce && !isTwseMisAutoWindow()) return;

      twseMisRefreshingRef.current = true;
      try {
        await loadTwseMisVolume(null, { silent: true, skipCooldown: true, auto: !forceOnce });
      } finally {
        twseMisRefreshingRef.current = false;
      }
    };

    const firstTimer = window.setTimeout(() => tick(true), 1500);
    const intervalId = window.setInterval(tick, intervalMs);

    return () => {
      cancelled = true;
      window.clearTimeout(firstTimer);
      window.clearInterval(intervalId);
    };
  }, [apiConfig.twseMisProxyUrl, stocks.map((stock) => stock.symbol).join(",")]);


  useEffect(() => {
    if (!stocksHydrated) return undefined;
    if (startupCacheWarmupRef.current) return undefined;

    startupCacheWarmupRef.current = true;
    let cancelled = false;

    const warmup = async () => {
      if (cancelled) return;
      const symbols = stocks.map((stock) => normalizeStockSymbol(stock.symbol)).filter(Boolean);
      const etfSymbols = stocks.filter(isEtfAsset).map((stock) => normalizeStockSymbol(stock.symbol)).filter(Boolean);

      // Startup warmup must call the normal loaders, not a raw warmRoute fetch.
      // The loaders update validationMap, lastFetchMap and sourceRuntimeMap.
      // Otherwise route cache is created but the validation table still shows "尚無比對來源".
      const tasks = [];

      if (apiConfig.twseProxyUrl && symbols.length) {
        tasks.push(loadTwseOpenApi(symbols));
      }

      if ((apiConfig.twseHistoryProxyUrl || DEFAULT_TWSE_HISTORY_PROXY_URL) && symbols.length) {
        tasks.push(loadTwseHistorySnapshot(symbols, { silent: true, skipCooldown: true }));
      }

      if (apiConfig.yahooOhlcvProxyUrl && symbols.length) {
        tasks.push(loadYahooOhlcv(symbols));
      }

      if (apiConfig.yahooEtfProxyUrl && etfSymbols.length) {
        tasks.push(loadYahooEtf(etfSymbols));
      }

      await Promise.allSettled(tasks);
    };

    const timer = window.setTimeout(warmup, 3000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    stocksHydrated,
    apiConfig.twseProxyUrl,
    apiConfig.twseHistoryProxyUrl,
    apiConfig.yahooOhlcvProxyUrl,
    apiConfig.yahooEtfProxyUrl,
    stocks.map((stock) => stock.symbol).join(","),
  ]);


  useEffect(() => {
    if (!stocksHydrated || !apiConfig.twseProxyUrl) return undefined;

    const currentSlot = getScheduledOfficialCacheSlot();
    if (currentSlot && !scheduledOfficialCacheSlotRef.current) {
      scheduledOfficialCacheSlotRef.current = currentSlot;
    }

    let cancelled = false;
    let running = false;

    const tick = async () => {
      if (cancelled || running) return;
      const nextSlot = getScheduledOfficialCacheSlot();
      if (!nextSlot || scheduledOfficialCacheSlotRef.current === nextSlot) return;

      const symbols = stocks.map((stock) => normalizeStockSymbol(stock.symbol)).filter(Boolean);
      if (!symbols.length) return;

      scheduledOfficialCacheSlotRef.current = nextSlot;
      running = true;
      try {
        await loadTwseOpenApi(symbols, { silent: true, skipCooldown: true });
      } finally {
        running = false;
      }
    };

    const intervalId = window.setInterval(tick, OFFICIAL_SCHEDULED_CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    stocksHydrated,
    apiConfig.twseProxyUrl,
    stocks.map((stock) => stock.symbol).join(","),
  ]);


  useEffect(() => {
    if (!stocksHydrated) return undefined;
    if (startupFinMindWarmupRef.current) return undefined;

    startupFinMindWarmupRef.current = true;
    let cancelled = false;

    const warmupFinMind = async () => {
      if (cancelled) return;
      const symbols = stocks.map((stock) => normalizeStockSymbol(stock.symbol)).filter(Boolean);
      if (!symbols.length) return;

      // FinMind is needed for technical score. Warm it up once on startup, but never with force.
      // The route side has 1h cache + stale-if-error, so this should reuse cache when available.
      try {
        if (apiConfig.finmindProxyUrl) await loadFinMindProxy(symbols);
        if (cancelled) return;
        if (apiConfig.finmindMarketProxyUrl) await loadFinMindMarket();
        if (cancelled) return;
        if (apiConfig.finmindDerivativesProxyUrl) await loadFinMindDerivatives();
      } catch {
        // Individual loaders already set apiMessage; keep startup warmup non-fatal.
      }
    };

    const timer = window.setTimeout(warmupFinMind, 4500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    stocksHydrated,
    apiConfig.finmindProxyUrl,
    apiConfig.finmindMarketProxyUrl,
    apiConfig.finmindDerivativesProxyUrl,
    stocks.map((stock) => stock.symbol).join(","),
  ]);


  async function loadTwseHistorySnapshot(symbolOverride = null, options = {}) {
    const { silent = false, skipCooldown = false } = options || {};
    const source = "twse_history_snapshot";
    const policy = getSourcePolicy(source);
    const refresh = canRefreshSource(lastFetchMap, source, policy.cooldownMs);
    if (!skipCooldown && !refresh.ok) {
      if (!silent) setApiMessage(`TWSE Snapshot 冷卻中：${refresh.remainSec} 秒`);
      return { ok: false, skipped: true, reason: `冷卻 ${refresh.remainSec} 秒` };
    }

    if (!silent) {
      setApiLoading(true);
      setApiMessage("讀取 TWSE snapshot 自算量能基準中...");
    }

    try {
      const requestSymbols = Array.isArray(symbolOverride) && symbolOverride.length ? symbolOverride : stocks.map((stock) => stock.symbol);
      const symbols = requestSymbols.map(normalizeStockSymbol).filter(Boolean).join(",");
      if (!symbols) return { ok: false, skipped: true, reason: "missing symbols" };

      const baseUrl = apiConfig.twseHistoryProxyUrl || DEFAULT_TWSE_HISTORY_PROXY_URL;
      const url = appendRouteQuery(baseUrl, { symbols, monthsBack: 8 });
      const res = await fetchWithTimeout(url, { cache: "no-store" }, policy.timeoutMs);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const history = Array.isArray(json.history) ? json.history : [];

      recordSourceRuntime(source, buildApiSourceRuntime({
        source,
        json,
        dataTime: json?.dataTimeSummary?.latestDate || json?.cache?.sourceLatestDate || json?.sourceLatestDate || "",
        count: history.length,
        note: json?.cache?.kind === "local_snapshot_file" ? "local snapshot" : json?.source || "",
      }));

      setValidationMap((prev) =>
        mergeSourceMap(prev, normalizeSourceRowsForValidation(history.map(normalizeTwseHistorySnapshotItem).filter(Boolean), "twse_history"))
      );
      setStocks((prev) => mergeTwseHistorySnapshotBySymbol(prev, history));
      setDataMode("twse_history_snapshot_volume_base");
      setLastFetchMap((prev) => markSourceFetched(prev, source));
      if (!silent) setApiMessage(`TWSE Snapshot 成功：${json.passCount ?? history.length}/${json.count ?? history.length} 檔，自算量能基準已更新`);
      return { ok: true, count: history.length, pass: json.passCount ?? history.length, source: json.source };
    } catch (error) {
      if (!silent) setApiMessage(`TWSE Snapshot 失敗：${error.message}`);
      return { ok: false, error: error.message };
    } finally {
      if (!silent) setApiLoading(false);
    }
  }

  async function loadFinMindProxy(symbolOverride = null, profileOverride = "score") {
    const source = "finmind_proxy";
    const policy = getSourcePolicy(source);
    const refresh = canRefreshSource(lastFetchMap, source, policy.cooldownMs);
    if (!refresh.ok) { setApiMessage(`FinMind Proxy 冷卻中：${refresh.remainSec} 秒`); return; }
    setApiLoading(true);
    setApiMessage("讀取中...");
    try {
      const requestSymbols = Array.isArray(symbolOverride) && symbolOverride.length ? symbolOverride : stocks.map((stock) => stock.symbol);
      const symbols = requestSymbols.map(normalizeStockSymbol).filter(Boolean).join(",");
      const profile = profileOverride || "score";
      const url = appendRouteQuery(apiConfig.finmindProxyUrl, { symbols, profile });
      const res = await fetchWithTimeout(url, {}, policy.timeoutMs);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list = Array.isArray(json) ? json : Array.isArray(json.stocks) ? json.stocks : [];
      const rawIncoming = list.filter((stock) => stock.symbol || stock.stock_id);
      const incoming = rawIncoming.map(normalizeExternalStock).filter((stock) => stock.symbol);
      recordSourceRuntime(source, buildApiSourceRuntime({
        source,
        json,
        count: rawIncoming.length,
        note: `profile=${json?.profile || profile}`,
      }));

      // 比對來源要吃 route 原始欄位，避免 normalizeExternalStock 過程漏掉 technical / valuation 欄位。
      setValidationMap((prev) =>
        mergeSourceMap(prev, normalizeSourceRowsForValidation(rawIncoming, "finmind"))
      );
      setStocks((prev) => mergeFinMindDailyBySymbol(prev, rawIncoming));
      setDataMode("finmind_daily_technical");
      setLastFetchMap((prev) => markSourceFetched(prev, source));
      setApiMessage(`FinMind成功：${rawIncoming.length} 檔，profile=${json?.profile || profile}，比對來源已更新`);
    } catch (error) {
      setApiMessage(`FinMind Proxy 失敗：${error.message}`);
    } finally {
      setApiLoading(false);
    }
  }

  async function loadTwseOpenApi(symbolOverride = null, options = {}) {
    const { silent = false, skipCooldown = false } = options || {};
    const source = "twse_proxy";
    const policy = getSourcePolicy(source);
    const refresh = canRefreshSource(lastFetchMap, source, policy.cooldownMs);
    if (!skipCooldown && !refresh.ok) {
      if (!silent) setApiMessage(`TWSE 冷卻中：${refresh.remainSec} 秒`);
      return { ok: false, skipped: true, reason: "cooldown", remainSec: refresh.remainSec };
    }
    if (!silent) {
      setApiLoading(true);
      setApiMessage("讀取中...");
    }
    try {
      const requestSymbols = Array.isArray(symbolOverride) && symbolOverride.length ? symbolOverride : stocks.map((stock) => stock.symbol);
      const symbols = requestSymbols.map(normalizeStockSymbol).filter(Boolean).join(",");
      const url = apiConfig.twseProxyUrl.includes("?") ? `${apiConfig.twseProxyUrl}&symbols=${symbols}` : `${apiConfig.twseProxyUrl}?symbols=${symbols}`;
      let incoming = [];
      let mode = "twse_proxy";
      let twseJson = null;
      try {
        const res = await fetchWithTimeout(url, {}, policy.timeoutMs);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        twseJson = json;
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
      const allow = new Set(requestSymbols.map(normalizeStockSymbol).filter(Boolean));
      const filtered = incoming.filter((stock) => allow.has(stock.symbol));
      const twseRows = filtered.length ? filtered : incoming;
      recordSourceRuntime(source, buildApiSourceRuntime({
        source,
        json: twseJson || {},
        count: twseRows.length,
        note: mode === "twse_proxy" ? "官方盤後" : "CORS 備援",
      }));

      setValidationMap((prev) =>
        mergeSourceMap(prev, normalizeSourceRowsForValidation(twseRows, "twse"))
      );
      setStocks((prev) => mergeTwseOfficialBySymbol(prev, twseRows));
      setDataMode(mode);
      setLastFetchMap((prev) => markSourceFetched(prev, source));
      if (!silent) setApiMessage(`${mode === "twse_proxy" ? "TWSE Proxy" : "TWSE CORS 備援"} 成功：${twseRows.length} 檔，比對來源已更新`);
      return { ok: true, count: twseRows.length, mode };
    } catch (error) {
      if (!silent) setApiMessage(`TWSE 失敗：${error.message}`);
      return { ok: false, error: error.message };
    } finally {
      if (!silent) setApiLoading(false);
    }
  }


  async function loadTwseMisVolume(symbolOverride = null, options = {}) {
    const { silent = false, skipCooldown = false, auto = false } = options || {};
    const source = "twse_mis";
    const policy = getSourcePolicy(source);

    if (auto && !isTwseMisAutoWindow()) {
      return { ok: false, skipped: true, reason: "outside_twse_mis_window" };
    }

    if (!apiConfig.twseMisProxyUrl) {
      if (!silent) setApiMessage("請先設定 TWSE MIS URL");
      return { ok: false, skipped: true, reason: "missing_twse_mis_url" };
    }

    if (!skipCooldown) {
      const refresh = canRefreshSource(lastFetchMap, source, policy.cooldownMs);
      if (!refresh.ok) {
        if (!silent) setApiMessage(`TWSE MIS 冷卻中：${refresh.remainSec} 秒`);
        return { ok: false, skipped: true, reason: `冷卻 ${refresh.remainSec} 秒` };
      }
    }

    if (!silent) {
      setApiLoading(true);
      setApiMessage("讀取 TWSE MIS 盤中主價量中...");
    }

    try {
      const requestSymbols = Array.isArray(symbolOverride) && symbolOverride.length ? symbolOverride : stocks.map((stock) => stock.symbol);
      const rows = await fetchTwseMisRows(requestSymbols, policy.timeoutMs, apiConfig.twseMisProxyUrl || DEFAULT_TWSE_MIS_PROXY_URL);
      if (rows.sourceRuntime) recordSourceRuntime(source, rows.sourceRuntime);
      const hasNewTradeTime = twseMisRowsHaveNewTradeTime(rows, twseMisLatestTradeTimeRef.current);
      const hasQuoteImprovement = twseMisRowsHaveQuoteImprovement(rows, stocks);
      const timePreview = rows.slice(0, 3).map((row) => `${row.symbol}:${row.tradetime || "-"}`).join(" / ");

      setLastFetchMap((prev) => markSourceFetched(prev, source));

      if (auto && !hasNewTradeTime && !hasQuoteImprovement) {
        if (!silent) setApiMessage(`TWSE MIS 無新行情${timePreview ? `（${timePreview}）` : ""}`);
        return { ok: true, skipped: true, reason: "same_tradetime", count: rows.length };
      }

      updateTwseMisLatestTradeTime(rows, twseMisLatestTradeTimeRef);
      setValidationMap((prev) =>
        mergeSourceMap(prev, normalizeSourceRowsForValidation(rows, "twse_mis"))
      );
      setStocks((prev) => mergeTwseMisBySymbol(prev, rows));
      setDataMode("twse_mis_intraday_main");

      let officialEtfNote = "";
      const etfSymbolsForOfficialInav = rows.filter((row) => row?.isEtfCandidate || /^00/.test(String(row?.symbol || row?.stock_id || ""))).map((row) => normalizeStockSymbol(row.symbol || row.stock_id)).filter(Boolean);
      if (etfSymbolsForOfficialInav.length) {
        const officialResult = await loadOfficialEtfInav(etfSymbolsForOfficialInav, { silent: true, skipCooldown: true, auto });
        if (officialResult?.ok) officialEtfNote = `；ETF 即時估值同步 ${officialResult.pass}/${officialResult.count} 檔`;
      }

      try {
        const index = await fetchTwseMarketIndex(policy.timeoutMs, apiConfig.twseMisProxyUrl || DEFAULT_TWSE_MIS_PROXY_URL);
        if (index) {
          setMarketIndex(index);
          if (index.sourceRuntime) recordSourceRuntime(source, index.sourceRuntime);
        }
      } catch {
        // Market index is display-only; hide if unavailable.
      }

      if (silent) {
        if (hasNewTradeTime || hasQuoteImprovement) setApiMessage(`行情自動刷新｜${timePreview || `${rows.length} 檔`}${hasQuoteImprovement && !hasNewTradeTime ? "｜補齊缺漏價量" : ""}${officialEtfNote}`);
      } else {
        setApiMessage(`盤中價量成功：${rows.length} 檔；已更新主畫面 price / volume${timePreview ? `（${timePreview}）` : ""}${officialEtfNote}`);
      }
      return { ok: true, count: rows.length, hasNewTradeTime, hasQuoteImprovement, officialEtfNote };
    } catch (error) {
      if (!silent) setApiMessage(`TWSE MIS 成交量參考失敗：${error.message}`);
      return { ok: false, error: error.message };
    } finally {
      if (!silent) setApiLoading(false);
    }
  }

  async function loadYahooOhlcv(symbolOverride = null) {
    const source = "yahoo_ohlcv";
    const policy = getSourcePolicy(source);
    const refresh = canRefreshSource(lastFetchMap, source, policy.cooldownMs);
    if (!refresh.ok) { setApiMessage(`外部 OHLCV 驗證冷卻中：${refresh.remainSec} 秒`); return { ok: false, skipped: true, reason: `冷卻 ${refresh.remainSec} 秒` }; }
    setApiLoading(true);
    setApiMessage("讀取外部 OHLCV 抽樣驗證中...");
    try {
      const requestSymbols = Array.isArray(symbolOverride) && symbolOverride.length ? symbolOverride : stocks.map((stock) => stock.symbol);
      const symbols = requestSymbols.map(normalizeStockSymbol).filter(Boolean).join(",");
      const url = apiConfig.yahooOhlcvProxyUrl.includes("?") ? `${apiConfig.yahooOhlcvProxyUrl}&symbols=${symbols}` : `${apiConfig.yahooOhlcvProxyUrl}?symbols=${symbols}`;
      const res = await fetchWithTimeout(url, {}, policy.timeoutMs);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list = Array.isArray(json.stocks) ? json.stocks : [];
      recordSourceRuntime(source, buildApiSourceRuntime({ source, json, count: list.length, note: "備援驗證" }));
      setValidationMap((prev) =>
        mergeSourceMap(prev, normalizeSourceRowsForValidation(list, "yahoo"))
      );
      setDataMode("yahoo_ohlcv_validation");
      setLastFetchMap((prev) => markSourceFetched(prev, source));
      setApiMessage(`外部 OHLCV 抽樣成功：${list.length} 檔，僅更新驗證層`);
      return { ok: true, count: list.length };
    } catch (error) {
      setApiMessage(`外部 OHLCV 驗證失敗：${error.message}`);
      return { ok: false, error: error.message };
    } finally {
      setApiLoading(false);
    }
  }


  async function loadOfficialEtfInav(symbolOverride = null, options = {}) {
    const { silent = false, skipCooldown = false, auto = false } = options || {};
    const source = "official_etf_inav";
    const policy = getSourcePolicy(source);

    if (!apiConfig.etfInavProxyUrl) {
      if (!silent) setApiMessage("ETF 即時估值 URL 尚未設定");
      return { ok: false, skipped: true, reason: "missing_etf_inav_url" };
    }

    if (!skipCooldown) {
      const refresh = canRefreshSource(lastFetchMap, source, policy.cooldownMs);
      if (!refresh.ok) {
        if (!silent) setApiMessage(`ETF 即時估值冷卻中：${refresh.remainSec} 秒`);
        return { ok: false, skipped: true, reason: `冷卻 ${refresh.remainSec} 秒` };
      }
    }

    if (!silent) {
      setApiLoading(true);
      setApiMessage("讀取 ETF 即時估值中...");
    }

    try {
      const requestSymbols = Array.isArray(symbolOverride) && symbolOverride.length
        ? symbolOverride
        : stocks.filter(isEtfAsset).map((stock) => stock.symbol);
      const symbols = requestSymbols.map(normalizeStockSymbol).filter(Boolean).join(",");
      if (!symbols) {
        if (!silent) setApiMessage("沒有 ETF 需要讀取即時估值");
        return { ok: true, count: 0, pass: 0 };
      }

      const baseUrl = apiConfig.etfInavProxyUrl || DEFAULT_ETF_INAV_PROXY_URL;
      const url = baseUrl.includes("?") ? `${baseUrl}&symbols=${symbols}` : `${baseUrl}?symbols=${symbols}`;
      const res = await fetchWithTimeout(url, {}, policy.timeoutMs);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const list = Array.isArray(json.results) ? json.results : [];
      const passCount = list.filter((row) => row?.parseStatus === "PASS").length;
      recordSourceRuntime(source, buildApiSourceRuntime({
        source,
        json,
        dataTime: pickEtfInavDataTime(json, list),
        count: list.length,
        pass: passCount,
      }));

      setValidationMap((prev) => mergeSourceMap(prev, normalizeSourceRowsForValidation(list.map((row) => ({
        ...row,
        symbol: normalizeStockSymbol(row.symbol || row.stock_id),
        stock_id: normalizeStockSymbol(row.symbol || row.stock_id),
        marketPrice: row.latestPrice,
        nav: row.referenceNav,
        etfMarketPrice: row.latestPrice,
        etfPremiumDiscountPct: row.premiumDiscountPct,
        etfSourcePage: "official_inav",
        etfFetchedAt: row.dataTime || row.navDate || "",
        sourceNote: "ETF 即時估值",
      })), source)));

      setStocks((prev) => mergeOfficialEtfInavToStocks(prev, list));
      setLastFetchMap((prev) => markSourceFetched(prev, source));
      if (!silent) setApiMessage(`ETF 即時估值成功：${passCount}/${list.length} 檔`);
      return { ok: true, count: list.length, pass: passCount, summary: json.summary };
    } catch (error) {
      if (!silent) setApiMessage(`ETF 即時估值失敗：${error.message}`);
      return { ok: false, error: error.message };
    } finally {
      if (!silent) setApiLoading(false);
    }
  }

  async function loadYahooEtf(symbolOverride = null) {
    const source = "yahoo_etf";
    const policy = getSourcePolicy(source);
    const refresh = canRefreshSource(lastFetchMap, source, policy.cooldownMs);
    if (!refresh.ok) { setApiMessage(`ETF 備援冷卻中：${refresh.remainSec} 秒`); return { ok: false, skipped: true, reason: `冷卻 ${refresh.remainSec} 秒` }; }
    setApiLoading(true);
    setApiMessage("讀取 ETF 備援輔助資料中...");
    try {
      const requestSymbols = Array.isArray(symbolOverride) && symbolOverride.length ? symbolOverride : stocks.filter(isEtfAsset).map((stock) => stock.symbol);
      const symbols = requestSymbols.map(normalizeStockSymbol).filter(Boolean).join(",");
      if (!symbols) { setApiMessage("沒有 ETF 需要讀取 ETF 備援輔助資料"); return { ok: true, count: 0 }; }
      const url = apiConfig.yahooEtfProxyUrl.includes("?") ? `${apiConfig.yahooEtfProxyUrl}&symbols=${symbols}` : `${apiConfig.yahooEtfProxyUrl}?symbols=${symbols}`;
      const res = await fetchWithTimeout(url, {}, policy.timeoutMs);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list = Array.isArray(json.etfs) ? json.etfs : [];
      recordSourceRuntime(source, buildApiSourceRuntime({
        source,
        json,
        count: list.length,
        pass: list.filter((row) => row?.probeQuality?.extractedAny).length,
        note: "備援資料",
      }));

      let yahooOhlcvList = [];
      let yahooOhlcvNote = "";
      if (apiConfig.yahooOhlcvProxyUrl && symbols) {
        try {
          const ohlcvUrl = apiConfig.yahooOhlcvProxyUrl.includes("?") ? `${apiConfig.yahooOhlcvProxyUrl}&symbols=${symbols}` : `${apiConfig.yahooOhlcvProxyUrl}?symbols=${symbols}`;
          const ohlcvRes = await fetchWithTimeout(ohlcvUrl, {}, getSourcePolicy("yahoo_ohlcv").timeoutMs);
          if (!ohlcvRes.ok) throw new Error(`HTTP ${ohlcvRes.status}`);
          const ohlcvJson = await ohlcvRes.json();
          yahooOhlcvList = Array.isArray(ohlcvJson.stocks) ? ohlcvJson.stocks : [];
          recordSourceRuntime("yahoo_ohlcv", buildApiSourceRuntime({ source: "yahoo_ohlcv", json: ohlcvJson, count: yahooOhlcvList.length, note: "ETF 備援同步" }));
          yahooOhlcvNote = `；Yahoo OHLCV 技術驗證同步 ${yahooOhlcvList.length} 檔`;
          setLastFetchMap((prev) => markSourceFetched(prev, "yahoo_ohlcv"));
        } catch (ohlcvError) {
          yahooOhlcvNote = `；Yahoo OHLCV 技術驗證未更新：${ohlcvError.message}`;
        }
      }

      setValidationMap((prev) => {
        const withEtf = mergeSourceMap(prev, normalizeSourceRowsForValidation(list, "yahoo_etf"));
        return yahooOhlcvList.length ? mergeSourceMap(withEtf, normalizeSourceRowsForValidation(yahooOhlcvList, "yahoo")) : withEtf;
      });
      setStocks((prev) => mergeYahooEtfToStocks(prev, list));
      setDataMode("yahoo_etf_auxiliary");
      setLastFetchMap((prev) => markSourceFetched(prev, source));
      setApiMessage(`ETF 備援輔助資料成功：${list.filter((row) => row?.probeQuality?.extractedAny).length}/${list.length} 檔${yahooOhlcvNote}`);
      return { ok: true, count: list.length, yahooOhlcvCount: yahooOhlcvList.length };
    } catch (error) {
      setApiMessage(`ETF 備援輔助資料失敗：${error.message}`);
      return { ok: false, error: error.message };
    } finally {
      setApiLoading(false);
    }
  }

  async function loadFinMindMarket() {
    const source = "finmind_market";
    const policy = getSourcePolicy(source);
    const refresh = canRefreshSource(lastFetchMap, source, policy.cooldownMs);
    if (!refresh.ok) { setApiMessage(`FinMind Market 冷卻中：${refresh.remainSec} 秒`); return; }
    setApiLoading(true);
    setApiMessage("讀取中...");
    try {
      const res = await fetchWithTimeout(apiConfig.finmindMarketProxyUrl, {}, policy.timeoutMs);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const market = json.market || {};
      recordSourceRuntime(source, buildApiSourceRuntime({ source, json, count: Array.isArray(market?.us) ? market.us.length : null, note: "市場補資料" }));
      setStocks((prev) => mergeMarketToStocks(prev, { ...market, dataTimeSummary: json.dataTimeSummary || {} }));
      setValidationMap((prev) => ({
        ...prev,
        __market: { ...(prev.__market || {}), finmind_market: market },
      }));
      setDataMode("finmind_market");
      setLastFetchMap((prev) => markSourceFetched(prev, source));
      setApiMessage("FinMind Market 成功：市場面已更新");
    } catch (error) {
      setApiMessage(`FinMind Market 失敗：${error.message}`);
    } finally {
      setApiLoading(false);
    }
  }

  async function loadFinMindDerivatives() {
    const source = "finmind_derivatives";
    const policy = getSourcePolicy(source);
    const refresh = canRefreshSource(lastFetchMap, source, policy.cooldownMs);
    if (!refresh.ok) { setApiMessage(`FinMind Derivatives 冷卻中：${refresh.remainSec} 秒`); return; }
    setApiLoading(true);
    setApiMessage("讀取中...");
    try {
      const res = await fetchWithTimeout(apiConfig.finmindDerivativesProxyUrl, {}, policy.timeoutMs);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const derivatives = json.derivatives || {};
      recordSourceRuntime(source, buildApiSourceRuntime({ source, json, note: "衍生性風險" }));
      setStocks((prev) => mergeDerivativesToStocks(prev, { ...derivatives, dataTimeSummary: json.dataTimeSummary || {} }));
      setValidationMap((prev) => ({
        ...prev,
        __derivatives: { ...(prev.__derivatives || {}), finmind_derivatives: derivatives },
      }));
      setDataMode("finmind_derivatives");
      setLastFetchMap((prev) => markSourceFetched(prev, source));
      setApiMessage("FinMind Derivatives 成功：衍生性資料已更新");
    } catch (error) {
      setApiMessage(`FinMind Derivatives 失敗：${error.message}`);
    } finally {
      setApiLoading(false);
    }
  }

  async function runSmartRefresh() {
    if (apiLoading) return;

    const summary = [];
    const canRun = (source) => {
      const policy = getSourcePolicy(source);
      const refresh = canRefreshSource(lastFetchMap, source, policy.cooldownMs);
      return { policy, refresh };
    };

    const google = canRun("google_csv");
    const twse = canRun("twse_proxy");
    const twseHistory = canRun("twse_history_snapshot");
    const finmind = canRun("finmind_proxy");
    const market = canRun("finmind_market");
    const derivatives = canRun("finmind_derivatives");
    const yahoo = canRun("yahoo_ohlcv");
    const officialEtf = canRun("official_etf_inav");
    const yahooEtf = canRun("yahoo_etf");

    try {
      let refreshSymbols = stocks.map((stock) => stock.symbol).map(normalizeStockSymbol).filter(Boolean);

      if (apiConfig.googleCsvUrl && google.refresh.ok) {
        const googleResult = await loadGoogleCsv();
        if (googleResult?.symbols?.length) {
          refreshSymbols = Array.from(new Set([...refreshSymbols, ...googleResult.symbols]));
        }
        summary.push("GoogleFinance 已更新");
      } else if (apiConfig.googleCsvUrl) {
        summary.push(`GoogleFinance 冷卻 ${google.refresh.remainSec} 秒`);
      }

      if (apiConfig.twseProxyUrl && twse.refresh.ok) {
        await loadTwseOpenApi(refreshSymbols);
        summary.push("TWSE 已更新");
      } else if (apiConfig.twseProxyUrl) {
        summary.push(`TWSE 冷卻 ${twse.refresh.remainSec} 秒`);
      }

      if ((apiConfig.twseHistoryProxyUrl || DEFAULT_TWSE_HISTORY_PROXY_URL) && twseHistory.refresh.ok) {
        const twseHistoryResult = await loadTwseHistorySnapshot(refreshSymbols);
        summary.push(twseHistoryResult?.ok ? `TWSE Snapshot 已更新 ${twseHistoryResult.pass || 0}/${twseHistoryResult.count || 0} 檔` : `TWSE Snapshot 未更新：${twseHistoryResult?.error || twseHistoryResult?.reason || "無法取得"}`);
      } else if (apiConfig.twseHistoryProxyUrl || DEFAULT_TWSE_HISTORY_PROXY_URL) {
        summary.push(`TWSE Snapshot 冷卻 ${twseHistory.refresh.remainSec} 秒`);
      }

      if (apiConfig.finmindProxyUrl && finmind.refresh.ok) {
        await loadFinMindProxy(refreshSymbols);
        summary.push("FinMind 已更新");
      } else if (apiConfig.finmindProxyUrl) {
        const minutes = Math.ceil(finmind.refresh.remainSec / 60);
        summary.push(`FinMind 冷卻約 ${minutes} 分鐘`);
      }

      if (apiConfig.finmindMarketProxyUrl && market.refresh.ok) {
        await loadFinMindMarket();
        summary.push("Market 已更新");
      } else if (apiConfig.finmindMarketProxyUrl) {
        const minutes = Math.ceil(market.refresh.remainSec / 60);
        summary.push(`Market 冷卻約 ${minutes} 分鐘`);
      }

      if (apiConfig.finmindDerivativesProxyUrl && derivatives.refresh.ok) {
        await loadFinMindDerivatives();
        summary.push("Derivatives 已更新");
      } else if (apiConfig.finmindDerivativesProxyUrl) {
        const minutes = Math.ceil(derivatives.refresh.remainSec / 60);
        summary.push(`Derivatives 冷卻約 ${minutes} 分鐘`);
      }

      // Yahoo 只作驗證層：更新資料時可順手嘗試；成功才比對，失敗不影響主資料與分數。
      if (apiConfig.yahooOhlcvProxyUrl && yahoo.refresh.ok) {
        const yahooResult = await loadYahooOhlcv(refreshSymbols);
        summary.push(yahooResult?.ok ? `Yahoo OHLCV 驗證已更新 ${yahooResult.count || 0} 檔` : `Yahoo 驗證未更新：${yahooResult?.error || yahooResult?.reason || "無法取得"}`);
      } else if (apiConfig.yahooOhlcvProxyUrl) {
        summary.push(`Yahoo 驗證冷卻 ${yahoo.refresh.remainSec} 秒`);
      }

      const etfSymbols = refreshSymbols.filter((symbol) => stocks.some((stock) => normalizeStockSymbol(stock.symbol) === symbol && isEtfAsset(stock)));
      if (apiConfig.etfInavProxyUrl && officialEtf.refresh.ok && etfSymbols.length) {
        const officialEtfResult = await loadOfficialEtfInav(etfSymbols);
        summary.push(officialEtfResult?.ok ? `ETF 即時估值已更新 ${officialEtfResult.pass || 0}/${officialEtfResult.count || 0} 檔` : `ETF 即時估值未更新：${officialEtfResult?.error || officialEtfResult?.reason || "無法取得"}`);
      } else if (apiConfig.etfInavProxyUrl && etfSymbols.length) {
        summary.push(`ETF 即時估值冷卻 ${officialEtf.refresh.remainSec} 秒`);
      }

      setApiMessage(summary.length ? summary.join("｜") : "沒有可更新的來源");
    } catch (error) {
      setApiMessage(`更新資料失敗：${error.message}`);
    }
  }

  const selectedMove = getPriceMove(current);
  const selectedDimensions = getShortDisplayDimensions(shortV1.dimensions, current);
  const selectedDimLabel = isEtfAsset(current) ? "資金面" : "籌碼面";
  const selectedScoreTone = getScoreTone(shortV1.score100 || 0);
  const selectedTime = current?.tradetime ? compactSourceTime(current.tradetime) : current?.updatedAt ? compactSourceTime(current.updatedAt) : formatLastFetch(lastFetchMap, "twse_mis");
  const horizonSlots = [
    { key: "short", label: "短線", enabled: true },
    { key: "mid", label: "中線", enabled: false },
    { key: "long", label: "長線", enabled: false },
  ];

  const selectedDetailPanel = (
    <div className="space-y-3">
      <FrameworkTable
        title="完整短線明細"
        subtitle={getShortFrameworkSubtitle(current)}
        result={shortV1}
        showScore
        horizon="short"
        onWeightChange={updateWeight}
        onResetHorizon={resetHorizonWeights}
        stock={current}
      />

      {isEtfAsset(current) ? <YahooEtfInfoCard stock={current} /> : null}
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f4f8ff_0%,#edf3fb_36%,#eef4fb_62%,#f7f9fc_100%)] px-3 py-4 text-slate-900 md:px-6 md:py-6">
      <div className="mx-auto max-w-6xl space-y-4 md:space-y-5">
        {showDebugPanel ? (
          <div className="flex justify-end">
            <Badge className="bg-amber-100 text-amber-800 shadow-sm">DEBUG</Badge>
          </div>
        ) : null}

        <AddAssetForm value={newAsset} onChange={setNewAsset} onAdd={addAsset} error={addError} />

        <div className="hidden md:block">
          <OverviewTable
            rows={overviewRows}
            selected={selected}
            onSelect={handleSelectSymbol}
            onInsight={handleInsightRequest}
            onRemove={removeAsset}
            dataMode={dataMode}
            lastFetchMap={lastFetchMap}
            marketIndex={marketIndex}
            selectedDetail={selectedDetailPanel}
          />
        </div>

        <div className="block md:hidden">
          <MobileOverviewCards
            rows={overviewRows}
            selected={selected}
            onSelect={handleSelectSymbol}
            onInsight={handleInsightRequest}
            onRemove={removeAsset}
            dataMode={dataMode}
            lastFetchMap={lastFetchMap}
            marketIndex={marketIndex}
            selectedDetail={selectedDetailPanel}
          />
        </div>


        {showDebugPanel && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3 md:p-4">
            <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900 md:text-2xl">開發檢查區</h2>
                <p className="text-sm text-slate-600">只在網址帶 ?debug=1 時顯示；一般使用者畫面沒有 Debug 入口。</p>
              </div>
            </div>
            <Tabs defaultValue="sources" className="space-y-3">
              <TabsList className="grid w-full grid-cols-2 rounded-xl p-1.5">
                <TabsTrigger value="sources" className="py-2.5">資料源</TabsTrigger>
                <TabsTrigger value="validate" className="py-2.5">資料驗證</TabsTrigger>
              </TabsList>
              <TabsContent value="sources"><div className="space-y-4"><SourceConnectorTable config={apiConfig} onConfigChange={setApiConfig} onSmartRefresh={runSmartRefresh} onLoadGoogle={loadGoogleCsv} onLoadFinMind={loadFinMindProxy} onLoadTwse={loadTwseOpenApi} onLoadTwseHistory={() => loadTwseHistorySnapshot()} onLoadTwseMis={loadTwseMisVolume} onLoadMarket={loadFinMindMarket} onLoadDerivatives={loadFinMindDerivatives} onLoadYahoo={loadYahooOhlcv} onLoadYahooEtf={loadYahooEtf} onLoadOfficialEtfInav={loadOfficialEtfInav} loading={apiLoading} apiMessage={apiMessage} lastFetchMap={lastFetchMap} sourceRuntimeMap={sourceRuntimeMap} stocks={stocks} googleDebug={googleDebug} /><Card className="rounded-xl shadow-sm"><CardContent className="p-3 space-y-3"><h3 className="font-semibold flex items-center gap-2"><Icon name="doc" /> 資料來源角色總覽</h3><div className="rounded-lg border bg-slate-50 p-3 text-xs leading-6 text-slate-600"><div className="font-semibold text-slate-900">資料原則</div><div>資料源只分三種更新規則：即時區（TWSE MIS / ETF iNAV / GoogleFinance）短 TTL；固定時段盤後校正區（TWSE OpenAPI / TWSE Snapshot / Yahoo 備援）使用 08:30 / 14:10 / 15:30 / 18:00 / 22:00 cache；FinMind 區（stocks / market / derivatives）採 1 小時 TTL。GoogleFinance 降級為輔助驗證；Yahoo 只作救援抽樣；FinMind Minute 已移除。</div></div><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[1050px] text-sm"><thead className="bg-white"><tr className="border-b text-left text-slate-500"><th className="w-[130px] py-2">來源</th><th className="w-[170px]">Dataset / API</th><th>主要欄位</th><th>使用方式</th><th className="w-[220px]">角色</th></tr></thead><tbody>{sourceRoleOverviewGroups.map((group) => <React.Fragment key={group.title}><tr className={`${group.tone} border-b`}><td colSpan={5} className="px-2 py-2 text-xs font-semibold"><div>{group.title}</div><div className="mt-0.5 font-normal">{group.description}</div></td></tr>{group.items.map((item) => <tr key={item.aspect} className="border-b last:border-0 align-top"><td className="py-2 font-medium">{item.aspect}</td><td className="text-slate-600">{item.datasets}</td><td className="text-slate-600">{item.fields}</td><td className="text-slate-500">{item.calcNote}</td><td className="text-slate-500"><div>短：{item.shortRole}</div><div>中：{item.midRole}</div><div>長：{item.longRole}</div></td></tr>)}</React.Fragment>)}</tbody></table></div></CardContent></Card><GoogleDiagnosticsSection googleDebug={googleDebug} stocks={stocks} /></div></TabsContent>
        
              <TabsContent value="validate">{(() => { const validationRows = getSourceValidationRows(current?.symbol || selected, current, validationMap); const validationState = getValidationStateForDisplay(validationRows); const groupedRows = validationGroupRows(validationRows); return <Card className="rounded-xl shadow-sm"><CardContent className="p-3 space-y-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold flex items-center gap-2"><Icon name="doc" /> 資料驗證</h3><p className="text-sm text-slate-500 mt-2">即時與歷史資料分區；盤中 price / volume 以 TWSE MIS 為主，日線技術以 TWSE Snapshot 自算為主，FinMind 驗證。</p></div><div className="flex flex-wrap gap-2"><Badge className={validationState.tone}>{validationState.label}</Badge><Badge className="bg-slate-100 text-slate-700">通過 {validationState.passed}｜需查 {validationState.failed}｜缺資料 {validationState.missing}</Badge></div></div><div className="rounded-xl bg-white border p-3 text-sm text-slate-700"><span className="font-medium text-slate-900">驗證結論：</span>{validationSummaryForDisplay(validationRows)}</div><div className="max-h-[360px] overflow-y-scroll overflow-x-auto rounded-xl border border-slate-200 bg-white pr-1 [scrollbar-gutter:stable]"><table className="w-full min-w-[960px] text-sm"><thead className="sticky top-0 z-10 bg-white"><tr className="border-b text-left text-slate-500"><th className="w-[190px] py-2">項目</th><th className="w-[185px]">主來源</th><th className="w-[125px]">主值</th><th className="w-[155px]">驗證來源</th><th className="w-[125px]">驗證值</th><th className="w-[90px]">偏差</th><th className="w-[90px]">容忍</th><th className="w-[96px]">狀態</th></tr></thead><tbody>{groupedRows.map(({ group, rows }) => <React.Fragment key={group}><tr className="bg-slate-50"><td colSpan={8} className="px-2 py-2 text-xs font-semibold text-slate-700">{group}</td></tr>{rows.map((row) => <React.Fragment key={`${group}-${row.label}`}><tr className="align-top"><td className="py-1.5 pr-2 font-medium text-slate-900">{row.label}</td><td className="max-w-[185px] pr-2 text-xs leading-5 text-slate-500">{row.currentSource}</td><td className="pr-2">{displayValue(row.finmindValue)}</td><td className="max-w-[155px] pr-2 text-xs leading-5 text-slate-500">{row.compareSource}</td><td className="pr-2">{displayValue(row.googleValue)}</td><td className="pr-2">{validationDiffTextForDisplay(row)}</td><td className="pr-2">{validationToleranceTextForDisplay(row)}</td><td className="pr-2"><Badge className={validationStatusClassForDisplay(row.status)}>{row.status}</Badge></td></tr><tr className="border-b last:border-0"><td colSpan={8} className="pb-2 pt-0 pl-2 pr-3 text-sm leading-5 text-slate-600">{compactValidationNoteForDisplay(row)}</td></tr></React.Fragment>)}</React.Fragment>)}</tbody></table></div><div className="rounded-xl border bg-slate-50 p-3 text-xs leading-5 text-slate-600">驗證層只檢查資料口徑，不覆蓋主資料、不參與評分。盤中 price / volume 以 TWSE MIS 為主；日線與技術主資料以 TWSE Snapshot 自算為主，FinMind 作驗證 / 備援。ETF 折溢價以即時估值欄位作輔助判斷。歷史與盤後資料需先對齊日期，不同日期不判失敗。</div></CardContent></Card>; })()}</TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );

}