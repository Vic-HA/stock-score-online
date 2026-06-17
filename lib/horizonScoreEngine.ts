// @ts-nocheck
// Horizon score engine extracted from app/page.tsx.
// Keep scoring formulas and score-row builders here; no React state, no fetch side effects.
//
// Horizon status for maintainers / future AI:
// - Short V1 is the active production score path.
// - Mid V1 is a framework placeholder for future medium-term scoring.
// - Long V1 is a framework placeholder for future long-term scoring.
// Do not treat Mid / Long V1 as finalized formulas until Phase C/D explicitly enables them.

import { volumeBaseShortDisplayLabel } from "@/lib/volumeLabels";

const HORIZON_SCORE_ENGINE_STATUS = {
  short: "active_short_v1",
  mid: "framework_only_mid_v1_not_final",
  long: "framework_only_long_v1_not_final",
};

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

function getDerived(stock) {
  const todayReturn = stock.prevClose > 0 ? ((stock.price - stock.prevClose) / stock.prevClose) * 100 : 0;
  const volumeBase = stock.volume10maTwseSnapshot > 0
    ? Number(stock.volume10maTwseSnapshot)
    : stock.avgVolume10TwseSnapshot > 0
      ? Number(stock.avgVolume10TwseSnapshot)
      : stock.volume10maFinMind > 0
        ? Number(stock.volume10maFinMind)
        : stock.avgVolume10 > 0
          ? Number(stock.avgVolume10)
          : stock.volume10ma > 0
            ? Number(stock.volume10ma)
            : stock.avgVolume20TwseSnapshot > 0
              ? Number(stock.avgVolume20TwseSnapshot)
              : stock.avgVolume20 > 0
                ? Number(stock.avgVolume20)
                : 0;
  const volumeBaseLabel = stock.volume10maTwseSnapshot > 0 || stock.avgVolume10TwseSnapshot > 0
    ? "TWSE snapshot 自算10日均量"
    : stock.volume10maFinMind > 0 || stock.avgVolume10 > 0
      ? "FinMind 10日均量備援"
      : stock.volume10ma > 0
        ? "Google 10日均量參考"
        : stock.avgVolume20TwseSnapshot > 0
          ? "TWSE snapshot 20日均量備援"
          : stock.avgVolume20 > 0
            ? "FinMind 20日均量備援"
            : "量能基準待補";
  const runtimeVolumeRatio = volumeBase > 0 && hasFinite(stock.volume) && Number(stock.volume) > 0
    ? Number(stock.volume) / volumeBase
    : null;
  const storedVolumeRatio = hasFinite(stock.volumeRatio) && Number(stock.volumeRatio) > 0
    ? Number(stock.volumeRatio)
    : null;
  const volumeRatio = runtimeVolumeRatio !== null
    ? runtimeVolumeRatio
    : storedVolumeRatio !== null
      ? storedVolumeRatio
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

// ACTIVE: Short V1 score rows.
// This is the current user-facing score formula and should be regression-tested when changed.
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
      source: `量能爆發力改採 V1.1 時間係數校正版。盤後以完整日成交量 / 均量正式評分；盤中以目前累積成交量，搭配台股盤中時間進度係數推估全日量，再與 10 日或 20 日均量比較。

計算方式：
盤後量能比 = 今日完整成交量 / 10日均量。
盤中預估全日量 = 目前累積成交量 / 台股盤中時間進度係數。
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
      rule: `${d.volumePower.timeLabel} / 今日量 ${compactNumber(stock.volume, 0)} / ${volumeBaseShortDisplayLabel(d.volumeBaseLabel)} ${compactNumber(d.volumeBase, 0)} / 原始量比 ${compactRatio(d.volumePower.rawRatio)} / 校正量比 ${compactRatio(d.volumePower.ratio)}（${d.volumePower.label}，${d.volumePower.confirmLabel}）`,
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

// FRAMEWORK ONLY: Mid V1 score rows.
// This keeps the short / mid / long architecture in place, but the formula is not finalized.
// Rows should be read as data-readiness / placeholder checks until the medium-term model is designed.
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

// FRAMEWORK ONLY: Long V1 score rows.
// This keeps the long-term architecture in place, but the formula is not finalized.
// Rows should be read as data-readiness / placeholder checks until the long-term model is designed.
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

// ACTIVE: current production short-term score.
function scoreShortV1(stock, weightConfig = DEFAULT_WEIGHT_CONFIG) { return applyStopLossGate(scoreRows(buildShortV1Rows(stock, weightConfig.short)), stock); }

// FRAMEWORK ONLY: not a finalized medium-term score. Kept so UI/data flow can preserve the short / mid / long skeleton.
function scoreMidV1(stock, weightConfig = DEFAULT_WEIGHT_CONFIG) { return scoreRows(buildMidV1Rows(stock, weightConfig.mid)); }

// FRAMEWORK ONLY: not a finalized long-term score. Kept so UI/data flow can preserve the short / mid / long skeleton.
function scoreLongV1(stock, weightConfig = DEFAULT_WEIGHT_CONFIG) { return scoreRows(buildLongV1Rows(stock, weightConfig.long)); }

export {
  HORIZON_SCORE_ENGINE_STATUS,
  DEFAULT_WEIGHT_CONFIG,
  cloneWeightConfig,
  clamp,
  pct,
  number,
  compactNumber,
  compactRatio,
  shortDerivativeLabel,
  compactDecimal,
  shortPcVolumeLabel,
  compactDerivativeText,
  fundamentalBriefText,
  passScore,
  roundScore,
  scorePriceVsMa,
  scoreRsiShort,
  scoreMacdMomentum,
  scoreKdTurn,
  scoreAtrVolatility,
  parseTaiwanMarketMinute,
  volumeTimeBucket,
  baseVolumeScoreV11,
  volumePowerStateV11,
  priceVolumeConfirmAdjustment,
  analyzeVolumePower,
  scoreVolumePower,
  scoreInstitutionalFlow,
  institutionalFlowDetails,
  scoreMarginRisk,
  scoreMarginShortRisk,
  scoreUsMarket,
  scoreOvernightRisk,
  overnightRiskDetails,
  scoreDerivativesRisk,
  derivativesRiskDetails,
  scoreFundamentalReady,
  getDerived,
  hasFinite,
  buildShortV1Rows,
  buildMidV1Rows,
  buildLongV1Rows,
  scoreRows,
  getStopLossState,
  applyStopLossGate,
  scoreShortV1,
  scoreMidV1,
  scoreLongV1,
};
