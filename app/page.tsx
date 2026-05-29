// @ts-nocheck
"use client";
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
const STOCKS_STORAGE_KEY = "stock_score_online_assets_v2";
const MAX_TRACKED_ASSETS = 50;

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
const DEFAULT_TWSE_MIS_PROXY_URL = "/api/twse/mis";
const DEFAULT_YAHOO_OHLCV_PROXY_URL = "/api/yahoo/ohlcv";
const DEFAULT_YAHOO_ETF_PROXY_URL = "/api/yahoo/etf";
const DEFAULT_ETF_INAV_PROXY_URL = "/api/etf/inav";
const TWSE_STOCK_DAY_ALL_URL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
const TWSE_BWIBBU_ALL_URL = "https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL";
const CORS_PROXY_RAW_URL = "https://api.allorigins.win/raw?url=";
const SOURCE_REFRESH_POLICY = {
  google_csv: {
    label: "GoogleFinance 較新行情",
    timeoutMs: 15000,
    cooldownMs: 10 * 1000,
    autoRefreshMs: 20 * 1000,
    cacheNote: "主畫面較新行情來源；前端每 20 秒重新讀取整份 CSV，手動讀取 10 秒內不重抓。Google 刷新會自動加入 CSV 新股票，且只更新 google 欄位，不會清除 TWSE / FinMind 驗證資料；股票清單會在前端掛載後存到 localStorage，重新整理不會消失，且避免 SSR hydration mismatch。名稱會優先用 TWSE 官方中文名補齊，表格會暫時顯示名稱來源方便 debug。欄位：price / prevClose / volume / PER / EPS / Nasdaq / SOX / VIX / updatedAt。",
  },
  twse_proxy: {
    label: "TWSE",
    timeoutMs: 15000,
    cooldownMs: 60 * 1000,
    autoRefreshMs: 0,
    cacheNote: "官方盤後 / 官方校正資料；固定時段 cache：08:30 / 14:10 / 15:30 / 18:00 / 22:00。其他時間吃 cache；第一次進頁面會啟動預熱並補資料驗證，debug / 進階測試可手動刷新。欄位：official price / prevClose / volume / PER / PBR / 殖利率。",
  },
  twse_mis: {
    label: "TWSE MIS 盤中主價量",
    timeoutMs: 15000,
    cooldownMs: 15 * 1000,
    autoRefreshMs: 15 * 1000,
    cacheNote: "盤中 08:30～14:00 每 15 秒批次查詢；route 端有 15 秒快取。miss 代表本次重抓外部，hit 代表 15 秒內重複呼叫吃快取；tradetime 未更新就不重繪。欄位：price / volume / tradetime / displayPrice / navUrl。",
  },
  finmind_proxy: {
    label: "FinMind",
    timeoutMs: 25000,
    cooldownMs: 60 * 60 * 1000,
    autoRefreshMs: 0,
    cacheNote: "FinMind Daily 供分數使用；第一次進頁面與主更新預設使用 profile=score（Price + 法人 + 融資融券，3 datasets/檔），中長線欄位沿用 lastGoodFull。進階測試可手動跑 profile=full。資料來源卡片顯示的是資料時間，不是抓取時間。欄位：ma5 / ma20 / ma60 / rsi14 / high20 / low20 / avgVolume20 / return20d / return60d / MACD / KD / ATR。",
  },
  finmind_market: {
    label: "FinMind Market",
    timeoutMs: 20000,
    cooldownMs: 60 * 60 * 1000,
    autoRefreshMs: 0,
    cacheNote: "FinMind Market 供市場風險參考；第一次進頁面會啟動預熱，主更新資料與進階手動按鈕也可觸發。route 端保留 1 小時 cache；頁面不做 interval 自動刷新、不帶 force。Nasdaq / SOX 可作第二來源；VIX 僅作日收盤參考。",
  },
  finmind_derivatives: {
    label: "FinMind Derivatives",
    timeoutMs: 20000,
    cooldownMs: 60 * 60 * 1000,
    autoRefreshMs: 0,
    cacheNote: "FinMind Derivatives 供隔夜 / 衍生性風險參考；第一次進頁面會啟動預熱，主更新資料與進階手動按鈕也可觸發。route 端保留 1 小時 cache；頁面不做 interval 自動刷新、不帶 force。抓台指期、期貨法人、選擇權 Put/Call。",
  },
  yahoo_ohlcv: {
    label: "Yahoo OHLCV 備援驗證",
    timeoutMs: 20000,
    cooldownMs: 5 * 60 * 1000,
    autoRefreshMs: 0,
    maxSymbols: 50,
    cacheNote: "Yahoo OHLCV 備援驗證；固定時段 cache：08:30 / 14:10 / 15:30 / 18:00 / 22:00。其他時間吃 cache；第一次進頁面會啟動預熱，debug / 進階測試可手動刷新。只更新驗證層，不覆蓋 TWSE / FinMind 主資料、不參與分數。",
  },
  official_etf_inav: {
    label: "ETF 即時估值",
    timeoutMs: 20000,
    cooldownMs: 15 * 1000,
    autoRefreshMs: 0,
    maxSymbols: 30,
    cacheNote: "ETF 即時估值資料；跟隨 TWSE MIS 更新後同步刷新，不另開固定 interval。檔數上限只是 route 保護機制，正常清單不需手動調整；僅更新 ETF 小卡與驗證層，不進短線分數。",
  },
  yahoo_etf: {
    label: "Yahoo ETF 備援資料",
    timeoutMs: 20000,
    cooldownMs: 5 * 60 * 1000,
    autoRefreshMs: 0,
    maxSymbols: 50,
    cacheNote: "Yahoo ETF 備援資料；固定時段 cache：08:30 / 14:10 / 15:30 / 18:00 / 22:00。其他時間吃 cache；第一次進頁面會啟動預熱，debug / 進階測試可手動刷新。只在投信官方 iNAV 缺值或 debug 時參考，不覆蓋官方 iNAV、不參與分數。",
  },
};
const DEFAULT_FETCH_TIMEOUT_MS = 8000;
const DEFAULT_REFRESH_COOLDOWN_MS = 60000;

const initialStocks = [
  createAssetTemplate({ symbol: "2330", name: "台積電", type: "股票", market: "TWSE" }),
  createAssetTemplate({ symbol: "0050", name: "元大台灣50", type: "ETF", market: "TWSE" }),
];

function getSourceConnectorPlan(config) {
  return [
    { name: "FinMind API", role: "Daily 技術補資料 / 備援", status: config.finmindProxyUrl ? "可測試" : "待接 proxy", fields: "技術、PER/PBR/殖利率比對、三大法人、融資融券、月營收、財報、資產負債", method: "前端呼叫自己的 proxy，不直接放 FinMind token；Daily 只補技術欄位，不覆蓋 Google/TWSE 行情與估值主資料，TaiwanStockPER 僅作比對。" },
    { name: "GoogleFinance", role: "較新行情 / 主畫面行情", status: config.googleCsvUrl ? "可測試" : "待填公開 CSV URL", fields: "price、prevClose、volume、volume10ma、volumeRatio、PER、EPS、high52/low52、roc20、Nasdaq、SOX、VIX、tradetime、updatedAt、sourceNote；MA5/MA20 可作技術輔助比對", method: "前端只貼 CSV URL；App 走 /api/google/verify 讀取。Google 作盤中參考行情來源，行情新鮮度以 tradetime 為準，updatedAt 僅作 Sheet/debug 參考；盤中若 TWSE MIS 已到位，Google 不再覆蓋主價量；若 published CSV 回吐較舊 tradetime，App 保留較新行情，不讓價格與量能回退。" },
    { name: "TWSE OpenAPI", role: "官方盤後 / 官方校正", status: config.twseProxyUrl ? "可測試" : "需 proxy", fields: "官方 price、prevClose、volume、PER、PBR、殖利率", method: "預設走 /api/twse/stocks proxy；免費免 token，作官方盤後校正與估值基準。盤中不拿 TWSE 硬比 GoogleFinance 即時口徑。" },
    { name: "TWSE MIS", role: "盤中 price / volume 主來源候選", status: "可手動測試", fields: "price / displayPrice / quoteMidPrice / prevClose / volume / tradetime / quoteAgeSec / navUrl", method: "前端手動讀取 Next.js TWSE MIS route；更新主畫面 price / volume，GoogleFinance 保留輔助比對；短線分數公式暫不改。" },
    { name: "Yahoo OHLCV", role: "外部 raw OHLCV 抽樣驗證", status: config.yahooOhlcvProxyUrl ? "可驗證" : "待接 proxy", fields: "Open / High / Low / Close、MACD / KD / ATR 同公式重算結果", method: "呼叫 /api/yahoo/ohlcv；只作外部 raw OHLCV 抽樣與技術指標同公式重算驗證，不覆蓋 FinMind 主技術資料、不參與分數。日期不同時只顯示外部值並標示不比對。" },
    { name: "ETF 即時估值", role: "ETF 折溢價主資料", status: config.etfInavProxyUrl ? "可測試" : "待接 proxy", fields: "即時估值、市價、折溢價、前日淨值/市價", method: "呼叫 /api/etf/inav；更新 ETF 小卡與驗證表，不參與短線分數。" },
    { name: "ETF 備援", role: "ETF 備援輔助資料", status: config.yahooEtfProxyUrl ? "可測試" : "待接 proxy", fields: "ETF 市價、漲跌、漲跌幅、區間高低、區間差、折溢價%", method: "僅作備援輔助；不覆蓋主行情、不參與股票或 ETF 短線分數。" },
  ];
}

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
    datasets: "Google Sheet CSV / GOOGLEFINANCE",
    fields: "price、prevClose、volume、volume10ma、volumeRatio、PER、EPS、high52/low52、roc20、Nasdaq、SOX、VIX、tradetime、updatedAt",
    calcNote: "主畫面較新行情來源；前端每 20 秒重新讀取公開 CSV。行情新鮮度以 tradetime 為準，updatedAt 只作 Sheet/debug 參考；若 Google published CSV 回吐舊快照，App 保留已採用的較新行情。",
    verifyRef: "TWSE MIS 作盤中主價量參考；TWSE OpenAPI 作盤後官方校正。",
    shortRole: "短線輔助行情來源。",
    midRole: "中線行情參考。",
    longRole: "長線不作唯一依據。"
  },
  {
    group: "非即時資料區",
    aspect: "TWSE OpenAPI",
    datasets: "STOCK_DAY_ALL / BWIBBU_ALL",
    fields: "官方 price、prevClose、volume、PER、PBR、殖利率",
    calcNote: "免費、免 token、官方盤後 / 官方校正資料；固定時段 cache，第一次進頁面會啟動預熱並補驗證表。",
    verifyRef: "GoogleFinance 較新行情可比對價量；FinMind Daily 不覆蓋官方估值。",
    shortRole: "官方校正。",
    midRole: "估值與盤後基準。",
    longRole: "PER / PBR / 殖利率基準。"
  },
  {
    group: "非即時資料區",
    aspect: "FinMind Daily",
    datasets: "TaiwanStockPrice + 技術 / 籌碼 / 基本面 datasets",
    fields: "MA、RSI、MACD、KD、ATR、20日量均、return20d/60d、三大法人、融資融券、月營收、財報、資產負債",
    calcNote: "供分數使用；第一次進頁面會啟動預熱。route 端保留 1 小時 cache + stale-if-error，避免 API 異常時把 0 值鎖進 cache。",
    verifyRef: "TWSE OpenAPI 校正盤後價量與估值；Yahoo OHLCV 僅作外部技術抽樣驗證。",
    shortRole: "技術分數與籌碼資料來源。",
    midRole: "趨勢、籌碼與基本面輔助。",
    longRole: "長線趨勢與品質輔助。"
  },
  {
    group: "非即時資料區",
    aspect: "FinMind Market",
    datasets: "/api/finmind/market",
    fields: "Nasdaq、SOX、S&P500、VIX、匯率 / 利率 / 商品等市場參考",
    calcNote: "市場風險補資料；啟動預熱 / 主更新 / 手動觸發，route 端 1 小時 cache，不做 interval 自動刷新。",
    verifyRef: "GoogleFinance Nasdaq / SOX / VIX 可作同向參考；日收盤與盤中口徑不同時不硬判。",
    shortRole: "美股與市場風險參考。",
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
    calcNote: "外部 raw OHLCV 抽樣驗證；固定時段 cache，只更新驗證層，不覆蓋 FinMind 主技術資料、不參與分數。",
    verifyRef: "與 FinMind 最新共同交易日對齊；日期不同時顯示外部值但標記不比對。",
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
  { title: "即時區", description: "盤中/即時參考：行情、ETF 即時估值與 Google 輔助行情。", tone: "bg-emerald-50 text-emerald-800 border-emerald-100" },
  { title: "非即時資料區", description: "啟動預熱 / 主更新 / 固定時段 cache：官方盤後校正、技術分數、籌碼、市場與風險補資料。", tone: "bg-sky-50 text-sky-800 border-sky-100" },
  { title: "救援區", description: "備援與抽樣驗證：不覆蓋主資料、不參與短線分數。", tone: "bg-amber-50 text-amber-800 border-amber-100" },
].map((group) => ({
  ...group,
  items: finmindAspectPlan.filter((item) => item.group === group.title),
}));

const DEFAULT_WEIGHT_CONFIG = {
  short: {
    ma5: 0.08,
    ma20: 0.08,
    rsi: 0.07,
    macdMomentum: 0.06,
    kdTurn: 0.04,
    atrVolatility: 0.02,
    volumePower: 0.05,
    institutional3d: 0.15,
    margin5d: 0.1,
    usMarket: 0.15,
    futuresVix: 0.15,
    derivativesData: 0.05,
    fundamentalsData: 0,
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

function cloneWeightConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_WEIGHT_CONFIG));
}

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
const pct = (value) => `${Number(value || 0).toFixed(1)}%`;
const number = (value) => Number(value || 0).toLocaleString("zh-TW");
const compactNumber = (value, digits = 1) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "-";
  const abs = Math.abs(n);
  if (abs >= 100000000) return `${(n / 100000000).toFixed(digits).replace(/\.0$/, "")}億`;
  if (abs >= 10000) return `${(n / 10000).toFixed(digits).replace(/\.0$/, "")}萬`;
  if (abs >= 1000) return `${(n / 1000).toFixed(digits).replace(/\.0$/, "")}千`;
  return Number(n.toFixed(digits)).toLocaleString("zh-TW");
};
const compactRatio = (value) => `${Number(value || 0).toFixed(2)}x`;
const shortDerivativeLabel = (label) => {
  const raw = String(label || "");
  const map = [
    ["期貨法人金額明顯偏多", "明顯偏多"],
    ["期貨法人金額偏多", "偏多"],
    ["期貨法人金額小幅偏空", "小幅偏空"],
    ["期貨法人金額偏空", "偏空"],
    ["期貨法人金額待接", "待接"],
    ["PutCall量 偏多/避險低", "避險低"],
    ["PutCall量 中性", "中性"],
    ["PutCall量 小幅偏高", "小幅偏高"],
    ["PutCall量 偏高", "偏高"],
    ["PutCall量 明顯偏高", "明顯偏高"],
    ["PutCall量 待接", "待接"],
    ["PutCall OI 明顯偏支撐", "強支撐"],
    ["PutCall OI 偏支撐", "偏支撐"],
    ["PutCall OI 中性", "中性"],
    ["PutCall OI 偏壓力", "偏壓力"],
    ["PutCall OI 明顯偏壓力", "壓力高"],
    ["PutCall OI 待接", "待接"],
    ["選擇權法人偏多", "偏多"],
    ["選擇權法人中性", "中性"],
    ["選擇權法人偏空", "偏空"],
    ["選擇權法人待接", "待接"],
  ];
  const found = map.find(([from]) => raw === from);
  return found ? found[1] : raw.replace("期貨法人金額", "").replace("PutCall量 ", "").replace("PutCall OI ", "").replace("選擇權法人", "").trim() || raw;
};
const compactDecimal = (value, digits = 2) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
};
const shortPcVolumeLabel = (label) => {
  const short = shortDerivativeLabel(label);
  if (short === "小幅偏高") return "小避險";
  if (short === "偏高") return "偏避險";
  if (short === "明顯偏高") return "強避險";
  if (short === "避險低") return "避險低";
  return short;
};
const compactDerivativeText = (stock, derivativesRisk) => {
  // 保留核心數字與方向，只縮短標籤；期權列歸入市場面的避險壓力檢查。
  const futures = `期貨${shortDerivativeLabel(derivativesRisk.futuresLabel)} ${compactNumber(stock.futuresInstitutionalNetAmount, 0)}`;
  const pcVol = `PC ${compactDecimal(stock.putCallVolumeRatio, 2)}${shortPcVolumeLabel(derivativesRisk.pcLabel)}`;
  const pcOi = `OI ${compactDecimal(stock.putCallOpenInterestRatio, 2)}${shortDerivativeLabel(derivativesRisk.pcOiLabel)}`;
  const option = `選權 ${compactDecimal(stock.optionInstitutionalNetBias, 0)}${shortDerivativeLabel(derivativesRisk.optionBiasLabel)}`;
  return `${futures} / ${pcVol} / ${pcOi} / ${option}`;
};
const fundamentalBriefText = (stock) => {
  const revenueYoY = Number.isFinite(Number(stock.revenueYoY)) ? pct(stock.revenueYoY) : "待補";
  const revenueMoM = Number.isFinite(Number(stock.revenueMoM)) ? pct(stock.revenueMoM) : "待補";
  const epsLabel = Number.isFinite(Number(stock.eps)) ? number(stock.eps) : "待補";
  const epsTtmLabel = Number.isFinite(Number(stock.epsTtm)) ? number(stock.epsTtm) : "待補";
  const epsGrowthLabel = Number.isFinite(Number(stock.epsGrowthYoY)) ? pct(stock.epsGrowthYoY) : "待補";
  const roeLabel = Number.isFinite(Number(stock.roeTtm ?? stock.roe)) ? pct(Number(stock.roeTtm ?? stock.roe)) : "待補";
  const grossMarginLabel = Number.isFinite(Number(stock.grossMargin)) ? pct(stock.grossMargin) : "待補";
  const operatingMarginLabel = Number.isFinite(Number(stock.operatingMargin)) ? pct(stock.operatingMargin) : "待補";
  const grossTrendLabel = Number.isFinite(Number(stock.grossMarginQoQ)) ? `${Number(stock.grossMarginQoQ) >= 0 ? "+" : ""}${compactDecimal(stock.grossMarginQoQ, 2)}點` : "待補";
  const opTrendLabel = Number.isFinite(Number(stock.operatingMarginQoQ)) ? `${Number(stock.operatingMarginQoQ) >= 0 ? "+" : ""}${compactDecimal(stock.operatingMarginQoQ, 2)}點` : "待補";
  const debtLabel = Number.isFinite(Number(stock.debtRatio)) ? pct(stock.debtRatio) : "待補";
  const strongRevenue = Number(stock.revenueYoY) > 0 && Number(stock.revenueMoM) > 0;
  const strongEps = Number(stock.epsGrowthYoY) > 0 || Number(stock.epsTtmGrowthYoY) > 0;
  const strongQuality = Number(stock.roeTtm ?? stock.roe) >= 15 && Number(stock.grossMargin) >= 30;
  const quality = strongRevenue && strongEps && strongQuality ? "偏強" : strongRevenue || strongEps || strongQuality ? "中性偏正" : "待觀察";
  // 基本面不進短線權重；保留營收、獲利、品質與財務安全的主要數字。
  return `${quality}：營收YoY/MoM ${revenueYoY}/${revenueMoM}；EPS ${epsLabel} / TTM ${epsTtmLabel}（YoY ${epsGrowthLabel}）；ROE ${roeLabel}；毛利/營益 ${grossMarginLabel}/${operatingMarginLabel}（QoQ ${grossTrendLabel}/${opTrendLabel}）；負債 ${debtLabel}`;
};
const passScore = (condition) => (condition ? 1 : 0);
const roundScore = (value) => Number(clamp(value, 0, 1).toFixed(2));
function scorePriceVsMa(price, ma, { weak = -2, idealLow = 0, idealHigh = 5, overheat = 12 } = {}) {
  if (!Number.isFinite(Number(price)) || !Number.isFinite(Number(ma)) || Number(ma) <= 0) return 0;
  const diff = ((Number(price) - Number(ma)) / Number(ma)) * 100;

  if (diff <= weak) return 0.1;
  if (diff < idealLow) return roundScore(0.35 + ((diff - weak) / (idealLow - weak)) * 0.25);
  if (diff <= idealHigh) return roundScore(0.75 + ((diff - idealLow) / Math.max(idealHigh - idealLow, 1)) * 0.25);
  if (diff <= overheat) return roundScore(1 - ((diff - idealHigh) / Math.max(overheat - idealHigh, 1)) * 0.3);
  return 0.55;
}

function scoreRsiShort(rsi) {
  const value = Number(rsi);
  if (!Number.isFinite(value)) return 0;
  if (value >= 45 && value <= 65) return 1;
  if ((value >= 35 && value < 45) || (value > 65 && value <= 70)) return 0.7;
  if (value >= 30 && value < 35) return 0.45;
  if (value > 70 && value <= 80) return 0.35;
  return 0.15;
}

function scoreMacdMomentum({ macd, macdSignal, macdHist, macdState }) {
  const hist = Number(macdHist);
  const m = Number(macd);
  const s = Number(macdSignal);
  const state = String(macdState || "");

  if (!Number.isFinite(hist) || !Number.isFinite(m) || !Number.isFinite(s)) return 0;

  if (state.includes("多方動能擴大") || state.includes("趨勢剛轉強")) return 1;
  if (state.includes("多方動能收斂")) return 0.75;
  if (state.includes("空方動能收斂")) return 0.45;
  if (state.includes("趨勢剛轉弱")) return 0.3;
  if (state.includes("空方動能擴大")) return 0.15;

  if (hist > 0 && m > s) return 0.75;
  if (hist > 0) return 0.65;
  if (hist < 0 && m < s) return 0.25;
  if (hist < 0) return 0.35;
  return 0.5;
}

function scoreKdTurn({ k9, d9, j9, kdState }) {
  const k = Number(k9);
  const d = Number(d9);
  const j = Number(j9);
  const state = String(kdState || "");

  if (!Number.isFinite(k) || !Number.isFinite(d)) return 0;

  if (state.includes("低檔轉強")) return 0.9;
  if (state.includes("短線轉強")) return 0.78;
  if (state.includes("短線偏多")) return 0.75;
  if (state.includes("高檔強勢")) return 0.65;
  if (state.includes("高檔轉弱")) return 0.25;
  if (state.includes("短線轉弱")) return 0.35;
  if (state.includes("短線偏弱")) return 0.35;
  if (state.includes("低檔弱勢")) return 0.2;

  if (k >= d && k < 80) return 0.75;
  if (k >= d && k >= 80) return 0.65;
  if (k < d && k > 80) return 0.25;
  if (k < d && k < 20) return 0.3;
  if (Number.isFinite(j) && j > 100) return 0.45;
  return 0.5;
}

function scoreAtrVolatility({ atrPct, volatilityState }) {
  const value = Number(atrPct);
  const state = String(volatilityState || "");

  if (!Number.isFinite(value) || value <= 0) return 0;

  if (state.includes("波動低")) return 0.8;
  if (state.includes("波動正常")) return 1;
  if (state.includes("波動升高")) return 0.6;
  if (state.includes("波動過大")) return 0.25;

  if (value < 1) return 0.8;
  if (value <= 3) return 1;
  if (value <= 5) return 0.6;
  return 0.25;
}

function parseTaiwanMarketMinute(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const hour = value.getHours();
    const minute = value.getMinutes();
    return hour * 60 + minute;
  }

  let text = String(value).trim();
  if (!text) return null;

  const isPm = /下午|PM/i.test(text);
  const isAm = /上午|AM/i.test(text);

  const match = text.match(/(\d{1,2})[:：](\d{2})/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  if (isPm && hour < 12) hour += 12;
  if (isAm && hour === 12) hour = 0;

  return hour * 60 + minute;
}

function volumeTimeBucket(minuteOfDay) {
  if (!Number.isFinite(Number(minuteOfDay))) {
    return {
      mode: "unknown",
      label: "時間未知",
      coefficient: null,
      note: "未取得 GoogleFinance tradetime，量能僅作盤中參考，不作時間校正。",
    };
  }

  const minute = Number(minuteOfDay);

  if (minute < 540) {
    return {
      mode: "preopen",
      label: "盤前/未開盤",
      coefficient: null,
      note: "尚未進入連續交易時段，不作正式量能判斷。",
    };
  }

  if (minute < 570) {
    return {
      mode: "early",
      label: "早盤觀察",
      coefficient: null,
      note: "09:00～09:30 開盤量容易受撮合、跳空與隔夜單影響，預設中性，不硬扣分。",
    };
  }

  if (minute < 600) return { mode: "intraday", label: "盤中校正", coefficient: 0.35, note: "以 09:30～10:00 量能進度係數 0.35 推估全日量。" };
  if (minute < 630) return { mode: "intraday", label: "盤中校正", coefficient: 0.48, note: "以 10:00～10:30 量能進度係數 0.48 推估全日量。" };
  if (minute < 690) return { mode: "intraday", label: "盤中校正", coefficient: 0.65, note: "以 10:30～11:30 量能進度係數 0.65 推估全日量。" };
  if (minute < 750) return { mode: "intraday", label: "盤中校正", coefficient: 0.80, note: "以 11:30～12:30 量能進度係數 0.80 推估全日量。" };
  if (minute < 800) return { mode: "intraday", label: "盤中校正", coefficient: 0.95, note: "以 12:30～13:20 量能進度係數 0.95 推估全日量。" };

  return {
    mode: "nearClose",
    label: "接近盤後",
    coefficient: 1,
    note: "13:20 之後接近完整日量，可近似視為正式日量。",
  };
}

function baseVolumeScoreV11(volumeRatio) {
  const value = Number(volumeRatio);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value < 0.5) return 0.15;
  if (value < 0.8) return 0.35;
  if (value < 1.3) return 0.55;
  if (value < 2) return 0.85;
  if (value < 3.5) return 1;
  return 0.7;
}

function volumePowerStateV11(volumeRatio) {
  const value = Number(volumeRatio);
  if (!Number.isFinite(value) || value <= 0) return "量能待補";
  if (value < 0.5) return "明顯量縮";
  if (value < 0.8) return "量能偏弱";
  if (value < 1.3) return "量能正常";
  if (value < 2) return "量能增溫";
  if (value < 3.5) return "爆量攻擊";
  return "爆量偏熱";
}

function priceVolumeConfirmAdjustment(baseScore, ratio, stock) {
  const price = Number(stock?.price || 0);
  const prevClose = Number(stock?.prevClose || 0);
  const ma5 = Number(stock?.ma5 || 0);
  const todayReturn = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
  const priceUp = todayReturn > 0 || (ma5 > 0 && price >= ma5);
  const priceDown = todayReturn < 0;

  let score = Number(baseScore || 0);
  let label = "價量待確認";

  if (Number(ratio) >= 1.3 && priceUp) {
    score = Math.max(score, 0.85);
    label = "量增價穩/價漲";
  } else if (Number(ratio) >= 1.3 && priceDown) {
    score = Math.min(score, 0.4);
    label = "放量下跌";
  } else if (Number(ratio) < 0.8 && priceUp) {
    score = Math.min(score, 0.55);
    label = "量縮上漲";
  } else if (Number(ratio) < 0.8 && priceDown) {
    score = Math.min(score, 0.25);
    label = "量縮弱勢";
  } else {
    label = "價量中性";
  }

  return { score: clamp(score, 0, 1), confirmLabel: label, todayReturn };
}

