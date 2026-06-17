type SourceRefreshPolicy = {
  label: string;
  timeoutMs: number;
  cooldownMs: number;
  autoRefreshMs?: number;
  maxSymbols?: number;
  cacheNote: string;
};

type RefreshResult = { ok: boolean; remainMs: number; remainSec: number };

const DEFAULT_SOURCE_POLICY: SourceRefreshPolicy = {
  label: "預設來源",
  timeoutMs: 8000,
  cooldownMs: 60000,
  cacheNote: "預設 60 秒冷卻。",
};

export const SOURCE_REFRESH_POLICY: Record<string, SourceRefreshPolicy> = {
  google_csv: {
    label: "GoogleFinance optional 驗證參考",
    timeoutMs: 15000,
    cooldownMs: 10 * 1000,
    autoRefreshMs: 20 * 1000,
    cacheNote: "選填輔助來源；前端可每 20 秒重新讀取公開 CSV，但不再作主資料依賴。Google 只更新 google validation 欄位，不覆蓋 TWSE MIS 盤中價量、TWSE OpenAPI 盤後估值、TWSE Snapshot 日線技術或 FinMind Market 風險主資料。若未設定 Google Sheet，主系統仍可用 TWSE + FinMind 正常運作。欄位僅作參考：price / prevClose / volume / PER / EPS / Nasdaq / SOX / VIX / updatedAt。",
  },
  twse_proxy: {
    label: "TWSE",
    timeoutMs: 15000,
    cooldownMs: 60 * 1000,
    autoRefreshMs: 0,
    cacheNote: "固定時段盤後校正；08:30 / 14:10 / 15:30 / 18:00 / 22:00 進入新時段才補跑。其他時間吃 route cache；不覆蓋 TWSE MIS 盤中主行情。",
  },
  twse_history_snapshot: {
    label: "TWSE Snapshot",
    timeoutMs: 15000,
    cooldownMs: 60 * 1000,
    autoRefreshMs: 0,
    cacheNote: "V73A7：讀取 /api/twse/history 的 local snapshot-first route；作為 TWSE STOCK_DAY 本機日線主資料，主值涵蓋自算 10/20日均量、MA5/20/60、RSI、MACD、KD、ATR、20日高低點與20/60日報酬。FinMind 改為驗證 / 備援，GoogleFinance 降級為即時輔助與參考。",
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
    cacheNote: "FinMind Daily 改為 TWSE snapshot 的驗證 / 備援來源；第一次進頁面與主更新預設使用 profile=score（Price + 法人 + 融資融券，3 datasets/檔），中長線欄位沿用 lastGoodFull。進階測試可手動跑 profile=full。資料來源卡片顯示的是資料時間，不是抓取時間。欄位：OHLCV、均量、MA、RSI、MACD、KD、ATR、法人、融資融券與基本面。",
  },
  finmind_market: {
    label: "FinMind Market",
    timeoutMs: 20000,
    cooldownMs: 60 * 60 * 1000,
    autoRefreshMs: 0,
    cacheNote: "FinMind Market 為市場 / 風險主資料；第一次進頁面會啟動預熱，主更新資料與進階手動按鈕也可觸發。route 端保留 1 小時 cache；頁面不做 interval 自動刷新、不帶 force。Nasdaq / SOX / VIX 以 FinMind 日收盤口徑作主值，GoogleFinance 只作同向驗證 / 參考。",
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

export const OFFICIAL_SCHEDULED_CACHE_CHECKPOINTS = ["08:30", "14:10", "15:30", "18:00", "22:00"];
export const OFFICIAL_SCHEDULED_CHECK_INTERVAL_MS = 60 * 1000;

export function getTaipeiClockParts(date: Date = new Date()): { dateKey: string; minutesOfDay: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  const hour = Number(parts.hour === "24" ? "0" : parts.hour || 0);
  const minute = Number(parts.minute || 0);
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minutesOfDay: hour * 60 + minute,
  };
}

export function scheduledCheckpointToMinutes(checkpoint: string): number | null {
  const [hour, minute] = String(checkpoint || "").split(":").map((value) => Number(value));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

type ScheduledCheckpoint = { checkpoint: string; minutes: number };

export function getScheduledOfficialCacheSlot(date: Date = new Date()): string {
  const { dateKey, minutesOfDay } = getTaipeiClockParts(date);
  const checkpoints = OFFICIAL_SCHEDULED_CACHE_CHECKPOINTS
    .map((checkpoint): ScheduledCheckpoint | null => {
      const minutes = scheduledCheckpointToMinutes(checkpoint);
      return minutes === null ? null : { checkpoint, minutes };
    })
    .filter((item): item is ScheduledCheckpoint => item !== null)
    .sort((a, b) => a.minutes - b.minutes);
  const matched = checkpoints.filter((item) => item.minutes <= minutesOfDay).at(-1);
  return matched ? `${dateKey} ${matched.checkpoint}` : "";
}

export const DEFAULT_FETCH_TIMEOUT_MS = DEFAULT_SOURCE_POLICY.timeoutMs;
export const DEFAULT_REFRESH_COOLDOWN_MS = DEFAULT_SOURCE_POLICY.cooldownMs;


export function canRefreshSource(lastFetchMap: Record<string, number> = {}, source: string, cooldownMs: number = DEFAULT_REFRESH_COOLDOWN_MS): RefreshResult {
  const last = lastFetchMap[source] || 0;
  const remainMs = Math.max(0, cooldownMs - (Date.now() - last));
  return { ok: remainMs <= 0, remainMs, remainSec: Math.ceil(remainMs / 1000) };
}

export function markSourceFetched(lastFetchMap: Record<string, number> = {}, source: string): Record<string, number> {
  return { ...lastFetchMap, [source]: Date.now() };
}

export function getSourcePolicy(source: string): SourceRefreshPolicy {
  return SOURCE_REFRESH_POLICY[source] || { ...DEFAULT_SOURCE_POLICY, label: source };
}
