// @ts-nocheck
export function formatDurationMs(ms) {
  const value = Number(ms || 0);
  if (!Number.isFinite(value) || value <= 0) return "未設定";
  if (value >= 60 * 60 * 1000) return `${Math.round(value / (60 * 60 * 1000))} 小時`;
  if (value >= 60 * 1000) return `${Math.round(value / (60 * 1000))} 分鐘`;
  return `${Math.round(value / 1000)} 秒`;
}

export function formatLastFetch(lastFetchMap, source) {
  const time = lastFetchMap?.[source];
  if (!time) return "尚未抓取";
  return new Date(time).toLocaleTimeString("zh-TW", { hour12: false });
}

export function compactSourceTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

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

export function formatCacheRuntime(cache) {
  if (!cache) return "";
  const hit = cache.hit ? "hit" : "miss";
  const age = Number.isFinite(Number(cache.ageSec)) ? `${cache.ageSec}s` : "-";
  const ttl = Number.isFinite(Number(cache.ttlSec)) ? `${cache.ttlSec}s` : "-";
  return `快取 ${hit}｜age ${age} / TTL ${ttl}`;
}

export function compactDateForDisplay(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[2]}/${iso[3]}`;
  const ym = raw.match(/^(\d{4})-(\d{2})$/);
  if (ym) return `${ym[1]}/${ym[2]}`;
  return raw;
}

export function formatRouteDataTimeSummary(json = {}, source = "") {
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

export function buildApiSourceRuntime({ source, json = {}, dataTime = "", count = null, pass = null, note = "" }) {
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

export function formatSourceRuntimeInfo(runtime, fallbackText = "尚未抓取") {
  if (!runtime) return fallbackText;
  if (runtime.summaryText) return runtime.summaryText;
  const parts = [];
  if (runtime.dataTimeText) parts.push(`資料 ${runtime.dataTimeText}`);
  if (runtime.cacheText) parts.push(runtime.cacheText);
  if (Number.isFinite(Number(runtime.count))) parts.push(`${runtime.count} 檔`);
  return parts.length ? parts.join("｜") : fallbackText;
}

export function formatPolicyAutoRefresh(item) {
  if (item?.source === "official_etf_inav") return "隨 TWSE MIS 同步";
  if (item?.source === "twse_proxy" || item?.source === "yahoo_ohlcv" || item?.source === "yahoo_etf") return "啟動預熱 / 固定時段 cache";
  if (item?.source === "finmind_proxy" || item?.source === "finmind_market" || item?.source === "finmind_derivatives") return "啟動預熱 / 主更新 / 手動";
  const ms = Number(item?.autoRefreshMs || 0);
  if (!ms) return "未設定";
  return `每 ${formatDurationMs(ms)}`;
}

export function formatPolicyMaxSymbols(item) {
  if (!item?.maxSymbols) return "";
  return `保護上限：最多 ${item.maxSymbols} 檔`;
}

export function explainCacheRuntime(runtime) {
  if (!runtime?.cache) return "";
  return runtime.cache.hit ? "使用快取，未重抓外部" : "本次重抓外部並更新快取";
}

export function pickTwseMisDataTime(json, rows = []) {
  return (
    json?.marketIndex?.tradetime ||
    rows.find((row) => row?.tradetime)?.tradetime ||
    json?.fetchedAt ||
    ""
  );
}

export function pickEtfInavDataTime(json, list = []) {
  return (
    list.find((row) => row?.dataTime)?.dataTime ||
    list.find((row) => row?.navDate)?.navDate ||
    json?.finishedAt ||
    json?.wrapperFinishedAt ||
    ""
  );
}
