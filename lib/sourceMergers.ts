// @ts-nocheck
// Source normalization / merge helpers extracted from app/page.tsx.
// Keep these as pure helpers: no React state, no UI, no fetch side effects.

import { sanitizePercentPointFromVerifiedSource } from "@/lib/validationRows";

export function createAssetTemplate({ symbol, name, type, market }) {
  const normalizedSymbol = normalizeStockSymbol(symbol);
  const normalizedType = type === "ETF" ? "ETF" : "股票";
  return { symbol: normalizedSymbol, name: String(name || normalizedSymbol || "新標的").trim(), type: normalizedType, market: market || "TWSE", price: 0, prevClose: 0, high20: 0, low20: 0, high52: 0, low52: 0, drawdown52: 0, pricePosition52: 0, roc20: 0, volume: 0, volume10ma: 0, volume10maTwseSnapshot: 0, avgVolume10TwseSnapshot: 0, volume10maFinMind: 0, avgVolume10: 0, volumeRatio: 0, avgVolume20: 0, avgVolume20TwseSnapshot: 0, ma5: 0, ma20: 0, ma60: 0, rsi14: 50, return20d: 0, return60d: 0, macd: null, macdSignal: null, macdHist: null, macdHistPrev1: null, macdHistPrev3: null, macdHistDelta3: null, macdHistTrend3: "", macdState: "", macdWarmupReady: false, k9: null, d9: null, j9: null, k9Prev1: null, d9Prev1: null, kdDiff: null, kdDiffPrev1: null, kdDiffTrend3: "", kdCross: "", kdState: "", kdWarmupReady: false, atr14: null, atrPct: null, atrPctAvg20: null, atrPctVsAvg20: null, volatilityState: "", atrWarmupReady: false, priceRowCount: 0, technicalWarmupStatus: null, marketcap: 0, beta: 0, datadelay: null, nasdaqReturn1d: 0, soxReturn1d: 0, taifexAfterHoursReturn: 0, vixChange1d: 0, foreign3d: 0, trust3d: 0, dealer3d: 0, foreign20d: 0, trust20d: 0, marginChange5dPct: 0, marginChange20dPct: 0, revenueYoY: 0, revenueMoM: 0, epsGrowthYoY: 0, eps: 0, earningsYield: 0, grossMargin: 0, operatingMargin: 0, grossMarginQoQ: 0, operatingMarginQoQ: 0, netMargin: 0, netMarginQoQ: 0, epsTtm: 0, epsTtmGrowthYoY: 0, incomeAfterTaxesTtm: 0, financialQuarterCount: 0, roe: 0, roeTtm: 0, debtRatio: 0, per: 0, pbr: 0, dividendYield: 0, yield: 0, yahooEtfMarketPrice: null, yahooEtfChange: null, yahooEtfChangePct: null, yahooEtfRangeHigh: null, yahooEtfRangeLow: null, yahooEtfRangeSpread: null, yahooEtfPremiumDiscountPct: null, yahooEtfSourcePage: "", yahooEtfFetchedAt: "", officialEtfInavEstimatedNav: null, officialEtfInavLatestPrice: null, officialEtfInavReferenceNav: null, officialEtfInavYesterdayPrice: null, officialEtfInavPremiumDiscountPct: null, officialEtfInavNavDate: "", officialEtfInavSourceType: "", officialEtfInavAdapter: "", officialEtfInavUpdatedAt: "" };
}