function analyzeVolumePower(stock, derived = {}) {
  const volume = Number(stock?.volume || 0);
  const base = Number(derived.volumeBase || 0);
  const rawRatio = Number(derived.volumeRatio || 0);
  const timeText = stock?.tradetime || stock?.tradeTime || stock?.googleTradeTime || stock?.updatedAt || "";
  const minuteOfDay = parseTaiwanMarketMinute(timeText);
  const bucket = volumeTimeBucket(minuteOfDay);

  if (!Number.isFinite(volume) || volume <= 0 || !Number.isFinite(base) || base <= 0) {
    return {
      ratio: rawRatio || 0,
      rawRatio,
      estimatedFullDayVolume: null,
      coefficient: null,
      mode: "missing",
      label: "量能待補",
      score: 0,
      confirmLabel: "資料不足",
      timeLabel: bucket.label,
      timeText,
      note: "成交量或均量基準不足，無法評分。",
    };
  }

  if (bucket.mode === "early" || bucket.mode === "preopen") {
    return {
      ratio: rawRatio,
      rawRatio,
      estimatedFullDayVolume: null,
      coefficient: bucket.coefficient,
      mode: bucket.mode,
      label: "早盤觀察",
      score: 0.5,
      confirmLabel: "早盤不硬扣",
      timeLabel: bucket.label,
      timeText,
      note: bucket.note,
    };
  }

  let adjustedRatio = rawRatio;
  let estimatedFullDayVolume = null;

  if (bucket.mode === "intraday" && bucket.coefficient > 0) {
    estimatedFullDayVolume = volume / bucket.coefficient;
    adjustedRatio = estimatedFullDayVolume / base;
  }

  const baseScore = baseVolumeScoreV11(adjustedRatio);
  const adjusted = priceVolumeConfirmAdjustment(baseScore, adjustedRatio, stock);

  return {
    ratio: adjustedRatio,
    rawRatio,
    estimatedFullDayVolume,
    coefficient: bucket.coefficient,
    mode: bucket.mode,
    label: volumePowerStateV11(adjustedRatio),
    score: adjusted.score,
    confirmLabel: adjusted.confirmLabel || adjusted.label || "價量中性",
    timeLabel: bucket.label,
    timeText,
    note: bucket.note,
  };
}

function scoreVolumePower(volumeInput, stock = null) {
  if (volumeInput && typeof volumeInput === "object" && "score" in volumeInput) return Number(volumeInput.score || 0);
  if (stock) return analyzeVolumePower(stock, getDerived(stock)).score;
  return baseVolumeScoreV11(volumeInput);
}

function scoreInstitutionalFlow(stockOrNet, maybeAvgVolume20 = null) {
  const isObject = stockOrNet && typeof stockOrNet === "object";

  const foreign3d = isObject ? Number(stockOrNet.foreign3d || 0) : 0;
  const trust3d = isObject ? Number(stockOrNet.trust3d || 0) : 0;
  const dealer3d = isObject ? Number(stockOrNet.dealer3d || 0) : 0;
  const net3d = isObject ? foreign3d + trust3d + dealer3d : Number(stockOrNet || 0);
  const avgVolume20 = isObject ? Number(stockOrNet.avgVolume20 || 0) : Number(maybeAvgVolume20 || 0);

  // 若 FinMind avgVolume20 尚未進來，不要直接把籌碼分打成 0；
  // 先退回舊版方向判斷，避免「資料還沒吃到」時整列壞掉。
  if (!Number.isFinite(avgVolume20) || avgVolume20 <= 0) {
    if (net3d > 1000000) return 1;
    if (net3d > 0) return 0.65;
    if (net3d > -1000000) return 0.35;
    return 0.1;
  }

  const netRatio = (net3d / avgVolume20) * 100;
  let score = 0.5;

  if (netRatio >= 5) score = 1;
  else if (netRatio >= 2) score = 0.8;
  else if (netRatio >= 0.5) score = 0.65;
  else if (netRatio >= 0) score = 0.55;
  else if (netRatio >= -1) score = 0.35;
  else if (netRatio >= -3) score = 0.2;
  else score = 0.05;

  if (isObject) {
    // 外資與投信同向買超，比單一法人撐盤更健康；若外資賣、投信買，只給部分分數。
    if (foreign3d > 0 && trust3d > 0) score = Math.min(1, score + 0.1);
    if (foreign3d < 0 && trust3d > 0 && net3d > 0) score = Math.min(score, 0.65);
    if (foreign3d < 0 && trust3d < 0) score = Math.min(score, 0.25);
  }

  return roundScore(score);
}

function institutionalFlowDetails(stock) {
  const avgVolume20 = Number(stock?.avgVolume20 || 0);
  const net3d = Number(stock?.foreign3d || 0) + Number(stock?.trust3d || 0) + Number(stock?.dealer3d || 0);
  const ratio = avgVolume20 > 0 ? (net3d / avgVolume20) * 100 : null;
  return { net3d, ratio };
}

function scoreMarginRisk(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 1;
  if (n <= 5) return 0.8;
  if (n <= 8) return 0.5;
  return 0.1;
}

function scoreMarginShortRisk(marginChange5dPct, shortSaleChange5dPct) {
  const margin = Number(marginChange5dPct);
  const shortSale = Number(shortSaleChange5dPct);

  let marginScore = scoreMarginRisk(margin);
  let shortScore = 0.6;

  if (Number.isFinite(shortSale)) {
    if (shortSale >= 30) shortScore = 0.25;
    else if (shortSale >= 15) shortScore = 0.45;
    else if (shortSale >= 5) shortScore = 0.65;
    else if (shortSale >= -10) shortScore = 0.85;
    else shortScore = 1;
  }

  return roundScore(marginScore * 0.75 + shortScore * 0.25);
}

function scoreUsMarket(nasdaq, sox) {
  const a = Number(nasdaq);
  const b = Number(sox);
  const values = [a, b].filter(Number.isFinite);

  if (!values.length) return 0;

  const avg = values.reduce((sum, x) => sum + x, 0) / values.length;

  if (a > 0 && b > 0 && avg >= 1) return 1;
  if (a > 0 && b > 0) return 0.85;
  if (a > 0 || b > 0) return 0.65;
  if (avg >= -1) return 0.35;
  return 0.1;
}

function scoreOvernightRisk({ taifexAfterHoursReturn, vixChange1d }) {
  const parts = [];

  if (Number.isFinite(Number(taifexAfterHoursReturn))) {
    const value = Number(taifexAfterHoursReturn);
    if (value > 0.5) parts.push(1);
    else if (value > 0) parts.push(0.75);
    else if (value > -0.5) parts.push(0.45);
    else parts.push(0.15);
  }

  if (Number.isFinite(Number(vixChange1d))) {
    const value = Number(vixChange1d);
    if (value < -1) parts.push(1);
    else if (value <= 0) parts.push(0.75);
    else if (value <= 1) parts.push(0.55);
    else parts.push(0.2);
  }

  return parts.length ? roundScore(parts.reduce((sum, x) => sum + x, 0) / parts.length) : 0;
}

function overnightRiskDetails({ taifexAfterHoursReturn, vixChange1d }) {
  const tx = Number(taifexAfterHoursReturn);
  const vix = Number(vixChange1d);

  const txLabel = Number.isFinite(tx)
    ? tx > 0.5
      ? "台指期偏強"
      : tx > 0
        ? "台指期小漲"
        : tx > -0.5
          ? "台指期中性偏弱"
          : "台指期偏弱"
    : "台指期待接";

  const vixLabel = Number.isFinite(vix)
    ? vix < -1
      ? "VIX 明顯回落"
      : vix <= 0
        ? "VIX 小幅回落"
        : vix <= 1
          ? "VIX 小升，中性"
          : "VIX 上升偏風險"
    : "VIX 待接";

  return { txLabel, vixLabel };
}

function scoreDerivativesRisk({ putCallVolumeRatio, putCallOpenInterestRatio, futuresInstitutionalNetAmount, optionInstitutionalNetBias }) {
  const parts = [];

  // Put/Call Volume：成交量偏高通常代表短線避險需求升溫，所以高值扣分。
  if (Number.isFinite(Number(putCallVolumeRatio))) {
    const value = Number(putCallVolumeRatio);
    if (value <= 0.9) parts.push(1);
    else if (value <= 1.05) parts.push(0.8);
    else if (value <= 1.2) parts.push(0.6);
    else if (value <= 1.5) parts.push(0.35);
    else parts.push(0.1);
  }

  // Put/Call OI：未平倉量邏輯與成交量相反。OI 高常被解讀為下方 Put 支撐，偏加分；OI 低代表上方 Call 壓制較重，偏扣分。
  if (Number.isFinite(Number(putCallOpenInterestRatio))) {
    const value = Number(putCallOpenInterestRatio);
    if (value >= 1.5) parts.push(1);
    else if (value >= 1.15) parts.push(0.85);
    else if (value >= 1.0) parts.push(0.6);
    else if (value >= 0.85) parts.push(0.35);
    else parts.push(0.15);
  }

  // 這裡使用的是 route 回傳的 futuresInstitutionalNetAmount，單位是金額，不是口數。
  // 若未來改用 futuresInstitutionalNetVolume，門檻要改成口數級距。
  if (Number.isFinite(Number(futuresInstitutionalNetAmount))) {
    const value = Number(futuresInstitutionalNetAmount);
    if (value > 10000000) parts.push(1);
    else if (value > 0) parts.push(0.75);
    else if (value > -10000000) parts.push(0.45);
    else parts.push(0.2);
  }

  if (Number.isFinite(Number(optionInstitutionalNetBias))) {
    const value = Number(optionInstitutionalNetBias);
    if (value > 0) parts.push(0.75);
    else if (value === 0) parts.push(0.5);
    else parts.push(0.25);
  }

  return parts.length ? roundScore(parts.reduce((sum, x) => sum + x, 0) / parts.length) : 0;
}

function derivativesRiskDetails({ putCallVolumeRatio, putCallOpenInterestRatio, futuresInstitutionalNetAmount, optionInstitutionalNetBias }) {
  const pc = Number(putCallVolumeRatio);
  const pcOi = Number(putCallOpenInterestRatio);
  const futuresNet = Number(futuresInstitutionalNetAmount);
  const optionBias = Number(optionInstitutionalNetBias);

  const pcLabel = Number.isFinite(pc)
    ? pc <= 0.9
      ? "PutCall量 偏多/避險低"
      : pc <= 1.05
        ? "PutCall量 中性"
        : pc <= 1.2
          ? "PutCall量 小幅偏高"
          : pc <= 1.5
            ? "PutCall量 偏高"
            : "PutCall量 明顯偏高"
    : "PutCall量 待接";

  const pcOiLabel = Number.isFinite(pcOi)
    ? pcOi >= 1.5
      ? "PutCall OI 明顯偏支撐"
      : pcOi >= 1.15
        ? "PutCall OI 偏支撐"
        : pcOi >= 1.0
          ? "PutCall OI 中性"
          : pcOi >= 0.85
            ? "PutCall OI 偏壓力"
            : "PutCall OI 明顯偏壓力"
    : "PutCall OI 待接";

  const futuresLabel = Number.isFinite(futuresNet)
    ? futuresNet > 10000000
      ? "期貨法人金額明顯偏多"
      : futuresNet > 0
        ? "期貨法人金額偏多"
        : futuresNet > -10000000
          ? "期貨法人金額小幅偏空"
          : "期貨法人金額偏空"
    : "期貨法人金額待接";

  const optionBiasLabel = Number.isFinite(optionBias)
    ? optionBias > 0
      ? "選擇權法人偏多"
      : optionBias === 0
        ? "選擇權法人中性"
        : "選擇權法人偏空"
    : "選擇權法人待接";

  return { pcLabel, pcOiLabel, futuresLabel, optionBiasLabel };
}

function scoreFundamentalReady(stock) {
  const checks = [
    hasFinite(stock.revenueYoY),
    hasFinite(stock.revenueMoM),
    hasFinite(stock.eps),
    hasFinite(stock.epsGrowthYoY),
    hasFinite(stock.grossMargin),
    hasFinite(stock.operatingMargin),
    hasFinite(stock.debtRatio),
  ];
  return roundScore(checks.filter(Boolean).length / checks.length);
}


function createAssetTemplate({ symbol, name, type, market }) {
  const normalizedSymbol = normalizeStockSymbol(symbol);
  const normalizedType = type === "ETF" ? "ETF" : "股票";
  return { symbol: normalizedSymbol, name: String(name || normalizedSymbol || "新標的").trim(), type: normalizedType, market: market || "TWSE", price: 0, prevClose: 0, high20: 0, low20: 0, high52: 0, low52: 0, drawdown52: 0, pricePosition52: 0, roc20: 0, volume: 0, volume10ma: 0, volumeRatio: 0, avgVolume20: 0, ma5: 0, ma20: 0, ma60: 0, rsi14: 50, return20d: 0, return60d: 0, macd: null, macdSignal: null, macdHist: null, macdHistPrev1: null, macdHistPrev3: null, macdHistDelta3: null, macdHistTrend3: "", macdState: "", macdWarmupReady: false, k9: null, d9: null, j9: null, k9Prev1: null, d9Prev1: null, kdDiff: null, kdDiffPrev1: null, kdDiffTrend3: "", kdCross: "", kdState: "", kdWarmupReady: false, atr14: null, atrPct: null, atrPctAvg20: null, atrPctVsAvg20: null, volatilityState: "", atrWarmupReady: false, priceRowCount: 0, technicalWarmupStatus: null, marketcap: 0, beta: 0, datadelay: null, nasdaqReturn1d: 0, soxReturn1d: 0, taifexAfterHoursReturn: 0, vixChange1d: 0, foreign3d: 0, trust3d: 0, dealer3d: 0, foreign20d: 0, trust20d: 0, marginChange5dPct: 0, marginChange20dPct: 0, revenueYoY: 0, revenueMoM: 0, epsGrowthYoY: 0, eps: 0, earningsYield: 0, grossMargin: 0, operatingMargin: 0, grossMarginQoQ: 0, operatingMarginQoQ: 0, netMargin: 0, netMarginQoQ: 0, epsTtm: 0, epsTtmGrowthYoY: 0, incomeAfterTaxesTtm: 0, financialQuarterCount: 0, roe: 0, roeTtm: 0, debtRatio: 0, per: 0, pbr: 0, dividendYield: 0, yield: 0, yahooEtfMarketPrice: null, yahooEtfChange: null, yahooEtfChangePct: null, yahooEtfRangeHigh: null, yahooEtfRangeLow: null, yahooEtfRangeSpread: null, yahooEtfPremiumDiscountPct: null, yahooEtfSourcePage: "", yahooEtfFetchedAt: "", officialEtfInavEstimatedNav: null, officialEtfInavLatestPrice: null, officialEtfInavReferenceNav: null, officialEtfInavYesterdayPrice: null, officialEtfInavPremiumDiscountPct: null, officialEtfInavNavDate: "", officialEtfInavSourceType: "", officialEtfInavAdapter: "", officialEtfInavUpdatedAt: "" };
}

