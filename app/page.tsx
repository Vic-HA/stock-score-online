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
const DEFAULT_GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTwI6HZIQcKRt3H9MCDW4kRynUlkMtR1KnzUYpGpXMhNErX-LrO3ejwbJ7hD9R_BfaOXtCaSo6nhhf_/pub?output=csv";
const DEFAULT_FINMIND_PROXY_URL = "/api/finmind/stocks";
const DEFAULT_FINMIND_MARKET_PROXY_URL = "/api/finmind/market";
const DEFAULT_FINMIND_DERIVATIVES_PROXY_URL = "/api/finmind/derivatives";
const DEFAULT_TWSE_PROXY_URL = ["", "api", "twse", "stocks"].join("/");
const TWSE_STOCK_DAY_ALL_URL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
const TWSE_BWIBBU_ALL_URL = "https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL";
const CORS_PROXY_RAW_URL = "https://api.allorigins.win/raw?url=";
const SOURCE_REFRESH_POLICY = {
  google_csv: {
    label: "GoogleFinance 較新行情",
    timeoutMs: 15000,
    cooldownMs: 10 * 1000,
    autoRefreshMs: 20 * 1000,
    cacheNote: "主畫面較新行情來源；前端每 20 秒重新讀取 CSV，手動讀取 10 秒內不重抓。欄位：price / prevClose / volume / PER / EPS / Nasdaq / SOX / VIX / updatedAt。",
  },
  twse_proxy: {
    label: "TWSE",
    timeoutMs: 15000,
    cooldownMs: 60 * 1000,
    autoRefreshMs: 3 * 60 * 60 * 1000,
    cacheNote: "官方盤後 / 官方校正資料；自動每 3 小時刷新一次，手動讀取 60 秒內不重抓。欄位：official price / prevClose / volume / PER / PBR / 殖利率。",
  },
  finmind_proxy: {
    label: "FinMind",
    timeoutMs: 25000,
    cooldownMs: 30 * 60 * 1000,
    autoRefreshMs: 60 * 60 * 1000,
    cacheNote: "非即時技術資料；保守期自動每 60 分鐘，手動 30 分鐘內不重抓。欄位：ma5 / ma20 / ma60 / rsi14 / high20 / low20 / avgVolume20 / return20d / return60d。",
  },
  finmind_market: {
    label: "FinMind Market",
    timeoutMs: 20000,
    cooldownMs: 5 * 60 * 1000,
    autoRefreshMs: 10 * 60 * 1000,
    cacheNote: "國際市場補資料；抓 Nasdaq / SOX / S&P500 / VIX / 匯率 / 美債 / 原油 / 黃金。建議 5～15 分鐘刷新。",
  },
  finmind_derivatives: {
    label: "FinMind Derivatives",
    timeoutMs: 20000,
    cooldownMs: 15 * 60 * 1000,
    autoRefreshMs: 30 * 60 * 1000,
    cacheNote: "衍生性商品補資料；抓台指期、期貨法人、選擇權 Put/Call。建議 15～30 分鐘刷新。",
  },
  finmind_minute: {
    label: "FinMind Minute（未啟用）",
    timeoutMs: 15000,
    cooldownMs: 180 * 1000,
    autoRefreshMs: 0,
    maxSymbols: 10,
    cacheNote: "目前 free level 無權限，已停用自動觸發。",
  },
};
const DEFAULT_FETCH_TIMEOUT_MS = 8000;
const DEFAULT_REFRESH_COOLDOWN_MS = 60000;

const initialStocks = [
  createAssetTemplate({ symbol: "2330", name: "台積電", type: "股票", market: "TWSE" }),
  createAssetTemplate({ symbol: "0050", name: "元大台灣50", type: "ETF", market: "TWSE" }),
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
    { name: "FinMind API", role: "Daily 技術補資料 / 備援", status: config.finmindProxyUrl ? "可測試" : "待接 proxy", fields: "技術、PER/PBR/殖利率比對、三大法人、融資融券、月營收、財報、資產負債", method: "前端呼叫自己的 proxy，不直接放 FinMind token；Daily 只補技術欄位，不覆蓋 Google/TWSE 行情與估值主資料，TaiwanStockPER 僅作比對。" },
    { name: "GoogleFinance", role: "較新行情 / 主畫面行情", status: config.googleCsvUrl ? "可測試" : "待填公開 CSV URL", fields: "price、prevClose、volume、PER、EPS、Nasdaq、SOX、VIX、updatedAt、sourceNote；MA5/MA20 可作技術輔助比對", method: "前端只貼 CSV URL；App 走 /api/google/verify 讀取。Google 作較新行情來源，讀取成功後可更新總覽行情欄位。" },
    { name: "TWSE OpenAPI", role: "官方盤後 / 官方校正", status: config.twseProxyUrl ? "可測試" : "需 proxy", fields: "官方 price、prevClose、volume、PER、PBR、殖利率", method: "預設走 /api/twse/stocks proxy；免費免 token，作官方校正與盤後基準。" },
  ];
}

const finmindAspectPlan = [
  {
    aspect: "GoogleFinance",
    datasets: "Google Sheet CSV / GOOGLEFINANCE",
    fields: "price、prevClose、volume、PER、EPS、Nasdaq、SOX、VIX、updatedAt",
    calcNote: "主畫面較新行情來源；Google Sheet 自身更新後，前端重新讀取 CSV 讓總覽跟著更新。",
    verifyRef: "TWSE OpenAPI 作官方盤後校正；FinMind Minute 作 Google 抓不到或不穩時的分鐘備援。",
    shortRole: "短線主行情來源。",
    midRole: "中線行情參考。",
    longRole: "長線不作唯一依據。"
  },
  {
    aspect: "TWSE OpenAPI",
    datasets: "STOCK_DAY_ALL / BWIBBU_ALL",
    fields: "官方 price、prevClose、volume、PER、PBR、殖利率",
    calcNote: "免費、免 token、官方盤後 / 官方校正資料；不追逐秒即時，作官方基準。",
    verifyRef: "GoogleFinance 較新行情可比對價量；FinMind Daily 不覆蓋官方估值。",
    shortRole: "官方校正。",
    midRole: "估值與盤後基準。",
    longRole: "PER / PBR / 殖利率基準。"
  },
  {
    aspect: "FinMind Daily",
    datasets: "TaiwanStockPrice",
    fields: "技術、PER/PBR/殖利率比對、三大法人、融資融券、月營收、財報、資產負債",
    calcNote: "非即時技術補資料；保守期低頻刷新，只補技術欄位，不覆蓋 Google/TWSE 的 price、volume、PER/PBR/殖利率。FinMind TaiwanStockPER 僅進比對層。",
    verifyRef: "GoogleFinance MA5/MA20 可輔助比對；TWSE 提供官方當日價量基準。",
    shortRole: "技術分數來源。",
    midRole: "趨勢資料來源。",
    longRole: "長線趨勢輔助。"
  },
  {
    aspect: "FinMind Minute",
    datasets: "TaiwanStockPriceMinute",
    fields: "分鐘 close / volume / date-time",
    calcNote: "分鐘級近即時備援；最多 10 檔，每 180 秒刷新，用於 GoogleFinance 不穩、延遲或抓不到時。",
    verifyRef: "不取代 Google 主行情；只作備援與盤中輔助。",
    shortRole: "近即時備援。",
    midRole: "通常不使用。",
    longRole: "不使用。"
  },
  {
    aspect: "暫不使用 / 後續",
    datasets: "法人、融資、月營收、財報三表、TAIFEX",
    fields: "foreign3d、trust3d、dealer3d、marginChange、revenue、EPS 成長、TAIFEX",
    calcNote: "這些欄位暫不讓 FinMind 高頻觸發；之後確認免費官方來源或必要性後再接。",
    verifyRef: "優先找 TWSE / TPEx / MOPS / TAIFEX 官方免費來源。",
    shortRole: "暫不計分。",
    midRole: "後續擴充。",
    longRole: "後續擴充。"
  },
];

