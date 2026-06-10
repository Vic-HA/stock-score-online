// @ts-nocheck
// Phase B-1A: shared validation helpers.
// Keep this file UI-agnostic so Main UI and Debug UI consume the same validation logic.

export function getFieldSource(stock, key, fallback = "尚未標記來源") {
  return stock?.[`${key}Source`] || stock?.sourceNote || fallback;
}

export function getSourceValue(validationMap, symbol, source, key) {
  const payload = validationMap?.[symbol]?.[source];
  if (!payload) return null;
  return payload[key] ?? payload.google?.[key] ?? null;
}

export function getSourceName(source) {
  if (source === "google") return "GoogleFinance";
  if (source === "twse") return "TWSE";
  if (source === "twse_history") return "TWSE Snapshot";
  if (source === "twse_mis") return "TWSE MIS";
  if (source === "finmind") return "FinMind";
  if (source === "yahoo") return "Yahoo OHLCV";
  if (source === "official_etf_inav") return "ETF 即時估值";
  if (source === "yahoo_etf") return "ETF 備援";
  if (source === "eps_note") return "FinMind 財報 EPS（口徑不同）";
  if (source === "none") return "不比對";
  return "尚無比對來源";
}

export function compareSourceValue(label, currentValue, compareValue, tolerancePct, note = "", currentSource = "目前資料", compareSource = "比對來源", options = {}) {
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

  if (options.statusOverrideAfterCompare && hasCurrent) {
    status = options.statusOverrideAfterCompare;
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

export function pickCompare(validationMap, symbol, source, key) {
  return {
    value: getSourceValue(validationMap, symbol, source, key),
    source: getSourceName(source),
  };
}

export function getYahooCandidateRows(validationMap, symbol) {
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

export function getYahooCompareRow(validationMap, symbol, targetDateRaw) {
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

export function pickYahooAlignedCompare(validationMap, symbol, targetDateRaw, key) {
  const { row, exact, yahooDate } = getYahooCompareRow(validationMap, symbol, targetDateRaw);
  if (!row) return { value: null, source: "Yahoo OHLCV", date: "", matched: false };
  return {
    value: row[key] ?? row?.[key.replace(/^daily/, "").toLowerCase()] ?? null,
    source: `Yahoo OHLCV ${yahooDate}`,
    date: row.date || row.updatedAt || yahooDate,
    matched: exact,
  };
}

export function yahooAlignedCompareOptions(finDateRaw, yahooLatestDateRaw, yahooMatchedDateRaw) {
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

export function normalizePercentCompareValue(value, field = "general") {
  // 比對層吃的是主資料已標準化後的「百分點」。
  // 不再把 < 1 的值自動 *100，避免 Google 0.5708% 被二次轉成 57.08%。
  if (field === "vix") return sanitizeVixPercentPointFromVerifiedSource(value);
  return sanitizePercentPointFromVerifiedSource(value);
}

export function sanitizePercentPointFromVerifiedSource(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  // 防呆：真的出現 57.08 / -90.42 這種不合理單日指數變化，多半是前一版二次轉換留下的 localStorage。
  // 還原成 0.5708 / -0.9042。
  if (Math.abs(n) > 20) return Number((n / 100).toFixed(4));

  return n;
}

export function sanitizeVixPercentPointFromVerifiedSource(value) {
  const n = sanitizePercentPointFromVerifiedSource(value);
  if (n === null || n === undefined) return null;

  // VIX 欄位在 Google Sheet 百分比格式下，偶爾會出現 6.382 代表 0.6382% 的小數點位移。
  // Nasdaq / SOX 不套用此規則，僅針對 VIX 進行保守防呆。
  if (Math.abs(n) >= 5 && Math.abs(n) <= 20) return Number((n / 10).toFixed(4));

  return n;
}

export function reconcileVixPercentPointWithReference(value, referenceValue) {
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

export function normalizeValidationDate(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const iso = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const slash = raw.match(/(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/);
  if (slash) return `${slash[1]}-${String(slash[2]).padStart(2, "0")}-${String(slash[3]).padStart(2, "0")}`;
  return raw.slice(0, 10);
}

export function sourceDateCompareOptions(primaryDateRaw, compareDateRaw, primaryName = "FinMind", compareName = "TWSE") {
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

// Phase B-1B: validation display / grouping helpers.
export function getValidationState(rows) {
  const total = rows.length;
  const abnormal = rows.filter((row) => ["資料異常", "缺值", "無法取得", "日期未標示"].includes(row.status)).length;
  const failed = rows.filter((row) => ["差異偏大", "需檢查"].includes(row.status)).length;
  const notAligned = rows.filter((row) => ["日期未對齊", "日期不同"].includes(row.status)).length;
  const realtime = rows.filter((row) => row.status === "即時參考" || row.status === "參考差異").length;
  const passed = rows.filter((row) => row.status === "通過").length;
  if (abnormal > 0) return { label: "資料異常", tone: "bg-slate-100 text-slate-700", failed, missing: abnormal, passed, notAligned, realtime };
  if (failed > 0) return { label: "差異偏大", tone: "bg-orange-100 text-orange-800", failed, missing: abnormal, passed, notAligned, realtime };
  if (notAligned > 0) return { label: "日期未對齊", tone: "bg-blue-100 text-blue-800", failed, missing: abnormal, passed, notAligned, realtime };
  if (realtime > 0 && passed === 0) return { label: "即時參考", tone: "bg-sky-100 text-sky-800", failed, missing: abnormal, passed, notAligned, realtime };
  if (passed > 0) return { label: "通過", tone: "bg-emerald-100 text-emerald-800", failed, missing: abnormal, passed, notAligned, realtime };
  return { label: "資料異常", tone: "bg-slate-100 text-slate-700", failed, missing: total, passed: 0, notAligned, realtime };
}

export function validationSummary(rows) {
  const state = getValidationState(rows);
  if (state.label === "通過") return "可比對欄位皆在容忍範圍內，來源一致性良好。";
  if (state.label === "日期未對齊") return `有 ${state.notAligned} 項資料日期未對齊；暫不做通過或差異偏大判定。`;
  if (state.label === "差異偏大") return `有 ${state.failed} 項差異超過容忍範圍，請優先檢查數值差異與來源時間。`;
  if (state.label === "即時參考") return "目前以即時資料作參考；盤中或試算階段不硬判差異。";
  return "部分資料缺值、日期未標示或無法取得；先保留既有資料，不判定為通過。";
}


export function validationGroupOf(label = "") {
  const text = String(label || "");
  if (/現價|成交量 volume$|昨收|TWSE MIS 盤中價量|量能爆發|10日均量|20日均量/.test(text)) return "即時 / 盤中資料";
  if (/收盤價抽樣|開盤價抽樣|最高價抽樣|最低價抽樣|日收盤|日成交量|5MA|20MA|60MA|RSI|高點|低點|報酬|技術預熱|MACD|KD|ATR/.test(text)) return "歷史 / 日線 / 技術資料";
  if (/外資|投信|自營|法人|融資|融券/.test(text)) return "籌碼 / 資金資料";
  if (/Nasdaq|SOX|台指期|VIX/.test(text)) return "市場 / 風險資料";
  if (/PER|PBR|殖利率|EPS|營收|毛利|營益|負債|ROE|淨利率|財報季度/.test(text)) return "估值 / 基本面 / 中長線預備";
  if (/ETF/.test(text)) return "ETF 輔助資料";
  return "其他";
}

export function validationActionTagOf(label = "") {
  const text = String(label || "");
  if (/TWSE MIS 盤中價量|FinMind 日收盤|FinMind 日成交量|ETF 即時市價|ETF 即時估值|ETF 折溢價%|三大法人3日|三大法人20日/.test(text)) return "mergeCandidate";
  if (/ETF 備援/.test(text)) return "hideCandidate";
  return "keep";
}

export function validationRoleOf(label = "") {
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

export function validationSortKey(label = "") {
  const text = String(label || "");
  const order = [
    "現價 price", "成交量 volume", "昨收 prevClose", "TWSE MIS 盤中價量", "量能爆發比 volumeRatio", "10日均量 volume10ma", "20日均量 avgVolume20",
    "收盤價抽樣", "開盤價抽樣", "最高價抽樣", "最低價抽樣", "FinMind 日收盤 dailyClose", "FinMind 日成交量 dailyVolume", "5MA", "20MA", "60MA", "RSI14", "20日高點 high20", "20日低點 low20", "20日報酬 return20d", "60日報酬 return60d", "技術預熱 priceRowCount", "MACD", "MACD Signal", "MACD Hist", "MACD 3日Δ", "KD K9", "KD D9", "KD J9", "ATR14", "ATR%", "ATR% 20日均值", "ATR% 偏離20均",
    "外資3日 foreign3d", "投信3日 trust3d", "自營商3日 dealer3d", "三大法人3日 institutional3d", "外資20日 foreign20d", "投信20日 trust20d", "自營商20日 dealer20d", "三大法人20日 institutional20d", "融資5日 marginChange5dPct", "融券5日 shortSaleChange5dPct", "融資20日 marginChange20dPct", "融券20日 shortSaleChange20dPct",
    "Nasdaq 一日變化", "SOX 一日變化", "台指期盤後 taifexAfterHoursReturn", "VIX 一日變化",
    "本益比 PER", "PBR", "殖利率 dividendYield", "季度 EPS", "EPS 成長 epsGrowthYoY", "TWSE 隱含 EPS TTM", "EPS TTM 成長 epsTtmGrowthYoY", "月營收 MoM revenueMoM", "月營收 YoY revenueYoY", "毛利率 grossMargin", "毛利率 QoQ 變化", "營益率 operatingMargin", "營益率 QoQ 變化", "負債比 debtRatio", "ROE TTM", "淨利率 netMargin", "財報季度數 financialQuarterCount",
    "ETF TWSE MIS displayPrice", "ETF TWSE MIS 成交量", "ETF displayPriceType", "ETF 即時估值", "ETF 即時市價", "ETF 前日淨值", "ETF 折溢價%", "ETF 估值來源"
  ];
  const idx = order.findIndex((item) => item === text);
  return idx >= 0 ? idx : 9999;
}

export function enrichValidationRow(row) {
  return {
    ...row,
    actionTag: row.actionTag || validationActionTagOf(row.label),
    validationRole: row.validationRole || validationRoleOf(row.label),
  };
}

export function validationStatusClass(status) {
  if (status === "通過") return "bg-emerald-100 text-emerald-800";
  if (status === "差異偏大" || status === "需檢查") return "bg-orange-100 text-orange-800";
  if (status === "日期未對齊" || status === "日期不同") return "bg-blue-100 text-blue-800";
  if (status === "即時參考") return "bg-sky-100 text-sky-800";
  if (status === "參考差異") return "bg-amber-100 text-amber-800";
  if (status === "口徑差異") return "bg-violet-100 text-violet-800";
  if (status === "不比對") return "bg-blue-100 text-blue-800";
  if (status === "已補值") return "bg-sky-100 text-sky-800";
  if (status === "接入確認") return "bg-indigo-100 text-indigo-800";
  if (["資料異常", "日期未標示", "缺值", "無法取得"].includes(status)) return "bg-slate-100 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

export function validationDiffText(row) {
  if (["不比對", "已補值", "接入確認", "缺值", "無法取得", "日期未對齊", "日期不同", "日期未標示", "資料異常", "即時參考"].includes(row.status)) return "-";
  if (row.finmindValue === 0 && row.googleValue !== 0 && ["差異偏大", "需檢查"].includes(row.status) && row.compareMode !== "abs") return "基準為0";
  if (row.compareMode === "abs") return `${Number(row.diffPct || 0).toFixed(3)}點`;
  return `${Number(row.diffPct || 0).toFixed(1)}%`;
}

export function validationToleranceText(row) {
  if (["不比對", "已補值", "接入確認", "缺值", "無法取得", "日期未對齊", "日期不同", "日期未標示", "資料異常", "即時參考"].includes(row.status)) return "-";
  if (row.status === "參考差異" || row.status === "即時參考") return row.toleranceLabel || "參考";
  return row.toleranceLabel || `±${row.tolerancePct}%`;
}

export function compactValidationNote(row) {
  const label = String(row?.label || "");
  if (["日期未對齊", "日期不同", "日期未標示", "資料異常", "即時參考", "差異偏大"].includes(row?.status) && row?.note) return row.note;
  if (/現價/.test(label)) return "TWSE MIS 盤中主值。";
  if (/昨收/.test(label)) return "昨收獨立校正。";
  if (/成交量 volume$/.test(label)) return "官方盤後量與日線驗證。";
  if (/日收盤/.test(label)) return row?.note || "日期一致才比對。";
  if (/日成交量/.test(label)) return row?.note || "日期一致才比對。";
  if (/10日均量/.test(label)) return "量能基準。";
  if (/量能爆發/.test(label)) return "短線量能基準。";
  if (/PER/.test(label)) return "估值口徑可能不同。";
  if (/PBR|殖利率/.test(label)) return "已補值。";
  if (/季度 EPS$/.test(label)) return "FinMind 單季財報；不與 Google 估值口徑混比。";
  if (/TWSE 隱含 EPS TTM/.test(label)) return "TWSE close / PER 隱含值；FinMind EPS TTM 驗證。";
  if (/技術預熱/.test(label)) return "技術資料量檢查。";
  if (/RSI/.test(label)) return "TWSE 自算 RSI；FinMind 不同口徑驗證。";
  if (/MACD/.test(label)) return "TWSE 自算 MACD；FinMind 驗證。";
  if (/KD/.test(label)) return "TWSE 自算 KD；FinMind 驗證。";
  if (/ATR/.test(label)) return "TWSE 自算 ATR；FinMind 驗證。";
  if (/5MA|20MA|MA|高點|低點|報酬|均量/.test(label)) return "TWSE snapshot 自算；FinMind 驗證。";
  if (/外資|投信|自營|法人/.test(label)) return "法人已補值。";
  if (/融資|融券/.test(label)) return "融資券已補值。";
  if (/營收/.test(label)) return "月營收已補值。";
  if (/毛利|營益|負債|EPS 成長/.test(label)) return "財報已補值。";
  if (/VIX/.test(label)) return "市場風險參考。";
  if (/Nasdaq|SOX/.test(label)) return "市場風險參考。";
  if (/台指期/.test(label)) return "有資料才比。";
  return row?.note || "";
}

export function validationGroupRows(rows = []) {
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

export function cleanupFinMindOnlyValidationRows(rows) {
  const finmindOnlyPattern = /外資|投信|自營商|三大法人|融資|融券|月營收|EPS 成長|EPS TTM|ROE TTM|毛利率|營益率|淨利率|負債比|財報季度數/;
  return rows.map((row) => {
    if (!row || !finmindOnlyPattern.test(row.label || "")) return row;
    const currentSource = String(row.currentSource || "");
    const compareSource = String(row.compareSource || "");
    const isDuplicateFinMind = currentSource.includes("FinMind") && compareSource.includes("FinMind");
    if (!isDuplicateFinMind) return row;

    const isChip = /外資|投信|自營商|三大法人/.test(row.label);
    const isMargin = /融資|融券/.test(row.label);
    const isRevenue = /月營收/.test(row.label);
    const isFinancialCount = /財報季度數/.test(row.label);
    const note = isChip
      ? "FinMind 籌碼主資料；暫不做交叉比對，後續可接 TWSE official 抽樣驗證。"
      : isMargin
        ? "FinMind 融資融券主資料；暫不做交叉比對，後續可接 TWSE official 抽樣驗證。"
        : isRevenue
          ? "FinMind 月營收主資料；暫不做交叉比對，後續可接官方月營收抽樣驗證。"
          : isFinancialCount
            ? "確認近四季 EPS / TTM / ROE 是否有足夠財報序列；不作交叉驗證。"
            : "FinMind 財報主資料；暫不做交叉比對，後續可接 TWSE / 公開資訊觀測站抽樣驗證。";

    return {
      ...row,
      googleValue: null,
      compareSource: "暫不比對",
      diffPct: 0,
      tolerancePct: 0,
      toleranceLabel: isFinancialCount ? "需足夠" : "待官方抽樣",
      status: isFinancialCount ? "接入確認" : row.finmindValue !== null && row.finmindValue !== undefined ? "已補值" : "缺值",
      note,
    };
  });
}


export function hasValidationDateToken(source = "") {
  return /（[^）]*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{4}-\d{1,2}|\d{4}Q\d|\d{4}\/\d{1,2}\/\d{1,2})/.test(String(source || ""));
}

export function withSourceDate(source, date, detail = "", options = {}) {
  const noCompare = options.noCompare || "尚無比對來源";
  const base = String(source || "");
  if (!base || base === noCompare || /暫不比對|尚無比對|輔助資料|接入確認|不比對/.test(base)) return base;
  if (hasValidationDateToken(base)) return base;
  const dateText = normalizeValidationDate(date) || String(date || "").trim();
  if (!dateText) return base;
  return `${base}（${dateText}${detail ? ` / ${detail}` : ""}）`;
}

function recalcRelativeValidationStatus(row) {
  const current = Number(row?.finmindValue);
  const compare = Number(row?.googleValue);
  if (!Number.isFinite(current) || !Number.isFinite(compare)) return row?.status;
  if (row?.compareMode === "abs") {
    const diff = Number((compare - current).toFixed(4));
    return Math.abs(diff) <= Number(row?.tolerancePct || 0) ? "通過" : "差異偏大";
  }
  if (current === 0 && compare === 0) return "通過";
  if (current === 0 && compare !== 0) return "差異偏大";
  const diff = ((compare - current) / current) * 100;
  return Math.abs(diff) <= Number(row?.tolerancePct || 0) ? "通過" : "差異偏大";
}

export function attachValidationDateLabels(row, context = {}) {
  if (!row) return row;
  const {
    noCompare = "尚無比對來源",
    twseHistoryDate,
    finmindScoreDate,
    finmindInstitutionalDate,
    finmindMarginDate,
    finmindRevenueDate,
    finmindFinancialDate,
    twseMisTradetime,
    officialEtfDisplay = {},
    officialEtfDataDate,
    twseMisDate,
    twseMisDisplayPriceType,
  } = context;
  const addDate = (source, date, detail = "") => withSourceDate(source, date, detail, { noCompare });
  const label = String(row.label || "");
  const isTwseHistoryFinMind = /10日均量|20日均量|收盤價抽樣|開盤價抽樣|最高價抽樣|最低價抽樣|5MA|20MA|60MA|RSI14|20日高點|20日低點|20日報酬|60日報酬|MACD|KD |ATR/.test(label);
  const isChip = /外資|投信|自營商|三大法人|institutional/.test(label);
  const isMargin = /融資|融券|margin|shortSale/.test(label);
  const isRevenue = /月營收|revenue/.test(label);
  const isFinancial = /季度 EPS|EPS 成長|EPS TTM|毛利|營益|淨利率|ROE|負債|財報季度/.test(label);
  const isValuation = /PBR|殖利率|本益比 PER/.test(label);
  const isEtfRealtimePrice = /ETF 即時市價/.test(label);
  const isEtfDisplayType = /ETF displayPriceType/.test(label);

  let next = {
    ...row,
    status: ["差異偏大", "需檢查"].includes(row.status) ? "差異偏大" : row.status === "日期不同" ? "日期未對齊" : row.status,
  };

  if (isTwseHistoryFinMind) {
    if (/TWSE Snapshot|TWSE snapshot|snapshot/.test(String(next.currentSource || ""))) {
      next.currentSource = addDate(next.currentSource, twseHistoryDate);
    }
    if (/FinMind/.test(String(next.compareSource || ""))) {
      next.compareSource = addDate(next.compareSource, finmindScoreDate);
    }
    if (twseHistoryDate && finmindScoreDate && twseHistoryDate !== finmindScoreDate) {
      next.status = "日期未對齊";
      next.diffPct = 0;
      next.tolerancePct = 0;
      next.toleranceLabel = "-";
      next.note = "資料日期未對齊，暫不判定。";
    }
  }

  if (isChip) {
    next.currentSource = addDate(next.currentSource, finmindInstitutionalDate);
    next.compareSource = addDate(next.compareSource, finmindInstitutionalDate);
  } else if (isMargin) {
    next.currentSource = addDate(next.currentSource, finmindMarginDate);
    next.compareSource = addDate(next.compareSource, finmindMarginDate);
  } else if (isRevenue) {
    next.currentSource = addDate(next.currentSource, finmindRevenueDate);
    next.compareSource = addDate(next.compareSource, finmindRevenueDate);
  } else if (isFinancial) {
    next.currentSource = addDate(next.currentSource, finmindFinancialDate);
    next.compareSource = addDate(next.compareSource, finmindFinancialDate);
  } else if (isValuation) {
    if (/FinMind/.test(String(next.currentSource || ""))) next.currentSource = addDate(next.currentSource, finmindScoreDate);
    if (/FinMind/.test(String(next.compareSource || ""))) next.compareSource = addDate(next.compareSource, finmindScoreDate);
    if (next.status === "日期未標示" && finmindScoreDate) {
      next.status = recalcRelativeValidationStatus(next);
      next.note = row.note || "估值欄位已帶入資料日期。";
    }
  }

  if (isEtfDisplayType) {
    next.currentSource = addDate(next.currentSource, twseMisTradetime);
  }

  if (isEtfRealtimePrice) {
    if (/ETF 即時估值/.test(String(next.currentSource || ""))) next.currentSource = addDate(next.currentSource, officialEtfDisplay.navDate || officialEtfDataDate);
    if (/TWSE MIS/.test(String(next.compareSource || ""))) next.compareSource = addDate(next.compareSource, twseMisTradetime);
    if ((officialEtfDataDate && twseMisDate && officialEtfDataDate !== twseMisDate) || twseMisDisplayPriceType === "trial") {
      next.status = "即時參考";
      next.toleranceLabel = "參考";
      next.note = "即時資料波動中，暫供參考。";
    }
  }

  return next;
}