function parseNum(value, fallback = 0) {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (raw === "" || raw === "-" || raw === "--" || raw.toUpperCase() === "N/A") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  return Number.isFinite(n) ? number(n) : "-";
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


function hasCjkText(value) {
  return /[\u4e00-\u9fff]/.test(String(value || ""));
}

function isPlaceholderName(name, symbol) {
  const raw = String(name || "").trim();
  const normalizedSymbol = normalizeStockSymbol(symbol);
  if (!raw) return true;
  if (raw === normalizedSymbol) return true;
  if (normalizeStockSymbol(raw) === normalizedSymbol) return true;
  if (raw.toUpperCase() === `TPE:${normalizedSymbol}` || raw.toUpperCase() === `TWO:${normalizedSymbol}`) return true;
  if (/^[0-9]{4}\s*$/.test(raw)) return true;
  return false;
}

function shouldReplaceName(currentName, officialName, symbol) {
  const official = String(officialName || "").trim();
  if (!official || official === symbol) return false;
  if (isPlaceholderName(currentName, symbol)) return true;
  // 如果目前名稱沒有中文，而官方名稱有中文，以官方名稱為準。
  if (!hasCjkText(currentName) && hasCjkText(official)) return true;
  return false;
}

function preferOfficialName(currentName, officialName, symbol) {
  const official = String(officialName || "").trim();
  if (!official || official === symbol) return { name: currentName, changed: false };

  // TWSE 有官方中文名時，一律用 TWSE 名稱作顯示基準。
  if (hasCjkText(official)) {
    return { name: official, changed: String(currentName || "").trim() !== official };
  }

  if (shouldReplaceName(currentName, official, symbol)) {
    return { name: official, changed: true };
  }

  return { name: currentName, changed: false };
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
    dataTime: row.dataTime ?? null,
    updatedAt: row.updatedAt ?? row.date ?? row.dataTime?.stockDayDateIso ?? row.dataTime?.bwibbuDateIso ?? null,
    sourceNote: row.sourceNote ?? row.dataTime?.note ?? "",
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

function normalizeTwseMisDateTime(dateText, timeText) {
  const d = String(dateText || "").trim();
  const t = String(timeText || "").trim();
  if (!d || !t) return "";
  const match = d.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) return `${d} ${t}`;
  return `${match[1]}/${match[2]}/${match[3]} ${t}`;
}

function normalizeTwseMisItem(item) {
  if (!item) return null;
  const symbol = normalizeStockSymbol(item.symbol || item.stock_id || item.c || item.ch);
  if (!symbol) return null;

  const raw = item.twseMisRaw || item.raw || item;
  const rawName = item.name || raw.n || raw.nf || symbol;
  const displayPrice = parseNum(item.displayPrice ?? item.price ?? item.quoteMidPrice ?? raw.z ?? raw.pz, null);
  const price = parseNum(item.price ?? raw.z ?? raw.pz, null);
  const quoteMidPrice = parseNum(item.quoteMidPrice, null);
  const lots = parseNum(item.twseMisLots ?? raw.v, null);
  const volumeShares = parseNum(item.volume, null) ?? (Number.isFinite(Number(lots)) ? Number(lots) * 1000 : null);
  const tradeTime = item.tradetime || normalizeTwseMisDateTime(raw.d, raw.t || raw["%"]);
  const navUrl = item.navUrl || raw.nu || "";
  const securityTypeCode = String(item.securityTypeCode || raw.it || "").trim();

  return {
    symbol,
    stock_id: symbol,
    name: rawName,
    market: item.exchange === "otc" || raw.ex === "otc" ? "TPEx" : "TWSE",
    price,
    displayPrice,
    displayPriceType: item.displayPriceType || item.priceType || (price !== null ? "last" : quoteMidPrice !== null ? "mid" : "none"),
    priceType: item.priceType || (price !== null ? "last" : quoteMidPrice !== null ? "mid" : "none"),
    quoteMidPrice,
    bid1: parseNum(item.bid1, null),
    ask1: parseNum(item.ask1, null),
    prevClose: parseNum(item.prevClose ?? raw.y, null),
    open: parseNum(item.open ?? raw.o, null),
    high: parseNum(item.high ?? raw.h, null),
    low: parseNum(item.low ?? raw.l, null),
    volume: volumeShares,
    twseMisLots: Number.isFinite(Number(lots)) ? Number(lots) : null,
    twseMisLastTradeVolume: parseNum(item.twseMisLastTradeVolume ?? raw.tv, null),
    tradetime: tradeTime,
    updatedAt: item.updatedAt || tradeTime || raw.d || "",
    tlongMs: parseNum(item.tlongMs ?? raw.tlong, null),
    quoteAgeSec: parseNum(item.quoteAgeSec, null),
    navUrl,
    isEtfCandidate: Boolean(item.isEtfCandidate || navUrl || securityTypeCode === "02"),
    securityTypeCode,
    sourceNote: "TWSE MIS",
  };
}

function mergeTwseMisBySymbol(currentStocks, incomingRows = []) {
  const map = new Map(currentStocks.map((stock) => [normalizeStockSymbol(stock.symbol), stock]));

  incomingRows.map(normalizeTwseMisItem).filter(Boolean).forEach((item) => {
    const symbol = normalizeStockSymbol(item.symbol);
    if (!symbol) return;

    const previous = map.get(symbol) || createAssetTemplate({
      symbol,
      name: item.name || symbol,
      type: item.isEtfCandidate ? "ETF" : "股票",
      market: item.market || "TWSE",
    });

    const next = { ...previous };
    if (item.name && shouldReplaceName(next.name, item.name, symbol)) {
      next.name = item.name;
      next.nameSource = "TWSE MIS";
    }

    if (item.isEtfCandidate && next.type !== "ETF") next.type = "ETF";
    next.market = next.market || item.market || "TWSE";

    const mainPrice = item.displayPrice ?? item.price ?? item.quoteMidPrice;
    if (mainPrice !== null && Number.isFinite(Number(mainPrice))) {
      next.price = Number(mainPrice);
      next.priceSource = item.displayPriceType === "mid" ? "TWSE MIS 五檔參考價" : "TWSE MIS";
      next.twseMisDisplayPrice = Number(mainPrice);
      next.twseMisDisplayPriceType = item.displayPriceType;
    }

    applyDefinedNumber(next, "prevClose", item.prevClose);
    applyDefinedNumber(next, "open", item.open);
    applyDefinedNumber(next, "high", item.high);
    applyDefinedNumber(next, "low", item.low);
    applyDefinedNumber(next, "volume", item.volume);
    if (item.volume !== null && item.volume !== undefined && Number.isFinite(Number(item.volume))) {
      // V71E：盤中量用 TWSE MIS 後，不保留 Google 舊 volumeRatio；
      // getDerived 會用 TWSE MIS volume / volume10ma 或 avgVolume20 重新計算。
      next.volumeRatio = null;
      next.volumeRatioSource = "TWSE MIS runtime ratio";
      next.volumeSource = "TWSE MIS";
    }
    applyDefinedNumber(next, "twseMisLots", item.twseMisLots);
    applyDefinedNumber(next, "twseMisLastTradeVolume", item.twseMisLastTradeVolume);
    applyDefinedNumber(next, "twseMisQuoteMidPrice", item.quoteMidPrice);
    applyDefinedNumber(next, "twseMisBid1", item.bid1);
    applyDefinedNumber(next, "twseMisAsk1", item.ask1);
    applyDefinedNumber(next, "twseMisTlongMs", item.tlongMs);
    applyDefinedNumber(next, "twseMisQuoteAgeSec", item.quoteAgeSec);

    if (item.tradetime) {
      next.tradetime = item.tradetime;
      next.updatedAt = item.updatedAt || item.tradetime;
      next.tradetimeSource = "TWSE MIS";
    }
    if (item.navUrl) next.etfNavUrl = item.navUrl;

    next.sourceNote = "TWSE MIS + GoogleFinance 輔助";
    next.intradaySource = "TWSE MIS";
    map.set(symbol, next);
  });

  return Array.from(map.values());
}

function buildTwseMisChannels(symbols = []) {
  const channels = [];
  symbols.map(normalizeStockSymbol).filter(Boolean).forEach((symbol) => {
    channels.push(`tse_${symbol}.tw`);
    channels.push(`otc_${symbol}.tw`);
  });
  return channels.join("|");
}

async function fetchTwseMisRows(symbols = [], timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, proxyUrl = DEFAULT_TWSE_MIS_PROXY_URL) {
  const normalizedSymbols = symbols.map(normalizeStockSymbol).filter(Boolean);
  if (!normalizedSymbols.length) return [];

  // TWSE MIS must be fetched through our Next.js API route.
  // Direct browser fetch often hits CORS / unstable proxy timeout, so keep this as a server-side proxy.
  const query = encodeURIComponent(normalizedSymbols.join(","));
  const baseUrl = proxyUrl || DEFAULT_TWSE_MIS_PROXY_URL;
  const sep = baseUrl.includes("?") ? "&" : "?";
  const url = `${baseUrl}${sep}symbols=${query}&_=${Date.now()}`;
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
    .filter((row) => row.price !== null || row.volume !== null || row.tradetime)
    .filter((row) => {
      const symbol = normalizeStockSymbol(row.symbol || row.stock_id || row.c);
      if (seen.has(symbol)) return false;
      seen.add(symbol);
      return true;
    });

  filteredRows.sourceRuntime = buildApiSourceRuntime({
    source: "twse_mis",
    json,
    dataTime: pickTwseMisDataTime(json, filteredRows),
    count: filteredRows.length,
    note: json?.marketIndex?.tradetime ? `大盤 ${compactSourceTime(json.marketIndex.tradetime)}` : "",
  });
  return filteredRows;
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

function applyDefinedNumber(target, key, value) {
  if (value !== null && value !== undefined && Number.isFinite(Number(value))) {
    target[key] = Number(value);
  }
}

function parseGoogleTradeTimeMs(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  const match = text.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\s*(上午|下午|AM|PM)?\s*(\d{1,2})[:：](\d{2})(?::(\d{2}))?/i);
  if (!match) {
    const direct = new Date(text);
    return Number.isNaN(direct.getTime()) ? null : direct.getTime();
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const meridiem = String(match[4] || "").toUpperCase();
  let hour = Number(match[5]);
  const minute = Number(match[6]);
  const second = Number(match[7] || 0);

  if ((meridiem === "下午" || meridiem === "PM") && hour < 12) hour += 12;
  if ((meridiem === "上午" || meridiem === "AM") && hour === 12) hour = 0;

  const date = new Date(year, month - 1, day, hour, minute, second);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function isOlderGoogleTradeTime(incomingTradeTime, currentTradeTime) {
  const incomingMs = parseGoogleTradeTimeMs(incomingTradeTime);
  const currentMs = parseGoogleTradeTimeMs(currentTradeTime);
  return Number.isFinite(incomingMs) && Number.isFinite(currentMs) && incomingMs < currentMs;
}

function mergeGoogleQuotesBySymbol(currentStocks, incomingGoogleRows) {
  const map = new Map(currentStocks.map((stock) => [normalizeStockSymbol(stock.symbol), stock]));

  incomingGoogleRows.forEach((item) => {
    const symbol = normalizeStockSymbol(item.symbol);
    if (!symbol) return;

    const payload = item.google || {};
    const google = payload.google || payload;
    const rawTicker = item.ticker || google.ticker || item.rawTicker || "";
    const market = String(rawTicker).toUpperCase().startsWith("TWO:") ? "TPEx" : "TWSE";
    const fallbackName = item.name || google.name || symbol;
    const previous = map.get(symbol) || createAssetTemplate({
      symbol,
      name: fallbackName,
      type: /^00/.test(symbol) ? "ETF" : "股票",
      market,
    });

    const next = { ...previous, name: previous.name || fallbackName, market: previous.market || market };
    if (fallbackName && shouldReplaceName(next.name, fallbackName, symbol)) {
      next.name = fallbackName;
      next.nameSource = "GoogleFinance";
    }
    const sourceName = "GoogleFinance";

    // Google CSV / GOOGLEFINANCE occasionally returns an older cached snapshot after a newer one.
    // Do not let an older tradetime roll back price, volume, volumeRatio, or the volume V1.1 time bucket.
    if (isOlderGoogleTradeTime(google.tradetime, previous.tradetime)) {
      return;
    }

    const allowGoogleMainQuote = shouldGoogleUpdateMainQuote(previous, google);
    const preserveTwseOfficialPrevClose = next.prevCloseSource === "TWSE";
    const preserveTwseOfficialValuation = (key) => next[`${key}Source`] === "TWSE";

    if (allowGoogleMainQuote) {
      applyDefinedNumber(next, "price", google.price);
      applyDefinedNumber(next, "volume", google.volume);
      applyDefinedNumber(next, "volumeRatio", google.volumeRatio);
      if (google.tradetime) next.tradetime = google.tradetime;
    }

    if (!preserveTwseOfficialPrevClose) {
      applyDefinedNumber(next, "prevClose", google.prevClose);
    }

    applyDefinedNumber(next, "volume10ma", google.volume10ma);

    if (!preserveTwseOfficialValuation("per")) {
      applyDefinedNumber(next, "per", google.per);
    }
    applyDefinedNumber(next, "eps", google.eps);
    applyDefinedNumber(next, "earningsYield", google.earningsYield);
    applyDefinedNumber(next, "yield", google.yield);
    applyDefinedNumber(next, "high52", google.high52);
    applyDefinedNumber(next, "low52", google.low52);
    applyDefinedNumber(next, "drawdown52", google.drawdown52);
    applyDefinedNumber(next, "pricePosition52", google.pricePosition52);
    applyDefinedNumber(next, "roc20", google.roc20);
    applyDefinedNumber(next, "marketcap", google.marketcap);
    applyDefinedNumber(next, "beta", google.beta);
    applyDefinedNumber(next, "datadelay", google.datadelay);
    if (google.tradetime && allowGoogleMainQuote) next.tradetime = google.tradetime;
    // Google 技術欄位只作比對來源，不覆蓋 FinMind 技術主資料。
    applyDefinedNumber(next, "googleMa5", google.ma5);
    applyDefinedNumber(next, "googleMa20", google.ma20);
    applyDefinedNumber(next, "googleRsi14", google.rsi14);
    if (google.ma5 !== null && google.ma5 !== undefined && !(next.ma5Source === "FinMind")) {
      applyDefinedNumber(next, "ma5", google.ma5);
      next.ma5Source = sourceName;
    }
    if (google.ma20 !== null && google.ma20 !== undefined && !(next.ma20Source === "FinMind")) {
      applyDefinedNumber(next, "ma20", google.ma20);
      next.ma20Source = sourceName;
    }
    if (google.rsi14 !== null && google.rsi14 !== undefined && !(next.rsi14Source === "FinMind")) {
      applyDefinedNumber(next, "rsi14", google.rsi14);
      next.rsi14Source = sourceName;
    }
    applyDefinedNumber(next, "foreign3d", google.foreign3d);
    applyDefinedNumber(next, "trust3d", google.trust3d);
    applyDefinedNumber(next, "dealer3d", google.dealer3d);
    applyDefinedNumber(next, "marginChange5dPct", google.marginChange5dPct);
    // /api/google/verify 已經把 Google Sheet 小數百分比統一轉成「百分點」。
    // 這裡不可再做二次百分比換算，否則 0.5708% 會被誤轉成 57.08%。
    const googleNasdaqReturn1d = sanitizePercentPointFromVerifiedSource(google.nasdaqReturn1d);
    const googleSoxReturn1d = sanitizePercentPointFromVerifiedSource(google.soxReturn1d);
    const googleTaifexAfterHoursReturn = sanitizePercentPointFromVerifiedSource(google.taifexAfterHoursReturn);
    const googleVixChange1d = sanitizePercentPointFromVerifiedSource(google.vixChange1d);

    applyDefinedNumber(next, "nasdaqReturn1d", googleNasdaqReturn1d);
    applyDefinedNumber(next, "soxReturn1d", googleSoxReturn1d);
    applyDefinedNumber(next, "taifexAfterHoursReturn", googleTaifexAfterHoursReturn);
    applyDefinedNumber(next, "vixChange1d", googleVixChange1d);

    if (allowGoogleMainQuote && google.price !== null && google.price !== undefined) next.priceSource = sourceName;
    if (!preserveTwseOfficialPrevClose && google.prevClose !== null && google.prevClose !== undefined) next.prevCloseSource = sourceName;
    if (allowGoogleMainQuote && google.volume !== null && google.volume !== undefined) next.volumeSource = sourceName;
    if (google.volume10ma !== null && google.volume10ma !== undefined) next.volume10maSource = sourceName;
    if (allowGoogleMainQuote && google.volumeRatio !== null && google.volumeRatio !== undefined) next.volumeRatioSource = sourceName;
    if (!preserveTwseOfficialValuation("per") && google.per !== null && google.per !== undefined) next.perSource = sourceName;
    if (google.eps !== null && google.eps !== undefined) next.epsSource = sourceName;
    if (google.earningsYield !== null && google.earningsYield !== undefined) next.earningsYieldSource = sourceName;
    if (google.yield !== null && google.yield !== undefined) next.yieldSource = sourceName;
    if (google.high52 !== null && google.high52 !== undefined) next.high52Source = sourceName;
    if (google.low52 !== null && google.low52 !== undefined) next.low52Source = sourceName;
    if (google.drawdown52 !== null && google.drawdown52 !== undefined) next.drawdown52Source = sourceName;
    if (google.pricePosition52 !== null && google.pricePosition52 !== undefined) next.pricePosition52Source = sourceName;
    if (google.roc20 !== null && google.roc20 !== undefined) next.roc20Source = sourceName;
    if (google.marketcap !== null && google.marketcap !== undefined) next.marketcapSource = sourceName;
    if (google.beta !== null && google.beta !== undefined) next.betaSource = sourceName;
    if (google.datadelay !== null && google.datadelay !== undefined) next.datadelaySource = sourceName;
    if (google.tradetime) next.tradetimeSource = sourceName;
    if (google.ma5 !== null && google.ma5 !== undefined) next.googleMa5Source = sourceName;
    if (google.ma20 !== null && google.ma20 !== undefined) next.googleMa20Source = sourceName;
    if (google.rsi14 !== null && google.rsi14 !== undefined) next.googleRsi14Source = sourceName;
    if (google.foreign3d !== null && google.foreign3d !== undefined) next.foreign3dSource = sourceName;
    if (google.trust3d !== null && google.trust3d !== undefined) next.trust3dSource = sourceName;
    if (google.dealer3d !== null && google.dealer3d !== undefined) next.dealer3dSource = sourceName;
    if (google.marginChange5dPct !== null && google.marginChange5dPct !== undefined) next.marginChange5dPctSource = sourceName;
    if (googleNasdaqReturn1d !== null && googleNasdaqReturn1d !== undefined) next.nasdaqReturn1dSource = sourceName;
    if (googleSoxReturn1d !== null && googleSoxReturn1d !== undefined) next.soxReturn1dSource = sourceName;
    if (googleTaifexAfterHoursReturn !== null && googleTaifexAfterHoursReturn !== undefined) next.taifexAfterHoursReturnSource = sourceName;
    if (googleVixChange1d !== null && googleVixChange1d !== undefined) next.vixChange1dSource = sourceName;

    if (google.updatedAt) next.googleUpdatedAt = google.updatedAt;
    if (google.sourceNote) next.sourceNote = google.sourceNote;
    else next.sourceNote = sourceName;
    next.priceSource = next.priceSource || sourceName;

    map.set(symbol, next);
  });

  return Array.from(map.values());
}


function normalizeSourceRowsForValidation(rows = [], sourceName = "source") {
  return rows.reduce((acc, row) => {
    const symbol = normalizeStockSymbol(row.symbol || row.stock_id || row.stockNo || row.Code || row["證券代號"]);
    if (!symbol) return acc;

    const payload = {
      ...row,
      symbol,
      stock_id: row.stock_id || row.symbol || symbol,
      price: row.price ?? row.close ?? row.ClosingPrice ?? row["收盤價"] ?? null,
      displayPrice: row.displayPrice ?? row.twseMisDisplayPrice ?? null,
      displayPriceType: row.displayPriceType ?? row.twseMisDisplayPriceType ?? null,
      quoteMidPrice: row.quoteMidPrice ?? row.twseMisQuoteMidPrice ?? null,
      quoteAgeSec: row.quoteAgeSec ?? row.twseMisQuoteAgeSec ?? null,
      navUrl: row.navUrl ?? row.etfNavUrl ?? "",
      dailyClose: row.dailyClose ?? row.close ?? null,
      dailyOpen: row.dailyOpen ?? row.open ?? null,
      dailyHigh: row.dailyHigh ?? row.high ?? row.max ?? null,
      dailyLow: row.dailyLow ?? row.low ?? row.min ?? null,
      dailyVolume: row.dailyVolume ?? row.volume ?? row.Trading_Volume ?? row.TradeVolume ?? row["成交股數"] ?? null,
      adjClose: row.adjClose ?? null,
      prevClose: row.prevClose ?? row.previous_close ?? row.prev_close ?? null,
      volume: row.volume ?? row.Trading_Volume ?? row.TradeVolume ?? row["成交股數"] ?? null,
      volume10ma: row.volume10ma ?? null,
      volumeRatio: row.volumeRatio ?? null,
      per: row.per ?? row.PER ?? row.PEratio ?? row["本益比"] ?? null,
      eps: row.eps ?? null,
      earningsYield: row.earningsYield ?? null,
      yield: row.yield ?? row.yieldpct ?? null,
      pbr: row.pbr ?? row.PBR ?? row.PBratio ?? row["股價淨值比"] ?? null,
      dividendYield: row.dividendYield ?? row.dividend_yield ?? row.DividendYield ?? row["殖利率"] ?? row["殖利率(%)"] ?? null,
      ma5: row.ma5 ?? null,
      ma20: row.ma20 ?? null,
      ma60: row.ma60 ?? null,
      rsi14: row.rsi14 ?? null,
      high20: row.high20 ?? null,
      low20: row.low20 ?? null,
      avgVolume20: row.avgVolume20 ?? null,
      return20d: row.return20d ?? null,
      return60d: row.return60d ?? null,
      macd: row.macd ?? null,
      macdSignal: row.macdSignal ?? null,
      macdHist: row.macdHist ?? null,
      macdHistPrev1: row.macdHistPrev1 ?? null,
      macdHistPrev3: row.macdHistPrev3 ?? null,
      macdHistDelta3: row.macdHistDelta3 ?? null,
      macdHistTrend3: row.macdHistTrend3 ?? "",
      macdState: row.macdState ?? "",
      macdWarmupReady: row.macdWarmupReady ?? false,
      k9: row.k9 ?? null,
      d9: row.d9 ?? null,
      j9: row.j9 ?? null,
      k9Prev1: row.k9Prev1 ?? null,
      d9Prev1: row.d9Prev1 ?? null,
      kdDiff: row.kdDiff ?? null,
      kdDiffPrev1: row.kdDiffPrev1 ?? null,
      kdDiffTrend3: row.kdDiffTrend3 ?? "",
      kdCross: row.kdCross ?? "",
      kdState: row.kdState ?? "",
      kdWarmupReady: row.kdWarmupReady ?? false,
      atr14: row.atr14 ?? null,
      atrPct: row.atrPct ?? null,
      atrPctAvg20: row.atrPctAvg20 ?? null,
      atrPctVsAvg20: row.atrPctVsAvg20 ?? null,
      volatilityState: row.volatilityState ?? "",
      atrWarmupReady: row.atrWarmupReady ?? false,
      priceRowCount: row.priceRowCount ?? null,
      technicalWarmupStatus: row.technicalWarmupStatus ?? null,
      grossProfit: row.grossProfit ?? null,
      operatingIncome: row.operatingIncome ?? null,
      financialRevenue: row.financialRevenue ?? null,
      incomeAfterTaxes: row.incomeAfterTaxes ?? null,
      incomeAfterTaxesTtm: row.incomeAfterTaxesTtm ?? null,
      epsTtm: row.epsTtm ?? null,
      epsTtmGrowthYoY: row.epsTtmGrowthYoY ?? null,
      grossMargin: row.grossMargin ?? null,
      grossMarginQoQ: row.grossMarginQoQ ?? null,
      operatingMargin: row.operatingMargin ?? null,
      operatingMarginQoQ: row.operatingMarginQoQ ?? null,
      netMargin: row.netMargin ?? null,
      netMarginQoQ: row.netMarginQoQ ?? null,
      totalAssets: row.totalAssets ?? null,
      totalLiabilities: row.totalLiabilities ?? null,
      equity: row.equity ?? null,
      roe: row.roe ?? null,
      roeTtm: row.roeTtm ?? null,
      debtRatio: row.debtRatio ?? null,
      financialQuarterCount: row.financialQuarterCount ?? null,
      high52: row.high52 ?? null,
      low52: row.low52 ?? null,
      drawdown52: row.drawdown52 ?? null,
      pricePosition52: row.pricePosition52 ?? null,
      roc20: row.roc20 ?? null,
      marketcap: row.marketcap ?? null,
      beta: row.beta ?? null,
      datadelay: row.datadelay ?? null,
      tradetime: row.tradetime ?? null,
      updatedAt: row.updatedAt ?? row.date ?? row.fetchedAt ?? null,
      etfMarketPrice: row.etfMarketPrice ?? row.marketPrice ?? null,
      etfChange: row.etfChange ?? row.change ?? null,
      etfChangePct: row.etfChangePct ?? row.changePct ?? null,
      etfRangeHigh: row.etfRangeHigh ?? row.rangeHigh ?? null,
      etfRangeLow: row.etfRangeLow ?? row.rangeLow ?? null,
      etfRangeSpread: row.etfRangeSpread ?? row.rangeSpread ?? null,
      etfPremiumDiscountPct: row.etfPremiumDiscountPct ?? row.premiumDiscountPct ?? null,
      etfSourcePage: row.etfSourcePage ?? row.sourcePage ?? "",
      etfFetchedAt: row.etfFetchedAt ?? row.fetchedAt ?? "",
      sourceNote: row.sourceNote || sourceName,
    };

    acc[symbol] = { ...(acc[symbol] || {}), [sourceName]: payload };
    return acc;
  }, {});
}

function extractStockSourceMap(rows = [], sourceName = "source") {
  return rows.reduce((acc, row) => {
    const symbol = normalizeStockSymbol(row.symbol || row.stock_id);
    if (!symbol) return acc;
    acc[symbol] = { ...(acc[symbol] || {}), [sourceName]: row };
    return acc;
  }, {});
}

function isBlankValue(value) {
  return value === null || value === undefined || value === "" || value === "-" || value === "--";
}

function mergeSourcePayloadPreserveGood(prevPayload = {}, nextPayload = {}) {
  const merged = { ...prevPayload };

  Object.entries(nextPayload || {}).forEach(([sourceName, sourceData]) => {
    if (!sourceData || typeof sourceData !== "object" || Array.isArray(sourceData)) {
      if (!isBlankValue(sourceData)) merged[sourceName] = sourceData;
      return;
    }

    const previousSource = merged[sourceName] && typeof merged[sourceName] === "object" ? merged[sourceName] : {};
    const mergedSource = { ...previousSource };

    Object.entries(sourceData).forEach(([field, value]) => {
      // Google Published CSV 會間歇性把公式欄吐成空值。
      // 不用空值覆蓋上一輪成功抓到的 ma5 / ma20 / volume10ma / high52 / roc20 等欄位。
      if (isBlankValue(value) && !isBlankValue(mergedSource[field])) return;
      mergedSource[field] = value;
    });

    merged[sourceName] = mergedSource;
  });

  return merged;
}

function mergeSourceMap(prevMap, sourceMap) {
  const next = { ...prevMap };
  Object.entries(sourceMap || {}).forEach(([symbol, sourcePayload]) => {
    next[symbol] = mergeSourcePayloadPreserveGood(next[symbol] || {}, sourcePayload || {});
  });
  return next;
}

function fillNamesFromValidationMap(currentStocks, validationMap) {
  if (!validationMap || !Object.keys(validationMap).length) return currentStocks;
  let changed = false;

  const nextStocks = currentStocks.map((stock) => {
    const symbol = normalizeStockSymbol(stock.symbol);
    const sourcePack = validationMap[symbol] || {};
    const twseName = sourcePack.twse?.name || sourcePack.twse?.stock_name || sourcePack.twse?.stockName || "";
    const finmindName = sourcePack.finmind?.name || sourcePack.finmind?.stock_name || sourcePack.finmind?.stockName || "";
    const officialName = twseName || finmindName;
    const source = twseName ? "TWSE" : finmindName ? "FinMind" : "";

    const preferred = preferOfficialName(stock.name, officialName, symbol);
    if (preferred.changed || (source === "TWSE" && hasCjkText(officialName) && stock.nameSource !== "TWSE")) {
      changed = true;
      return {
        ...stock,
        name: preferred.name,
        nameSource: source,
        nameDebug: {
          currentName: stock.name,
          officialName,
          resolvedName: preferred.name,
          source,
          twseName,
          finmindName,
        },
      };
    }

    return stock;
  });

  return changed ? nextStocks : currentStocks;
}

function mergeTwseOfficialBySymbol(currentStocks, incomingTwseRows) {
  const map = new Map(currentStocks.map((stock) => [normalizeStockSymbol(stock.symbol), stock]));

  incomingTwseRows.forEach((incoming) => {
    const symbol = normalizeStockSymbol(incoming.symbol || incoming.stock_id);
    if (!symbol) return;

    const incomingName = incoming.name || incoming.stock_name || incoming.stockName || symbol;
    const previous = map.get(symbol) || createAssetTemplate({
      symbol,
      name: incomingName,
      type: /^00/.test(symbol) ? "ETF" : "股票",
      market: incoming.market || "TWSE",
    });

    const next = { ...previous };
    const sourceName = "TWSE";

    // 自動補中文名稱：TWSE 有官方中文名時，一律用 TWSE 作顯示基準，避免 2330 已有中文名但沒有標示來源。
    const officialName = preferOfficialName(next.name, incomingName, symbol);
    if (officialName.changed || hasCjkText(incomingName)) {
      next.name = officialName.name;
      next.nameSource = "TWSE";
    }
    next.nameDebug = {
      currentName: previous.name,
      incomingName,
      resolvedName: next.name,
      incomingKeys: Object.keys(incoming || {}).slice(0, 20),
      source: sourceName,
    };
    if (incoming.market && !next.market) next.market = incoming.market;

    // V71F：TWSE OpenAPI 是「盤後官方校正」，盤中不得覆蓋已到位的即時主價量。
    // 注意 TWSE MIS 來源可能是 "TWSE MIS" 或 "TWSE MIS 五檔參考價"，
    // 不能只用等號判斷，否則會發生「盤中新值 → 盤後舊值 → 盤中新值」來回跳。
    const keepRealtimeQuote =
      isTwseMisIntradayQuoteReady(next) ||
      isGoogleIntradayQuoteReady(next);

    if (!keepRealtimeQuote) {
      applyDefinedNumber(next, "price", incoming.price);
      applyDefinedNumber(next, "volume", incoming.volume);
      if (incoming.price !== null && incoming.price !== undefined) next.priceSource = sourceName;
      if (incoming.volume !== null && incoming.volume !== undefined) next.volumeSource = sourceName;
    }

    applyDefinedNumber(next, "prevClose", incoming.prevClose);
    if (incoming.prevClose !== null && incoming.prevClose !== undefined) next.prevCloseSource = sourceName;

    if (incoming.price !== null && incoming.price !== undefined) {
      next.officialClose = incoming.price;
      next.officialCloseSource = sourceName;
    }
    if (incoming.volume !== null && incoming.volume !== undefined) {
      next.officialVolume = incoming.volume;
      next.officialVolumeSource = sourceName;
    }
    next.officialQuoteMergedButMainQuoteKept = Boolean(keepRealtimeQuote);

    // 官方估值欄位收斂到 TWSE；Google / FinMind 保留在 validationMap 做驗證值。
    applyDefinedNumber(next, "per", incoming.per);
    applyDefinedNumber(next, "pbr", incoming.pbr);
    applyDefinedNumber(next, "dividendYield", incoming.dividendYield);
    if (incoming.per !== null && incoming.per !== undefined) next.perSource = sourceName;
    if (incoming.pbr !== null && incoming.pbr !== undefined) next.pbrSource = sourceName;
    if (incoming.dividendYield !== null && incoming.dividendYield !== undefined) next.dividendYieldSource = sourceName;

    if (incoming.updatedAt) next.twseUpdatedAt = incoming.updatedAt;
    if (incoming.dataTime) next.twseDataTime = incoming.dataTime;
    next.officialSourceNote = incoming.sourceNote || sourceName;

    map.set(symbol, next);
  });

  return Array.from(map.values());
}

function mergeFinMindDailyBySymbol(currentStocks, incomingFinMindRows) {
  const map = new Map(currentStocks.map((stock) => [normalizeStockSymbol(stock.symbol), stock]));

  incomingFinMindRows.forEach((incoming) => {
    const symbol = normalizeStockSymbol(incoming.symbol || incoming.stock_id);
    if (!symbol) return;

    const incomingName = incoming.name || incoming.stock_name || incoming.stockName || symbol;
    const previous = map.get(symbol) || createAssetTemplate({
      symbol,
      name: incomingName,
      type: /^00/.test(symbol) ? "ETF" : "股票",
      market: incoming.market || "TWSE",
    });

    const next = { ...previous };
    const sourceName = "FinMind";

    if (shouldReplaceName(next.name, incomingName, symbol)) {
      next.name = incomingName;
      next.nameSource = "FinMind";
    }

    // FinMind 不覆蓋 GoogleFinance 的即時 price / prevClose / volume。
    // 但會補進技術、籌碼、融資、基本面與估值比對欄位。
    const fields = [
      "dailyClose",
      "dailyPrevClose",
      "dailyVolume",
      "high20",
      "low20",
      "avgVolume20",
      "ma5",
      "ma20",
      "ma60",
      "rsi14",
      "return20d",
      "return60d",
      "macd",
      "macdSignal",
      "macdHist",
      "macdHistPrev1",
      "macdHistPrev3",
      "macdHistDelta3",
      "k9",
      "d9",
      "j9",
      "k9Prev1",
      "d9Prev1",
      "kdDiff",
      "kdDiffPrev1",
      "atr14",
      "atrPct",
      "atrPctAvg20",
      "atrPctVsAvg20",
      "priceRowCount",
      "foreign3d",
      "trust3d",
      "dealer3d",
      "institutional3d",
      "foreign20d",
      "trust20d",
      "dealer20d",
      "institutional20d",
      "marginPurchaseBuy",
      "marginPurchaseSell",
      "marginPurchaseTodayBalance",
      "marginPurchaseYesterdayBalance",
      "marginChange5dPct",
      "marginChange20dPct",
      "shortSaleBuy",
      "shortSaleSell",
      "shortSaleTodayBalance",
      "shortSaleYesterdayBalance",
      "shortSaleChange5dPct",
      "shortSaleChange20dPct",
      "revenueLatest",
      "revenueMonth",
      "revenueYear",
      "revenueMoM",
      "revenueYoY",
      "eps",
      "epsGrowthYoY",
      "grossProfit",
      "operatingIncome",
      "financialRevenue",
      "incomeAfterTaxes",
      "incomeAfterTaxesTtm",
      "epsTtm",
      "epsTtmGrowthYoY",
      "grossMargin",
      "grossMarginQoQ",
      "operatingMargin",
      "operatingMarginQoQ",
      "netMargin",
      "netMarginQoQ",
      "totalAssets",
      "totalLiabilities",
      "equity",
      "roe",
      "roeTtm",
      "debtRatio",
      "financialQuarterCount",
    ];

    fields.forEach((key) => {
      applyDefinedNumber(next, key, incoming[key]);
      if (incoming[key] !== null && incoming[key] !== undefined) next[`${key}Source`] = sourceName;
    });

    // 估值主值優先 TWSE BWIBBU；FinMind PER 只在 TWSE 缺值時補位。
    ["per", "pbr", "dividendYield"].forEach((key) => {
      if (next[`${key}Source`] === "TWSE") return;
      applyDefinedNumber(next, key, incoming[key]);
      if (incoming[key] !== null && incoming[key] !== undefined) next[`${key}Source`] = sourceName;
    });

    if (incoming.dataTime) next.finmindDataTime = incoming.dataTime;
    if (incoming.profileDataTime) next.finmindProfileDataTime = incoming.profileDataTime;
    if (incoming.dataFreshness) next.finmindDataFreshness = incoming.dataFreshness;

    ["macdState", "macdHistTrend3", "kdState", "kdDiffTrend3", "kdCross", "volatilityState"].forEach((key) => {
      if (incoming[key] !== null && incoming[key] !== undefined && incoming[key] !== "") {
        next[key] = incoming[key];
        next[`${key}Source`] = sourceName;
      }
    });

    if (incoming.updatedAt) next.finmindUpdatedAt = incoming.updatedAt;
    if (incoming.datasetStatus) next.finmindDatasetStatus = incoming.datasetStatus;
    if (incoming.rawCounts) next.finmindRawCounts = incoming.rawCounts;
    if (incoming.technicalWarmupStatus) next.technicalWarmupStatus = incoming.technicalWarmupStatus;
    if (incoming.macdWarmupReady !== undefined) next.macdWarmupReady = incoming.macdWarmupReady;
    if (incoming.kdWarmupReady !== undefined) next.kdWarmupReady = incoming.kdWarmupReady;
    if (incoming.atrWarmupReady !== undefined) next.atrWarmupReady = incoming.atrWarmupReady;
    if (incoming.fieldErrors) next.finmindFieldErrors = incoming.fieldErrors;
    next.technicalSourceNote = incoming.sourceNote || sourceName;

    map.set(symbol, next);
  });

  return Array.from(map.values());
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

function formatLastFetch(lastFetchMap, source) {
  const time = lastFetchMap[source];
  if (!time) return "尚未抓取";
  return new Date(time).toLocaleTimeString("zh-TW", { hour12: false });
}

function compactSourceTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  // Route wrappers return ISO / UTC timestamps. Convert those to local time first.
  // Otherwise "2026-05-28T07:08:05Z" would be displayed as "07:08:05"
  // instead of Taiwan local time "15:08:05".
  const looksLikeIso = /^\d{4}-\d{2}-\d{2}T/.test(raw) || /Z$/.test(raw);
  if (looksLikeIso) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toLocaleTimeString("zh-TW", { hour12: false });
  }

  const m = raw.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
  if (m) return m[1];
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toLocaleTimeString("zh-TW", { hour12: false });
  return raw;
}

function formatCacheRuntime(cache) {
  if (!cache) return "";
  const hit = cache.hit ? "hit" : "miss";
  const age = Number.isFinite(Number(cache.ageSec)) ? `${cache.ageSec}s` : "-";
  const ttl = Number.isFinite(Number(cache.ttlSec)) ? `${cache.ttlSec}s` : "-";
  return `快取 ${hit}｜age ${age} / TTL ${ttl}`;
}


function compactDateForDisplay(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[2]}/${iso[3]}`;
  const ym = raw.match(/^(\d{4})-(\d{2})$/);
  if (ym) return `${ym[1]}/${ym[2]}`;
  return raw;
}

function formatRouteDataTimeSummary(json = {}, source = "") {
  const profile = json?.profileDataSummary;
  if (profile) {
    const scoreParts = [
      profile.latestPriceDate ? `日K ${compactDateForDisplay(profile.latestPriceDate)}` : "",
      profile.latestInstitutionalDate ? `法人 ${compactDateForDisplay(profile.latestInstitutionalDate)}` : "",
      profile.latestMarginDate ? `融資券 ${compactDateForDisplay(profile.latestMarginDate)}` : "",
    ].filter(Boolean);
    const fundamentalParts = [
      profile.latestRevenueMonth ? `月營收 ${compactDateForDisplay(profile.latestRevenueMonth)}` : "",
      profile.latestFinancialQuarter ? `財報 ${profile.latestFinancialQuarter}` : "",
      profile.latestBalanceQuarter ? `資產負債 ${profile.latestBalanceQuarter}` : "",
    ].filter(Boolean);
    const left = scoreParts.length ? `短線 ${scoreParts.join(" / ")}` : "";
    const right = fundamentalParts.length ? `中長線 ${fundamentalParts.join(" / ")}` : "";
    return [left, right].filter(Boolean).join("｜");
  }

  const summary = json?.dataTimeSummary;
  if (!summary) return "";

  if (source === "twse_proxy") {
    return [
      summary.stockDayDateIso ? `STOCK_DAY ${compactDateForDisplay(summary.stockDayDateIso)}` : "",
      summary.bwibbuDateIso ? `BWIBBU ${compactDateForDisplay(summary.bwibbuDateIso)}` : "",
    ].filter(Boolean).join("｜");
  }

  if (source === "official_etf_inav") {
    return [
      summary.latestDataTime ? `估值 ${compactSourceTime(summary.latestDataTime)}` : "",
      summary.latestNavDate ? `淨值日 ${compactDateForDisplay(summary.latestNavDate)}` : "",
    ].filter(Boolean).join("｜");
  }

  if (source === "yahoo_ohlcv") {
    return summary.latestOhlcvDate ? `OHLCV ${compactDateForDisplay(summary.latestOhlcvDate)}` : "";
  }

  if (source === "yahoo_etf") {
    return summary.confidence === "low" ? "資料時間未可靠揭露" : (summary.latestQuoteDate || "");
  }

  if (source === "finmind_market") {
    return [
      summary.latestUsMarketDate ? `美股 ${compactDateForDisplay(summary.latestUsMarketDate)}` : "",
      summary.latestFxDate ? `匯率 ${compactDateForDisplay(summary.latestFxDate)}` : "",
      summary.latestBondDate ? `債券 ${compactDateForDisplay(summary.latestBondDate)}` : "",
      summary.fedRateDate ? `利率 ${compactDateForDisplay(summary.fedRateDate)}` : "",
    ].filter(Boolean).join("｜");
  }

  if (source === "finmind_derivatives") {
    return [
      summary.futuresDate ? `期貨 ${compactDateForDisplay(summary.futuresDate)}` : "",
      summary.futuresInstitutionalDate ? `期貨法人 ${compactDateForDisplay(summary.futuresInstitutionalDate)}` : "",
      summary.optionDate ? `選擇權 ${compactDateForDisplay(summary.optionDate)}` : "",
      summary.optionInstitutionalDate ? `選擇權法人 ${compactDateForDisplay(summary.optionInstitutionalDate)}` : "",
    ].filter(Boolean).join("｜");
  }

  return "";
}

function appendRouteQuery(url, params = {}) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && String(value) !== "");
  if (!entries.length) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join("&")}`;
}

function buildApiSourceRuntime({ source, json = {}, dataTime = "", count = null, pass = null, note = "" }) {
  const cacheText = formatCacheRuntime(json?.cache);
  const routeDataTimeText = formatRouteDataTimeSummary(json, source);
  const sourceDataTime = dataTime || routeDataTimeText || json?.fetchedAt || json?.finishedAt || json?.wrapperFinishedAt || "";
  const displayDataTimeText = routeDataTimeText || (sourceDataTime ? compactSourceTime(sourceDataTime) : "");
  const hasPass = pass !== null && pass !== undefined && pass !== "";
  const hasCount = count !== null && count !== undefined && count !== "";
  const countText =
    hasPass && hasCount && Number.isFinite(Number(pass)) && Number.isFinite(Number(count))
      ? `${pass}/${count} 檔`
      : hasCount && Number.isFinite(Number(count))
        ? `${count} 檔`
        : "";

  return {
    source,
    dataTime: sourceDataTime,
    dataTimeText: displayDataTimeText,
    routeDataTimeText,
    dataTimeSummary: json?.profileDataSummary || json?.dataTimeSummary || null,
    count,
    pass,
    note,
    cache: json?.cache || null,
    cacheText,
    cachePolicy: json?.cachePolicy || null,
    fetchedAt: json?.fetchedAt || json?.finishedAt || json?.wrapperFinishedAt || "",
    updatedAt: Date.now(),
    summaryText: [displayDataTimeText ? `資料時間 ${displayDataTimeText}` : "", cacheText, countText, note]
      .filter(Boolean)
      .join("｜"),
  };
}

function formatSourceRuntimeInfo(runtime, fallbackText = "尚未抓取") {
  if (!runtime) return fallbackText;
  if (runtime.summaryText) return runtime.summaryText;
  const parts = [];
  if (runtime.dataTimeText) parts.push(`資料 ${runtime.dataTimeText}`);
  if (runtime.cacheText) parts.push(runtime.cacheText);
  if (Number.isFinite(Number(runtime.count))) parts.push(`${runtime.count} 檔`);
  return parts.length ? parts.join("｜") : fallbackText;
}

function formatPolicyAutoRefresh(item) {
  if (item?.source === "official_etf_inav") return "隨 TWSE MIS 同步";
  if (item?.source === "twse_proxy" || item?.source === "yahoo_ohlcv" || item?.source === "yahoo_etf") return "啟動預熱 / 固定時段 cache";
  if (item?.source === "finmind_proxy" || item?.source === "finmind_market" || item?.source === "finmind_derivatives") return "啟動預熱 / 主更新 / 手動";
  const ms = Number(item?.autoRefreshMs || 0);
  if (!ms) return "未設定";
  return `每 ${formatDurationMs(ms)}`;
}

function formatPolicyMaxSymbols(item) {
  if (!item?.maxSymbols) return "";
  return `保護上限：最多 ${item.maxSymbols} 檔`;
}

function explainCacheRuntime(runtime) {
  if (!runtime?.cache) return "";
  return runtime.cache.hit ? "使用快取，未重抓外部" : "本次重抓外部並更新快取";
}

function pickTwseMisDataTime(json, rows = []) {
  return (
    json?.marketIndex?.tradetime ||
    rows.find((row) => row?.tradetime)?.tradetime ||
    json?.fetchedAt ||
    ""
  );
}

function pickEtfInavDataTime(json, list = []) {
  return (
    list.find((row) => row?.dataTime)?.dataTime ||
    list.find((row) => row?.navDate)?.navDate ||
    json?.finishedAt ||
    json?.wrapperFinishedAt ||
    ""
  );
}

function getFieldSource(stock, key, fallback = "尚未標記來源") {
  return stock?.[`${key}Source`] || stock?.sourceNote || fallback;
}

function getSourceValue(validationMap, symbol, source, key) {
  const payload = validationMap?.[symbol]?.[source];
  if (!payload) return null;
  return payload[key] ?? payload.google?.[key] ?? null;
}

function getSourceName(source) {
  if (source === "google") return "GoogleFinance";
  if (source === "twse") return "TWSE";
  if (source === "twse_mis") return "TWSE MIS";
  if (source === "finmind") return "FinMind";
  if (source === "yahoo") return "Yahoo OHLCV";
  if (source === "official_etf_inav") return "ETF 即時估值";
  if (source === "yahoo_etf") return "ETF 備援";
  if (source === "eps_note") return "FinMind 財報 EPS（口徑不同）";
  if (source === "none") return "不比對";
  return "尚無比對來源";
}

function compareSourceValue(label, currentValue, compareValue, tolerancePct, note = "", currentSource = "目前資料", compareSource = "比對來源", options = {}) {
  const f = Number(currentValue);
  const g = Number(compareValue);
  const hasCurrent = currentValue !== null && currentValue !== undefined && Number.isFinite(f);
  const hasCompare = compareValue !== null && compareValue !== undefined && Number.isFinite(g);
  let diffPct = 0;
  let status = options.noCompare ? "不比對" : "缺值";

  if (options.statusOverride) {
    status = hasCurrent ? options.statusOverride : "缺值";
  } else if (!options.noCompare && hasCurrent && hasCompare) {
    if (options.compareMode === "abs") {
      diffPct = Number((g - f).toFixed(4));
      status = Math.abs(diffPct) <= tolerancePct ? "通過" : "需檢查";
    } else if (f === 0 && g === 0) {
      status = "通過";
      diffPct = 0;
    } else if (f === 0 && g !== 0) {
      status = "需檢查";
      diffPct = 0;
    } else {
      diffPct = ((g - f) / f) * 100;
      status = Math.abs(diffPct) <= tolerancePct ? "通過" : "需檢查";
    }
  } else if (!options.noCompare && hasCurrent && !hasCompare) {
    status = "缺值";
  }

  return {
    label,
    finmindValue: currentValue,
    googleValue: compareValue,
    diffPct,
    tolerancePct,
    status,
    note,
    currentSource,
    compareSource,
    compareMode: options.compareMode || "relative",
    toleranceLabel: options.toleranceLabel || null,
  };
}

function pickCompare(validationMap, symbol, source, key) {
  return {
    value: getSourceValue(validationMap, symbol, source, key),
    source: getSourceName(source),
  };
}

function getYahooCandidateRows(validationMap, symbol) {
  const payload = validationMap?.[symbol]?.yahoo;
  if (!payload) return [];

  const candidates = [];
  if (Array.isArray(payload.technicalRows)) candidates.push(...payload.technicalRows);
  if (Array.isArray(payload.rows)) candidates.push(...payload.rows);

  const seen = new Set();
  return candidates
    .filter((row) => row && normalizeValidationDate(row?.date || row?.updatedAt))
    .filter((row) => {
      const date = normalizeValidationDate(row?.date || row?.updatedAt);
      const key = `${date}-${row.macd ?? ""}-${row.dailyClose ?? row.close ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => normalizeValidationDate(b?.date || b?.updatedAt).localeCompare(normalizeValidationDate(a?.date || a?.updatedAt)));
}

function getYahooCompareRow(validationMap, symbol, targetDateRaw) {
  const targetDate = normalizeValidationDate(targetDateRaw);
  const candidates = getYahooCandidateRows(validationMap, symbol);
  if (!candidates.length) return { row: null, exact: false, targetDate, yahooDate: "" };

  const exactRow = targetDate
    ? candidates.find((row) => normalizeValidationDate(row?.date || row?.updatedAt) === targetDate)
    : null;

  const row = exactRow || candidates[0];
  return {
    row,
    exact: !!exactRow,
    targetDate,
    yahooDate: normalizeValidationDate(row?.date || row?.updatedAt),
  };
}

function pickYahooAlignedCompare(validationMap, symbol, targetDateRaw, key) {
  const { row, exact, yahooDate } = getYahooCompareRow(validationMap, symbol, targetDateRaw);
  if (!row) return { value: null, source: "Yahoo OHLCV", date: "", matched: false };
  return {
    value: row[key] ?? row?.[key.replace(/^daily/, "").toLowerCase()] ?? null,
    source: `Yahoo OHLCV ${yahooDate}`,
    date: row.date || row.updatedAt || yahooDate,
    matched: exact,
  };
}

function yahooAlignedCompareOptions(finDateRaw, yahooLatestDateRaw, yahooMatchedDateRaw) {
  const finDate = normalizeValidationDate(finDateRaw);
  const yahooLatestDate = normalizeValidationDate(yahooLatestDateRaw);
  const yahooShownDate = normalizeValidationDate(yahooMatchedDateRaw) || yahooLatestDate;

  if (finDate && yahooShownDate && finDate === yahooShownDate) {
    return { noCompare: false, dateNote: `已對齊共同交易日 ${finDate}。` };
  }

  if (finDate && yahooShownDate && finDate !== yahooShownDate) {
    return {
      noCompare: true,
      dateNote: `日期不同：FinMind ${finDate} / Yahoo ${yahooShownDate}，只顯示外部值，不判通過或失敗。`,
    };
  }

  if (!finDate && yahooShownDate) {
    return {
      noCompare: true,
      dateNote: `FinMind 日期缺值；Yahoo 已取得 ${yahooShownDate}，只顯示外部值，不判通過或失敗。`,
    };
  }

  return { noCompare: true, dateNote: "Yahoo 未取得可對齊的共同交易日，不判通過或失敗。" };
}

function normalizePercentCompareValue(value, field = "general") {
  // 比對層吃的是主資料已標準化後的「百分點」。
  // 不再把 < 1 的值自動 *100，避免 Google 0.5708% 被二次轉成 57.08%。
  if (field === "vix") return sanitizeVixPercentPointFromVerifiedSource(value);
  return sanitizePercentPointFromVerifiedSource(value);
}

function sanitizePercentPointFromVerifiedSource(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  // 防呆：真的出現 57.08 / -90.42 這種不合理單日指數變化，多半是前一版二次轉換留下的 localStorage。
  // 還原成 0.5708 / -0.9042。
  if (Math.abs(n) > 20) return Number((n / 100).toFixed(4));

  return n;
}

function sanitizeVixPercentPointFromVerifiedSource(value) {
  const n = sanitizePercentPointFromVerifiedSource(value);
  if (n === null || n === undefined) return null;

  // VIX 欄位在 Google Sheet 百分比格式下，偶爾會出現 6.382 代表 0.6382% 的小數點位移。
  // Nasdaq / SOX 不套用此規則，僅針對 VIX 進行保守防呆。
  if (Math.abs(n) >= 5 && Math.abs(n) <= 20) return Number((n / 10).toFixed(4));

  return n;
}

function reconcileVixPercentPointWithReference(value, referenceValue) {
  const current = sanitizeVixPercentPointFromVerifiedSource(value);
  const reference = sanitizePercentPointFromVerifiedSource(referenceValue);

  if (current === null || current === undefined) return current;
  if (reference === null || reference === undefined || !Number.isFinite(Number(reference))) return current;

  // 若 Google VIX 與 FinMind VIX 呈現穩定 10 倍偏移，視為小數點口徑問題，校正後再進驗證與風險分數。
  const candidates = [current, Number((current / 10).toFixed(4)), Number((current * 10).toFixed(4))]
    .filter((x, index, arr) => Number.isFinite(Number(x)) && arr.indexOf(x) === index);
  const best = candidates.reduce((bestValue, candidate) => {
    const bestDiff = Math.abs(Number(bestValue) - Number(reference));
    const candidateDiff = Math.abs(Number(candidate) - Number(reference));
    return candidateDiff < bestDiff ? candidate : bestValue;
  }, current);

  return best;
}

function normalizeValidationDate(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const iso = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const slash = raw.match(/(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/);
  if (slash) return `${slash[1]}-${String(slash[2]).padStart(2, "0")}-${String(slash[3]).padStart(2, "0")}`;
  return raw.slice(0, 10);
}

function sourceDateCompareOptions(primaryDateRaw, compareDateRaw, primaryName = "FinMind", compareName = "TWSE") {
  const primaryDate = normalizeValidationDate(primaryDateRaw);
  const compareDate = normalizeValidationDate(compareDateRaw);
  if (primaryDate && compareDate && primaryDate !== compareDate) {
    return {
      noCompare: true,
      dateNote: `日期不同：${primaryName} ${primaryDate} / ${compareName} ${compareDate}，不判通過或失敗。`,
    };
  }
  return { noCompare: false, dateNote: "" };
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

  const twsePrevClose = pickCompare(validationMap, symbol, "twse", "prevClose");
  const twseClose = pickCompare(validationMap, symbol, "twse", "price");
  const twseVolume = pickCompare(validationMap, symbol, "twse", "volume");
  const twsePer = pickCompare(validationMap, symbol, "twse", "per");
  const twsePbr = pickCompare(validationMap, symbol, "twse", "pbr");
  const twseDividendYield = pickCompare(validationMap, symbol, "twse", "dividendYield");
  const twseUpdatedAt = pickCompare(validationMap, symbol, "twse", "updatedAt");
  const twseDataTime = getSourceValue(validationMap, symbol, "twse", "dataTime") || {};
  const twseOfficialDate = twseDataTime.stockDayDateIso || twseDataTime.bwibbuDateIso || twseUpdatedAt.value || main.twseUpdatedAt || "";
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
  const googlePer = pickCompare(validationMap, symbol, "google", "per");
  const googleEps = pickCompare(validationMap, symbol, "google", "eps");

  const finDailyClose = pickCompare(validationMap, symbol, "finmind", "dailyClose");
  const finDailyOpen = pickCompare(validationMap, symbol, "finmind", "dailyOpen");
  const finDailyHigh = pickCompare(validationMap, symbol, "finmind", "dailyHigh");
  const finDailyLow = pickCompare(validationMap, symbol, "finmind", "dailyLow");
  const finDailyVolume = pickCompare(validationMap, symbol, "finmind", "dailyVolume");
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
  const googleVixPctRaw = normalizePercentCompareValue(googleVix.value, "vix");
  const googleTaifexPct = normalizePercentCompareValue(googleTaifex.value);
  const mainNasdaqPct = normalizePercentCompareValue(main.nasdaqReturn1d);
  const mainSoxPct = normalizePercentCompareValue(main.soxReturn1d);
  const mainTaifexPct = normalizePercentCompareValue(main.taifexAfterHoursReturn);
  const mainVixPctRaw = normalizePercentCompareValue(main.vixChange1d, "vix");
  const latestGoogleVixPctRaw = googleVixPctRaw !== null ? googleVixPctRaw : mainVixPctRaw;
  const finmindNasdaqPct = normalizePercentCompareValue(main.finmindNasdaqReturn1d);
  const finmindSoxPct = normalizePercentCompareValue(main.finmindSoxReturn1d);
  const finmindVixPct = normalizePercentCompareValue(main.finmindVixChange1d, "vix");
  const latestGoogleVixPct = reconcileVixPercentPointWithReference(latestGoogleVixPctRaw, finmindVixPct);

  const finPer = pickCompare(validationMap, symbol, "finmind", "per");
  const finPbr = pickCompare(validationMap, symbol, "finmind", "pbr");
  const finDividendYield = pickCompare(validationMap, symbol, "finmind", "dividendYield");

  const googlePerValue = positiveOrNull(googlePer.value);
  const twsePerValue = positiveOrNull(twsePer.value);
  const finPerValue = positiveOrNull(finPer.value);
  const twsePbrValue = positiveOrNull(twsePbr.value);
  const finPbrValue = positiveOrNull(finPbr.value);
  const twseDividendYieldValue = isEtf ? positiveOrNull(twseDividendYield.value) : finiteOrNull(twseDividendYield.value);
  const finDividendYieldValue = isEtf ? positiveOrNull(finDividendYield.value) : finiteOrNull(finDividendYield.value);
  const showValuationRows = !isEtf || shouldShowEtfOptional(googlePer.value, twsePer.value, finPer.value, twsePbr.value, finPbr.value, twseDividendYield.value, finDividendYield.value);

  const finMa60 = pickCompare(validationMap, symbol, "finmind", "ma60");
  const finRsi14 = pickCompare(validationMap, symbol, "finmind", "rsi14");
  const finHigh20 = pickCompare(validationMap, symbol, "finmind", "high20");
  const finLow20 = pickCompare(validationMap, symbol, "finmind", "low20");
  const finAvgVolume20 = pickCompare(validationMap, symbol, "finmind", "avgVolume20");
  const finReturn20d = pickCompare(validationMap, symbol, "finmind", "return20d");
  const finReturn60d = pickCompare(validationMap, symbol, "finmind", "return60d");
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

  const rows = [
    compareSourceValue("現價 price", twseMisMainPriceValue, googlePrice.value, 0.5, `盤中主來源改用 TWSE MIS；GoogleFinance 保留輔助比對。${twseMisDisplayPriceType.value === "mid" ? "目前 MIS 使用五檔中間價作參考價，非正式成交價。" : ""}`, twseMisMainPriceValue !== null ? `${twseMisMainPriceSource}${twseMisTimeLabel}` : getFieldSource(main, "price"), googlePrice.value !== null ? googlePrice.source : noCompare, googlePrice.value !== null && twseMisMainPriceValue !== null ? {} : { statusOverride: twseMisMainPriceValue !== null ? "已補值" : undefined }),
    compareSourceValue("昨收 prevClose", twsePrevClose.value, googlePrevClose.value, 0.2, "昨收主值收斂到 TWSE 官方；GoogleFinance 保留為驗證值。若差異出現，優先檢查 Google CSV 是否仍為舊快照或昨收口徑未更新。", twsePrevClose.value !== null ? `${twsePrevClose.source}${twseOfficialDate ? `（${normalizeValidationDate(twseOfficialDate)}）` : ""}` : noCompare, googlePrevClose.value !== null ? googlePrevClose.source : noCompare),
    compareSourceValue("成交量 volume", twseMisVolume.value, googleVolume.value, 5, `盤中成交量主來源改用 TWSE MIS；GoogleFinance 保留輔助比對。${twseMisTradetime.value ? `MIS 時間 ${twseMisTradetime.value}` : ""}`, twseMisVolume.value !== null ? `${twseMisVolume.source}${twseMisTimeLabel}` : getFieldSource(main, "volume"), googleVolume.value !== null ? googleVolume.source : noCompare, googleVolume.value !== null && twseMisVolume.value !== null ? { statusOverride: "參考差異", toleranceLabel: "參考" } : { statusOverride: twseMisVolume.value !== null ? "已補值" : undefined }),
    compareSourceValue("TWSE MIS 盤中價量", twseMisVolume.value, null, 0, `TWSE MIS 已作為盤中價量主來源候選；僅改價量來源，不改短線分數公式。${twseMisMainPriceValue !== null ? ` MIS 價 ${twseMisMainPriceValue}` : ""}${twseMisTradetime.value ? `，MIS 時間 ${twseMisTradetime.value}` : ""}`, twseMisVolume.value !== null ? `${twseMisVolume.source}${twseMisTimeLabel}` : noCompare, getSourceName("none"), { statusOverride: "已補值" }),
    compareSourceValue("官方收盤 close", twseClose.value, finDailyClose.value, 0.2, dailyCloseCheck.dateNote || "盤後收盤主值收斂到 TWSE OpenAPI；FinMind 日 K 保留為技術序列與驗證值。日期一致才判通過/失敗，不覆蓋盤中 TWSE MIS 主行情。", twseClose.value !== null ? `${twseClose.source}${twseOfficialDate ? `（${normalizeValidationDate(twseOfficialDate)}）` : ""}` : noCompare, finDailyClose.value !== null ? `${finDailyClose.source}${finUpdatedAt.value ? `（${normalizeValidationDate(finUpdatedAt.value)}）` : ""}` : getFieldSource(main, "dailyClose"), dailyCloseCheck.noCompare ? { noCompare: true } : {}),
    compareSourceValue("官方成交量 volume", twseVolume.value, finDailyVolume.value, 1, dailyVolumeCheck.dateNote || "盤後成交量主值收斂到 TWSE OpenAPI；FinMind 日量保留為技術序列與驗證值。日期一致才判通過/失敗，不與 Google 盤中量硬比。", twseVolume.value !== null ? `${twseVolume.source}${twseOfficialDate ? `（${normalizeValidationDate(twseOfficialDate)}）` : ""}` : noCompare, finDailyVolume.value !== null ? `${finDailyVolume.source}${finUpdatedAt.value ? `（${normalizeValidationDate(finUpdatedAt.value)}）` : ""}` : getFieldSource(main, "dailyVolume"), dailyVolumeCheck.noCompare ? { noCompare: true } : {}),
    compareSourceValue("10日均量 volume10ma", main.volume10ma, null, 3, "由 GoogleFinance 輕量欄位產生，作為盤中量能基準；不硬比 TWSE / FinMind 盤後量。", getFieldSource(main, "volume10ma"), "接入確認", { statusOverride: "接入確認" }),
    compareSourceValue("量能爆發比 volumeRatio", main.volumeRatio, null, 0.5, "GoogleFinance 原始盤中量能比僅作接入確認；短線主表會依 tradetime 進行 V1.1 時間係數校正，不與 TWSE 盤後量硬比。", getFieldSource(main, "volumeRatio"), "接入確認", { statusOverride: "接入確認" }),

    showValuationRows ? compareSourceValue("本益比 PER", twsePerValue, googlePerValue !== null ? googlePerValue : finPerValue, 10, "PER 主值收斂到 TWSE 官方 BWIBBU；GoogleFinance / FinMind PER 僅作驗證或 fallback 參考。ETF 若無有效估值資料不列為已補值。", twsePerValue !== null ? `${twsePer.source}${twseOfficialDate ? `（${normalizeValidationDate(twseOfficialDate)}）` : ""}` : noCompare, googlePerValue !== null ? googlePer.source : finPerValue !== null ? finPer.source : noCompare, twsePerValue !== null && (googlePerValue !== null || finPerValue !== null) ? {} : { statusOverride: twsePerValue !== null ? "已補值" : undefined }) : null,
    showValuationRows ? compareSourceValue("PBR", twsePbrValue, finPbrValue, 5, "PBR 主值收斂到 TWSE 官方 BWIBBU；FinMind 僅作驗證或 fallback 參考。ETF 若來源值為 0 或空值視為缺值，不列為已補值。", twsePbrValue !== null ? `${twsePbr.source}${twseOfficialDate ? `（${normalizeValidationDate(twseOfficialDate)}）` : ""}` : noCompare, finPbrValue !== null ? finPbr.source : noCompare, twsePbrValue !== null && finPbrValue !== null ? {} : { statusOverride: twsePbrValue !== null ? "已補值" : undefined }) : null,
    showValuationRows ? compareSourceValue("殖利率 dividendYield", twseDividendYieldValue, finDividendYieldValue, 5, "殖利率主值收斂到 TWSE 官方 BWIBBU；FinMind 僅作驗證或 fallback 參考。ETF 若來源值為 0 或空值視為缺值，不列為已補值。", twseDividendYieldValue !== null ? `${twseDividendYield.source}${twseOfficialDate ? `（${normalizeValidationDate(twseOfficialDate)}）` : ""}` : noCompare, finDividendYieldValue !== null ? finDividendYield.source : noCompare, twseDividendYieldValue !== null && finDividendYieldValue !== null ? {} : { statusOverride: twseDividendYieldValue !== null ? "已補值" : undefined }) : null,

    compareSourceValue("EPS", googleEps.value, finEps.value, 999, "GoogleFinance EPS 與 FinMind 財報 EPS 口徑可能不同：Google 常見為行情估值口徑，FinMind 為財報期 EPS；只列出，不用通過/失敗判斷。", googleEps.value !== null ? googleEps.source : getFieldSource(main, "eps"), finEps.value !== null ? finEps.source : getSourceName("eps_note"), { noCompare: true }),

    compareSourceValue("5MA", main.ma5, googleMa5Value, 1.5, "主值採 FinMind 日 K；GoogleFinance 作參考。差異超過容忍值時優先檢查 Google 歷史區間、是否含盤中價、交易日筆數與排序；驗證層不覆蓋主值。", getFieldSource(main, "ma5"), googleMa5Source),
    compareSourceValue("20MA", main.ma20, googleMa20Value, 1.5, "主值採 FinMind 日 K；GoogleFinance 作參考。差異超過容忍值時優先檢查 Google 歷史區間、是否含盤中價、交易日筆數與排序；驗證層不覆蓋主值。", getFieldSource(main, "ma20"), googleMa20Source),
    compareSourceValue("60MA", main.ma60, finMa60.value, 1, "FinMind 技術補資料欄位；GoogleFinance CSV 目前未提供 60MA，因此只確認 FinMind 已補入。", getFieldSource(main, "ma60"), finMa60.value !== null ? finMa60.source : noCompare, { statusOverride: "已補值" }),
    compareSourceValue("RSI14", main.rsi14, finRsi14.value, 1, "FinMind 技術補資料欄位；GoogleFinance CSV 目前未提供 RSI14，因此只確認 FinMind 已補入。", getFieldSource(main, "rsi14"), finRsi14.value !== null ? finRsi14.source : noCompare, { statusOverride: "已補值" }),
    compareSourceValue("20日高點 high20", main.high20, finHigh20.value, 1, "FinMind 技術補資料欄位；用於停損與區間位置。", getFieldSource(main, "high20"), finHigh20.value !== null ? finHigh20.source : noCompare, { statusOverride: "已補值" }),
    compareSourceValue("20日低點 low20", main.low20, finLow20.value, 1, "FinMind 技術補資料欄位；用於停損與區間位置。", getFieldSource(main, "low20"), finLow20.value !== null ? finLow20.source : noCompare, { statusOverride: "已補值" }),
    compareSourceValue("20日均量 avgVolume20", main.avgVolume20, finAvgVolume20.value, 3, "FinMind 技術補資料欄位；用於量能比。", getFieldSource(main, "avgVolume20"), finAvgVolume20.value !== null ? finAvgVolume20.source : noCompare, { statusOverride: "已補值" }),
    compareSourceValue("20日報酬 return20d", main.return20d, finReturn20d.value, 3, "FinMind 技術補資料欄位。", getFieldSource(main, "return20d"), finReturn20d.value !== null ? finReturn20d.source : noCompare, { statusOverride: "已補值" }),
    compareSourceValue("60日報酬 return60d", main.return60d, finReturn60d.value, 3, "FinMind 技術補資料欄位。", getFieldSource(main, "return60d"), finReturn60d.value !== null ? finReturn60d.source : noCompare, { statusOverride: "已補值" }),
    compareSourceValue("技術預熱 priceRowCount", main.priceRowCount, null, 0, "確認 MACD / KD / ATR warm-up 是否達有效評分門檻；目前採 300 日曆天，MACD / ATR 至少 100 筆、KD 至少 40 筆交易日。", getFieldSource(main, "priceRowCount"), "接入確認", { statusOverride: "接入確認", toleranceLabel: "需達門檻" }),
    (yahooDailyClose.value !== null ? compareSourceValue("收盤價抽樣", finDailyClose.value, yahooDailyClose.value, 0.1, yahooCompareOptions.dateNote || "外部 OHLCV 僅作抽樣驗證；不覆蓋 FinMind、不參與分數。", finDailyClose.value !== null ? "FinMind OHLCV" : getFieldSource(main, "dailyClose"), yahooDailyClose.value !== null ? yahooDailyClose.source : noCompare, { ...yahooCompareOptions, toleranceLabel: "±0.1%" }) : null),
    (yahooDailyOpen.value !== null ? compareSourceValue("開盤價抽樣", finDailyOpen.value, yahooDailyOpen.value, 0.1, yahooCompareOptions.dateNote || "外部 OHLCV 抽樣驗證。", finDailyOpen.value !== null ? "FinMind OHLCV" : getFieldSource(main, "dailyOpen"), yahooDailyOpen.value !== null ? yahooDailyOpen.source : noCompare, { ...yahooCompareOptions, toleranceLabel: "±0.1%" }) : null),
    (yahooDailyHigh.value !== null ? compareSourceValue("最高價抽樣", finDailyHigh.value, yahooDailyHigh.value, 0.1, yahooCompareOptions.dateNote || "外部 OHLCV 抽樣驗證。", finDailyHigh.value !== null ? "FinMind OHLCV" : getFieldSource(main, "dailyHigh"), yahooDailyHigh.value !== null ? yahooDailyHigh.source : noCompare, { ...yahooCompareOptions, toleranceLabel: "±0.1%" }) : null),
    (yahooDailyLow.value !== null ? compareSourceValue("最低價抽樣", finDailyLow.value, yahooDailyLow.value, 0.1, yahooCompareOptions.dateNote || "外部 OHLCV 抽樣驗證。", finDailyLow.value !== null ? "FinMind OHLCV" : getFieldSource(main, "dailyLow"), yahooDailyLow.value !== null ? yahooDailyLow.source : noCompare, { ...yahooCompareOptions, toleranceLabel: "±0.1%" }) : null),

    (isEtf ? compareSourceValue("ETF TWSE MIS displayPrice", twseMisMainPriceValue, null, 0, twseMisDisplayPriceType.value === "mid" ? "TWSE MIS z 缺值時，以五檔中間價作參考；不視為正式成交價。" : "TWSE MIS ETF 即時成交價 / 顯示價。", twseMisMainPriceValue !== null ? `${twseMisMainPriceSource}${twseMisTimeLabel}` : noCompare, "輔助資料", { statusOverride: twseMisMainPriceValue !== null ? "已補值" : undefined, toleranceLabel: "輔助" }) : null),
    (isEtf ? compareSourceValue("ETF TWSE MIS 成交量", twseMisVolume.value, null, 0, "TWSE MIS ETF 盤中成交量；用於流動性與價差陷阱判斷，不進短線分數。", twseMisVolume.value !== null ? `${twseMisVolume.source}${twseMisTimeLabel}` : noCompare, "輔助資料", { statusOverride: twseMisVolume.value !== null ? "已補值" : undefined, toleranceLabel: "輔助" }) : null),
    (isEtf ? compareSourceValue("ETF displayPriceType", twseMisDisplayPriceType.value ? 1 : null, null, 0, twseMisDisplayPriceType.value ? `顯示價型態：${twseMisDisplayPriceType.value}；last 為成交價，mid 為五檔中間參考價。` : "尚未取得 ETF 顯示價型態。", twseMisDisplayPriceType.value ? `TWSE MIS ${twseMisDisplayPriceType.value}` : noCompare, "輔助資料", { statusOverride: twseMisDisplayPriceType.value ? "已補值" : undefined, toleranceLabel: "輔助" }) : null),
    (isEtf ? compareSourceValue("ETF 即時估值", officialEtfDisplay.estimatedNav, null, 0, "ETF 官方即時估值；用於折溢價與追價風險判斷，不進短線分數。", officialEtfDisplay.estimatedNav !== null && officialEtfDisplay.estimatedNav !== undefined ? officialEtfDisplay.source : noCompare, "輔助資料", { statusOverride: officialEtfDisplay.estimatedNav !== null && officialEtfDisplay.estimatedNav !== undefined ? "已補值" : undefined, toleranceLabel: "輔助" }) : null),
    (isEtf ? compareSourceValue("ETF 即時市價", officialEtfDisplay.latestPrice, twseMisMainPriceValue, 0.3, "ETF 官方即時市價需接近 TWSE MIS 主行情；兩者接近代表小卡市價口徑可信。", officialEtfDisplay.latestPrice !== null && officialEtfDisplay.latestPrice !== undefined ? officialEtfDisplay.source : noCompare, twseMisMainPriceValue !== null ? `${twseMisMainPriceSource}${twseMisTimeLabel}` : noCompare, { statusOverride: officialEtfDisplay.latestPrice !== null && officialEtfDisplay.latestPrice !== undefined ? undefined : "缺值", toleranceLabel: "±0.3%" }) : null),
    (isEtf ? compareSourceValue("ETF 前日淨值", officialEtfDisplay.referenceNav, null, 0, officialEtfDisplay.navDate ? `官方前日淨值日期：${officialEtfDisplay.navDate}。` : "官方前日淨值日期尚未更新。", officialEtfDisplay.referenceNav !== null && officialEtfDisplay.referenceNav !== undefined ? officialEtfDisplay.source : noCompare, "輔助資料", { statusOverride: officialEtfDisplay.referenceNav !== null && officialEtfDisplay.referenceNav !== undefined ? "已補值" : undefined, toleranceLabel: "輔助" }) : null),
    (isEtf ? compareSourceValue("ETF 折溢價%", officialEtfDisplay.premiumDiscountPct, null, 0, "官方即時折溢價；用於觀察追價或折價，不作短線分數。", officialEtfDisplay.premiumDiscountPct !== null && officialEtfDisplay.premiumDiscountPct !== undefined ? officialEtfDisplay.source : noCompare, "輔助資料", { statusOverride: officialEtfDisplay.premiumDiscountPct !== null && officialEtfDisplay.premiumDiscountPct !== undefined ? "已補值" : undefined, compareMode: "abs", toleranceLabel: "輔助" }) : null),
    (isEtf ? compareSourceValue("ETF 估值來源", officialEtfDisplay.estimatedNav !== null && officialEtfDisplay.estimatedNav !== undefined ? 1 : null, null, 0, officialEtfDisplay.adapter ? "官方即時估值已同步；可用於折溢價與市價一致性檢查。" : "官方即時估值尚未同步。", officialEtfDisplay.estimatedNav !== null && officialEtfDisplay.estimatedNav !== undefined ? "ETF 即時估值" : noCompare, "輔助資料", { statusOverride: officialEtfDisplay.estimatedNav !== null && officialEtfDisplay.estimatedNav !== undefined ? "已補值" : undefined, toleranceLabel: "輔助" }) : null),

    (yahooMacd.value !== null ? compareSourceValue("MACD", finMacd.value, yahooMacd.value, 2, yahooCompareOptions.dateNote || "外部 OHLCV 對齊共同交易日後重算；對照主表 MACD。", "FinMind OHLCV + App計算", yahooMacd.value !== null ? yahooMacd.source + " + 同公式" : noCompare, { ...yahooCompareOptions, compareMode: "abs", toleranceLabel: "±2.00" }) : compareSourceValue("MACD", finMacd.value, null, 2, "主表技術欄位已接入；外部 OHLCV 尚未取得或未對齊共同交易日，暫作接入確認。", "FinMind OHLCV + App計算", "待外部 OHLCV", { statusOverride: "接入確認", compareMode: "abs", toleranceLabel: "待驗證" })),
    (yahooMacdSignal.value !== null ? compareSourceValue("MACD Signal", finMacdSignal.value, yahooMacdSignal.value, 2, yahooCompareOptions.dateNote || "外部 OHLCV 對齊共同交易日後重算；對照主表 Signal。", "FinMind OHLCV + App計算", yahooMacdSignal.value !== null ? yahooMacdSignal.source + " + 同公式" : noCompare, { ...yahooCompareOptions, compareMode: "abs", toleranceLabel: "±2.00" }) : compareSourceValue("MACD Signal", finMacdSignal.value, null, 2, "主表技術欄位已接入；外部 OHLCV 尚未取得或未對齊共同交易日，暫作接入確認。", "FinMind OHLCV + App計算", "待外部 OHLCV", { statusOverride: "接入確認", compareMode: "abs", toleranceLabel: "待驗證" })),
    (yahooMacdHist.value !== null ? compareSourceValue("MACD Hist", finMacdHist.value, yahooMacdHist.value, 1, yahooCompareOptions.dateNote || "外部 OHLCV 對齊共同交易日後重算；對照主表 Hist。", "FinMind OHLCV + App計算", yahooMacdHist.value !== null ? yahooMacdHist.source + " + 同公式" : noCompare, { ...yahooCompareOptions, compareMode: "abs", toleranceLabel: "±1.00" }) : compareSourceValue("MACD Hist", finMacdHist.value, null, 1, "主表技術欄位已接入；外部 OHLCV 尚未取得或未對齊共同交易日，暫作接入確認。", "FinMind OHLCV + App計算", "待外部 OHLCV", { statusOverride: "接入確認", compareMode: "abs", toleranceLabel: "待驗證" })),
    (yahooMacdHistDelta3.value !== null ? compareSourceValue("MACD 3日Δ", finMacdHistDelta3.value, yahooMacdHistDelta3.value, 1.5, yahooCompareOptions.dateNote || "外部 OHLCV 對齊共同交易日後重算；對照主表 3日Δ。", "FinMind OHLCV + App計算", yahooMacdHistDelta3.value !== null ? yahooMacdHistDelta3.source + " + 同公式" : noCompare, { ...yahooCompareOptions, compareMode: "abs", toleranceLabel: "±1.50" }) : compareSourceValue("MACD 3日Δ", finMacdHistDelta3.value, null, 1.5, "主表技術欄位已接入；外部 OHLCV 尚未取得或未對齊共同交易日，暫作接入確認。", "FinMind OHLCV + App計算", "待外部 OHLCV", { statusOverride: "接入確認", compareMode: "abs", toleranceLabel: "待驗證" })),
    (yahooK9.value !== null ? compareSourceValue("KD K9", finK9.value, yahooK9.value, 2, yahooCompareOptions.dateNote || "外部 OHLCV 對齊共同交易日後重算；對照主表 K。", "FinMind OHLCV + App計算", yahooK9.value !== null ? yahooK9.source + " + 同公式" : noCompare, { ...yahooCompareOptions, compareMode: "abs", toleranceLabel: "±2點" }) : compareSourceValue("KD K9", finK9.value, null, 2, "主表技術欄位已接入；外部 OHLCV 尚未取得或未對齊共同交易日，暫作接入確認。", "FinMind OHLCV + App計算", "待外部 OHLCV", { statusOverride: "接入確認", compareMode: "abs", toleranceLabel: "待驗證" })),
    (yahooD9.value !== null ? compareSourceValue("KD D9", finD9.value, yahooD9.value, 2, yahooCompareOptions.dateNote || "外部 OHLCV 對齊共同交易日後重算；對照主表 D。", "FinMind OHLCV + App計算", yahooD9.value !== null ? yahooD9.source + " + 同公式" : noCompare, { ...yahooCompareOptions, compareMode: "abs", toleranceLabel: "±2點" }) : compareSourceValue("KD D9", finD9.value, null, 2, "主表技術欄位已接入；外部 OHLCV 尚未取得或未對齊共同交易日，暫作接入確認。", "FinMind OHLCV + App計算", "待外部 OHLCV", { statusOverride: "接入確認", compareMode: "abs", toleranceLabel: "待驗證" })),
    (yahooJ9.value !== null ? compareSourceValue("KD J9", finJ9.value, yahooJ9.value, 2.5, yahooCompareOptions.dateNote || "外部 OHLCV 對齊共同交易日後重算；對照主表 J。", "FinMind OHLCV + App計算", yahooJ9.value !== null ? yahooJ9.source + " + 同公式" : noCompare, { ...yahooCompareOptions, compareMode: "abs", toleranceLabel: "±2.5點" }) : compareSourceValue("KD J9", finJ9.value, null, 2.5, "主表技術欄位已接入；外部 OHLCV 尚未取得或未對齊共同交易日，暫作接入確認。", "FinMind OHLCV + App計算", "待外部 OHLCV", { statusOverride: "接入確認", compareMode: "abs", toleranceLabel: "待驗證" })),
    (yahooAtr14.value !== null ? compareSourceValue("ATR14", finAtr14.value, yahooAtr14.value, 5, yahooCompareOptions.dateNote || "外部 OHLCV 對齊共同交易日後重算；對照主表 ATR。", "FinMind OHLCV + App計算", yahooAtr14.value !== null ? yahooAtr14.source + " + 同公式" : noCompare, { ...yahooCompareOptions, toleranceLabel: "±5%" }) : compareSourceValue("ATR14", finAtr14.value, null, 5, "主表技術欄位已接入；外部 OHLCV 尚未取得或未對齊共同交易日，暫作接入確認。", "FinMind OHLCV + App計算", "待外部 OHLCV", { statusOverride: "接入確認", toleranceLabel: "待驗證" })),
    (yahooAtrPct.value !== null ? compareSourceValue("ATR%", finAtrPct.value, yahooAtrPct.value, 0.2, yahooCompareOptions.dateNote || "外部 OHLCV 對齊共同交易日後重算；對照主表 ATR%。", "FinMind OHLCV + App計算", yahooAtrPct.value !== null ? yahooAtrPct.source + " + 同公式" : noCompare, { ...yahooCompareOptions, compareMode: "abs", toleranceLabel: "±0.20點" }) : compareSourceValue("ATR%", finAtrPct.value, null, 0.2, "主表技術欄位已接入；外部 OHLCV 尚未取得或未對齊共同交易日，暫作接入確認。", "FinMind OHLCV + App計算", "待外部 OHLCV", { statusOverride: "接入確認", compareMode: "abs", toleranceLabel: "待驗證" })),
    (yahooAtrPctAvg20.value !== null ? compareSourceValue("ATR% 20日均值", finAtrPctAvg20.value, yahooAtrPctAvg20.value, 0.2, yahooCompareOptions.dateNote || "外部 OHLCV 對齊共同交易日後重算；對照主表 20均。", "FinMind OHLCV + App計算", yahooAtrPctAvg20.value !== null ? yahooAtrPctAvg20.source + " + 同公式" : noCompare, { ...yahooCompareOptions, compareMode: "abs", toleranceLabel: "±0.20點" }) : compareSourceValue("ATR% 20日均值", finAtrPctAvg20.value, null, 0.2, "主表技術欄位已接入；外部 OHLCV 尚未取得或未對齊共同交易日，暫作接入確認。", "FinMind OHLCV + App計算", "待外部 OHLCV", { statusOverride: "接入確認", compareMode: "abs", toleranceLabel: "待驗證" })),
    (yahooAtrPctVsAvg20.value !== null ? compareSourceValue("ATR% 偏離20均", finAtrPctVsAvg20.value, yahooAtrPctVsAvg20.value, 2, yahooCompareOptions.dateNote || "外部 OHLCV 對齊共同交易日後重算；對照主表偏離值。", "FinMind OHLCV + App計算", yahooAtrPctVsAvg20.value !== null ? yahooAtrPctVsAvg20.source + " + 同公式" : noCompare, { ...yahooCompareOptions, compareMode: "abs", toleranceLabel: "±2點" }) : compareSourceValue("ATR% 偏離20均", finAtrPctVsAvg20.value, null, 2, "主表技術欄位已接入；外部 OHLCV 尚未取得或未對齊共同交易日，暫作接入確認。", "FinMind OHLCV + App計算", "待外部 OHLCV", { statusOverride: "接入確認", compareMode: "abs", toleranceLabel: "待驗證" })),

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
    (!isEtf ? compareSourceValue("EPS TTM", main.epsTtm, finEpsTtm.value, 0.1, "近四季 EPS 合計；用於中長線獲利能力背景，不進短線分數。ETF 可能無此欄位。", getFieldSource(main, "epsTtm"), finEpsTtm.value !== null ? finEpsTtm.source : noCompare, { statusOverride: "已補值" }) : null),
    (!isEtf ? compareSourceValue("EPS TTM 成長 epsTtmGrowthYoY", main.epsTtmGrowthYoY, finEpsTtmGrowth.value, 0.1, "近四季 EPS 年增率；用於觀察獲利趨勢，不進短線分數。", getFieldSource(main, "epsTtmGrowthYoY"), finEpsTtmGrowth.value !== null ? finEpsTtmGrowth.source : noCompare, { statusOverride: "已補值" }) : null),
    (!isEtf ? compareSourceValue("ROE TTM", main.roeTtm ?? main.roe, finRoeTtm.value, 0.1, "以近四季稅後淨利與最新股東權益估算 ROE；用於品質檢查，不進短線分數。", getFieldSource(main, "roeTtm"), finRoeTtm.value !== null ? finRoeTtm.source : noCompare, { statusOverride: "已補值" }) : null),
    (!isEtf ? compareSourceValue("毛利率 grossMargin", main.grossMargin, finGrossMargin.value, 0.1, "FinMind 財報資料。ETF 可能無此欄位。", getFieldSource(main, "grossMargin"), finGrossMargin.value !== null ? finGrossMargin.source : noCompare, { statusOverride: "已補值" }) : null),
    (!isEtf ? compareSourceValue("毛利率 QoQ 變化", main.grossMarginQoQ, finGrossMarginQoQ.value, 0.1, "最新季度毛利率較前一季變化，單位為百分點；用於觀察品質趨勢。", getFieldSource(main, "grossMarginQoQ"), finGrossMarginQoQ.value !== null ? finGrossMarginQoQ.source : noCompare, { statusOverride: "已補值", compareMode: "abs", toleranceLabel: "資料補值" }) : null),
    (!isEtf ? compareSourceValue("營益率 operatingMargin", main.operatingMargin, finOperatingMargin.value, 0.1, "FinMind 財報資料。ETF 可能無此欄位。", getFieldSource(main, "operatingMargin"), finOperatingMargin.value !== null ? finOperatingMargin.source : noCompare, { statusOverride: "已補值" }) : null),
    (!isEtf ? compareSourceValue("營益率 QoQ 變化", main.operatingMarginQoQ, finOperatingMarginQoQ.value, 0.1, "最新季度營益率較前一季變化，單位為百分點；用於觀察營運效率趨勢。", getFieldSource(main, "operatingMarginQoQ"), finOperatingMarginQoQ.value !== null ? finOperatingMarginQoQ.source : noCompare, { statusOverride: "已補值", compareMode: "abs", toleranceLabel: "資料補值" }) : null),
    (!isEtf ? compareSourceValue("淨利率 netMargin", main.netMargin, finNetMargin.value, 0.1, "最新季度淨利率；用於獲利品質背景，不進短線分數。", getFieldSource(main, "netMargin"), finNetMargin.value !== null ? finNetMargin.source : noCompare, { statusOverride: "已補值" }) : null),
    (!isEtf ? compareSourceValue("負債比 debtRatio", main.debtRatio, finDebtRatio.value, 0.1, "FinMind 資產負債資料。ETF 可能無此欄位。", getFieldSource(main, "debtRatio"), finDebtRatio.value !== null ? finDebtRatio.source : noCompare, { statusOverride: "已補值" }) : null),
    (!isEtf ? compareSourceValue("財報季度數 financialQuarterCount", main.financialQuarterCount, finFinancialQuarterCount.value, 0, "確認近四季 EPS / TTM / ROE 是否有足夠財報序列；不作交叉驗證。", getFieldSource(main, "financialQuarterCount"), finFinancialQuarterCount.value !== null ? finFinancialQuarterCount.source : noCompare, { statusOverride: "接入確認", toleranceLabel: "需足夠" }) : null),

    compareSourceValue("Nasdaq 一日變化", mainNasdaqPct, finmindNasdaqPct, 0.05, "台股開盤時段通常已接近美股收盤結果；GoogleFinance 作主畫面市場參考，FinMind Market 作日收盤驗證，差異超過容忍值才需檢查。", getFieldSource(main, "nasdaqReturn1d"), finmindNasdaqPct !== null ? "FinMind Market（日收盤驗證）" : noCompare, { compareMode: "abs", toleranceLabel: "±0.05點" }),
    compareSourceValue("SOX 一日變化", mainSoxPct, finmindSoxPct, 0.05, "台股開盤時段通常已接近美股收盤結果；GoogleFinance 作主畫面市場參考，FinMind Market 作日收盤驗證，差異超過容忍值才需檢查。", getFieldSource(main, "soxReturn1d"), finmindSoxPct !== null ? "FinMind Market（日收盤驗證）" : noCompare, { compareMode: "abs", toleranceLabel: "±0.05點" }),
    compareSourceValue("台指期盤後 taifexAfterHoursReturn", mainTaifexPct, googleTaifexPct, 0.1, "主資料用 FinMind Derivatives；GoogleFinance 沒有穩定台指期盤後欄位時不比對，只列主資料。若 Sheet 有填，會先統一為百分點格式再列參考。", getFieldSource(main, "taifexAfterHoursReturn"), googleTaifexPct !== null ? `${googleTaifex.source}（參考，不比對）` : getSourceName("none"), { compareMode: "abs", toleranceLabel: "±0.10點", noCompare: true }),
    compareSourceValue("VIX 一日變化", latestGoogleVixPct, finmindVixPct, 0.1, "VIX 已加入小數點位移防呆；GoogleFinance 作主畫面風險參考，FinMind Market 作日收盤驗證。若校正後仍超過容忍值，視為來源口徑或市場風險需檢查。", "GoogleFinance", finmindVixPct !== null ? "FinMind Market（日收盤驗證）" : getSourceName("none"), { compareMode: "abs", toleranceLabel: "±0.10點" }),
  ];

  return rows.filter(Boolean);
}

function getValidationState(rows) {
  const total = rows.length;
  const missing = rows.filter((row) => row.status === "缺值" || row.status === "無法取得").length;
  const failed = rows.filter((row) => row.status === "需檢查").length;
  const passed = rows.filter((row) => row.status === "通過").length;
  if (failed > 0) return { label: "需檢查", tone: "bg-orange-100 text-orange-800", failed, missing, passed };
  if (passed > 0 && missing === 0) return { label: "可信", tone: "bg-emerald-100 text-emerald-800", failed, missing, passed };
  if (passed > 0) return { label: "部分驗證", tone: "bg-yellow-100 text-yellow-800", failed, missing, passed };
  return { label: "未驗證", tone: "bg-slate-100 text-slate-700", failed, missing: total, passed: 0 };
}

function validationSummary(rows) {
  const state = getValidationState(rows);
  if (state.label === "可信") return "可比對欄位皆在容忍範圍內，來源一致性良好。";
  if (state.label === "部分驗證") return `已有 ${state.passed} 項完成交叉驗證，另有 ${state.missing} 項缺值；已補值與接入確認不代表外部驗證通過。`;
  if (state.label === "需檢查") return `有 ${state.failed} 項超過容忍值，需檢查資料日期、單位或除權息口徑；未能確認前不應完全信任該欄位。`;
  return "目前缺少可交叉比對欄位；系統先保留既有資料，不判定為失敗。";
}


function validationGroupOf(label = "") {
  const text = String(label || "");
  if (/現價|成交量 volume$|昨收|TWSE MIS 盤中價量|量能爆發|10日均量|20日均量/.test(text)) return "即時 / 盤中資料";
  if (/收盤價抽樣|開盤價抽樣|最高價抽樣|最低價抽樣|日收盤|日成交量|5MA|20MA|60MA|RSI|高點|低點|報酬|技術預熱|MACD|KD|ATR/.test(text)) return "歷史 / 日線 / 技術資料";
  if (/外資|投信|自營|法人|融資|融券/.test(text)) return "籌碼 / 資金資料";
  if (/Nasdaq|SOX|台指期|VIX/.test(text)) return "市場 / 風險資料";
  if (/PER|PBR|殖利率|EPS|營收|毛利|營益|負債|ROE|淨利率|財報季度/.test(text)) return "估值 / 基本面 / 中長線預備";
  if (/ETF/.test(text)) return "ETF 輔助資料";
  return "其他";
}

function validationActionTagOf(label = "") {
  const text = String(label || "");
  if (/TWSE MIS 盤中價量|FinMind 日收盤|FinMind 日成交量|ETF 即時市價|ETF 即時估值|ETF 折溢價%|三大法人3日|三大法人20日/.test(text)) return "mergeCandidate";
  if (/ETF 備援/.test(text)) return "hideCandidate";
  return "keep";
}

function validationRoleOf(label = "") {
  const text = String(label || "");
  if (/現價/.test(text)) return "盤中即時：TWSE MIS 主、Google 輔";
  if (/成交量 volume$/.test(text)) return "盤中即時：TWSE MIS 主、Google 輔，差異只參考";
  if (/量能爆發|10日均量|20日均量/.test(text)) return "短線V1 技術面：量能爆發力";
  if (/5MA|20MA/.test(text)) return "短線V1 技術面：股價相對均線";
  if (/RSI/.test(text)) return "短線V1 技術面：RSI";
  if (/MACD/.test(text)) return "短線V1 技術面：MACD 動能";
  if (/KD/.test(text)) return "短線V1 技術面：KD 轉折";
  if (/ATR/.test(text)) return "短線V1 技術面：ATR 波動";
  if (/外資|投信|自營|法人/.test(text)) return "短線V1 資金面：法人買賣參考";
  if (/融資|融券/.test(text)) return "短線V1 資金面：槓桿熱度參考";
  if (/Nasdaq|SOX/.test(text)) return "短線V1 市場面：外部風向";
  if (/台指期|VIX/.test(text)) return "短線V1 市場面：隔夜風險";
  if (/ETF/.test(text)) return "ETF 輔助：價差 / 流動性 / NAV 入口，不進短線分數";
  if (/PER|PBR|殖利率|EPS|營收|毛利|營益|負債|ROE|淨利率|財報季度/.test(text)) return "非即時：估值 / 基本面 / 中長線預備";
  if (/抽樣|日收盤|日成交量|高點|低點|報酬|預熱/.test(text)) return "非即時：歷史日線 / 技術資料驗證";
  return "資料驗證";
}

function validationSortKey(label = "") {
  const text = String(label || "");
  const order = [
    "現價 price", "成交量 volume", "昨收 prevClose", "TWSE MIS 盤中價量", "量能爆發比 volumeRatio", "10日均量 volume10ma", "20日均量 avgVolume20",
    "收盤價抽樣", "開盤價抽樣", "最高價抽樣", "最低價抽樣", "FinMind 日收盤 dailyClose", "FinMind 日成交量 dailyVolume", "5MA", "20MA", "60MA", "RSI14", "20日高點 high20", "20日低點 low20", "20日報酬 return20d", "60日報酬 return60d", "技術預熱 priceRowCount", "MACD", "MACD Signal", "MACD Hist", "MACD 3日Δ", "KD K9", "KD D9", "KD J9", "ATR14", "ATR%", "ATR% 20日均值", "ATR% 偏離20均",
    "外資3日 foreign3d", "投信3日 trust3d", "自營商3日 dealer3d", "三大法人3日 institutional3d", "外資20日 foreign20d", "投信20日 trust20d", "自營商20日 dealer20d", "三大法人20日 institutional20d", "融資5日 marginChange5dPct", "融券5日 shortSaleChange5dPct", "融資20日 marginChange20dPct", "融券20日 shortSaleChange20dPct",
    "Nasdaq 一日變化", "SOX 一日變化", "台指期盤後 taifexAfterHoursReturn", "VIX 一日變化",
    "本益比 PER", "PBR", "殖利率 dividendYield", "EPS", "EPS 成長 epsGrowthYoY", "EPS TTM", "EPS TTM 成長 epsTtmGrowthYoY", "月營收 MoM revenueMoM", "月營收 YoY revenueYoY", "毛利率 grossMargin", "毛利率 QoQ 變化", "營益率 operatingMargin", "營益率 QoQ 變化", "負債比 debtRatio", "ROE TTM", "淨利率 netMargin", "財報季度數 financialQuarterCount",
    "ETF TWSE MIS displayPrice", "ETF TWSE MIS 成交量", "ETF displayPriceType", "ETF 即時估值", "ETF 即時市價", "ETF 前日淨值", "ETF 折溢價%", "ETF 估值來源"
  ];
  const idx = order.findIndex((item) => item === text);
  return idx >= 0 ? idx : 9999;
}

function enrichValidationRow(row) {
  return {
    ...row,
    actionTag: row.actionTag || validationActionTagOf(row.label),
    validationRole: row.validationRole || validationRoleOf(row.label),
  };
}

function validationStatusClass(status) {
  if (status === "通過") return "bg-emerald-100 text-emerald-800";
  if (status === "需檢查") return "bg-orange-100 text-orange-800";
  if (status === "參考差異") return "bg-amber-100 text-amber-800";
  if (status === "不比對") return "bg-blue-100 text-blue-800";
  if (status === "已補值") return "bg-sky-100 text-sky-800";
  if (status === "接入確認") return "bg-indigo-100 text-indigo-800";
  if (status === "缺值" || status === "無法取得") return "bg-slate-100 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

function validationDiffText(row) {
  if (["不比對", "已補值", "接入確認", "缺值", "無法取得"].includes(row.status)) return "-";
  if (row.finmindValue === 0 && row.googleValue !== 0 && row.status === "需檢查" && row.compareMode !== "abs") return "基準為0";
  if (row.compareMode === "abs") return `${Number(row.diffPct || 0).toFixed(3)}點`;
  return pct(row.diffPct);
}

function validationToleranceText(row) {
  if (["不比對", "已補值", "接入確認", "缺值", "無法取得"].includes(row.status)) return "-";
  if (row.status === "參考差異") return row.toleranceLabel || "參考";
  return row.toleranceLabel || `±${row.tolerancePct}%`;
}

function compactValidationNote(row) {
  const label = String(row?.label || "");
  if (/現價/.test(label)) return "TWSE MIS 盤中主值。";
  if (/昨收/.test(label)) return "昨收獨立校正。";
  if (/成交量 volume$/.test(label)) return "Google 僅輔助參考。";
  if (/日收盤/.test(label)) return row?.note || "日期一致才比對。";
  if (/日成交量/.test(label)) return row?.note || "日期一致才比對。";
  if (/10日均量/.test(label)) return "量能基準。";
  if (/量能爆發/.test(label)) return "短線量能基準。";
  if (/PER/.test(label)) return "估值口徑可能不同。";
  if (/PBR|殖利率/.test(label)) return "已補值。";
  if (/EPS$/.test(label)) return "口徑不同，不比對。";
  if (/技術預熱/.test(label)) return "技術資料量檢查。";
  if (/MACD/.test(label)) return "同日 OHLCV 重算驗證。";
  if (/KD/.test(label)) return "同日 OHLCV 重算驗證。";
  if (/ATR/.test(label)) return "同日 OHLCV 重算驗證。";
  if (/5MA|20MA/.test(label)) return "外部均線參考。";
  if (/MA|RSI|高點|低點|報酬|均量/.test(label)) return "日 K 已補值。";
  if (/外資|投信|自營|法人/.test(label)) return "法人已補值。";
  if (/融資|融券/.test(label)) return "融資券已補值。";
  if (/營收/.test(label)) return "月營收已補值。";
  if (/毛利|營益|負債|EPS 成長/.test(label)) return "財報已補值。";
  if (/VIX/.test(label)) return "市場風險參考。";
  if (/Nasdaq|SOX/.test(label)) return "市場風險參考。";
  if (/台指期/.test(label)) return "有資料才比。";
  return row?.note || "";
}

function validationGroupRows(rows = []) {
  const order = ["即時 / 盤中資料", "歷史 / 日線 / 技術資料", "籌碼 / 資金資料", "市場 / 風險資料", "估值 / 基本面 / 中長線預備", "ETF 輔助資料", "其他"];
  const grouped = new Map(order.map((key) => [key, []]));
  rows.map(enrichValidationRow).forEach((row) => {
    const group = validationGroupOf(row.label);
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(row);
  });
  for (const group of grouped.keys()) {
    grouped.get(group).sort((a, b) => validationSortKey(a.label) - validationSortKey(b.label));
  }
  return order.map((group) => ({ group, rows: grouped.get(group) || [] })).filter((item) => item.rows.length);
}

function getDerived(stock) {
  const todayReturn = stock.prevClose > 0 ? ((stock.price - stock.prevClose) / stock.prevClose) * 100 : 0;
  const volumeBase = stock.volume10ma > 0
    ? Number(stock.volume10ma)
    : stock.avgVolume20 > 0
      ? Number(stock.avgVolume20)
      : 0;
  const volumeBaseLabel = stock.volume10ma > 0
    ? "10日均量"
    : stock.avgVolume20 > 0
      ? "20日均量備援"
      : "量能基準待補";
  const volumeRatio = hasFinite(stock.volumeRatio) && Number(stock.volumeRatio) > 0
    ? Number(stock.volumeRatio)
    : volumeBase > 0
      ? stock.volume / volumeBase
      : 1;
  const range20 = stock.high20 - stock.low20;
  const closePosition20 = range20 > 0 ? clamp(((stock.price - stock.low20) / range20) * 100) : 50;
  const institutional3d = (stock.foreign3d || 0) + (stock.trust3d || 0) + (stock.dealer3d || 0);
  const institutional20d = (stock.foreign20d || 0) + (stock.trust20d || 0);
  const basic = { todayReturn, volumeRatio, volumeBase, volumeBaseLabel, closePosition20, institutional3d, institutional20d };
  const volumePower = analyzeVolumePower(stock, basic);
  return { ...basic, volumePower };
}

function hasFinite(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}


function buildShortV1Rows(stock, weights = DEFAULT_WEIGHT_CONFIG.short) {
  const d = getDerived(stock);
  const hasTaifex = hasFinite(stock.taifexAfterHoursReturn) && Number(stock.taifexAfterHoursReturn) !== 0;
  const ma5Diff = stock.ma5 > 0 ? ((stock.price - stock.ma5) / stock.ma5) * 100 : 0;
  const ma20Diff = stock.ma20 > 0 ? ((stock.price - stock.ma20) / stock.ma20) * 100 : 0;
  const institutionalFlow = institutionalFlowDetails(stock);
  const institutionalScore = scoreInstitutionalFlow(stock);
  const marginScore = scoreMarginShortRisk(stock.marginChange5dPct, stock.shortSaleChange5dPct);
  const usScore = scoreUsMarket(stock.nasdaqReturn1d, stock.soxReturn1d);
  const overnightRiskInput = {
    taifexAfterHoursReturn: stock.taifexAfterHoursReturn,
    vixChange1d: stock.vixChange1d,
  };
  const overnightRiskScore = scoreOvernightRisk(overnightRiskInput);
  const overnightRisk = overnightRiskDetails(overnightRiskInput);
  const derivativesRiskInput = {
    putCallVolumeRatio: stock.putCallVolumeRatio,
    putCallOpenInterestRatio: stock.putCallOpenInterestRatio,
    futuresInstitutionalNetAmount: stock.futuresInstitutionalNetAmount,
    optionInstitutionalNetBias: stock.optionInstitutionalNetBias,
  };
  const derivativesRiskScore = scoreDerivativesRisk(derivativesRiskInput);
  const derivativesRisk = derivativesRiskDetails(derivativesRiskInput);
  const fundamentalScore = scoreFundamentalReady(stock);

  return [
    {
      weightKey: "ma5",
      dimension: "技術面",
      item: "股價相對 5MA",
      source: `以現價相對 5MA 乖離衡量短線動能。站上且乖離合理為正向；跌破或乖離過大則降低短線追價評價。

評分標準：
乖離 <= -2%：弱勢區，低分。
-2% ～ 0%：接近翻揚，逐步加分。
0% ～ 4%：健康區間，高分。
4% ～ 10%：偏熱，逐步扣分。
> 10%：追價風險高，不給滿分。`,
      weight: weights.ma5,
      score: scorePriceVsMa(stock.price, stock.ma5, { weak: -2, idealLow: 0, idealHigh: 4, overheat: 10 }),
      rule: `現價 ${number(stock.price)} / 5MA ${number(stock.ma5)} / 乖離 ${pct(ma5Diff)}`,
      status: weights.ma5 > 0 ? "計分" : "資料確認，不計分"
    },
    {
      weightKey: "ma20",
      dimension: "技術面",
      item: "股價相對 20MA",
      source: `以現價相對 20MA 乖離衡量波段結構。站上 20MA 代表波段支撐仍在；乖離擴大時，短線追價風險升高。

評分標準：
乖離 <= -3%：跌破波段支撐，低分。
-3% ～ 0%：接近支撐，中低分。
0% ～ 5%：健康區間，高分。
5% ～ 12%：偏強但有乖離，逐步扣分。
> 12%：過度乖離，視為追價風險。`,
      weight: weights.ma20,
      score: scorePriceVsMa(stock.price, stock.ma20, { weak: -3, idealLow: 0, idealHigh: 5, overheat: 12 }),
      rule: `現價 ${number(stock.price)} / 20MA ${number(stock.ma20)} / 乖離 ${pct(ma20Diff)}`,
      status: weights.ma20 > 0 ? "計分" : "資料確認，不計分"
    },
    {
      weightKey: "rsi",
      dimension: "技術面",
      item: "RSI(14)",
      source: `以 RSI(14) 判斷短線動能溫度。RSI 不是越高越好，健康動能優於極端過熱。

評分標準：
45 ～ 65：健康區間，滿分。
35 ～ 45：偏弱但可接受。
65 ～ 70：偏熱但可接受。
30 ～ 35：弱勢區，低分。
70 ～ 80：過熱區，低分。
< 30 或 > 80：極端值，最低分區。`,
      weight: weights.rsi,
      score: scoreRsiShort(stock.rsi14),
      rule: `RSI ${Number(stock.rsi14 || 0).toFixed(1)}；健康區間 45～65`,
      status: weights.rsi > 0 ? "計分" : "資料確認，不計分"
    },
    {
      weightKey: "macdMomentum",
      dimension: "技術面",
      item: "MACD 動能",
      source: `計算基準：以日線收盤價計算 EMA12、EMA26、Signal9 與 Hist；Hist = MACD - Signal。MACD 屬 EMA 遞迴型指標，採約 300 個日曆天作為預熱區間；有效評分門檻為至少 100 筆交易日。

評分標準：
Hist 由負轉正，或 MACD 上穿 Signal：趨勢剛轉強，1.00。
Hist > 0 且近 3 日 Hist 擴大：多方動能擴大，0.90。
Hist > 0 但近 3 日 Hist 收斂：多方動能收斂，0.75。
Hist < 0 但近 3 日 Hist 收斂：空方動能收斂，0.45。
Hist 由正轉負，或 MACD 跌破 Signal：趨勢剛轉弱，0.30。
Hist < 0 且近 3 日更負：空方動能擴大，0.15。`,      weight: weights.macdMomentum,
      score: scoreMacdMomentum(stock),
      rule: `MACD ${compactDecimal(stock.macd, 2)} / Signal ${compactDecimal(stock.macdSignal, 2)} / Hist ${compactDecimal(stock.macdHist, 2)} / 3日Δ ${compactDecimal(stock.macdHistDelta3, 2)}（${stock.macdState || "待觀察"}）`,
      status: weights.macdMomentum > 0 ? "計分" : "資料確認，不計分"
    },
    {
      weightKey: "kdTurn",
      dimension: "技術面",
      item: "KD 轉折",
      source: `計算基準：以日線高、低、收計算 RSV9、K9、D9、J9，並以近 2～3 日 K/D 關係確認轉折。KD 收斂速度較快；有效評分門檻為至少 40 筆交易日。

評分標準：
K 上穿 D，且 K/D 低於或接近 20：低檔轉強，0.90。
K 上穿 D，且 K/D 位於 20～80：短線轉強，0.78。
K > D 且 K/D 位於 20～80：短線偏多，0.75。
K > D 且 K/D 高於 80：高檔強勢，0.65；不視為無風險追價。
K 下穿 D，且 K/D 高於 80：高檔轉弱，0.25。
K 下穿 D，且 K/D 位於 20～80：短線轉弱，0.35。
K < D 且 K/D 位於 20～80：短線偏弱，0.35。
K < D 且 K/D 低於 20：低檔弱勢，0.20。
J > 100：過熱修正，分數上限 0.60；J < 0：過弱修正，分數上限 0.45。`,      weight: weights.kdTurn,
      score: scoreKdTurn(stock),
      rule: `K ${compactDecimal(stock.k9, 1)} / D ${compactDecimal(stock.d9, 1)} / J ${compactDecimal(stock.j9, 1)} / ${stock.kdCross || "未交叉"}（${stock.kdState || "待觀察"}）`,
      status: weights.kdTurn > 0 ? "計分" : "資料確認，不計分"
    },
    {
      weightKey: "atrVolatility",
      dimension: "技術面",
      item: "ATR 波動",
      source: `計算基準：以日線高、低、收計算 TR、ATR14、ATR% 與 ATR% 20 日均值。ATR 採 Wilder smoothing，並以自身近 20 日常態波動作比較；有效評分門檻為至少 100 筆交易日。

評分標準：
ATR% 接近近 20 日平均：波動正常，1.00。
ATR% 低於近 20 日平均約 25% 以上：波動低，0.80；需搭配量價確認。
ATR% 高於近 20 日平均 20%～50%：波動升高，0.60。
ATR% 高於近 20 日平均 50% 以上：波動過大，0.25。
ATR% 過高且同時爆量、乖離偏大或市場轉弱：視為短線震盪風險，保守降評。`,      weight: weights.atrVolatility,
      score: scoreAtrVolatility(stock),
      rule: `ATR ${compactDecimal(stock.atr14, 2)} / ATR% ${compactDecimal(stock.atrPct, 2)}% / 20均 ${compactDecimal(stock.atrPctAvg20, 2)}% / 偏離 ${compactDecimal(stock.atrPctVsAvg20, 1)}%（${stock.volatilityState || "待觀察"}）`,
      status: weights.atrVolatility > 0 ? "計分" : "資料確認，不計分"
    },
    {
      weightKey: "volumePower",
      dimension: "技術面",
      item: "量能爆發力",
      source: `量能爆發力改採 V1.1 時間係數校正版。盤後以完整日成交量 / 均量正式評分；盤中若有 GoogleFinance tradetime，先用台股盤中時間進度係數把目前累積量推估為全日量，再與 10 日或 20 日均量比較。

計算方式：
盤後量能比 = 今日完整成交量 / 10日均量。
盤中預估全日量 = GoogleFinance 目前累積量 / 台股盤中時間進度係數。
盤中量能比 = 盤中預估全日量 / 10日均量或20日均量備援。

時間係數：
09:00～09:30：早盤觀察，不硬扣分。
09:30～10:00：0.35。
10:00～10:30：0.48。
10:30～11:30：0.65。
11:30～12:30：0.80。
12:30～13:20：0.95。
13:20 之後：接近完整日量，係數 1.00。

評分標準：
量能比 >= 2.0：爆量攻擊。
1.3～2.0：量能增溫。
0.8～1.3：量能正常。
0.5～0.8：量能偏弱。
< 0.5：明顯量縮。

價格確認：
量增且價格上漲 / 站上均線，視為有效攻擊量。
量增但價格下跌，視為放量賣壓。
量縮但價格上漲，追價分數保守。
量縮且價格下跌，視為買盤不足。`,
      weight: weights.volumePower,
      score: scoreVolumePower(d.volumePower),
      rule: `${d.volumePower.timeLabel} / 今日量 ${compactNumber(stock.volume, 0)} / ${d.volumeBaseLabel.replace("10日均量", "10均").replace("20日均量備援", "20均")} ${compactNumber(d.volumeBase, 0)} / 原始量比 ${compactRatio(d.volumePower.rawRatio)} / 校正量比 ${compactRatio(d.volumePower.ratio)}（${d.volumePower.label}，${d.volumePower.confirmLabel}）`,
      status: weights.volumePower > 0 ? "計分" : "資料確認，不計分"
    },
    {
      weightKey: "institutional3d",
      dimension: "籌碼面",
      item: "三大法人3日",
      source: `以三大法人近 3 日淨額相對 20 日均量衡量籌碼力道。法人合計買超占均量比重越高，籌碼分數越高；外資與投信同向買超加分，外資與投信同向賣超扣分。

評分標準：
法人淨買超 / 20日均量 >= 5%：強買超，高分。
2% ～ 5%：明顯偏多。
0.5% ～ 2%：小幅偏多。
0% ～ 0.5%：中性偏多。
-1% ～ 0%：小幅偏空。
-3% ～ -1%：偏空。
< -3%：明顯賣超，低分。

方向修正：
外資 + 投信同向買超：加分。
外資賣、投信買但合計買超：限制最高分。
外資 + 投信同向賣超：限制分數上緣。`,
      weight: weights.institutional3d,
      score: institutionalScore,
      rule: `外資 ${compactNumber(stock.foreign3d, 0)} / 投信 ${compactNumber(stock.trust3d, 0)} / 自營 ${compactNumber(stock.dealer3d, 0)} / 合計 ${compactNumber(d.institutional3d, 0)} / 占比 ${institutionalFlow.ratio === null ? "待補" : pct(institutionalFlow.ratio)}`,
      status: weights.institutional3d > 0 ? "計分" : "資料確認，不計分"
    },
    {
      weightKey: "margin5d",
      dimension: "籌碼面",
      item: "融資5日風險",
      source: `以融資 5 日變化作為主要籌碼風險，融券 5 日變化作為輔助。融資快速增加代表槓桿升溫，短線容易形成籌碼壓力；融資下降或穩定則風險較低。

融資評分標準：
融資變化 <= 0%：籌碼壓力低，高分。
0% ～ 5%：小幅升溫，仍可接受。
5% ～ 8%：偏熱，扣分。
> 8%：槓桿升溫明顯，低分。

融券輔助標準：
融券增加 >= 30%：避險或放空升溫，扣分。
15% ～ 30%：偏空升溫。
5% ～ 15%：小幅偏空。
-10% ～ 5%：中性。
< -10%：融券回補，風險下降。`,
      weight: weights.margin5d,
      score: marginScore,
      rule: `融資5日 ${pct(stock.marginChange5dPct)} / 融券5日 ${pct(stock.shortSaleChange5dPct)}`,
      status: weights.margin5d > 0 ? "計分" : "資料確認，不計分"
    },
    {
      weightKey: "usMarket",
      dimension: "市場面",
      item: "美股科技風向",
      source: `以 Nasdaq 與 SOX 衡量外部科技股風向。台股電子權值股與半導體族群對 Nasdaq / SOX 敏感，雙指數同步轉強為正向，雙弱則提高短線風險。

評分標準：
Nasdaq > 0 且 SOX > 0，平均漲幅 >= 1%：強勢，高分。
Nasdaq > 0 且 SOX > 0：同步偏多。
任一指數上漲：中性偏多。
平均跌幅在 -1% 以內：中性偏弱。
平均跌幅 < -1%：外部風險偏高。`,
      weight: weights.usMarket,
      score: usScore,
      rule: `Nasdaq ${pct(stock.nasdaqReturn1d)} / SOX ${pct(stock.soxReturn1d)}`,
      status: weights.usMarket > 0 ? "計分" : "資料確認，不計分"
    },
    {
      weightKey: "futuresVix",
      dimension: "市場面",
      item: "隔夜風險",
      source: `以台指期盤後與 VIX 衡量隔夜風險。台指期偏強、VIX 回落代表風險下降；台指期轉弱或 VIX 升溫代表風險提高。

台指期評分標準：
台指期 > 0.5%：偏強，高分。
0% ～ 0.5%：小漲，偏正向。
-0.5% ～ 0%：中性偏弱。
< -0.5%：偏弱，低分。

VIX 評分標準：
VIX < -1%：明顯回落，高分。
-1% ～ 0%：小幅回落，偏正向。
0% ～ 1%：小幅升溫，中性。
> 1%：風險升溫，扣分。`,
      weight: weights.futuresVix,
      score: overnightRiskScore,
      rule: `台指期 ${hasTaifex ? pct(stock.taifexAfterHoursReturn) : "待接"}（${overnightRisk.txLabel}） / VIX ${pct(stock.vixChange1d)}（${overnightRisk.vixLabel}）`,
      status: weights.futuresVix > 0 ? "計分" : "資料確認，不計分"
    },
    {
      weightKey: "derivativesData",
      dimension: "市場面",
      item: "期權避險",
      source: `以期貨法人淨額、Put/Call 成交量與 Put/Call 未平倉結構衡量大盤避險壓力。法人偏多、避險需求下降為正向；避險升溫或法人偏空為負向。

Put/Call 成交量評分標準：
PutCall 量 <= 0.9：避險壓力低，高分。
0.9 ～ 1.05：中性。
1.05 ～ 1.2：小幅偏高。
1.2 ～ 1.5：避險升溫。
> 1.5：避險明顯升溫，低分。

Put/Call OI 評分標準：
PutCall OI >= 1.5：下方支撐偏強，高分。
1.15 ～ 1.5：偏支撐。
1.0 ～ 1.15：中性。
0.85 ～ 1.0：偏壓力。
< 0.85：壓力偏高。

期貨法人淨額評分標準：
法人淨額 > 1,000萬：明顯偏多。
0 ～ 1,000萬：偏多。
-1,000萬 ～ 0：小幅偏空。
< -1,000萬：偏空。`,
      weight: weights.derivativesData,
      score: derivativesRiskScore,
      rule: compactDerivativeText(stock, derivativesRisk),
      status: weights.derivativesData > 0 ? "計分" : "資料確認，不計分"
    },
    {
      weightKey: "fundamentalsData",
      dimension: "基本面",
      item: "基本面完整度",
      source: `短線 V1 暫不將基本面納入主要權重，僅檢查營收、EPS、毛利率、營益率、負債比等欄位是否完整。此項目前作為後續風險濾網，不直接主導短線分數。

評分標準：
已取得欄位數 / 應檢查欄位數 = 基本面完整度分數。

檢查欄位：
revenueYoY
revenueMoM
eps
epsGrowthYoY
grossMargin
operatingMargin
debtRatio`,
      weight: weights.fundamentalsData,
      score: fundamentalScore,
      rule: fundamentalBriefText(stock),
      status: weights.fundamentalsData > 0 ? "計分" : "資料確認，不計分"
    },
  ];
}

function buildMidV1Rows(stock, weights = DEFAULT_WEIGHT_CONFIG.mid) {
  const d = getDerived(stock);
  return [
    { weightKey: "trendData", dimension: "技術面", item: "20MA / 60MA / 52週位階 / 20日動能資料可抓取", source: "中線使用 FinMind 趨勢資料 + GoogleFinance 52週位階與 roc20。短線不用這些長週期欄位，避免污染短線分數。", weight: weights.trendData, score: passScore(Number.isFinite(stock.ma20) && Number.isFinite(stock.ma60) && Number.isFinite(stock.return60d) && Number.isFinite(stock.pricePosition52) && Number.isFinite(stock.roc20)), rule: `20MA ${number(stock.ma20)} / 60MA ${number(stock.ma60)} / 60日 ${pct(stock.return60d)} / 52週位階 ${Number(stock.pricePosition52 || 0).toFixed(2)} / 20日動能 ${pct(Number(stock.roc20 || 0) * 100)}`, status: weights.trendData > 0 ? "計分" : "資料確認，不計分" },
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
    { weightKey: "qualityData", dimension: "基本面", item: "品質 / 成長 / 估值資料可抓取", source: "長線使用 FinMind 財報品質 + GoogleFinance earningsYield / yield 作估值背景；不進短線。", weight: weights.qualityData, score: passScore(Number.isFinite(stock.grossMargin) && Number.isFinite(stock.debtRatio) && Number.isFinite(stock.earningsYield)), rule: `盈餘殖利率 ${pct(Number(stock.earningsYield || 0) * 100)} / 殖利率 ${pct(stock.yield)} / 毛利率 ${pct(stock.grossMargin)} / 負債比 ${pct(stock.debtRatio)}`, status: weights.qualityData > 0 ? "計分" : "資料確認，不計分" },
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
  const price = Number(stock?.price);
  const ma20 = Number(stock?.ma20);
  const low20 = Number(stock?.low20);
  const high20 = Number(stock?.high20);
  const ma5 = Number(stock?.ma5);

  const hasPrice = Number.isFinite(price) && price > 0;
  const hasMa20 = Number.isFinite(ma20) && ma20 > 0;
  const hasLow20 = Number.isFinite(low20) && low20 > 0;
  const hasHigh20 = Number.isFinite(high20) && high20 > 0;
  const hasMa5 = Number.isFinite(ma5) && ma5 > 0;

  // V71C：停損閘門只處理明確跌破風控線；不能因為「距20日高點回落」單一條件就把高分股票硬壓到停損。
  // 盤中價格從盤後收盤價更新後，5MA乖離變差是合理；但只要仍站上20MA，就不應直接觸發停損閘門。
  const breakMa20 = hasPrice && hasMa20 ? price < ma20 : false;
  const nearLow20 = hasPrice && hasLow20 ? price <= low20 * 1.02 : false;
  const pullbackFromHigh20 = hasPrice && hasHigh20 ? ((high20 - price) / high20) * 100 : 0;
  const deepPullback = pullbackFromHigh20 >= 8;
  const belowMa5 = hasPrice && hasMa5 ? price < ma5 : false;

  const triggered = breakMa20 || nearLow20;
  const warning = !triggered && (deepPullback || belowMa5);

  const reasons = [];
  const warnings = [];

  if (breakMa20) reasons.push("跌破20MA");
  if (nearLow20) reasons.push("接近20日低點");

  if (deepPullback) warnings.push(`距20日高點回落${pct(pullbackFromHigh20)}`);
  if (belowMa5) warnings.push("跌破5MA");

  return {
    triggered,
    warning,
    reasons,
    warnings,
    pullbackFromHigh20,
    inputs: { price, ma5, ma20, low20, high20 },
  };
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
  if (stopLoss?.quotePending) return { label: "等待盤中價", tone: "bg-slate-100 text-slate-700" };
  if (stopLoss?.triggered) return { label: "停損警示 / 不追價", tone: "bg-red-100 text-red-800" };
  if (total >= 0.85) return { label: "強力買入 / 適合短線做多", tone: "bg-emerald-100 text-emerald-800" };
  if (total >= 0.7) return { label: "偏多 / 可分批試單", tone: "bg-lime-100 text-lime-800" };
  if (total >= 0.55) return { label: "橫盤觀望 / 等確認", tone: "bg-yellow-100 text-yellow-800" };
  if (total >= 0.4) return { label: "偏弱 / 不追價", tone: "bg-orange-100 text-orange-800" };
  return { label: "避開 / 等待轉強", tone: "bg-red-100 text-red-800" };
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

function getFrameworkAnalysis(horizon, result) {
  return `${horizon} V1 目前是資料架構版，已列入 Google / TWSE / FinMind 多來源欄位，共 ${result.rows.length} 項資料檢查，其中 ${result.rows.filter((row) => row.score === 1).length} 項資料可用。此頁用來確認 API 欄位是否可抓，尚未完成正式投資分數校準。`;
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
    const validationState = getValidationState(validationRows);
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
  if (score >= 85) return { badge: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-500", track: "bg-emerald-50", card: "border-emerald-200 bg-emerald-50/70", text: "text-emerald-800", ring: "ring-emerald-100" };
  if (score >= 70) return { badge: "bg-lime-100 text-lime-800", bar: "bg-lime-500", track: "bg-lime-50", card: "border-lime-200 bg-lime-50/70", text: "text-lime-800", ring: "ring-lime-100" };
  if (score >= 55) return { badge: "bg-yellow-100 text-yellow-800", bar: "bg-yellow-500", track: "bg-yellow-50", card: "border-yellow-200 bg-yellow-50/70", text: "text-yellow-800", ring: "ring-yellow-100" };
  if (score >= 40) return { badge: "bg-orange-100 text-orange-800", bar: "bg-orange-500", track: "bg-orange-50", card: "border-orange-200 bg-orange-50/70", text: "text-orange-800", ring: "ring-orange-100" };
  return { badge: "bg-red-100 text-red-800", bar: "bg-red-500", track: "bg-red-50", card: "border-red-200 bg-red-50/70", text: "text-red-800", ring: "ring-red-100" };
}

function ScoreBadge({ score, pending = false }) {
  if (pending) return <Badge className="bg-slate-100 text-slate-700 text-sm px-3 py-1">待即時</Badge>;
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

function OverviewTable({ rows, selected, onSelect, onInsight, onRemove, dataMode, lastFetchMap = {}, marketIndex = null }) {
  const refreshTime = formatLastFetch(lastFetchMap, "twse_mis") !== "尚未抓取" ? formatLastFetch(lastFetchMap, "twse_mis") : formatLastFetch(lastFetchMap, "google_csv");
  const hasMarketIndex = marketIndex?.price !== null && marketIndex?.price !== undefined && Number.isFinite(Number(marketIndex.price));
  const indexTimeText = marketIndex?.time ? `｜${compactSourceTime(marketIndex.time)}` : "";
  const indexText = hasMarketIndex
    ? `台股大盤：${displayValue(marketIndex.price)}${marketIndex.changePct !== null && marketIndex.changePct !== undefined ? `（${Number(marketIndex.changePct) >= 0 ? "+" : ""}${Number(marketIndex.changePct).toFixed(2)}%${marketIndex.change !== null && marketIndex.change !== undefined ? ` / ${Number(marketIndex.change) >= 0 ? "+" : ""}${number(marketIndex.change)}` : ""}）` : ""}${indexTimeText}`
    : "台股大盤：待更新";
  const indexBadgeTone = hasMarketIndex
    ? Number(marketIndex?.changePct) >= 0
      ? "bg-emerald-50 text-emerald-700"
      : "bg-rose-50 text-rose-700"
    : "bg-slate-100 text-slate-600";
  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="p-3 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><h3 className="text-lg font-semibold flex items-center gap-2"><Icon name="bar" /> 全部股票 / ETF 總覽</h3><p className="text-xs text-slate-500 mt-0.5">依短線 V1 排序；追蹤清單上限 50 檔。點擊短線、中線或長線查看評語。</p></div><div className="flex flex-wrap items-center gap-2"><Badge className={indexBadgeTone}>{indexText}</Badge><Badge className="bg-slate-100 text-slate-700">刷新時間：{refreshTime}</Badge></div></div>
        <div className="max-h-[260px] overflow-y-scroll overflow-x-auto rounded-lg border border-slate-200 bg-white pr-1 [scrollbar-gutter:stable]"><table className="w-full min-w-[1140px] text-[15px]"><thead className="sticky top-0 z-10 bg-white"><tr className="border-b text-left text-slate-500"><th className="w-14 px-2 py-2 text-center">排名</th><th>標的</th><th>類型</th><th>市場</th><th>現價</th><th>今日</th><th>短線</th><th>中線</th><th>長線</th><th>技術</th><th>籌碼</th><th>市場</th><th>建議</th><th>資料驗證</th><th className="w-20 text-center">操作</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.stock.symbol} className={`border-b last:border-0 cursor-pointer hover:bg-slate-50 ${selected === row.stock.symbol ? "bg-slate-100" : ""}`} onClick={() => onSelect(row.stock.symbol)}><td className="px-2 py-2 text-center font-medium tabular-nums">{index + 1}</td><td className="font-medium">{row.stock.symbol} {row.stock.name}{row.stock.nameSource ? <span className="ml-1 text-[11px] text-slate-400">({row.stock.nameSource})</span> : null}</td><td>{row.stock.type}</td><td>{row.stock.market}</td><td>{row.short.quotePending ? <span className="text-slate-400">待即時</span> : number(row.stock.price)}</td><td>{pct(row.derived.todayReturn)}</td><td><button type="button" onClick={(e) => { e.stopPropagation(); onInsight(row.stock.symbol, "short"); }}><ScoreBadge score={row.short.score100} pending={row.short.quotePending} /></button></td><td><button type="button" onClick={(e) => { e.stopPropagation(); onInsight(row.stock.symbol, "mid"); }}><Badge className="bg-slate-100 text-slate-700">待公式</Badge></button></td><td><button type="button" onClick={(e) => { e.stopPropagation(); onInsight(row.stock.symbol, "long"); }}><Badge className="bg-slate-100 text-slate-700">待公式</Badge></button></td><td>{Math.round(row.tech)}</td><td>{Math.round(row.chip)}</td><td>{Math.round(row.market)}</td><td><Badge className={row.recommendation.tone}>{row.recommendation.label}</Badge></td><td><Badge className={row.validationState.tone}>{row.validationState.label}</Badge></td><td className="text-center"><Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onRemove(row.stock.symbol); }}>移除</Button></td></tr>)}</tbody></table></div>
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>追蹤清單上限 50 檔；顯示區維持約 5 檔高度，超過可視範圍請在表格內上下滾動。</span>
          <span>{rows.length} 檔標的</span>
        </div>
      </CardContent>
    </Card>
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

評分標準維持原短線 V1：
雙指數同步轉強為正向；同步轉弱則提高短線風險。`;
  }
  if (row.weightKey === "derivativesData") {
    next.item = "大盤避險";
    next.source = `以期貨法人淨額、Put/Call 成交量與 Put/Call 未平倉結構衡量大盤避險壓力。此項不是 ETF 本身基本面，而是台股短線風險濾網。

評分標準維持原短線 V1：
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
    return "短線 V1 保守版：ETF 主表收斂為技術、資金、市場三大面向；MACD / KD / ATR 納入技術面，基本面檢查不套用 ETF。";
  }
  return "短線 V1 保守版：主表收斂為技術、籌碼、市場三大面向；MACD / KD / ATR 納入技術面，基本面改為獨立檢查。";
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
      summary: "尚未取得 ETF 折溢價資料；不影響短線 V1 主分數。",
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
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[15px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-semibold text-slate-900">ETF 輔助風險小卡</div>
            <div className="mt-1 text-xs text-slate-500">折溢價 + 市價一致性 + 流動性 + 日內波動 + 技術同步；不進短線總分。</div>
          </div>
        </div>
        <div className={`mt-3 rounded-lg border p-3 ${etfRiskToneClass(analysis.level)}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold">ETF 輔助總結</div>
            <Badge className="bg-white/70 text-inherit">{analysis.levelLabel}</Badge>
          </div>
          <div className="mt-2 font-semibold leading-6">{analysis.summaryLine}</div>
        </div>
        <div className="mt-2 leading-6 text-slate-600">ETF 即時估值尚未取得；先以主行情、量能與技術面為主，不影響短線 V1 主分數。</div>
      </div>
    );
  }

  const { sourcePage, premium, intraday, consistency, liquidity, technical, summaryLine, level, levelLabel } = analysis;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[15px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-900">ETF 輔助風險小卡</div>
          <div className="mt-1 text-xs text-slate-500">折溢價 + 市價一致性 + 流動性 + 日內波動 + 技術同步；不進短線總分。</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-slate-100 text-slate-700">ETF 即時估值｜{sourcePage}</Badge>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-6">
        <div><div className="text-xs text-slate-500">主行情</div><div className="font-medium">{displayValue(stock.price)}</div></div>
        <div><div className="text-xs text-slate-500">即時市價</div><div className="font-medium">{displayValue(stock.yahooEtfMarketPrice)}</div></div>
        <div><div className="text-xs text-slate-500">價差</div><div className="font-medium">{consistency.diffText}</div></div>
        <div><div className="text-xs text-slate-500">折溢價</div><div className="font-medium">{pct(stock.yahooEtfPremiumDiscountPct)}</div></div>
        <div><div className="text-xs text-slate-500">量比</div><div className="font-medium">{liquidity.ratioText}</div></div>
        <div><div className="text-xs text-slate-500">區間差</div><div className="font-medium">{displayValue(stock.yahooEtfRangeSpread)}（{intraday.ratioText}）</div></div>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div><div className="text-xs text-slate-500">日內區間</div><div className="font-medium text-slate-800">{displayValue(stock.yahooEtfRangeLow)}～{displayValue(stock.yahooEtfRangeHigh)}</div></div>
        <div><div className="text-xs text-slate-500">資料時間</div><div className="font-medium text-slate-800">{stock.yahooEtfFetchedAt || "-"}</div></div>
      </div>

      <div className={`mt-3 rounded-lg border p-3 ${etfRiskToneClass(level)}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-semibold">ETF 輔助總結</div>
          <Badge className="bg-white/70 text-inherit">{levelLabel}</Badge>
        </div>
        <div className="mt-2 font-semibold leading-6">{summaryLine}</div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className={`rounded-lg border p-3 ${etfRiskToneClass(premium.level)}`}>
          <div className="text-xs opacity-80">折溢價判讀</div>
          <div className="mt-1 font-semibold">{premium.state}</div>
          <div className="mt-1 leading-6">{premium.summary}</div>
        </div>
        <div className={`rounded-lg border p-3 ${etfRiskToneClass(consistency.level)}`}>
          <div className="text-xs opacity-80">市價一致性</div>
          <div className="mt-1 font-semibold">{consistency.state}</div>
          <div className="mt-1 leading-6">{consistency.summary}</div>
        </div>
        <div className={`rounded-lg border p-3 ${etfRiskToneClass(liquidity.level)}`}>
          <div className="text-xs opacity-80">流動性檢查</div>
          <div className="mt-1 font-semibold">{liquidity.state}</div>
          <div className="mt-1 leading-6">{liquidity.summary}</div>
        </div>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div className={`rounded-lg border p-3 ${etfRiskToneClass(intraday.level)}`}>
          <div className="text-xs opacity-80">日內波動判讀</div>
          <div className="mt-1 font-semibold">{intraday.state}</div>
          <div className="mt-1 leading-6">{intraday.summary}</div>
        </div>
        <div className={`rounded-lg border p-3 ${etfRiskToneClass(technical.level)}`}>
          <div className="text-xs opacity-80">技術同步</div>
          <div className="mt-1 font-semibold">{technical.state}</div>
          <div className="mt-1 leading-6">{technical.summary}</div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 leading-6 text-slate-600">
        <span className="font-semibold text-slate-800">操作提醒：</span>
        {premium.action} ETF 輔助小卡只用來辨識追價價差、流動性陷阱與資料不同步，不改變短線 V1 主分數。
      </div>

      <div className="mt-2 text-xs leading-5 text-slate-500">ETF 即時估值僅作折溢價、追價風險與流動性輔助判讀；不參與短線 V1 主分數。若資料暫缺，維持缺值並回到技術面與量能主框架。</div>
    </div>
  );
}

function FrameworkTable({ title, subtitle, result, showScore = false, horizon, onWeightChange, onResetHorizon, stock }) {
  const isShortDesktopTemplate = horizon === "short";

  if (isShortDesktopTemplate) {
    const displayRows = getShortFrameworkDisplayRows(result.rows, stock);
    const fundamentalRow = getShortFrameworkFundamentalRow(result.rows, stock);

    return (
      <Card className="rounded-xl shadow-sm">
        <CardContent className="p-3 space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="text-[15px] text-slate-500 mt-1">{subtitle}</p>
            </div>
            {horizon && onResetHorizon && <Button variant="outline" size="sm" onClick={() => onResetHorizon(horizon)} className="shrink-0">恢復預設值</Button>}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1040px] text-[15px]">
              <colgroup>
                <col className="w-[92px]" />
                <col className="w-[190px]" />
                <col className="w-[104px]" />
                <col className="w-[112px]" />
                <col className="w-[92px]" />
                <col />
              </colgroup>
              <thead className="bg-white">
                <tr className="border-b text-left text-slate-500">
                  <th className="px-3 py-3">維度</th>
                  <th className="px-3 py-3 whitespace-nowrap">指標</th>
                  <th className="px-3 py-3 text-center">權重</th>
                  <th className="px-3 py-3 text-center">狀態</th>
                  <th className="px-3 py-3 text-center">分數</th>
                  <th className="px-3 py-3">數據</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => (
                  <tr key={`${row.dimension}-${row.item}`} className="border-b last:border-0">
                    <td className="px-3 py-3 align-top font-medium whitespace-nowrap">{row.dimension}</td>
                    <td className="px-3 py-3 align-top whitespace-nowrap leading-6">{row.item}</td>
                    <td className="px-3 py-3 align-top text-center">
                      {horizon && row.weightKey && onWeightChange ? (
                        <Input type="number" step="0.01" min="0" max="1" value={row.weight} onChange={(e) => onWeightChange(horizon, row.weightKey, e.target.value)} className="mx-auto h-8 w-20 rounded-lg border-slate-300 px-2 text-right text-[15px] font-medium" />
                      ) : row.weight.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 align-top"><div className="flex min-h-[32px] items-center justify-center"><StatusBadge text={row.status} /></div></td>
                    <td className="px-3 py-3 align-top text-center">{compareBadge(row.score)}</td>
                    <td className="px-3 py-3 align-top text-slate-600 leading-6">{getShortFrameworkRowDataText(row)}</td>
                  </tr>
                ))}
                {showScore && <tr className="bg-slate-50 font-semibold"><td className="px-3 py-3" colSpan={2}>權重合計 / 加權得分</td><td className="px-3 py-3 text-center">{result.totalWeight.toFixed(2)}</td><td className="px-3 py-3"></td><td className="px-3 py-3 text-center">{result.total.toFixed(2)}</td><td className="px-3 py-3">MACD / KD / ATR 已納入技術面計分；若需觀察不計分，可將權重調為 0。</td></tr>}
              </tbody>
            </table>
          </div>

          {fundamentalRow && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[15px]">
              <div className="font-semibold text-slate-900">基本面檢查</div>
              <div className="mt-2 leading-6 text-slate-600">{getShortFrameworkRowDataText(fundamentalRow)}</div>
            </div>
          )}

          {isEtfAsset(stock) && <YahooEtfInfoCard stock={stock} />}

          <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <summary className="cursor-pointer select-none font-semibold text-slate-800">完整計分規則</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {[...displayRows, ...(fundamentalRow ? [fundamentalRow] : [])].map((row) => <div key={`rule-${row.dimension}-${row.item}`} className="rounded-lg bg-white p-3 shadow-sm"><div className="font-semibold text-slate-900">{row.dimension}｜{row.item}</div><div className="mt-1 whitespace-pre-line leading-6 text-slate-600">{getShortFrameworkRowRuleText(row) || "此列暫無額外規則說明。"}</div></div>)}
            </div>
            {isEtfAsset(stock) && (
              <div className="mt-3 rounded-lg bg-white p-3 shadow-sm">
                <div className="font-semibold text-slate-900">ETF 專用｜折溢價輔助判斷</div>
                <div className="mt-1 whitespace-pre-line leading-6 text-slate-600">{yahooEtfPremiumRuleText()}</div>
              </div>
            )}
          </details>
        </CardContent>
      </Card>
    );
  }

  return <Card className="rounded-xl shadow-sm"><CardContent className="p-3 space-y-3"><div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between"><div><h3 className="text-lg font-semibold">{title}</h3><p className="text-[15px] text-slate-500 mt-1">{subtitle}</p></div>{horizon && onResetHorizon && <Button variant="outline" size="sm" onClick={() => onResetHorizon(horizon)} className="shrink-0">恢復預設值</Button>}</div><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[1260px] text-[15px]"><colgroup><col className="w-[112px]" /><col className="w-[340px]" /><col className="w-[104px]" /><col className="w-[150px]" /><col className="w-[130px]" /><col className="w-[280px]" /><col className="w-[360px]" /></colgroup><thead className="bg-white"><tr className="border-b text-left text-slate-500"><th className="px-3 py-3">維度</th><th className="px-3 py-3 whitespace-nowrap">指標 / 資料檢查</th><th className="px-3 py-3 text-center">權重</th><th className="px-3 py-3 text-center">狀態</th><th className="px-3 py-3 text-center">分數</th><th className="px-3 py-3">規則 / 數據</th><th className="px-3 py-3">公式解釋</th></tr></thead><tbody>{result.rows.map((row) => <tr key={`${row.dimension}-${row.item}`} className="border-b last:border-0"><td className="px-3 py-3 align-top font-medium whitespace-nowrap">{row.dimension}</td><td className="px-3 py-3 align-top whitespace-nowrap leading-6">{row.item}</td><td className="px-3 py-3 align-top text-center">{horizon && row.weightKey && onWeightChange ? <Input type="number" step="0.01" min="0" max="1" value={row.weight} onChange={(e) => onWeightChange(horizon, row.weightKey, e.target.value)} className="mx-auto h-8 w-20 rounded-lg border-slate-300 px-2 text-right text-[15px] font-medium" /> : row.weight.toFixed(2)}</td><td className="px-3 py-3 align-top"><div className="flex min-h-[32px] items-center justify-center"><StatusBadge text={row.status} /></div></td><td className="px-3 py-3 align-top text-center">{compareBadge(row.score)}</td><td className="px-3 py-3 align-top text-slate-600 leading-6">{row.rule}</td><td className="px-3 py-3 align-top text-slate-500 leading-6">{row.explain || row.source}</td></tr>)}{showScore && <tr className="bg-slate-50 font-semibold"><td className="px-3 py-3" colSpan={2}>權重合計 / 加權得分</td><td className="px-3 py-3 text-center">{result.totalWeight.toFixed(2)}</td><td className="px-3 py-3"></td><td className="px-3 py-3"></td><td className="px-3 py-3">{result.total.toFixed(2)}</td><td className="px-3 py-3">分數改為 0～1 連續分；合計建議維持 1.00。</td></tr>}</tbody></table></div></CardContent></Card>;
}



function isTwseMisAutoWindow(now = new Date()) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = 8 * 60 + 30;
  const end = 14 * 60;
  return minutes >= start && minutes <= end;
}

function isSameTaipeiDateFromMs(ms, now = new Date()) {
  if (!Number.isFinite(ms)) return false;
  const d = new Date(ms);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isGoogleIntradayQuoteReady(stock, now = new Date()) {
  const source = String(stock?.priceSource || "");
  if (source !== "GoogleFinance") return false;
  const tradeTime = stock?.tradetime || stock?.updatedAt || "";
  const tradeMs = parseGoogleTradeTimeMs(tradeTime);
  return Number.isFinite(tradeMs) && isSameTaipeiDateFromMs(tradeMs, now);
}

function isTwseMisIntradayQuoteReady(stock) {
  const source = String(stock?.priceSource || "");
  const hasMisSource = source.startsWith("TWSE MIS") || String(stock?.intradaySource || "") === "TWSE MIS";
  const hasTradeTime = Boolean(stock?.tradetime || stock?.updatedAt);
  const hasPrice = Number.isFinite(Number(stock?.price)) && Number(stock?.price) > 0;
  return hasMisSource && hasTradeTime && hasPrice;
}

function getIntradayQuoteReadiness(stock, now = new Date()) {
  if (!isTwseMisAutoWindow(now)) {
    return { ready: true, pending: false, reason: "非盤中即時區間", source: stock?.priceSource || "" };
  }

  if (isTwseMisIntradayQuoteReady(stock)) {
    return { ready: true, pending: false, reason: "TWSE MIS 盤中價已到位", source: stock?.priceSource || "TWSE MIS", tradetime: stock?.tradetime || stock?.updatedAt || "" };
  }

  if (isGoogleIntradayQuoteReady(stock, now)) {
    return { ready: true, pending: false, reason: "GoogleFinance 盤中價已到位", source: "GoogleFinance", tradetime: stock?.tradetime || stock?.updatedAt || "" };
  }

  return {
    ready: false,
    pending: true,
    reason: "盤中即時價尚未到位；暫不使用昨收 / 盤後收盤價產生短線建議。",
    source: stock?.priceSource || stock?.intradaySource || stock?.officialCloseSource || stock?.dailyCloseSource || "尚無即時價來源",
    tradetime: stock?.tradetime || stock?.updatedAt || "",
  };
}


function hasTwseMisIntradayLock(stock, now = new Date()) {
  if (!isTwseMisAutoWindow(now)) return false;
  const source = String(stock?.priceSource || "");
  const hasMisSource = source.startsWith("TWSE MIS") || String(stock?.intradaySource || "") === "TWSE MIS";
  const hasTradeTime = Boolean(stock?.tradetime || stock?.updatedAt);
  const hasPrice = Number.isFinite(Number(stock?.price)) && Number(stock?.price) > 0;
  return hasMisSource && hasTradeTime && hasPrice;
}

function isGoogleQuoteUsableForIntraday(google, now = new Date()) {
  const price = Number(google?.price);
  const tradeMs = parseGoogleTradeTimeMs(google?.tradetime || google?.updatedAt || "");
  return Number.isFinite(price) && price > 0 && Number.isFinite(tradeMs) && isSameTaipeiDateFromMs(tradeMs, now);
}

function shouldGoogleUpdateMainQuote(previous, google, now = new Date()) {
  if (!isTwseMisAutoWindow(now)) return true;
  if (hasTwseMisIntradayLock(previous, now)) return false;
  return isGoogleQuoteUsableForIntraday(google, now);
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

function updateTwseMisLatestTradeTime(rows = [], latestRef) {
  if (!latestRef?.current) return;
  rows.forEach((row) => {
    const symbol = normalizeStockSymbol(row?.symbol || row?.stock_id || row?.c);
    const tradeTime = String(row?.tradetime || row?.updatedAt || "").trim();
    if (symbol && tradeTime) latestRef.current[symbol] = tradeTime;
  });
}

function formatDurationMs(ms) {
  const value = Number(ms || 0);
  if (!Number.isFinite(value) || value <= 0) return "未設定";
  if (value >= 60 * 60 * 1000) return `${Math.round(value / (60 * 60 * 1000))} 小時`;
  if (value >= 60 * 1000) return `${Math.round(value / (60 * 1000))} 分鐘`;
  return `${Math.round(value / 1000)} 秒`;
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

function SourceConnectorTable({ config, onConfigChange, onSmartRefresh, onLoadGoogle, onLoadFinMind, onLoadTwse, onLoadTwseMis, onLoadMarket, onLoadDerivatives, onLoadYahoo, onLoadYahooEtf, onLoadOfficialEtfInav, loading, apiMessage, lastFetchMap, sourceRuntimeMap = {}, stocks, googleDebug }) {
  const sourceDisplayOrder = [
    "twse_mis",
    "official_etf_inav",
    "google_csv",
    "twse_proxy",
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
    finmind_proxy: "技術主資料",
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
      description: "盤中會自動刷新或同步更新；用來確認目前行情、ETF 即時估值與 Google 輔助行情。",
      sources: ["twse_mis", "official_etf_inav", "google_csv"],
    },
    {
      title: "非即時資料區",
      description: "啟動預熱 / 主更新 / 固定時段 cache；用於官方盤後校正、技術分數、籌碼與市場風險資料。",
      sources: ["twse_proxy", "finmind_proxy", "finmind_market", "finmind_derivatives"],
    },
    {
      title: "救援區",
      description: "只作備援與抽樣驗證，不覆蓋主資料、不參與短線分數。全站追蹤上限已由總覽控管，此處不重複顯示保護上限。",
      sources: ["yahoo_ohlcv", "yahoo_etf"],
    },
  ].map((group) => ({
    ...group,
    items: group.sources.map((source) => policyBySource[source]).filter(Boolean),
  }));
  const googleTemplate = buildGoogleVerifySheetTemplate(stocks);
  return <Card className="rounded-xl shadow-sm"><CardContent className="p-3 space-y-3"><h3 className="font-semibold flex items-center gap-2"><Icon name="doc" /> 資料來源串接層</h3><p className="text-xs text-slate-500">依「即時區 / 非即時資料區 / 救援區」排序；下方角色總覽已整合完整資料源說明。</p><div className="grid gap-2 md:grid-cols-3">
  <Input placeholder="TWSE MIS URL，例如 /api/twse/mis" value={config.twseMisProxyUrl || DEFAULT_TWSE_MIS_PROXY_URL} onChange={(e) => onConfigChange({ ...config, twseMisProxyUrl: e.target.value })} />
  <Input placeholder="ETF 即時估值 URL，例如 /api/etf/inav" value={config.etfInavProxyUrl || DEFAULT_ETF_INAV_PROXY_URL} onChange={(e) => onConfigChange({ ...config, etfInavProxyUrl: e.target.value })} />
  <Input placeholder="Google Sheet 公開 CSV URL" value={config.googleCsvUrl} onChange={(e) => onConfigChange({ ...config, googleCsvUrl: e.target.value })} />

  <Input placeholder="TWSE OpenAPI URL，例如 /api/twse/stocks" value={config.twseProxyUrl} onChange={(e) => onConfigChange({ ...config, twseProxyUrl: e.target.value })} />
  <Input placeholder="FinMind Daily URL，例如 /api/finmind/stocks" value={config.finmindProxyUrl} onChange={(e) => onConfigChange({ ...config, finmindProxyUrl: e.target.value })} />
  <Input placeholder="FinMind Market URL，例如 /api/finmind/market" value={config.finmindMarketProxyUrl} onChange={(e) => onConfigChange({ ...config, finmindMarketProxyUrl: e.target.value })} />

  <Input placeholder="FinMind Derivatives URL，例如 /api/finmind/derivatives" value={config.finmindDerivativesProxyUrl} onChange={(e) => onConfigChange({ ...config, finmindDerivativesProxyUrl: e.target.value })} />
  <Input placeholder="Yahoo OHLCV 備援 URL，例如 /api/yahoo/ohlcv" value={config.yahooOhlcvProxyUrl} onChange={(e) => onConfigChange({ ...config, yahooOhlcvProxyUrl: e.target.value })} />
  <Input placeholder="Yahoo ETF 備援 URL，例如 /api/yahoo/etf" value={config.yahooEtfProxyUrl} onChange={(e) => onConfigChange({ ...config, yahooEtfProxyUrl: e.target.value })} />
</div><div className="flex flex-wrap items-center gap-2">
  <Button onClick={onSmartRefresh} disabled={loading || (!config.googleCsvUrl && !config.finmindProxyUrl && !config.twseProxyUrl && !config.twseMisProxyUrl && !config.finmindMarketProxyUrl && !config.finmindDerivativesProxyUrl && !config.yahooOhlcvProxyUrl && !config.yahooEtfProxyUrl)}>更新資料</Button>
  {apiMessage && <Badge className={apiMessage.includes("成功") || apiMessage.includes("已更新") ? "bg-emerald-100 text-emerald-800" : "bg-yellow-100 text-yellow-800"}>{apiMessage}</Badge>}
</div>
<details className="rounded-xl border border-dashed bg-slate-50 p-3 text-xs text-slate-600">
  <summary className="cursor-pointer select-none font-semibold text-slate-800">進階測試來源</summary>
  <div className="mt-3 flex flex-wrap gap-2">
    <Button onClick={onLoadTwse} disabled={loading || !config.twseProxyUrl}>讀取 TWSE</Button>
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
            <div className="mt-1 text-slate-400 line-clamp-3">{item.cacheNote}</div>
          </div>
        ))}
      </div>
    </section>
  ))}
</div>{googleDebug && <div className="rounded-xl border bg-white p-3 text-xs text-slate-600"><div className="font-semibold text-slate-900">Google CSV 讀取診斷</div>{googleDebug.error ? <div className="text-red-600">錯誤：{googleDebug.error}</div> : <div className="space-y-1"><div>讀取方式：{googleDebug.mode}</div><div>CSV 列數：{googleDebug.parsedRows}</div><div>已對上：{googleDebug.matchedSymbols?.join(", ") || "無"}</div><div>未對上：{googleDebug.unmatchedSymbols?.join(", ") || "無"}</div><div>欄位：{googleDebug.headers?.join(" / ") || "無"}</div><div>rawDataMap：{googleDebug.rawDataMap ? Object.keys(googleDebug.rawDataMap).join(" / ") : "無"}</div>
<div>接受更新：{Array.isArray(googleDebug.acceptedSymbols) && googleDebug.acceptedSymbols.length ? `${googleDebug.acceptedSymbols.length} 檔｜${googleDebug.acceptedSymbols.slice(0, 12).join(" / ")}${googleDebug.acceptedSymbols.length > 12 ? ` ...另 ${googleDebug.acceptedSymbols.length - 12} 檔` : ""}` : "無"}{Array.isArray(googleDebug.staleSymbols) && googleDebug.staleSymbols.length ? `；略過舊快照 ${googleDebug.staleSymbols.length} 檔` : ""}</div>
<div className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2">CSV 關鍵摘要：{compactGoogleCsvRowsPreview(googleDebug, 20)}</div>
<div className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2">已採用行情：{compactGoogleAcceptedPreview(googleDebug, 20)}</div>
<div className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-amber-50 p-2 text-amber-800">略過舊快照明細：{compactGoogleStalePreview(googleDebug, 20)}</div>
<div>欄位完整度：{googleDebug.formulaCompleteness !== undefined ? googleDebug.formulaCompleteness : "-"}{googleDebug.fetchAttempts ? `；抓取次數 ${googleDebug.fetchAttempts}` : ""}{Number(googleDebug.formulaCompleteness || 0) > 0 && Number(googleDebug.formulaCompleteness || 0) < 0.5 ? "；本輪公式欄不完整，畫面會保留上一輪成功值" : ""}</div>
</div>}</div>}<div className="rounded-xl border bg-slate-50 p-3 space-y-2"><div className="font-semibold text-slate-900">Google 驗證模板</div><p className="text-xs text-slate-500">複製下方內容貼到 Google Sheet A1，等待 GOOGLEFINANCE 公式跑出數字後，將試算表發佈成 CSV，再把公開 CSV URL 貼回上方讀取。公式會依列號自動對齊，新增 2454 / 其他股票時不要讓公式固定在 C2。正式讀取會讀整份 CSV，因此重新整理頁面後也會把 CSV 裡的新股票加回 App；App 不會寫入或重建 Google Sheet。</p><textarea className="h-36 w-full rounded-lg border bg-white p-2 font-mono text-xs text-slate-700" readOnly value={googleTemplate} /></div></CardContent></Card>;
}


export default function StockShortV1App() {
  const [stocks, setStocks] = useState(initialStocks);
  const [selected, setSelected] = useState("2330");
  const [newAsset, setNewAsset] = useState({ symbol: "", name: "", type: "股票", market: "TWSE" });
  const [addError, setAddError] = useState("");
  const [insightTarget, setInsightTarget] = useState(null);
  const [dataMode, setDataMode] = useState(DEFAULT_DATA_MODE);
  const [apiConfig, setApiConfig] = useState({ googleCsvUrl: DEFAULT_GOOGLE_SHEET_CSV_URL, finmindProxyUrl: DEFAULT_FINMIND_PROXY_URL, finmindMarketProxyUrl: DEFAULT_FINMIND_MARKET_PROXY_URL, finmindDerivativesProxyUrl: DEFAULT_FINMIND_DERIVATIVES_PROXY_URL, twseProxyUrl: DEFAULT_TWSE_PROXY_URL, twseMisProxyUrl: DEFAULT_TWSE_MIS_PROXY_URL, yahooOhlcvProxyUrl: DEFAULT_YAHOO_OHLCV_PROXY_URL, yahooEtfProxyUrl: DEFAULT_YAHOO_ETF_PROXY_URL, etfInavProxyUrl: DEFAULT_ETF_INAV_PROXY_URL });
  const [apiLoading, setApiLoading] = useState(false);
  const googleRefreshingRef = useRef(false);
  const googleAutoRequestSeqRef = useRef(0);
  const googleLatestTradeTimeRef = useRef({});
  const twseMisRefreshingRef = useRef(false);
  const startupCacheWarmupRef = useRef(false);
  const startupFinMindWarmupRef = useRef(false);
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

  const current = stocks.find((s) => s.symbol === selected) || stocks[0];
  const derived = getDerived(current);
  const overviewRows = useMemo(() => buildOverviewRows(stocks, validationMap, weightConfig), [stocks, validationMap, weightConfig]);
  const activeInsightRow = insightTarget ? overviewRows.find((row) => row.stock.symbol === insightTarget.symbol) : null;
  const activeInsight = insightTarget ? getHorizonInsight(activeInsightRow, insightTarget.horizon) : null;
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


  function mergeYahooEtfToStocks(currentStocks, yahooEtfRows = []) {
    const rows = Array.isArray(yahooEtfRows) ? yahooEtfRows : [];
    const bySymbol = new Map(rows.map((row) => [normalizeStockSymbol(row.symbol || row.stock_id), row]));

    return currentStocks.map((stock) => {
      const symbol = normalizeStockSymbol(stock.symbol);
      const row = bySymbol.get(symbol);
      if (!row) return stock;

      const next = { ...stock };
      if (isEtfAsset(next)) {
        applyDefinedNumber(next, "yahooEtfMarketPrice", row.marketPrice);
        applyDefinedNumber(next, "yahooEtfChange", row.change);
        applyDefinedNumber(next, "yahooEtfChangePct", row.changePct);
        applyDefinedNumber(next, "yahooEtfRangeHigh", row.rangeHigh);
        applyDefinedNumber(next, "yahooEtfRangeLow", row.rangeLow);
        applyDefinedNumber(next, "yahooEtfRangeSpread", row.rangeSpread);
        applyDefinedNumber(next, "yahooEtfPremiumDiscountPct", row.premiumDiscountPct);
        next.yahooEtfSourcePage = row.sourcePage || "";
        next.yahooEtfFetchedAt = row.fetchedAt || "";
        next.yahooEtfSource = "ETF 備援";
      }
      return next;
    });
  }


  function mergeOfficialEtfInavToStocks(currentStocks, officialRows = []) {
    const rows = Array.isArray(officialRows) ? officialRows : [];
    const bySymbol = new Map(rows.map((row) => [normalizeStockSymbol(row.symbol || row.stock_id), row]));

    return currentStocks.map((stock) => {
      const symbol = normalizeStockSymbol(stock.symbol);
      const row = bySymbol.get(symbol);
      if (!row || row.parseStatus !== "PASS") return stock;

      const next = { ...stock };
      if (isEtfAsset(next)) {
        applyDefinedNumber(next, "officialEtfInavEstimatedNav", row.estimatedNav);
        applyDefinedNumber(next, "officialEtfInavLatestPrice", row.latestPrice);
        applyDefinedNumber(next, "officialEtfInavReferenceNav", row.referenceNav);
        applyDefinedNumber(next, "officialEtfInavYesterdayPrice", row.yesterdayPrice);
        applyDefinedNumber(next, "officialEtfInavPremiumDiscountPct", row.premiumDiscountPct);
        next.officialEtfInavNavDate = row.navDate || "";
        next.officialEtfInavSourceType = row.sourceType || "";
        next.officialEtfInavAdapter = row.adapter || "";
        next.officialEtfInavUpdatedAt = row.dataTime || row.navDate || "";

        // Reuse the existing ETF risk-card fields to avoid a large UI rewrite.
        applyDefinedNumber(next, "yahooEtfMarketPrice", row.latestPrice);
        applyDefinedNumber(next, "yahooEtfPremiumDiscountPct", row.premiumDiscountPct);
        next.yahooEtfRangeHigh = next.yahooEtfRangeHigh ?? null;
        next.yahooEtfRangeLow = next.yahooEtfRangeLow ?? null;
        next.yahooEtfRangeSpread = next.yahooEtfRangeSpread ?? null;
        next.yahooEtfSourcePage = "official_inav";
        next.yahooEtfFetchedAt = row.dataTime || row.navDate || "";
        next.yahooEtfSource = "official_etf_inav";
      }
      return next;
    });
  }

  function mergeMarketToStocks(currentStocks, marketPayload) {
    const derived = marketPayload?.derived || {};
    const gold = marketPayload?.gold || {};
    const fedRate = marketPayload?.fedRate || {};
    const bonds = Array.isArray(marketPayload?.bonds) ? marketPayload.bonds : [];
    const fx = Array.isArray(marketPayload?.fx) ? marketPayload.fx : [];
    const oil = Array.isArray(marketPayload?.oil) ? marketPayload.oil : [];
    const us10y = bonds.find((item) => String(item.id || "").includes("10"));
    const usd = fx.find((item) => item.id === "USD");
    const jpy = fx.find((item) => item.id === "JPY");
    const wti = oil.find((item) => item.id === "WTI");

    return currentStocks.map((stock) => {
      const next = { ...stock };
      const sourceName = "FinMind Market";

      // Nasdaq / SOX 主資料優先用 GoogleFinance，因為它跟 Google Sheet 前端更新較同步。
      // FinMind Market 仍保留成第二來源與備援，不直接覆蓋 GoogleFinance 主欄位。
      if (derived.nasdaqReturn1d !== null && derived.nasdaqReturn1d !== undefined) {
        applyDefinedNumber(next, "finmindNasdaqReturn1d", derived.nasdaqReturn1d);
        next.finmindNasdaqReturn1dSource = sourceName;

        const hasGoogleNasdaq =
          next.nasdaqReturn1dSource === "GoogleFinance" &&
          next.nasdaqReturn1d !== null &&
          next.nasdaqReturn1d !== undefined &&
          Number.isFinite(Number(next.nasdaqReturn1d));

        if (!hasGoogleNasdaq) {
          applyDefinedNumber(next, "nasdaqReturn1d", derived.nasdaqReturn1d);
          next.nasdaqReturn1dSource = sourceName;
        }
      }

      if (derived.soxReturn1d !== null && derived.soxReturn1d !== undefined) {
        applyDefinedNumber(next, "finmindSoxReturn1d", derived.soxReturn1d);
        next.finmindSoxReturn1dSource = sourceName;

        const hasGoogleSox =
          next.soxReturn1dSource === "GoogleFinance" &&
          next.soxReturn1d !== null &&
          next.soxReturn1d !== undefined &&
          Number.isFinite(Number(next.soxReturn1d));

        if (!hasGoogleSox) {
          applyDefinedNumber(next, "soxReturn1d", derived.soxReturn1d);
          next.soxReturn1dSource = sourceName;
        }
      }

      applyDefinedNumber(next, "sp500Return1d", derived.sp500Return1d);
      applyDefinedNumber(next, "dowReturn1d", derived.dowReturn1d);

      // VIX 口徑容易因盤中 / 收盤 / 延遲不同而跳動。
      // GoogleFinance 通常跟前端 Sheet 更新較同步，所以如果已經有 GoogleFinance VIX，就不讓 FinMind Market 覆蓋主欄位。
      // FinMind Market 的 VIX 仍保留在 finmindVixChange1d，作資料驗證與備援。
      if (derived.vixChange1d !== null && derived.vixChange1d !== undefined) {
        applyDefinedNumber(next, "finmindVixChange1d", derived.vixChange1d);
        next.finmindVixChange1dSource = sourceName;

        const hasGoogleVix =
          next.vixChange1dSource === "GoogleFinance" &&
          next.vixChange1d !== null &&
          next.vixChange1d !== undefined &&
          Number.isFinite(Number(next.vixChange1d));

        if (hasGoogleVix) {
          const reconciledGoogleVix = reconcileVixPercentPointWithReference(next.vixChange1d, derived.vixChange1d);
          if (reconciledGoogleVix !== null && reconciledGoogleVix !== undefined) {
            applyDefinedNumber(next, "vixChange1d", reconciledGoogleVix);
          }
        } else {
          applyDefinedNumber(next, "vixChange1d", derived.vixChange1d);
          next.vixChange1dSource = sourceName;
        }
      }

      applyDefinedNumber(next, "us10yYield", us10y?.value);
      applyDefinedNumber(next, "usdTwd", usd?.value);
      applyDefinedNumber(next, "jpyTwd", jpy?.value);
      applyDefinedNumber(next, "wtiOil", wti?.value);
      applyDefinedNumber(next, "goldPrice", gold?.value);
      applyDefinedNumber(next, "fedRate", fedRate?.value);

      [
        "sp500Return1d",
        "dowReturn1d",
        "us10yYield",
        "usdTwd",
        "jpyTwd",
        "wtiOil",
        "goldPrice",
        "fedRate",
      ].forEach((key) => {
        if (next[key] !== null && next[key] !== undefined) next[`${key}Source`] = sourceName;
      });

      next.marketSourceNote = "FinMind Market";
      return next;
    });
  }

  function mergeDerivativesToStocks(currentStocks, derivativesPayload) {
    const derived = derivativesPayload?.derived || {};
    const futures = derivativesPayload?.futures || {};
    const futuresInstitutional = derivativesPayload?.futuresInstitutional || {};
    const options = derivativesPayload?.options || {};
    const optionInstitutional = derivativesPayload?.optionInstitutional || {};

    return currentStocks.map((stock) => {
      const next = { ...stock };
      const sourceName = "FinMind Derivatives";

      applyDefinedNumber(next, "taifexAfterHoursReturn", derived.taifexAfterHoursReturn);
      applyDefinedNumber(next, "futuresSpreadPer", derived.futuresSpreadPer);
      applyDefinedNumber(next, "futuresInstitutionalNetAmount", derived.futuresInstitutionalNetAmount);
      applyDefinedNumber(next, "futuresInstitutionalNetVolume", derived.futuresInstitutionalNetVolume);
      applyDefinedNumber(next, "futuresOpenInterestNetAmount", derived.futuresOpenInterestNetAmount);
      applyDefinedNumber(next, "putCallVolumeRatio", derived.putCallVolumeRatio);
      applyDefinedNumber(next, "putCallOpenInterestRatio", derived.putCallOpenInterestRatio);
      applyDefinedNumber(next, "optionInstitutionalNetBias", derived.optionInstitutionalNetBias);
      applyDefinedNumber(next, "futuresClose", futures.close);
      applyDefinedNumber(next, "futuresVolume", futures.volume);
      applyDefinedNumber(next, "futuresOpenInterest", futures.openInterest);
      applyDefinedNumber(next, "txInstitutionalNetAmount", futuresInstitutional.txInstitutionalNetAmount);
      applyDefinedNumber(next, "txInstitutionalNetVolume", futuresInstitutional.txInstitutionalNetVolume);
      applyDefinedNumber(next, "optionCallVolume", options.optionCallVolume);
      applyDefinedNumber(next, "optionPutVolume", options.optionPutVolume);
      applyDefinedNumber(next, "optionInstitutionalNetBias", optionInstitutional.optionInstitutionalNetBias);

      [
        "taifexAfterHoursReturn",
        "futuresSpreadPer",
        "futuresInstitutionalNetAmount",
        "futuresInstitutionalNetVolume",
        "futuresOpenInterestNetAmount",
        "putCallVolumeRatio",
        "putCallOpenInterestRatio",
        "optionInstitutionalNetBias",
        "futuresClose",
        "futuresVolume",
        "futuresOpenInterest",
        "txInstitutionalNetAmount",
        "txInstitutionalNetVolume",
        "optionCallVolume",
        "optionPutVolume",
      ].forEach((key) => {
        if (next[key] !== null && next[key] !== undefined) next[`${key}Source`] = sourceName;
      });

      next.derivativesSourceNote = "FinMind Derivatives";
      return next;
    });
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
    apiConfig.yahooOhlcvProxyUrl,
    apiConfig.yahooEtfProxyUrl,
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

  async function loadTwseOpenApi(symbolOverride = null) {
    const source = "twse_proxy";
    const policy = getSourcePolicy(source);
    const refresh = canRefreshSource(lastFetchMap, source, policy.cooldownMs);
    if (!refresh.ok) { setApiMessage(`TWSE 冷卻中：${refresh.remainSec} 秒`); return; }
    setApiLoading(true);
    setApiMessage("讀取中...");
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
      setApiMessage(`${mode === "twse_proxy" ? "TWSE Proxy" : "TWSE CORS 備援"} 成功：${twseRows.length} 檔，比對來源已更新`);
    } catch (error) {
      setApiMessage(`TWSE 失敗：${error.message}`);
    } finally {
      setApiLoading(false);
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
      const timePreview = rows.slice(0, 3).map((row) => `${row.symbol}:${row.tradetime || "-"}`).join(" / ");

      setLastFetchMap((prev) => markSourceFetched(prev, source));

      if (auto && !hasNewTradeTime) {
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
        if (hasNewTradeTime) setApiMessage(`行情自動刷新｜${timePreview || `${rows.length} 檔`}${officialEtfNote}`);
      } else {
        setApiMessage(`盤中價量成功：${rows.length} 檔；已更新主畫面 price / volume${timePreview ? `（${timePreview}）` : ""}${officialEtfNote}`);
      }
      return { ok: true, count: rows.length, hasNewTradeTime, officialEtfNote };
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
      setStocks((prev) => mergeMarketToStocks(prev, market));
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
      setStocks((prev) => mergeDerivativesToStocks(prev, derivatives));
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

  return (
    <div className="min-h-screen bg-slate-50 p-3 text-[15px] text-slate-900"><div className="mx-auto max-w-7xl space-y-3">
      <div><h1 className="text-3xl font-bold tracking-tight">股票短中長分析 App — V1</h1><p className="text-[15px] text-slate-500 mt-1">先做全部股票 / ETF 總覽，再點進單檔細節。短線 V1 維持原三大面向，並加入停損閘門；中線與長線公式尚未啟用。</p></div>
      <AddAssetForm value={newAsset} onChange={setNewAsset} onAdd={addAsset} error={addError} />
      <OverviewTable rows={overviewRows} selected={selected} onSelect={setSelected} onInsight={(symbol, horizon) => { setSelected(symbol); setInsightTarget({ symbol, horizon }); }} onRemove={removeAsset} dataMode={dataMode} lastFetchMap={lastFetchMap} marketIndex={marketIndex} />
      <InsightPanel insight={activeInsight} />
      <Tabs defaultValue="short" className="space-y-3"><TabsList className="grid w-full grid-cols-5 rounded-xl p-1.5"><TabsTrigger value="short" className="py-2.5">短線V1</TabsTrigger><TabsTrigger value="mid" className="py-2.5">中線V1</TabsTrigger><TabsTrigger value="long" className="py-2.5">長線V1</TabsTrigger><TabsTrigger value="sources" className="py-2.5">資料源</TabsTrigger><TabsTrigger value="validate" className="py-2.5">資料驗證</TabsTrigger></TabsList>
        <TabsContent value="short"><FrameworkTable title="圖片版短線評分表" subtitle={getShortFrameworkSubtitle(current)} result={shortV1} showScore horizon="short" onWeightChange={updateWeight} onResetHorizon={resetHorizonWeights} stock={current} /><div className="grid gap-3 md:grid-cols-3 mt-3">{getShortDisplayDimensions(shortV1.dimensions, current).map((dim) => <DimensionScoreCard key={dim.dimension} dim={dim} />)}</div></TabsContent>
        <TabsContent value="mid"><FrameworkTable title="中線 V1 架構表" subtitle={getFrameworkAnalysis("中線", midV1)} result={midV1} showScore horizon="mid" onWeightChange={updateWeight} onResetHorizon={resetHorizonWeights} /></TabsContent>
        <TabsContent value="long"><FrameworkTable title="長線 V1 架構表" subtitle={getFrameworkAnalysis("長線", longV1)} result={longV1} showScore horizon="long" onWeightChange={updateWeight} onResetHorizon={resetHorizonWeights} /></TabsContent>
        <TabsContent value="sources"><div className="space-y-4"><SourceConnectorTable config={apiConfig} onConfigChange={setApiConfig} onSmartRefresh={runSmartRefresh} onLoadGoogle={loadGoogleCsv} onLoadFinMind={loadFinMindProxy} onLoadTwse={loadTwseOpenApi} onLoadTwseMis={loadTwseMisVolume} onLoadMarket={loadFinMindMarket} onLoadDerivatives={loadFinMindDerivatives} onLoadYahoo={loadYahooOhlcv} onLoadYahooEtf={loadYahooEtf} onLoadOfficialEtfInav={loadOfficialEtfInav} loading={apiLoading} apiMessage={apiMessage} lastFetchMap={lastFetchMap} sourceRuntimeMap={sourceRuntimeMap} stocks={stocks} googleDebug={googleDebug} /><Card className="rounded-xl shadow-sm"><CardContent className="p-3 space-y-3"><h3 className="font-semibold flex items-center gap-2"><Icon name="doc" /> 資料來源角色總覽</h3><div className="rounded-lg border bg-slate-50 p-3 text-xs leading-6 text-slate-600"><div className="font-semibold text-slate-900">資料原則</div><div>資料源依即時區、非即時資料區、救援區管理。TWSE MIS / ETF iNAV / GoogleFinance 負責盤中與即時輔助；TWSE OpenAPI / FinMind 負責盤後、技術、籌碼與風險資料；Yahoo OHLCV / ETF 只作備援與抽樣驗證。FinMind Minute 已移除，不再使用。</div></div><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[1050px] text-sm"><thead className="bg-white"><tr className="border-b text-left text-slate-500"><th className="w-[130px] py-2">來源</th><th className="w-[170px]">Dataset / API</th><th>主要欄位</th><th>使用方式</th><th className="w-[220px]">角色</th></tr></thead><tbody>{sourceRoleOverviewGroups.map((group) => <React.Fragment key={group.title}><tr className={`${group.tone} border-b`}><td colSpan={5} className="px-2 py-2 text-xs font-semibold"><div>{group.title}</div><div className="mt-0.5 font-normal">{group.description}</div></td></tr>{group.items.map((item) => <tr key={item.aspect} className="border-b last:border-0 align-top"><td className="py-2 font-medium">{item.aspect}</td><td className="text-slate-600">{item.datasets}</td><td className="text-slate-600">{item.fields}</td><td className="text-slate-500">{item.calcNote}</td><td className="text-slate-500"><div>短：{item.shortRole}</div><div>中：{item.midRole}</div><div>長：{item.longRole}</div></td></tr>)}</React.Fragment>)}</tbody></table></div></CardContent></Card></div></TabsContent>
        <TabsContent value="validate">{(() => { const validationRows = getSourceValidationRows(selected, current, validationMap); const validationState = getValidationState(validationRows); const groupedRows = validationGroupRows(validationRows); return <Card className="rounded-xl shadow-sm"><CardContent className="p-3 space-y-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold flex items-center gap-2"><Icon name="doc" /> 資料驗證</h3><p className="text-sm text-slate-500 mt-2">即時與歷史資料分區；盤中 price / volume 以 TWSE MIS 為主，GoogleFinance 輔助參考。</p></div><div className="flex flex-wrap gap-2"><Badge className={validationState.tone}>{validationState.label}</Badge><Badge className="bg-slate-100 text-slate-700">通過 {validationState.passed}｜需查 {validationState.failed}｜缺資料 {validationState.missing}</Badge></div></div><div className="rounded-xl bg-white border p-3 text-sm text-slate-700"><span className="font-medium text-slate-900">驗證結論：</span>{validationSummary(validationRows)}</div><div className="max-h-[360px] overflow-y-scroll overflow-x-auto rounded-xl border border-slate-200 bg-white pr-1 [scrollbar-gutter:stable]"><table className="w-full min-w-[1060px] text-sm"><thead className="sticky top-0 z-10 bg-white"><tr className="border-b text-left text-slate-500"><th className="w-[190px] py-2">項目</th><th className="w-[165px]">主來源</th><th className="w-[115px]">主值</th><th className="w-[135px]">驗證來源</th><th className="w-[115px]">驗證值</th><th className="w-[80px]">偏差</th><th className="w-[80px]">容忍</th><th className="w-[88px]">狀態</th><th>短註</th></tr></thead><tbody>{groupedRows.map(({ group, rows }) => <React.Fragment key={group}><tr className="bg-slate-50"><td colSpan={9} className="px-2 py-2 text-xs font-semibold text-slate-700">{group}</td></tr>{rows.map((row) => <tr key={`${group}-${row.label}`} className="border-b last:border-0 align-top"><td className="py-2 pr-2 font-medium text-slate-900">{row.label}</td><td className="max-w-[165px] pr-2 text-xs text-slate-500">{row.currentSource}</td><td className="pr-2">{displayValue(row.finmindValue)}</td><td className="max-w-[135px] pr-2 text-xs text-slate-500">{row.compareSource}</td><td className="pr-2">{displayValue(row.googleValue)}</td><td className="pr-2">{validationDiffText(row)}</td><td className="pr-2">{validationToleranceText(row)}</td><td className="pr-2"><Badge className={validationStatusClass(row.status)}>{row.status}</Badge></td><td className="max-w-[260px] text-xs leading-5 text-slate-500">{compactValidationNote(row)}</td></tr>)}</React.Fragment>)}</tbody></table></div><div className="rounded-xl border bg-slate-50 p-3 text-xs leading-5 text-slate-600">驗證層只檢查資料口徑，不覆蓋主資料、不參與評分。盤中 price / volume 以 TWSE MIS 為主；ETF 折溢價以即時估值欄位作輔助判斷。歷史與盤後資料需先對齊日期，不同日期不判失敗。</div></CardContent></Card>; })()}</TabsContent>
      </Tabs>
    </div></div>
  );
}