export function parseNum(value, fallback = 0) {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (raw === "" || raw === "-" || raw === "--" || raw.toUpperCase() === "N/A") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeStockSymbol(value) {
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

export function hasCjkText(value) {
  return /[\u4e00-\u9fff]/.test(String(value || ""));
}

export function isPlaceholderName(name, symbol) {
  const raw = String(name || "").trim();
  const normalizedSymbol = normalizeStockSymbol(symbol);
  if (!raw) return true;
  if (raw === normalizedSymbol) return true;
  if (normalizeStockSymbol(raw) === normalizedSymbol) return true;
  if (raw.toUpperCase() === `TPE:${normalizedSymbol}` || raw.toUpperCase() === `TWO:${normalizedSymbol}`) return true;
  if (/^[0-9]{4}\s*$/.test(raw)) return true;
  return false;
}

export function shouldReplaceName(currentName, officialName, symbol) {
  const official = String(officialName || "").trim();
  if (!official || official === symbol) return false;
  if (isPlaceholderName(currentName, symbol)) return true;
  // 如果目前名稱沒有中文，而官方名稱有中文，以官方名稱為準。
  if (!hasCjkText(currentName) && hasCjkText(official)) return true;
  return false;
}

export function preferOfficialName(currentName, officialName, symbol) {
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

export function getRowValue(row, keys, fallback = "") {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return fallback;
}

export function normalizeExternalStock(row) {
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

export function getAnyField(row, keys, fallback = "") {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return fallback;
}

export function normalizeTwseStockDayRow(row) {
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

export function normalizeTwseBwibbuRow(row) {
  const symbol = String(getAnyField(row, ["Code", "code", "證券代號", "股票代號", "stockNo", "stock_id"])).trim().toUpperCase();
  if (!symbol) return null;
  return {
    symbol,
    per: parseNum(getAnyField(row, ["PEratio", "PER", "本益比", "殖利率", "本益比(倍)"]), 0),
    pbr: parseNum(getAnyField(row, ["PBratio", "PBR", "股價淨值比", "股價淨值比(倍)"]), 0),
    dividendYield: parseNum(getAnyField(row, ["DividendYield", "Dividend Yield", "殖利率", "殖利率(%)"]), 0),
  };
}

export function mergeTwseRows(stockRows, valuationRows) {
  const valuationMap = new Map(valuationRows.filter(Boolean).map((row) => [row.symbol, row]));
  return stockRows.filter(Boolean).map((stock) => ({ ...stock, ...(valuationMap.get(stock.symbol) || {}) }));
}

export function normalizeTwseMisDateTime(dateText, timeText) {
  const d = String(dateText || "").trim();
  const t = String(timeText || "").trim();
  if (!d || !t) return "";
  const match = d.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) return `${d} ${t}`;
  return `${match[1]}/${match[2]}/${match[3]} ${t}`;
}

export function normalizeTwseMisItem(item) {
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

export function mergeTwseMisBySymbol(currentStocks, incomingRows = []) {
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
      // V71E/V71G：盤中量用 TWSE MIS 後，不保留 Google 舊 volumeRatio；
      // getDerived 會用 TWSE MIS volume / volume10ma 或 avgVolume20 重新計算，validation 也讀 runtime ratio。
      next.volumeRatio = null;
      next.volumeRatioSource = "MIS 即時量 / 歷史均量";
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

export function buildTwseMisChannels(symbols = []) {
  const channels = [];
  symbols.map(normalizeStockSymbol).filter(Boolean).forEach((symbol) => {
    channels.push(`tse_${symbol}.tw`);
    channels.push(`otc_${symbol}.tw`);
  });
  return channels.join("|");
}

export function applyDefinedNumber(target, key, value) {
  if (value !== null && value !== undefined && Number.isFinite(Number(value))) {
    target[key] = Number(value);
  }
}

export function parseGoogleTradeTimeMs(value) {
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

export function isTwseMisAutoWindow(now = new Date()) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = 8 * 60 + 30;
  const end = 14 * 60;
  return minutes >= start && minutes <= end;
}

export function isSameTaipeiDateFromMs(ms, now = new Date()) {
  if (!Number.isFinite(ms)) return false;
  const d = new Date(ms);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function isGoogleIntradayQuoteReady(stock, now = new Date()) {
  const source = String(stock?.priceSource || "");
  if (source !== "GoogleFinance") return false;
  const tradeTime = stock?.tradetime || stock?.updatedAt || "";
  const tradeMs = parseGoogleTradeTimeMs(tradeTime);
  return Number.isFinite(tradeMs) && isSameTaipeiDateFromMs(tradeMs, now);
}

export function isTwseMisIntradayQuoteReady(stock) {
  const source = String(stock?.priceSource || "");
  const hasMisSource = source.startsWith("TWSE MIS") || String(stock?.intradaySource || "") === "TWSE MIS";
  const hasTradeTime = Boolean(stock?.tradetime || stock?.updatedAt);
  const hasPrice = Number.isFinite(Number(stock?.price)) && Number(stock?.price) > 0;
  return hasMisSource && hasTradeTime && hasPrice;
}

export function extractTaipeiDateKey(value) {
  if (!value) return "";
  if (typeof value === "object") {
    return extractTaipeiDateKey(
      value.stockDayDateIso ||
      value.bwibbuDateIso ||
      value.latestDate ||
      value.snapshotSourceLatestDate ||
      value.latestRawDate ||
      value.dataDate ||
      value.date ||
      value.fetchedAt ||
      value.updatedAt ||
      ""
    );
  }

  const text = String(value || "").trim();
  const match = text.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
}

export function getRealtimeQuoteDateKey(stock) {
  return extractTaipeiDateKey(stock?.tradetime || stock?.updatedAt || stock?.googleUpdatedAt || "");
}

export function getDailySourceDateKey(source) {
  return extractTaipeiDateKey(
    source?.dataTime ||
    source?.updatedAt ||
    source?.latestDate ||
    source?.twseHistoryLatestDate ||
    source?.twseUpdatedAt ||
    source?.finmindUpdatedAt ||
    source?.date ||
    ""
  );
}

export function hasUsableTwseMisQuote(stock) {
  const source = String(stock?.priceSource || "");
  const hasMisSource = source.startsWith("TWSE MIS") || String(stock?.intradaySource || "") === "TWSE MIS";
  const hasPrice = Number.isFinite(Number(stock?.price)) && Number(stock?.price) > 0;
  return hasMisSource && hasPrice;
}

export function hasUsableRealtimeQuote(stock, now = new Date()) {
  if (hasUsableTwseMisQuote(stock)) return true;
  return isGoogleQuoteUsableForIntraday(stock, now);
}

export function shouldPreserveRealtimeMainQuote(previous, incomingDaily = {}, now = new Date()) {
  if (!hasUsableRealtimeQuote(previous, now)) return false;

  const realtimeDate = getRealtimeQuoteDateKey(previous);
  const incomingDate = getDailySourceDateKey(incomingDaily);

  // If we cannot prove the daily source is same-day or newer, do not let it roll back a valid MIS/Google quote.
  if (!incomingDate || !realtimeDate) return true;
  return incomingDate < realtimeDate;
}

export function getIntradayQuoteReadiness(stock, now = new Date()) {
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

export function hasTwseMisIntradayLock(stock, now = new Date()) {
  // Keep the lock after 14:00 as long as the MIS quote is still newer than daily fallback data.
  // The caller decides whether an incoming daily source is same-day/newer via shouldPreserveRealtimeMainQuote().
  return hasUsableTwseMisQuote(stock);
}

export function isGoogleQuoteUsableForIntraday(google, now = new Date()) {
  const price = Number(google?.price);
  const tradeMs = parseGoogleTradeTimeMs(google?.tradetime || google?.updatedAt || "");
  return Number.isFinite(price) && price > 0 && Number.isFinite(tradeMs) && isSameTaipeiDateFromMs(tradeMs, now);
}

export function hasTwseOfficialMainQuote(stock) {
  const priceSource = String(stock?.priceSource || "");
  const volumeSource = String(stock?.volumeSource || "");
  const hasPrice = Number.isFinite(Number(stock?.price)) && Number(stock?.price) > 0;
  const hasVolume = Number.isFinite(Number(stock?.volume)) && Number(stock?.volume) > 0;
  return (priceSource === "TWSE" && hasPrice) || (volumeSource === "TWSE" && hasVolume);
}

export function shouldGoogleUpdateMainQuote(previous, google, now = new Date()) {
  if (hasUsableTwseMisQuote(previous)) return false;
  if (!isGoogleQuoteUsableForIntraday(google, now)) return false;

  const googleDate = extractTaipeiDateKey(google?.tradetime || google?.updatedAt || "");
  const officialDate = getDailySourceDateKey({
    dataTime: previous?.twseDataTime || previous?.twseHistoryDataTime || previous?.finmindDataTime,
    updatedAt: previous?.twseUpdatedAt || previous?.twseHistoryLatestDate || previous?.finmindUpdatedAt || previous?.updatedAt,
    latestDate: previous?.twseHistoryLatestDate,
  });

  // If official/snapshot data is older than the Google intraday quote, Google can temporarily own the main quote.
  if (hasTwseOfficialMainQuote(previous) && officialDate && googleDate && officialDate >= googleDate) return false;
  return true;
}

export function normalizeSourceRowsForValidation(rows = [], sourceName = "source") {
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
      volume10maTwseSnapshot: row.volume10maTwseSnapshot ?? row.avgVolume10TwseSnapshot ?? null,
      avgVolume10TwseSnapshot: row.avgVolume10TwseSnapshot ?? null,
      avgVolume10: row.avgVolume10 ?? null,
      volume10maFinMind: row.volume10maFinMind ?? row.avgVolume10 ?? null,
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

export function extractStockSourceMap(rows = [], sourceName = "source") {
  return rows.reduce((acc, row) => {
    const symbol = normalizeStockSymbol(row.symbol || row.stock_id);
    if (!symbol) return acc;
    acc[symbol] = { ...(acc[symbol] || {}), [sourceName]: row };
    return acc;
  }, {});
}

export function isBlankValue(value) {
  return value === null || value === undefined || value === "" || value === "-" || value === "--";
}

export function mergeSourcePayloadPreserveGood(prevPayload = {}, nextPayload = {}) {
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

export function mergeSourceMap(prevMap, sourceMap) {
  const next = { ...prevMap };
  Object.entries(sourceMap || {}).forEach(([symbol, sourcePayload]) => {
    next[symbol] = mergeSourcePayloadPreserveGood(next[symbol] || {}, sourcePayload || {});
  });
  return next;
}

export function fillNamesFromValidationMap(currentStocks, validationMap) {
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

export function mergeTwseOfficialBySymbol(currentStocks, incomingTwseRows) {
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
    const keepRealtimeQuote = shouldPreserveRealtimeMainQuote(next, incoming);

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

export function normalizeTwseHistorySnapshotItem(item) {
  if (!item) return null;
  const symbol = normalizeStockSymbol(item.symbol || item.stock_id);
  if (!symbol) return null;

  const latestRow = Array.isArray(item.historyRows) && item.historyRows.length
    ? item.historyRows[item.historyRows.length - 1]
    : Array.isArray(item.last220Rows) && item.last220Rows.length
      ? item.last220Rows[item.last220Rows.length - 1]
      : null;

  return {
    ...item,
    symbol,
    stock_id: symbol,
    sourceNote: "TWSE Snapshot",
    dataTime: item.latestDate || item.dataTime?.latestDate || item.updatedAt || "",
    dailyClose: item.dailyClose ?? item.close ?? latestRow?.close ?? latestRow?.c ?? null,
    dailyOpen: item.dailyOpen ?? item.open ?? latestRow?.open ?? latestRow?.o ?? null,
    dailyHigh: item.dailyHigh ?? item.high ?? latestRow?.high ?? latestRow?.h ?? null,
    dailyLow: item.dailyLow ?? item.low ?? latestRow?.low ?? latestRow?.l ?? null,
    dailyVolume: item.dailyVolume ?? item.volume ?? latestRow?.volume ?? latestRow?.v ?? null,
    avgVolume10: item.avgVolume10 ?? null,
    avgVolume10TwseSnapshot: item.avgVolume10 ?? null,
    volume10maTwseSnapshot: item.avgVolume10 ?? null,
    avgVolume20: item.avgVolume20 ?? null,
    avgVolume20TwseSnapshot: item.avgVolume20 ?? null,
    ma5: item.ma5 ?? null,
    ma10: item.ma10 ?? null,
    ma20: item.ma20 ?? null,
    ma60: item.ma60 ?? null,
    rsi14: item.rsi14 ?? item.rsi14Standard ?? item.rsi14WilderSeedSma ?? null,
    rsi14Standard: item.rsi14Standard ?? item.rsi14 ?? null,
    rsi14FinMindCompatible: item.rsi14FinMindCompatible ?? null,
    rsi14WilderSeedSma: item.rsi14WilderSeedSma ?? null,
    rsi14Simple: item.rsi14Simple ?? null,
    rsi14Ema: item.rsi14Ema ?? null,
    rsi14Cutler: item.rsi14Cutler ?? null,
    high20: item.high20 ?? null,
    low20: item.low20 ?? null,
    return20d: item.return20d ?? null,
    return60d: item.return60d ?? null,
    macd: item.macd ?? null,
    macdSignal: item.macdSignal ?? null,
    macdHist: item.macdHist ?? null,
    macdHistDelta3: item.macdHistDelta3 ?? null,
    macdWarmupRows: item.macdWarmupRows ?? null,
    macdWarmupReady: item.technicalStatus?.macdWarmupReady ?? null,
    k9: item.k9 ?? null,
    d9: item.d9 ?? null,
    j9: item.j9 ?? null,
    atr14: item.atr14 ?? null,
    atrPct: item.atrPct ?? null,
    atrPctAvg20: item.atrPctAvg20 ?? null,
    atrPctVsAvg20: item.atrPctVsAvg20 ?? null,
    atrWarmupReady: item.technicalStatus?.atrReady ?? null,
    kdWarmupReady: item.technicalStatus?.kdReady ?? null,
    priceRowCount: item.priceRowCount ?? item.rowCount ?? item.technicalStatus?.rowCount ?? null,
    technicalWarmupStatus: item.technicalStatus ?? null,
    latestDate: item.latestDate || item.dataTime?.latestDate || null,
  };
}

export function mergeTwseHistorySnapshotBySymbol(currentStocks, incomingHistoryRows = []) {
  const map = new Map(currentStocks.map((stock) => [normalizeStockSymbol(stock.symbol), stock]));

  incomingHistoryRows.map(normalizeTwseHistorySnapshotItem).filter(Boolean).forEach((incoming) => {
    const symbol = normalizeStockSymbol(incoming.symbol || incoming.stock_id);
    if (!symbol) return;

    const previous = map.get(symbol) || createAssetTemplate({
      symbol,
      name: incoming.name || incoming.stock_name || incoming.stockName || symbol,
      type: /^00/.test(symbol) ? "ETF" : "股票",
      market: incoming.market || "TWSE",
    });

    const next = { ...previous };
    const sourceName = "TWSE Snapshot";

    // V73A7：TWSE snapshot 自算日線 / 技術指標正式成為主資料；FinMind 保留在 validationMap 做驗證 / 備援。
    const fields = [
      "dailyClose",
      "dailyOpen",
      "dailyHigh",
      "dailyLow",
      "dailyVolume",
      "avgVolume10TwseSnapshot",
      "volume10maTwseSnapshot",
      "avgVolume20TwseSnapshot",
      "ma5",
      "ma10",
      "ma20",
      "ma60",
      "rsi14",
      "rsi14Standard",
      "rsi14FinMindCompatible",
      "rsi14WilderSeedSma",
      "rsi14Simple",
      "rsi14Ema",
      "rsi14Cutler",
      "high20",
      "low20",
      "return20d",
      "return60d",
      "macd",
      "macdSignal",
      "macdHist",
      "macdHistDelta3",
      "macdWarmupRows",
      "macdWarmupReady",
      "k9",
      "d9",
      "j9",
      "atr14",
      "atrPct",
      "atrPctAvg20",
      "atrPctVsAvg20",
      "atrWarmupReady",
      "kdWarmupReady",
      "priceRowCount",
      "technicalWarmupStatus",
    ];

    fields.forEach((key) => {
      applyDefinedNumber(next, key, incoming[key]);
      if (incoming[key] !== null && incoming[key] !== undefined) next[`${key}Source`] = sourceName;
    });

    // avgVolume10 / avgVolume20 是 getDerived() 的共同欄位；TWSE snapshot 優先寫入，FinMind 保留在 validationMap 做驗證 / 備援。
    if (incoming.avgVolume10 !== null && incoming.avgVolume10 !== undefined) {
      applyDefinedNumber(next, "avgVolume10", incoming.avgVolume10);
      next.avgVolume10Source = sourceName;
      applyDefinedNumber(next, "volume10ma", incoming.avgVolume10);
      next.volume10maSource = sourceName;
      next.volumeRatio = null;
      next.volumeRatioSource = "TWSE snapshot 主成交量 / 自算10日均量";
    }
    if (incoming.avgVolume20 !== null && incoming.avgVolume20 !== undefined) {
      applyDefinedNumber(next, "avgVolume20", incoming.avgVolume20);
      next.avgVolume20Source = sourceName;
    }

    const keepRealtimeQuote = shouldPreserveRealtimeMainQuote(next, incoming);

    // 盤後或非即時時段，snapshot 可以作為官方日線價量主值；盤中不覆蓋 MIS / Google 即時價量。
    if (!keepRealtimeQuote) {
      applyDefinedNumber(next, "price", incoming.dailyClose);
      applyDefinedNumber(next, "volume", incoming.dailyVolume);
      if (incoming.dailyClose !== null && incoming.dailyClose !== undefined) next.priceSource = sourceName;
      if (incoming.dailyVolume !== null && incoming.dailyVolume !== undefined) next.volumeSource = sourceName;
    }

    if (incoming.latestDate) next.twseHistoryLatestDate = incoming.latestDate;
    if (incoming.dataTime) next.twseHistoryDataTime = incoming.dataTime;
    next.twseHistorySourceNote = sourceName;

    map.set(symbol, next);
  });

  return Array.from(map.values());
}

export function mergeFinMindDailyBySymbol(currentStocks, incomingFinMindRows) {
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
      "avgVolume10",
      "volume10maFinMind",
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

function isOlderGoogleTradeTime(incomingTradeTime, currentTradeTime) {
  const incomingMs = parseGoogleTradeTimeMs(incomingTradeTime);
  const currentMs = parseGoogleTradeTimeMs(currentTradeTime);
  return Number.isFinite(incomingMs) && Number.isFinite(currentMs) && incomingMs < currentMs;
}

export function mergeGoogleQuotesBySymbol(currentStocks, incomingGoogleRows) {
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
      // V73A5: volumeRatio is derived at runtime from the current main volume / historical volume base.
      // Keep Google volumeRatio in validationMap only; do not let it overwrite main stock.volumeRatio.
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

    // V73A9: Google market fields are validation-only. FinMind Market / Derivatives own the main market-risk fields.
    // Keep googleNasdaqReturn1d / googleSoxReturn1d / googleVixChange1d in validationMap; do not overwrite main fields here.

    if (allowGoogleMainQuote && google.price !== null && google.price !== undefined) next.priceSource = sourceName;
    if (!preserveTwseOfficialPrevClose && google.prevClose !== null && google.prevClose !== undefined) next.prevCloseSource = sourceName;
    if (allowGoogleMainQuote && google.volume !== null && google.volume !== undefined) next.volumeSource = sourceName;
    if (google.volume10ma !== null && google.volume10ma !== undefined) next.volume10maSource = sourceName;
    // V73A5: Google volumeRatio is validation-only; main volumeRatioSource should describe runtime calculation.
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
    // V73A9: market-risk source labels should remain FinMind Market / Derivatives when available.

    if (google.updatedAt) next.googleUpdatedAt = google.updatedAt;
    if (google.sourceNote) next.sourceNote = google.sourceNote;
    else next.sourceNote = sourceName;
    next.priceSource = next.priceSource || sourceName;

    map.set(symbol, next);
  });

  return Array.from(map.values());
}


function isEtfAssetForMerge(stock) {
  return String(stock?.type || "").toUpperCase() === "ETF" || /^00/.test(String(stock?.symbol || ""));
}

export function mergeYahooEtfToStocks(currentStocks, yahooEtfRows = []) {
  const rows = Array.isArray(yahooEtfRows) ? yahooEtfRows : [];
  const bySymbol = new Map(rows.map((row) => [normalizeStockSymbol(row.symbol || row.stock_id), row]));

  return currentStocks.map((stock) => {
    const symbol = normalizeStockSymbol(stock.symbol);
    const row = bySymbol.get(symbol);
    if (!row) return stock;

    const next = { ...stock };
    if (isEtfAssetForMerge(next)) {
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


export function mergeOfficialEtfInavToStocks(currentStocks, officialRows = []) {
  const rows = Array.isArray(officialRows) ? officialRows : [];
  const bySymbol = new Map(rows.map((row) => [normalizeStockSymbol(row.symbol || row.stock_id), row]));

  return currentStocks.map((stock) => {
    const symbol = normalizeStockSymbol(stock.symbol);
    const row = bySymbol.get(symbol);
    if (!row || row.parseStatus !== "PASS") return stock;

    const next = { ...stock };
    if (isEtfAssetForMerge(next)) {
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

export function mergeMarketToStocks(currentStocks, marketPayload) {
  const derived = marketPayload?.derived || {};
  const gold = marketPayload?.gold || {};
  const fedRate = marketPayload?.fedRate || {};
  const bonds = Array.isArray(marketPayload?.bonds) ? marketPayload.bonds : [];
  const fx = Array.isArray(marketPayload?.fx) ? marketPayload.fx : [];
  const oil = Array.isArray(marketPayload?.oil) ? marketPayload.oil : [];
  const marketSummary = marketPayload?.dataTimeSummary || {};
  const marketDataTime = marketSummary.latestUsMarketDate || marketSummary.latestDataTime || marketSummary.latestDate || marketPayload?.finishedAt || marketPayload?.fetchedAt || "";
  const us10y = bonds.find((item) => String(item.id || "").includes("10"));
  const usd = fx.find((item) => item.id === "USD");
  const jpy = fx.find((item) => item.id === "JPY");
  const wti = oil.find((item) => item.id === "WTI");

  return currentStocks.map((stock) => {
    const next = { ...stock };
    const sourceName = "FinMind Market";

    // V73A9: FinMind Market is the main market-risk source. GoogleFinance is validation/reference only.
    if (derived.nasdaqReturn1d !== null && derived.nasdaqReturn1d !== undefined) {
      applyDefinedNumber(next, "finmindNasdaqReturn1d", derived.nasdaqReturn1d);
      next.finmindNasdaqReturn1dSource = sourceName;
      applyDefinedNumber(next, "nasdaqReturn1d", derived.nasdaqReturn1d);
      next.nasdaqReturn1dSource = sourceName;
    }

    if (derived.soxReturn1d !== null && derived.soxReturn1d !== undefined) {
      applyDefinedNumber(next, "finmindSoxReturn1d", derived.soxReturn1d);
      next.finmindSoxReturn1dSource = sourceName;
      applyDefinedNumber(next, "soxReturn1d", derived.soxReturn1d);
      next.soxReturn1dSource = sourceName;
    }

    applyDefinedNumber(next, "sp500Return1d", derived.sp500Return1d);
    applyDefinedNumber(next, "dowReturn1d", derived.dowReturn1d);

    // V73A9: VIX also uses FinMind Market as main; GoogleFinance is only used in the validation table.
    if (derived.vixChange1d !== null && derived.vixChange1d !== undefined) {
      applyDefinedNumber(next, "finmindVixChange1d", derived.vixChange1d);
      next.finmindVixChange1dSource = sourceName;
      applyDefinedNumber(next, "vixChange1d", derived.vixChange1d);
      next.vixChange1dSource = sourceName;
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
    next.marketDataTimeSummary = marketSummary;
    next.marketDataTime = marketDataTime;
    next.marketUpdatedAt = marketDataTime;
    next.marketLatestUsMarketDate = marketSummary.latestUsMarketDate || marketDataTime;
    return next;
  });
}

export function mergeDerivativesToStocks(currentStocks, derivativesPayload) {
  const derived = derivativesPayload?.derived || {};
  const futures = derivativesPayload?.futures || {};
  const futuresInstitutional = derivativesPayload?.futuresInstitutional || {};
  const options = derivativesPayload?.options || {};
  const optionInstitutional = derivativesPayload?.optionInstitutional || {};
  const derivativesSummary = derivativesPayload?.dataTimeSummary || {};
  const derivativesDataTime = derivativesSummary.futuresDate || derivativesSummary.futuresInstitutionalDate || derivativesSummary.optionDate || derivativesSummary.optionInstitutionalDate || derivativesPayload?.finishedAt || derivativesPayload?.fetchedAt || "";

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
    next.derivativesDataTimeSummary = derivativesSummary;
    next.derivativesDataTime = derivativesDataTime;
    next.derivativesUpdatedAt = derivativesDataTime;
    next.derivativesFuturesDate = derivativesSummary.futuresDate || derivativesDataTime;
    return next;
  });
}