const DEFAULT_WEIGHT_CONFIG = {
  short: {
    ma5: 0.15,
    ma20: 0.15,
    rsi: 0.1,
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

const WEIGHT_SECTIONS = [
  { horizon: "short", title: "短線權重", note: "保守版：市場面拆成美股科技風向與隔夜風險，衍生性金融商品獨立低權重 0.05。" },
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
  futuresVix: "隔夜風險",
  derivativesData: "期權風險",
  fundamentalsData: "基本面資料確認",
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
const roundScore = (value) => Number(clamp(value, 0, 1).toFixed(2));
const linearScore = (value, min, max) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (max === min) return n >= max ? 1 : 0;
  return roundScore((n - min) / (max - min));
};

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

  if (Number.isFinite(Number(putCallVolumeRatio))) {
    const value = Number(putCallVolumeRatio);
    if (value <= 0.9) parts.push(1);
    else if (value <= 1.05) parts.push(0.8);
    else if (value <= 1.2) parts.push(0.6);
    else if (value <= 1.5) parts.push(0.35);
    else parts.push(0.1);
  }

  if (Number.isFinite(Number(putCallOpenInterestRatio))) {
    const value = Number(putCallOpenInterestRatio);
    if (value <= 0.9) parts.push(1);
    else if (value <= 1.05) parts.push(0.8);
    else if (value <= 1.2) parts.push(0.6);
    else if (value <= 1.5) parts.push(0.35);
    else parts.push(0.1);
  }

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
      ? "PutCall 偏多/避險低"
      : pc <= 1.05
        ? "PutCall 中性"
        : pc <= 1.2
          ? "PutCall 小幅偏高"
          : pc <= 1.5
            ? "PutCall 偏高"
            : "PutCall 明顯偏高"
    : "PutCall 待接";

  const pcOiLabel = Number.isFinite(pcOi)
    ? pcOi <= 0.9
      ? "PutCall OI 偏多"
      : pcOi <= 1.05
        ? "PutCall OI 中性"
        : pcOi <= 1.2
          ? "PutCall OI 小幅偏高"
          : pcOi <= 1.5
            ? "PutCall OI 偏高"
            : "PutCall OI 明顯偏高"
    : "PutCall OI 待接";

  const futuresLabel = Number.isFinite(futuresNet)
    ? futuresNet > 10000000
      ? "期貨法人明顯偏多"
      : futuresNet > 0
        ? "期貨法人偏多"
        : futuresNet > -10000000
          ? "期貨法人小幅偏空"
          : "期貨法人偏空"
    : "期貨法人待接";

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
  return { symbol: normalizedSymbol, name: String(name || normalizedSymbol || "新標的").trim(), type: normalizedType, market: market || "TWSE", price: 0, prevClose: 0, high20: 0, low20: 0, volume: 0, avgVolume20: 0, ma5: 0, ma20: 0, ma60: 0, rsi14: 50, return20d: 0, return60d: 0, nasdaqReturn1d: 0, soxReturn1d: 0, taifexAfterHoursReturn: 0, vixChange1d: 0, foreign3d: 0, trust3d: 0, dealer3d: 0, foreign20d: 0, trust20d: 0, marginChange5dPct: 0, marginChange20dPct: 0, revenueYoY: 0, revenueMoM: 0, epsGrowthYoY: 0, eps: 0, grossMargin: 0, operatingMargin: 0, roe: 0, debtRatio: 0, per: 0, pbr: 0, dividendYield: 0 };
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

function applyDefinedNumber(target, key, value) {
  if (value !== null && value !== undefined && Number.isFinite(Number(value))) {
    target[key] = Number(value);
  }
}

function mergeGoogleQuotesBySymbol(currentStocks, incomingGoogleRows) {
  const map = new Map(currentStocks.map((stock) => [normalizeStockSymbol(stock.symbol), stock]));

  incomingGoogleRows.forEach((item) => {
    const symbol = normalizeStockSymbol(item.symbol);
    const previous = map.get(symbol);
    if (!previous) return;

    const next = { ...previous };
    const payload = item.google || {};
    const google = payload.google || payload;
    const sourceName = "GoogleFinance";

    applyDefinedNumber(next, "price", google.price);
    applyDefinedNumber(next, "prevClose", google.prevClose);
    applyDefinedNumber(next, "volume", google.volume);
    applyDefinedNumber(next, "per", google.per);
    applyDefinedNumber(next, "eps", google.eps);
    applyDefinedNumber(next, "ma5", google.ma5);
    applyDefinedNumber(next, "ma20", google.ma20);
    applyDefinedNumber(next, "rsi14", google.rsi14);
    applyDefinedNumber(next, "foreign3d", google.foreign3d);
    applyDefinedNumber(next, "trust3d", google.trust3d);
    applyDefinedNumber(next, "dealer3d", google.dealer3d);
    applyDefinedNumber(next, "marginChange5dPct", google.marginChange5dPct);
    applyDefinedNumber(next, "nasdaqReturn1d", google.nasdaqReturn1d);
    applyDefinedNumber(next, "soxReturn1d", google.soxReturn1d);
    applyDefinedNumber(next, "taifexAfterHoursReturn", google.taifexAfterHoursReturn);
    applyDefinedNumber(next, "vixChange1d", google.vixChange1d);

    if (google.price !== null && google.price !== undefined) next.priceSource = sourceName;
    if (google.prevClose !== null && google.prevClose !== undefined) next.prevCloseSource = sourceName;
    if (google.volume !== null && google.volume !== undefined) next.volumeSource = sourceName;
    if (google.per !== null && google.per !== undefined) next.perSource = sourceName;
    if (google.eps !== null && google.eps !== undefined) next.epsSource = sourceName;
    if (google.ma5 !== null && google.ma5 !== undefined) next.ma5Source = sourceName;
    if (google.ma20 !== null && google.ma20 !== undefined) next.ma20Source = sourceName;
    if (google.rsi14 !== null && google.rsi14 !== undefined) next.rsi14Source = sourceName;
    if (google.foreign3d !== null && google.foreign3d !== undefined) next.foreign3dSource = sourceName;
    if (google.trust3d !== null && google.trust3d !== undefined) next.trust3dSource = sourceName;
    if (google.dealer3d !== null && google.dealer3d !== undefined) next.dealer3dSource = sourceName;
    if (google.marginChange5dPct !== null && google.marginChange5dPct !== undefined) next.marginChange5dPctSource = sourceName;
    if (google.nasdaqReturn1d !== null && google.nasdaqReturn1d !== undefined) next.nasdaqReturn1dSource = sourceName;
    if (google.soxReturn1d !== null && google.soxReturn1d !== undefined) next.soxReturn1dSource = sourceName;
    if (google.taifexAfterHoursReturn !== null && google.taifexAfterHoursReturn !== undefined) next.taifexAfterHoursReturnSource = sourceName;
    if (google.vixChange1d !== null && google.vixChange1d !== undefined) next.vixChange1dSource = sourceName;

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
      prevClose: row.prevClose ?? row.previous_close ?? row.prev_close ?? null,
      volume: row.volume ?? row.Trading_Volume ?? row.TradeVolume ?? row["成交股數"] ?? null,
      per: row.per ?? row.PER ?? row.PEratio ?? row["本益比"] ?? null,
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
      updatedAt: row.updatedAt ?? row.date ?? null,
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

function mergeSourceMap(prevMap, sourceMap) {
  const next = { ...prevMap };
  Object.entries(sourceMap || {}).forEach(([symbol, sourcePayload]) => {
    next[symbol] = { ...(next[symbol] || {}), ...sourcePayload };
  });
  return next;
}

function mergeTwseOfficialBySymbol(currentStocks, incomingTwseRows) {
  const map = new Map(currentStocks.map((stock) => [normalizeStockSymbol(stock.symbol), stock]));

  incomingTwseRows.forEach((incoming) => {
    const symbol = normalizeStockSymbol(incoming.symbol || incoming.stock_id);
    const previous = map.get(symbol);
    if (!previous) return;

    const next = { ...previous };
    const sourceName = "TWSE";

    // GoogleFinance 若已是主行情，不用 TWSE 盤後資料覆蓋主畫面行情。
    const keepGoogleQuote = next.priceSource === "GoogleFinance";

    if (!keepGoogleQuote) {
      applyDefinedNumber(next, "price", incoming.price);
      applyDefinedNumber(next, "prevClose", incoming.prevClose);
      applyDefinedNumber(next, "volume", incoming.volume);
      if (incoming.price !== null && incoming.price !== undefined) next.priceSource = sourceName;
      if (incoming.prevClose !== null && incoming.prevClose !== undefined) next.prevCloseSource = sourceName;
      if (incoming.volume !== null && incoming.volume !== undefined) next.volumeSource = sourceName;
    }

    // 官方估值欄位可由 TWSE 補，但 PER 若 Google 已有，就保留 Google 作主欄位，TWSE 進比對來源。
    if (!(next.perSource === "GoogleFinance")) {
      applyDefinedNumber(next, "per", incoming.per);
      if (incoming.per !== null && incoming.per !== undefined) next.perSource = sourceName;
    }

    applyDefinedNumber(next, "pbr", incoming.pbr);
    applyDefinedNumber(next, "dividendYield", incoming.dividendYield);
    if (incoming.pbr !== null && incoming.pbr !== undefined) next.pbrSource = sourceName;
    if (incoming.dividendYield !== null && incoming.dividendYield !== undefined) next.dividendYieldSource = sourceName;

    if (incoming.updatedAt) next.twseUpdatedAt = incoming.updatedAt;
    next.officialSourceNote = incoming.sourceNote || sourceName;

    map.set(symbol, next);
  });

  return Array.from(map.values());
}

function mergeFinMindDailyBySymbol(currentStocks, incomingFinMindRows) {
  const map = new Map(currentStocks.map((stock) => [normalizeStockSymbol(stock.symbol), stock]));

  incomingFinMindRows.forEach((incoming) => {
    const symbol = normalizeStockSymbol(incoming.symbol || incoming.stock_id);
    const previous = map.get(symbol);
    if (!previous) return;

    const next = { ...previous };
    const sourceName = "FinMind";

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
      "per",
      "pbr",
      "dividendYield",
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
      "grossMargin",
      "operatingMargin",
      "totalAssets",
      "totalLiabilities",
      "equity",
      "debtRatio",
    ];

    fields.forEach((key) => {
      applyDefinedNumber(next, key, incoming[key]);
      if (incoming[key] !== null && incoming[key] !== undefined) next[`${key}Source`] = sourceName;
    });

    if (incoming.updatedAt) next.finmindUpdatedAt = incoming.updatedAt;
    if (incoming.datasetStatus) next.finmindDatasetStatus = incoming.datasetStatus;
    if (incoming.rawCounts) next.finmindRawCounts = incoming.rawCounts;
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
  if (source === "finmind") return "FinMind";
  if (source === "pending_finmind_minute") return "待接 FinMind Minute";
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
  let status = options.noCompare ? "不比對" : "無法取得";

  if (!options.noCompare && hasCurrent && hasCompare) {
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
    status = "無法取得";
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

function normalizePercentCompareValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  // GoogleFinance / Sheet 常用 0.0202 代表 2.02%，FinMind Market 則已是 2.02。
  // 比對表統一換成百分點，避免出現 2.02 vs 0.02 的假警報。
  if (Math.abs(n) > 0 && Math.abs(n) < 1) return Number((n * 100).toFixed(4));
  return n;
}

function getSourceValidationRows(symbol, stock, validationMap = {}) {
  const main = stock || {};
  const noCompare = "尚無比對來源";

  const twsePrevClose = pickCompare(validationMap, symbol, "twse", "prevClose");

  const googleMa5 = pickCompare(validationMap, symbol, "google", "ma5");
  const googleMa20 = pickCompare(validationMap, symbol, "google", "ma20");
  const googleNasdaq = pickCompare(validationMap, symbol, "google", "nasdaqReturn1d");
  const googleSox = pickCompare(validationMap, symbol, "google", "soxReturn1d");
  const googleVix = pickCompare(validationMap, symbol, "google", "vixChange1d");
  const googleTaifex = pickCompare(validationMap, symbol, "google", "taifexAfterHoursReturn");
  const googleNasdaqPct = normalizePercentCompareValue(googleNasdaq.value);
  const googleSoxPct = normalizePercentCompareValue(googleSox.value);
  const googleVixPct = normalizePercentCompareValue(googleVix.value);
  const googleTaifexPct = normalizePercentCompareValue(googleTaifex.value);

  const finPer = pickCompare(validationMap, symbol, "finmind", "per");
  const finPbr = pickCompare(validationMap, symbol, "finmind", "pbr");
  const finDividendYield = pickCompare(validationMap, symbol, "finmind", "dividendYield");

  const finMa5 = pickCompare(validationMap, symbol, "finmind", "ma5");
  const finMa20 = pickCompare(validationMap, symbol, "finmind", "ma20");
  const finMa60 = pickCompare(validationMap, symbol, "finmind", "ma60");
  const finRsi14 = pickCompare(validationMap, symbol, "finmind", "rsi14");
  const finHigh20 = pickCompare(validationMap, symbol, "finmind", "high20");
  const finLow20 = pickCompare(validationMap, symbol, "finmind", "low20");
  const finAvgVolume20 = pickCompare(validationMap, symbol, "finmind", "avgVolume20");
  const finReturn20d = pickCompare(validationMap, symbol, "finmind", "return20d");
  const finReturn60d = pickCompare(validationMap, symbol, "finmind", "return60d");

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
  const finOperatingMargin = pickCompare(validationMap, symbol, "finmind", "operatingMargin");
  const finDebtRatio = pickCompare(validationMap, symbol, "finmind", "debtRatio");

  return [
    compareSourceValue("現價 price", main.price, null, 0.5, "即時行情以 GoogleFinance 主畫面為優先；FinMind Minute 目前 free level 不接，TWSE 是盤後資料所以不拿來硬比即時價。", getFieldSource(main, "price"), getSourceName("none"), { noCompare: true }),
    compareSourceValue("昨收 prevClose", main.prevClose, twsePrevClose.value, 0.2, "昨收不是即時欄位，可以用 TWSE 官方盤後資料比對；若遇除權息或交易日不同再人工檢查。", getFieldSource(main, "prevClose"), twsePrevClose.value !== null ? twsePrevClose.source : noCompare),
    compareSourceValue("成交量 volume", main.volume, null, 3, "盤中成交量與 TWSE 盤後累計量時間點不同，先不比對；FinMind Minute 目前 free level 不接。", getFieldSource(main, "volume"), getSourceName("none"), { noCompare: true }),

    compareSourceValue("本益比 PER", main.per, finPer.value, 10, "PER 口徑容易因即時價格、EPS 口徑與更新時間不同而偏差；比對來源用 FinMind TaiwanStockPER。", getFieldSource(main, "per"), finPer.value !== null ? finPer.source : noCompare),
    compareSourceValue("PBR", main.pbr, finPbr.value, 5, "PBR 目前主要由 TWSE 官方寫入；比對來源用 FinMind TaiwanStockPER.PBR。", getFieldSource(main, "pbr"), finPbr.value !== null ? finPbr.source : noCompare),
    compareSourceValue("殖利率 dividendYield", main.dividendYield, finDividendYield.value, 5, "殖利率目前主要由 TWSE 官方寫入；比對來源用 FinMind TaiwanStockPER.dividend_yield。", getFieldSource(main, "dividendYield"), finDividendYield.value !== null ? finDividendYield.source : noCompare),

    compareSourceValue("EPS", main.eps, finEps.value, 999, "GoogleFinance EPS 與 FinMind 財報 EPS 口徑可能不同：Google 常見為行情估值口徑，FinMind 為財報期 EPS；只列出，不用通過/失敗判斷。", getFieldSource(main, "eps"), finEps.value !== null ? finEps.source : getSourceName("eps_note"), { noCompare: true }),

    compareSourceValue("5MA", main.ma5, googleMa5.value, 1.5, "主資料用 FinMind 技術面；比對來源用 GoogleFinance。短均線會因交易日、更新時間、四捨五入或 Google Sheet 計算區間不同出現小差異，±1.5% 內先視為可接受。", getFieldSource(main, "ma5"), googleMa5.value !== null ? googleMa5.source : noCompare),
    compareSourceValue("20MA", main.ma20, googleMa20.value, 1.5, "主資料用 FinMind 技術面；比對來源用 GoogleFinance。20MA 較穩定，若差異超過 ±1.5% 再檢查交易日或計算區間。", getFieldSource(main, "ma20"), googleMa20.value !== null ? googleMa20.source : noCompare),
    compareSourceValue("60MA", main.ma60, finMa60.value, 1, "FinMind 技術補資料欄位；GoogleFinance CSV 目前未提供 60MA，因此只確認 FinMind 已補入。", getFieldSource(main, "ma60"), finMa60.value !== null ? finMa60.source : noCompare),
    compareSourceValue("RSI14", main.rsi14, finRsi14.value, 1, "FinMind 技術補資料欄位；GoogleFinance CSV 目前未提供 RSI14，因此只確認 FinMind 已補入。", getFieldSource(main, "rsi14"), finRsi14.value !== null ? finRsi14.source : noCompare),
    compareSourceValue("20日高點 high20", main.high20, finHigh20.value, 1, "FinMind 技術補資料欄位；用於停損與區間位置。", getFieldSource(main, "high20"), finHigh20.value !== null ? finHigh20.source : noCompare),
    compareSourceValue("20日低點 low20", main.low20, finLow20.value, 1, "FinMind 技術補資料欄位；用於停損與區間位置。", getFieldSource(main, "low20"), finLow20.value !== null ? finLow20.source : noCompare),
    compareSourceValue("20日均量 avgVolume20", main.avgVolume20, finAvgVolume20.value, 3, "FinMind 技術補資料欄位；用於量能比。", getFieldSource(main, "avgVolume20"), finAvgVolume20.value !== null ? finAvgVolume20.source : noCompare),
    compareSourceValue("20日報酬 return20d", main.return20d, finReturn20d.value, 3, "FinMind 技術補資料欄位。", getFieldSource(main, "return20d"), finReturn20d.value !== null ? finReturn20d.source : noCompare),
    compareSourceValue("60日報酬 return60d", main.return60d, finReturn60d.value, 3, "FinMind 技術補資料欄位。", getFieldSource(main, "return60d"), finReturn60d.value !== null ? finReturn60d.source : noCompare),

    compareSourceValue("外資3日 foreign3d", main.foreign3d, finForeign3d.value, 0.1, "FinMind 三大法人資料。", getFieldSource(main, "foreign3d"), finForeign3d.value !== null ? finForeign3d.source : noCompare),
    compareSourceValue("投信3日 trust3d", main.trust3d, finTrust3d.value, 0.1, "FinMind 三大法人資料。", getFieldSource(main, "trust3d"), finTrust3d.value !== null ? finTrust3d.source : noCompare),
    compareSourceValue("自營商3日 dealer3d", main.dealer3d, finDealer3d.value, 0.1, "FinMind 三大法人資料。", getFieldSource(main, "dealer3d"), finDealer3d.value !== null ? finDealer3d.source : noCompare),
    compareSourceValue("三大法人3日 institutional3d", main.institutional3d, finInstitutional3d.value, 0.1, "FinMind 三大法人合計。", getFieldSource(main, "institutional3d"), finInstitutional3d.value !== null ? finInstitutional3d.source : noCompare),
    compareSourceValue("外資20日 foreign20d", main.foreign20d, finForeign20d.value, 0.1, "FinMind 三大法人資料。", getFieldSource(main, "foreign20d"), finForeign20d.value !== null ? finForeign20d.source : noCompare),
    compareSourceValue("投信20日 trust20d", main.trust20d, finTrust20d.value, 0.1, "FinMind 三大法人資料。", getFieldSource(main, "trust20d"), finTrust20d.value !== null ? finTrust20d.source : noCompare),
    compareSourceValue("自營商20日 dealer20d", main.dealer20d, finDealer20d.value, 0.1, "FinMind 三大法人資料。", getFieldSource(main, "dealer20d"), finDealer20d.value !== null ? finDealer20d.source : noCompare),
    compareSourceValue("三大法人20日 institutional20d", main.institutional20d, finInstitutional20d.value, 0.1, "FinMind 三大法人合計。", getFieldSource(main, "institutional20d"), finInstitutional20d.value !== null ? finInstitutional20d.source : noCompare),

    compareSourceValue("融資5日 marginChange5dPct", main.marginChange5dPct, finMargin5.value, 0.1, "FinMind 融資融券資料。", getFieldSource(main, "marginChange5dPct"), finMargin5.value !== null ? finMargin5.source : noCompare),
    compareSourceValue("融資20日 marginChange20dPct", main.marginChange20dPct, finMargin20.value, 0.1, "FinMind 融資融券資料。", getFieldSource(main, "marginChange20dPct"), finMargin20.value !== null ? finMargin20.source : noCompare),
    compareSourceValue("融券5日 shortSaleChange5dPct", main.shortSaleChange5dPct, finShort5.value, 0.1, "FinMind 融資融券資料。", getFieldSource(main, "shortSaleChange5dPct"), finShort5.value !== null ? finShort5.source : noCompare),
    compareSourceValue("融券20日 shortSaleChange20dPct", main.shortSaleChange20dPct, finShort20.value, 0.1, "FinMind 融資融券資料。", getFieldSource(main, "shortSaleChange20dPct"), finShort20.value !== null ? finShort20.source : noCompare),

    compareSourceValue("月營收 MoM revenueMoM", main.revenueMoM, finRevenueMoM.value, 0.1, "FinMind 月營收資料。ETF 可能無此欄位。", getFieldSource(main, "revenueMoM"), finRevenueMoM.value !== null ? finRevenueMoM.source : noCompare),
    compareSourceValue("月營收 YoY revenueYoY", main.revenueYoY, finRevenueYoY.value, 0.1, "FinMind 月營收資料。ETF 可能無此欄位。", getFieldSource(main, "revenueYoY"), finRevenueYoY.value !== null ? finRevenueYoY.source : noCompare),
    compareSourceValue("EPS 成長 epsGrowthYoY", main.epsGrowthYoY, finEpsGrowth.value, 0.1, "FinMind 財報資料。ETF 可能無此欄位。", getFieldSource(main, "epsGrowthYoY"), finEpsGrowth.value !== null ? finEpsGrowth.source : noCompare),
    compareSourceValue("毛利率 grossMargin", main.grossMargin, finGrossMargin.value, 0.1, "FinMind 財報資料。ETF 可能無此欄位。", getFieldSource(main, "grossMargin"), finGrossMargin.value !== null ? finGrossMargin.source : noCompare),
    compareSourceValue("營益率 operatingMargin", main.operatingMargin, finOperatingMargin.value, 0.1, "FinMind 財報資料。ETF 可能無此欄位。", getFieldSource(main, "operatingMargin"), finOperatingMargin.value !== null ? finOperatingMargin.source : noCompare),
    compareSourceValue("負債比 debtRatio", main.debtRatio, finDebtRatio.value, 0.1, "FinMind 資產負債資料。ETF 可能無此欄位。", getFieldSource(main, "debtRatio"), finDebtRatio.value !== null ? finDebtRatio.source : noCompare),

    compareSourceValue("Nasdaq 一日變化", main.nasdaqReturn1d, googleNasdaqPct, 0.05, "主資料用 FinMind Market；比對來源用 GoogleFinance。兩邊已統一為百分點格式，這類欄位看絕對差距，不看相對誤差。", getFieldSource(main, "nasdaqReturn1d"), googleNasdaqPct !== null ? googleNasdaq.source : noCompare, { compareMode: "abs", toleranceLabel: "±0.05點" }),
    compareSourceValue("SOX 一日變化", main.soxReturn1d, googleSoxPct, 0.05, "主資料用 FinMind Market；比對來源用 GoogleFinance。兩邊已統一為百分點格式，這類欄位看絕對差距，不看相對誤差。", getFieldSource(main, "soxReturn1d"), googleSoxPct !== null ? googleSox.source : noCompare, { compareMode: "abs", toleranceLabel: "±0.05點" }),
    compareSourceValue("台指期盤後 taifexAfterHoursReturn", main.taifexAfterHoursReturn, googleTaifexPct, 0.1, "主資料用 FinMind Derivatives；若 GoogleFinance 有填台指期盤後欄位，會先統一為百分點格式再比對。沒有比對來源時只列主資料，不判定失敗。", getFieldSource(main, "taifexAfterHoursReturn"), googleTaifexPct !== null ? googleTaifex.source : noCompare, { compareMode: "abs", toleranceLabel: "±0.10點" }),
    compareSourceValue("VIX 一日變化", main.vixChange1d, googleVixPct, 0.05, "主資料用 FinMind Market；比對來源用 GoogleFinance。VIX 變動幅度常很小，驗證看百分點絕對差距，不看相對誤差。", getFieldSource(main, "vixChange1d"), googleVixPct !== null ? googleVix.source : noCompare, { compareMode: "abs", toleranceLabel: "±0.05點" }),
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
  if (state.label === "可信") return "可比對欄位皆在容忍範圍內，來源一致性良好。";
  if (state.label === "部分驗證") return `已有 ${state.passed} 項通過驗證，仍有 ${state.missing} 項無法從驗證來源取得；該欄位僅保留主資料，不判定為驗證失敗。`;
  if (state.label === "需檢查") return `有 ${state.failed} 項超過容忍值，需檢查資料日期、單位或除權息口徑；未能確認前不應完全信任該欄位。`;
  return "目前比對來源無法取得可比對欄位；系統先保留既有資料，不判定為失敗。";
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

function hasFinite(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

function dataReady(...values) {
  return values.every((value) => hasFinite(value));
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
      item: "股價相對 5MA（短線動能）",
      source: "不是只看大於小於；用股價相對 5MA 的乖離給 0～1 分。剛站上最健康，偏離太大會因追高風險逐步扣分。",
      weight: weights.ma5,
      score: scorePriceVsMa(stock.price, stock.ma5, { weak: -2, idealLow: 0, idealHigh: 4, overheat: 10 }),
      rule: `現價 ${number(stock.price)} / 5MA ${number(stock.ma5)} / 乖離 ${pct(ma5Diff)}`,
      status: weights.ma5 > 0 ? "計分" : "資料確認，不計分"
    },
    {
      weightKey: "ma20",
      dimension: "技術面",
      item: "股價相對 20MA（波段支撐）",
      source: "20MA 是波段支撐與乖離風險判斷。0～5% 是最健康區間；5～12% 仍偏多但逐步扣分；超過 12% 視為追高風險，不再給滿分。",
      weight: weights.ma20,
      score: scorePriceVsMa(stock.price, stock.ma20, { weak: -3, idealLow: 0, idealHigh: 5, overheat: 12 }),
      rule: `現價 ${number(stock.price)} / 20MA ${number(stock.ma20)} / 乖離 ${pct(ma20Diff)}`,
      status: weights.ma20 > 0 ? "計分" : "資料確認，不計分"
    },
    {
      weightKey: "rsi",
      dimension: "技術面",
      item: "RSI(14) 動能溫度",
      source: "RSI 不是越低越好也不是越高越好。45～65 視為健康動能；65～70 偏熱但可接受；70 以上開始扣分，30 以下代表弱勢或急跌也不直接滿分。",
      weight: weights.rsi,
      score: scoreRsiShort(stock.rsi14),
      rule: `RSI ${Number(stock.rsi14 || 0).toFixed(1)}；健康區間 45～65`,
      status: weights.rsi > 0 ? "計分" : "資料確認，不計分"
    },
    {
      weightKey: "institutional3d",
      dimension: "籌碼面",
      item: "三大法人 3 日合計",
      source: "不能只看絕對張數，會被大型股放大。新版用三大法人 3 日合計 ÷ 20 日均量標準化：0～0.5% 是小買超，0.5～2% 普通偏多，2～5% 明顯偏多，5% 以上強買。若外資賣、投信買，最多只給普通偏多；若均量尚未補到，先退回方向判斷，避免資料未進來時誤判。",
      weight: weights.institutional3d,
      score: institutionalScore,
      rule: `外資 ${number(stock.foreign3d)} / 投信 ${number(stock.trust3d)} / 自營商 ${number(stock.dealer3d)} / 合計 ${number(d.institutional3d)} / 20日均量 ${number(stock.avgVolume20)} / 占比 ${institutionalFlow.ratio === null ? "待補" : pct(institutionalFlow.ratio)}`,
      status: weights.institutional3d > 0 ? "計分" : "資料確認，不計分"
    },
    {
      weightKey: "margin5d",
      dimension: "籌碼面",
      item: "融資 5 日風險",
      source: "融資快速增加代表散戶槓桿升溫，短線容易形成籌碼壓力。融券快速增加代表空方或避險升溫，不一定絕對看空，但會降低短線分數；此項以融資 75%、融券 25% 加權。",
      weight: weights.margin5d,
      score: marginScore,
      rule: `融資5日 ${pct(stock.marginChange5dPct)} / 融券5日 ${pct(stock.shortSaleChange5dPct)}`,
      status: weights.margin5d > 0 ? "計分" : "資料確認，不計分"
    },
    {
      weightKey: "usMarket",
      dimension: "市場面",
      item: "美股科技風向",
      source: "台股短線容易受 Nasdaq 與 SOX 影響。兩者都漲且平均漲幅夠強給高分；只有一個轉強給中等分；雙雙轉弱扣分。",
      weight: weights.usMarket,
      score: usScore,
      rule: `Nasdaq ${pct(stock.nasdaqReturn1d)} / SOX ${pct(stock.soxReturn1d)}`,
      status: weights.usMarket > 0 ? "計分" : "資料確認，不計分"
    },
    {
      weightKey: "futuresVix",
      dimension: "市場面",
      item: "隔夜風險（台指期 / VIX）",
      source: "只看隔夜大盤風險，不混入期權籌碼。台指期盤後 >0.5% 偏強、0～0.5% 小漲、<0 偏弱；VIX 回落加分，0～1% 小升算中性，>1% 才偏風險。",
      weight: weights.futuresVix,
      score: overnightRiskScore,
      rule: `台指期 ${hasTaifex ? pct(stock.taifexAfterHoursReturn) : "待接"}（${overnightRisk.txLabel}） / VIX ${pct(stock.vixChange1d)}（${overnightRisk.vixLabel}）`,
      status: weights.futuresVix > 0 ? "計分" : "資料確認，不計分"
    },
    {
      weightKey: "derivativesData",
      dimension: "衍生性金融商品",
      item: "期權風險（期貨法人 / PutCall）",
      source: "這列專門看期權籌碼，不再混在市場面。期貨法人淨額 >0 偏多，-1000萬～0 小幅偏空，<-1000萬偏空；PutCall 1.05～1.2 小幅偏高，1.2～1.5 偏高，>1.5 明顯偏高。保守版權重只給 0.05。",
      weight: weights.derivativesData,
      score: derivativesRiskScore,
      rule: `期貨法人 ${number(stock.futuresInstitutionalNetAmount)}（${derivativesRisk.futuresLabel}） / PutCall量 ${stock.putCallVolumeRatio ?? "-"}（${derivativesRisk.pcLabel}） / PutCallOI ${stock.putCallOpenInterestRatio ?? "-"}（${derivativesRisk.pcOiLabel}） / 選擇權法人 ${number(stock.optionInstitutionalNetBias)}（${derivativesRisk.optionBiasLabel}）`,
      status: weights.derivativesData > 0 ? "計分" : "資料確認，不計分"
    },
    {
      weightKey: "fundamentalsData",
      dimension: "基本面",
      item: "基本面資料完整度",
      source: "短線 V1 先不把基本面納入正式權重，但會檢查月營收、EPS、毛利率、營益率、負債比是否都已補到，未來可轉成基本面風險濾網。",
      weight: weights.fundamentalsData,
      score: fundamentalScore,
      rule: `營收YoY ${pct(stock.revenueYoY)} / MoM ${pct(stock.revenueMoM)} / EPS ${number(stock.eps)} / EPS YoY ${pct(stock.epsGrowthYoY)} / 毛利率 ${pct(stock.grossMargin)} / 營益率 ${pct(stock.operatingMargin)} / 負債比 ${pct(stock.debtRatio)}`,
      status: weights.fundamentalsData > 0 ? "計分" : "資料確認，不計分"
    },
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
  parts.push("基本面已接入 FinMind 月營收、財報與資產負債資料；市場面拆成美股科技風向與隔夜風險，衍生性金融商品獨立成低權重期權風險。");
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
  return <Card className="rounded-xl shadow-sm"><CardContent className="p-3 space-y-3"><div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between"><div><h3 className="text-lg font-semibold">{title}</h3><p className="text-[15px] text-slate-500 mt-1">{subtitle}</p></div>{horizon && onResetHorizon && <Button variant="outline" size="sm" onClick={() => onResetHorizon(horizon)} className="shrink-0">恢復預設值</Button>}</div><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[1260px] text-[15px]"><colgroup><col className="w-[112px]" /><col className="w-[340px]" /><col className="w-[104px]" /><col className="w-[150px]" /><col className="w-[130px]" /><col className="w-[280px]" /><col className="w-[360px]" /></colgroup><thead className="bg-white"><tr className="border-b text-left text-slate-500"><th className="px-3 py-3">維度</th><th className="px-3 py-3 whitespace-nowrap">指標 / 資料檢查</th><th className="px-3 py-3 text-center">權重</th><th className="px-3 py-3 text-center">狀態</th><th className="px-3 py-3 text-center">分數</th><th className="px-3 py-3">規則 / 數據</th><th className="px-3 py-3">公式解釋</th></tr></thead><tbody>{result.rows.map((row) => <tr key={`${row.dimension}-${row.item}`} className="border-b last:border-0"><td className="px-3 py-3 align-top font-medium whitespace-nowrap">{row.dimension}</td><td className="px-3 py-3 align-top whitespace-nowrap leading-6">{row.item}</td><td className="px-3 py-3 align-top text-center">{horizon && row.weightKey && onWeightChange ? <Input type="number" step="0.01" min="0" max="1" value={row.weight} onChange={(e) => onWeightChange(horizon, row.weightKey, e.target.value)} className="mx-auto h-8 w-20 rounded-lg border-slate-300 px-2 text-right text-[15px] font-medium" /> : row.weight.toFixed(2)}</td><td className="px-3 py-3 align-top"><div className="flex min-h-[32px] items-center justify-center"><StatusBadge text={row.status} /></div></td><td className="px-3 py-3 align-top text-center">{compareBadge(row.score)}</td><td className="px-3 py-3 align-top text-slate-600 leading-6">{row.rule}</td><td className="px-3 py-3 align-top text-slate-500 leading-6">{row.explain || row.source}</td></tr>)}{showScore && <tr className="bg-slate-50 font-semibold"><td className="px-3 py-3" colSpan={2}>權重合計 / 加權得分</td><td className="px-3 py-3 text-center">{result.totalWeight.toFixed(2)}</td><td className="px-3 py-3"></td><td className="px-3 py-3"></td><td className="px-3 py-3">{result.total.toFixed(2)}</td><td className="px-3 py-3">分數改為 0～1 連續分；合計建議維持 1.00。</td></tr>}</tbody></table></div></CardContent></Card>;
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

function formatDurationMs(ms) {
  const value = Number(ms || 0);
  if (!Number.isFinite(value) || value <= 0) return "未設定";
  if (value >= 60 * 60 * 1000) return `${Math.round(value / (60 * 60 * 1000))} 小時`;
  if (value >= 60 * 1000) return `${Math.round(value / (60 * 1000))} 分鐘`;
  return `${Math.round(value / 1000)} 秒`;
}

function SourceConnectorTable({ config, onConfigChange, onSmartRefresh, onLoadGoogle, onLoadFinMind, onLoadTwse, onLoadMarket, onLoadDerivatives, loading, apiMessage, lastFetchMap, stocks, googleDebug }) {
  const plan = getSourceConnectorPlan(config);
  const policies = ["google_csv", "twse_proxy", "finmind_proxy", "finmind_market", "finmind_derivatives"].map((source) => ({ source, ...getSourcePolicy(source), lastFetch: formatLastFetch(lastFetchMap, source) }));
  const googleTemplate = buildGoogleVerifySheetTemplate(stocks);
  return <Card className="rounded-xl shadow-sm"><CardContent className="p-3 space-y-3"><h3 className="font-semibold flex items-center gap-2"><Icon name="doc" /> 資料來源串接層</h3><p className="text-xs text-slate-500">正式流程以 Google Sheet 發佈 CSV URL 為準；App 只讀取公開 CSV，不寫入或重建 Google Sheet。</p><div className="grid gap-2 md:grid-cols-3"><Input placeholder="Google Sheet 公開 CSV URL" value={config.googleCsvUrl} onChange={(e) => onConfigChange({ ...config, googleCsvUrl: e.target.value })} /><Input placeholder="FinMind stocks URL，例如 /api/finmind/stocks" value={config.finmindProxyUrl} onChange={(e) => onConfigChange({ ...config, finmindProxyUrl: e.target.value })} /><Input placeholder="TWSE proxy URL，例如 /api/twse/stocks" value={config.twseProxyUrl} onChange={(e) => onConfigChange({ ...config, twseProxyUrl: e.target.value })} /><Input placeholder="FinMind market URL，例如 /api/finmind/market" value={config.finmindMarketProxyUrl} onChange={(e) => onConfigChange({ ...config, finmindMarketProxyUrl: e.target.value })} /><Input placeholder="FinMind derivatives URL，例如 /api/finmind/derivatives" value={config.finmindDerivativesProxyUrl} onChange={(e) => onConfigChange({ ...config, finmindDerivativesProxyUrl: e.target.value })} /></div><div className="flex flex-wrap items-center gap-2">
  <Button onClick={onSmartRefresh} disabled={loading || (!config.googleCsvUrl && !config.finmindProxyUrl && !config.twseProxyUrl && !config.finmindMarketProxyUrl && !config.finmindDerivativesProxyUrl)}>更新資料</Button>
  {apiMessage && <Badge className={apiMessage.includes("成功") || apiMessage.includes("已更新") ? "bg-emerald-100 text-emerald-800" : "bg-yellow-100 text-yellow-800"}>{apiMessage}</Badge>}
</div>
<details className="rounded-xl border border-dashed bg-slate-50 p-3 text-xs text-slate-600">
  <summary className="cursor-pointer select-none font-semibold text-slate-800">進階測試來源</summary>
  <div className="mt-3 flex flex-wrap gap-2">
    <Button onClick={onLoadGoogle} disabled={loading || !config.googleCsvUrl}>讀取 GoogleFinance</Button>
    <Button onClick={onLoadTwse} disabled={loading || !config.twseProxyUrl}>讀取 TWSE</Button>
    <Button onClick={onLoadFinMind} disabled={loading || !config.finmindProxyUrl}>讀取 FinMind</Button><Button onClick={onLoadMarket} disabled={loading || !config.finmindMarketProxyUrl}>讀取 Market</Button><Button onClick={onLoadDerivatives} disabled={loading || !config.finmindDerivativesProxyUrl}>讀取 Derivatives</Button>
  </div>
  <div className="mt-2 text-slate-400">開發測試用；正式使用建議按「更新資料」，由系統依冷卻規則判斷要不要觸發各來源。</div>
</details><div className="grid gap-2 md:grid-cols-3">{policies.map((item) => <div key={item.source} className="rounded-lg border bg-white p-3 text-xs text-slate-600"><div className="mb-1 font-semibold text-slate-900">{item.label}</div><div>Timeout：{item.timeoutMs / 1000} 秒</div><div>手動冷卻：{formatDurationMs(item.cooldownMs)}</div><div>自動刷新：{item.autoRefreshMs ? `每 ${formatDurationMs(item.autoRefreshMs)}` : "未設定"}</div>{item.maxSymbols && <div>檔數限制：最多 {item.maxSymbols} 檔</div>}<div>上次：{item.lastFetch}</div><div className="mt-1 text-slate-400">{item.cacheNote}</div></div>)}</div><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-sm"><thead className="bg-white"><tr className="border-b text-left text-slate-500"><th className="py-2">來源</th><th>角色</th><th>狀態</th><th>欄位</th><th>串接方式</th></tr></thead><tbody>{plan.map((item) => <tr key={item.name} className="border-b last:border-0"><td className="py-2 font-medium">{item.name}</td><td>{item.role}</td><td><Badge className={item.status.includes("可") ? "bg-emerald-100 text-emerald-800" : item.status.includes("待") ? "bg-yellow-100 text-yellow-800" : "bg-slate-100 text-slate-700"}>{item.status}</Badge></td><td className="max-w-sm text-slate-600">{item.fields}</td><td className="max-w-md text-slate-500">{item.method}</td></tr>)}</tbody></table></div>{googleDebug && <div className="rounded-xl border bg-white p-3 text-xs text-slate-600"><div className="font-semibold text-slate-900">Google CSV 讀取診斷</div>{googleDebug.error ? <div className="text-red-600">錯誤：{googleDebug.error}</div> : <div className="space-y-1"><div>讀取方式：{googleDebug.mode}</div><div>CSV 列數：{googleDebug.parsedRows}</div><div>已對上：{googleDebug.matchedSymbols?.join(", ") || "無"}</div><div>未對上：{googleDebug.unmatchedSymbols?.join(", ") || "無"}</div><div>欄位：{googleDebug.headers?.join(" / ") || "無"}</div><div>rawDataMap：{googleDebug.rawDataMap ? Object.keys(googleDebug.rawDataMap).join(" / ") : "無"}</div><div>原始前 3 列：{googleDebug.rawPreview?.map((row) => `[${row.join(" | ")}]`).join(" ／ ") || "無"}</div><div>數值預覽：{googleDebug.valuePreview?.map((x) => `${x.symbol}: price=${x.price ?? "-"}, prev=${x.prevClose ?? "-"}, volume=${x.volume ?? "-"}, per=${x.per ?? "-"}, eps=${x.eps ?? "-"}, ma5=${x.ma5 ?? "-"}, ma20=${x.ma20 ?? "-"}, nasdaq=${x.nasdaqReturn1d ?? "-"}, sox=${x.soxReturn1d ?? "-"}, vix=${x.vixChange1d ?? "-"}`).join("｜") || "無"}</div></div>}</div>}<div className="rounded-xl border bg-slate-50 p-3 space-y-2"><div className="font-semibold text-slate-900">Google 驗證模板</div><p className="text-xs text-slate-500">複製下方內容貼到 Google Sheet A1，等待 GOOGLEFINANCE 公式跑出數字後，將試算表發佈成 CSV，再把公開 CSV URL 貼回上方讀取。正式讀取只會讀 CSV URL，不會寫入或重建 Google Sheet。</p><textarea className="h-36 w-full rounded-lg border bg-white p-2 font-mono text-xs text-slate-700" readOnly value={googleTemplate} /></div></CardContent></Card>;
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
  assert("驗證列會產出可判讀狀態", getSourceValidationRows("2330", sample).every((row) => ["通過", "需檢查", "無法取得"].includes(row.status)), "來源校正與分層欄位比對應能標記通過/需檢查/無法取得。");
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
  const [apiConfig, setApiConfig] = useState({ googleCsvUrl: DEFAULT_GOOGLE_SHEET_CSV_URL, finmindProxyUrl: DEFAULT_FINMIND_PROXY_URL, finmindMarketProxyUrl: DEFAULT_FINMIND_MARKET_PROXY_URL, finmindDerivativesProxyUrl: DEFAULT_FINMIND_DERIVATIVES_PROXY_URL, twseProxyUrl: DEFAULT_TWSE_PROXY_URL });
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

      applyDefinedNumber(next, "nasdaqReturn1d", derived.nasdaqReturn1d);
      applyDefinedNumber(next, "soxReturn1d", derived.soxReturn1d);
      applyDefinedNumber(next, "sp500Return1d", derived.sp500Return1d);
      applyDefinedNumber(next, "dowReturn1d", derived.dowReturn1d);
      applyDefinedNumber(next, "vixChange1d", derived.vixChange1d);
      applyDefinedNumber(next, "us10yYield", us10y?.value);
      applyDefinedNumber(next, "usdTwd", usd?.value);
      applyDefinedNumber(next, "jpyTwd", jpy?.value);
      applyDefinedNumber(next, "wtiOil", wti?.value);
      applyDefinedNumber(next, "goldPrice", gold?.value);
      applyDefinedNumber(next, "fedRate", fedRate?.value);

      [
        "nasdaqReturn1d",
        "soxReturn1d",
        "sp500Return1d",
        "dowReturn1d",
        "vixChange1d",
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

      if (json.rawDataMap) {
        const googleRows = Object.entries(json.rawDataMap).map(([symbol, google]) => ({
          symbol,
          google,
        }));
        setStocks((prev) => mergeGoogleQuotesBySymbol(prev, googleRows));
      }

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
      setDataMode("google_quote_api");
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
      const rawIncoming = list.filter((stock) => stock.symbol || stock.stock_id);
      const incoming = rawIncoming.map(normalizeExternalStock).filter((stock) => stock.symbol);

      // 比對來源要吃 route 原始欄位，避免 normalizeExternalStock 過程漏掉 technical / valuation 欄位。
      setValidationMap((prev) =>
        mergeSourceMap(prev, normalizeSourceRowsForValidation(rawIncoming, "finmind"))
      );
      setStocks((prev) => mergeFinMindDailyBySymbol(prev, rawIncoming));
      setDataMode("finmind_daily_technical");
      setLastFetchMap((prev) => markSourceFetched(prev, source));
      setApiMessage(`FinMind成功：${rawIncoming.length} 檔，比對來源已更新`);
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
      const twseRows = filtered.length ? filtered : incoming;

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

    try {
      if (apiConfig.googleCsvUrl && google.refresh.ok) {
        await loadGoogleCsv();
        summary.push("GoogleFinance 已更新");
      } else if (apiConfig.googleCsvUrl) {
        summary.push(`GoogleFinance 冷卻 ${google.refresh.remainSec} 秒`);
      }

      if (apiConfig.twseProxyUrl && twse.refresh.ok) {
        await loadTwseOpenApi();
        summary.push("TWSE 已更新");
      } else if (apiConfig.twseProxyUrl) {
        summary.push(`TWSE 冷卻 ${twse.refresh.remainSec} 秒`);
      }

      if (apiConfig.finmindProxyUrl && finmind.refresh.ok) {
        await loadFinMindProxy();
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

      setApiMessage(summary.length ? summary.join("｜") : "沒有可更新的來源");
    } catch (error) {
      setApiMessage(`更新資料失敗：${error.message}`);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 text-[15px] text-slate-900"><div className="mx-auto max-w-7xl space-y-3">
      <div><h1 className="text-3xl font-bold tracking-tight">股票短中長分析 App — V1</h1><p className="text-[15px] text-slate-500 mt-1">先做全部股票 / ETF 總覽，再點進單檔細節。短線 V1 維持原三大面向，並加入停損閘門；中線與長線公式尚未啟用。</p></div>
      <AddAssetForm value={newAsset} onChange={setNewAsset} onAdd={addAsset} error={addError} />
      <OverviewTable rows={overviewRows} selected={selected} onSelect={setSelected} onInsight={(symbol, horizon) => { setSelected(symbol); setInsightTarget({ symbol, horizon }); }} onRemove={removeAsset} dataMode={dataMode} />
      <InsightPanel insight={activeInsight} />
      <Tabs defaultValue="short" className="space-y-3"><TabsList className="grid w-full grid-cols-5 rounded-xl p-1.5"><TabsTrigger value="short" className="py-2.5">短線V1</TabsTrigger><TabsTrigger value="mid" className="py-2.5">中線V1</TabsTrigger><TabsTrigger value="long" className="py-2.5">長線V1</TabsTrigger><TabsTrigger value="sources" className="py-2.5">資料源</TabsTrigger><TabsTrigger value="validate" className="py-2.5">資料驗證</TabsTrigger></TabsList>
        <TabsContent value="short"><FrameworkTable title="圖片版短線評分表" subtitle="短線 V1 保守版：市場面拆成美股科技風向與隔夜風險；衍生性金融商品獨立低權重，避免跟市場面混在一起。" result={shortV1} showScore horizon="short" onWeightChange={updateWeight} onResetHorizon={resetHorizonWeights} /><div className="grid gap-3 md:grid-cols-5 mt-3">{shortV1.dimensions.map((dim) => <DimensionScoreCard key={dim.dimension} dim={dim} />)}</div></TabsContent>
        <TabsContent value="mid"><FrameworkTable title="中線 V1 架構表" subtitle={getFrameworkAnalysis("中線", midV1)} result={midV1} showScore horizon="mid" onWeightChange={updateWeight} onResetHorizon={resetHorizonWeights} /></TabsContent>
        <TabsContent value="long"><FrameworkTable title="長線 V1 架構表" subtitle={getFrameworkAnalysis("長線", longV1)} result={longV1} showScore horizon="long" onWeightChange={updateWeight} onResetHorizon={resetHorizonWeights} /></TabsContent>
        <TabsContent value="sources"><div className="space-y-4"><SourceConnectorTable config={apiConfig} onConfigChange={setApiConfig} onSmartRefresh={runSmartRefresh} onLoadGoogle={loadGoogleCsv} onLoadFinMind={loadFinMindProxy} onLoadTwse={loadTwseOpenApi} onLoadMarket={loadFinMindMarket} onLoadDerivatives={loadFinMindDerivatives} loading={apiLoading} apiMessage={apiMessage} lastFetchMap={lastFetchMap} stocks={stocks} googleDebug={googleDebug} /><Card className="rounded-xl shadow-sm"><CardContent className="p-3 space-y-3"><h3 className="font-semibold flex items-center gap-2"><Icon name="doc" /> 資料來源角色總覽</h3><div className="rounded-lg border bg-slate-50 p-3 text-xs leading-6 text-slate-600"><div className="font-semibold text-slate-900">資料原則</div><div>GoogleFinance 作主畫面較新行情；TWSE OpenAPI 作官方盤後 / 估值校正；FinMind Daily 只補技術資料；FinMind Minute 只作近即時備援。</div></div><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[1300px] text-sm"><thead className="bg-white"><tr className="border-b text-left text-slate-500"><th className="py-2">來源</th><th>Dataset / API</th><th>主要欄位</th><th>怎麼算 / 使用方式</th><th>驗證 / 備援來源</th><th>短線角色</th><th>中線角色</th><th>長線角色</th></tr></thead><tbody>{finmindAspectPlan.map((item) => <tr key={item.aspect} className="border-b last:border-0 align-top"><td className="py-2 font-medium">{item.aspect}</td><td className="max-w-xs text-slate-600">{item.datasets}</td><td className="max-w-xs text-slate-600">{item.fields}</td><td className="max-w-sm text-slate-500">{item.calcNote}</td><td className="max-w-xs text-slate-500">{item.verifyRef}</td><td className="max-w-sm text-slate-500">{item.shortRole}</td><td className="max-w-sm text-slate-500">{item.midRole}</td><td className="max-w-sm text-slate-500">{item.longRole}</td></tr>)}</tbody></table></div></CardContent></Card></div></TabsContent>
        <TabsContent value="validate"><Card className="rounded-xl shadow-sm"><CardContent className="p-3 space-y-3"><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold flex items-center gap-2"><Icon name="doc" /> 來源校正與分層欄位比對</h3><p className="text-sm text-slate-500 mt-2">欄位依來源角色分層：GoogleFinance 作主畫面較新行情；TWSE OpenAPI 作官方盤後 / 估值比對；FinMind Daily 作技術欄位比對與補資料。</p></div><Badge className="bg-slate-100 text-slate-700">策略：Google 行情、TWSE 官方、FinMind 技術補資料</Badge></div><div className="rounded-xl bg-white border p-4 text-sm text-slate-700"><span className="font-medium text-slate-900">驗證結論：</span>{validationSummary(getSourceValidationRows(selected, current, validationMap))}</div><div className="max-h-[340px] overflow-y-scroll overflow-x-auto rounded-xl border border-slate-200 bg-white pr-1 [scrollbar-gutter:stable]"><table className="w-full min-w-[1280px] text-sm"><thead className="sticky top-0 z-10 bg-white"><tr className="border-b text-left text-slate-500"><th className="py-2">欄位</th><th>目前來源</th><th>目前資料</th><th>比對來源</th><th>比對資料</th><th>偏差</th><th>容忍值</th><th>狀態</th><th>備註</th></tr></thead><tbody>{getSourceValidationRows(selected, current, validationMap).map((row) => <tr key={row.label} className="border-b last:border-0"><td className="py-2 font-medium">{row.label}</td><td className="max-w-[160px] text-xs text-slate-500">{row.currentSource}</td><td>{displayValue(row.finmindValue)}</td><td className="max-w-[160px] text-xs text-slate-500">{row.compareSource}</td><td>{displayValue(row.googleValue)}</td><td>{row.finmindValue === 0 && row.googleValue !== 0 && row.status === "需檢查" && row.compareMode !== "abs" ? "基準為0" : row.compareMode === "abs" ? `${Number(row.diffPct || 0).toFixed(3)}點` : pct(row.diffPct)}</td><td>{row.toleranceLabel || `±${row.tolerancePct}%`}</td><td><Badge className={row.status === "通過" ? "bg-emerald-100 text-emerald-800" : row.status === "需檢查" ? "bg-orange-100 text-orange-800" : row.status === "不比對" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"}>{row.status}</Badge></td><td className="max-w-md text-slate-500">{row.note}</td></tr>)}</tbody></table></div></CardContent></Card></TabsContent>
      </Tabs>
    </div></div>
  );
}
