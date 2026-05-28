import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BUILD_VERSION = "ETF_INAV_PROBE_BUILD_25_CATHAY_REALTIME_INAV_PARSER";

type MisEtfItem = {
  symbol?: string;
  stock_id?: string;
  name?: string;
  navUrl?: string | null;
};

type CathayRealtimeRecord = {
  lastPrice: number | null;
  closingPrice: number | null;
  closingPriceDate: string | null;
  priceRiseFall: number | null;
  priceRiseFallPercent: number | null;
  estimateNav: number | null;
  closingNav: number | null;
  closingNavDate: string | null;
  navRiseFall: number | null;
  navRiseFallPercent: number | null;
  diff: number | null;
  diffRate: number | null;
  trackingGap: number | null;
  isSettle: boolean | null;
  fundCode: string | null;
  stockCode: string | null;
  stockShortNameFix: string | null;
  fundName: string | null;
  fundSName: string | null;
  etfTypeName: string | null;
  currency: string | null;
  isETF: boolean | null;
  isListedTrade: boolean | null;
  raw: unknown;
};

type CathayRealtimeParserResult = {
  adapter: "cathay_realtime_estimate_nav_list_parser_v1";
  parseStatus: "PASS" | "FAIL";
  symbol: string;
  name: string | null;
  sourceUrl: string | null;
  apiUrl: string;
  httpStatus: number | null;
  contentType: string | null;
  jsonOk: boolean;
  recordFound: boolean;
  record: CathayRealtimeRecord | null;
  officialLikeOutput: {
    symbol: string;
    name: string | null;
    fundCompany: "cathay";
    parseStatus: "PASS" | "FAIL";
    sourceType: "intraday_inav";
    dataTime: string | null;
    navDate: string | null;
    estimatedNav: number | null;
    latestPrice: number | null;
    referenceNav: number | null;
    yesterdayPrice: number | null;
    premiumDiscountPct: number | null;
    marketChange: number | null;
    marketChangePct: number | null;
    navChange: number | null;
    navChangePct: number | null;
    trackingGap: number | null;
    currency: string | null;
    sourceUrl: string | null;
    adapter: string;
    warnings: string[];
  };
  warnings: string[];
};

function safeString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function toNumberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, "").replace("%", "").replace("+", "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeDate(v: string | null): string | null {
  if (!v) return null;
  return v.replace(/\//g, "-");
}

function pickItemsFromMisJson(json: any): MisEtfItem[] {
  if (Array.isArray(json?.data)) return json.data;
  if (json?.rawDataMap && typeof json.rawDataMap === "object") return Object.values(json.rawDataMap);
  if (json?.data && typeof json.data === "object") return Object.values(json.data);
  return [];
}

async function fetchMisEtfItems(req: NextRequest, symbols: string): Promise<MisEtfItem[]> {
  const baseUrl = new URL(req.url);
  const origin = `${baseUrl.protocol}//${baseUrl.host}`;
  const misUrl = `${origin}/api/twse/mis?symbols=${encodeURIComponent(symbols)}&includeEtfList=1`;
  const res = await fetch(misUrl, { cache: "no-store", headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`TWSE MIS route failed: HTTP ${res.status}`);
  return pickItemsFromMisJson(await res.json());
}

function flattenObjects(json: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const seen = new Set<unknown>();

  function walk(v: unknown, depth: number) {
    if (depth > 14 || v == null || seen.has(v)) return;

    if (typeof v === "object") {
      seen.add(v);

      if (Array.isArray(v)) {
        for (const item of v) walk(item, depth + 1);
        return;
      }

      const obj = v as Record<string, unknown>;
      out.push(obj);

      for (const value of Object.values(obj)) walk(value, depth + 1);
    }
  }

  walk(json, 0);
  return out;
}

function normalizeRecord(obj: Record<string, unknown>): CathayRealtimeRecord {
  return {
    lastPrice: toNumberOrNull(obj.lastPrice),
    closingPrice: toNumberOrNull(obj.closingPrice),
    closingPriceDate: safeString(obj.closingPriceDate),
    priceRiseFall: toNumberOrNull(obj.priceRiseFall),
    priceRiseFallPercent: toNumberOrNull(obj.priceRiseFallPercent),
    estimateNav: toNumberOrNull(obj.estimateNav),
    closingNav: toNumberOrNull(obj.closingNav),
    closingNavDate: safeString(obj.closingNavDate),
    navRiseFall: toNumberOrNull(obj.navRiseFall),
    navRiseFallPercent: toNumberOrNull(obj.navRiseFallPercent),
    diff: toNumberOrNull(obj.diff),
    diffRate: toNumberOrNull(obj.diffRate),
    trackingGap: toNumberOrNull(obj.trackingGap),
    isSettle: typeof obj.isSettle === "boolean" ? obj.isSettle : null,
    fundCode: safeString(obj.fundCode),
    stockCode: safeString(obj.stockCode),
    stockShortNameFix: safeString(obj.stockShortNameFix),
    fundName: safeString(obj.fundName),
    fundSName: safeString(obj.fundSName),
    etfTypeName: safeString(obj.etfTypeName),
    currency: safeString(obj.currency),
    isETF: typeof obj.isETF === "boolean" ? obj.isETF : null,
    isListedTrade: typeof obj.isListedTrade === "boolean" ? obj.isListedTrade : null,
    raw: obj,
  };
}

function findRecord(json: unknown, symbol: string, fundCode: string): CathayRealtimeRecord | null {
  for (const obj of flattenObjects(json)) {
    const stockCode = safeString(obj.stockCode);
    const code = safeString(obj.fundCode);
    const estimateNav = toNumberOrNull(obj.estimateNav);
    const lastPrice = toNumberOrNull(obj.lastPrice);
    const diffRate = toNumberOrNull(obj.diffRate);

    if (
      stockCode === symbol &&
      code === fundCode &&
      estimateNav != null &&
      lastPrice != null &&
      diffRate != null
    ) {
      return normalizeRecord(obj);
    }
  }

  return null;
}

async function fetchCathayRealtimeList(symbol: string, fundCode: string): Promise<{
  apiUrl: string;
  httpStatus: number | null;
  contentType: string | null;
  jsonOk: boolean;
  record: CathayRealtimeRecord | null;
  error: string | null;
}> {
  const apiUrl = "https://cwapi.cathaysite.com.tw/api/ETF/GetRealTimeEstimateNavList";

  try {
    const res = await fetch(apiUrl, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      headers: {
        accept: "application/json,text/plain,*/*",
        "accept-language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        referer: "https://www.cathaysite.com.tw/ETF/estimate?lang=zh_TW",
        origin: "https://www.cathaysite.com.tw",
        "x-requested-with": "XMLHttpRequest",
      },
    });

    const text = await res.text();
    let json: unknown | null = null;

    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    return {
      apiUrl,
      httpStatus: res.status,
      contentType: res.headers.get("content-type"),
      jsonOk: json != null,
      record: json ? findRecord(json, symbol, fundCode) : null,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      apiUrl,
      httpStatus: null,
      contentType: null,
      jsonOk: false,
      record: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function buildOfficialLikeOutput(
  symbol: string,
  name: string | null,
  sourceUrl: string | null,
  apiUrl: string,
  record: CathayRealtimeRecord | null
): CathayRealtimeParserResult["officialLikeOutput"] {
  if (!record) {
    return {
      symbol,
      name,
      fundCompany: "cathay",
      parseStatus: "FAIL",
      sourceType: "intraday_inav",
      dataTime: null,
      navDate: null,
      estimatedNav: null,
      latestPrice: null,
      referenceNav: null,
      yesterdayPrice: null,
      premiumDiscountPct: null,
      marketChange: null,
      marketChangePct: null,
      navChange: null,
      navChangePct: null,
      trackingGap: null,
      currency: null,
      sourceUrl: apiUrl || sourceUrl,
      adapter: "cathay_realtime_estimate_nav_list_parser_v1",
      warnings: ["No Cathay realtime estimate NAV record found."],
    };
  }

  const warnings: string[] = [];

  if (record.stockCode !== symbol) warnings.push(`stockCode=${record.stockCode}; expected ${symbol}.`);
  if (record.fundCode !== "CN") warnings.push(`fundCode=${record.fundCode}; expected CN.`);
  if (record.estimateNav == null) warnings.push("estimateNav missing.");
  if (record.lastPrice == null) warnings.push("lastPrice missing.");
  if (record.diffRate == null) warnings.push("diffRate missing.");
  if (record.isSettle === true) warnings.push("isSettle=true; data may be after-market/settled, not live trading.");
  warnings.push("Cathay intraday iNAV parser is probe-stable; compare with page/TWSE MIS before merging into production.");

  return {
    symbol,
    name: record.stockShortNameFix || record.fundSName || name,
    fundCompany: "cathay",
    parseStatus: record.estimateNav != null && record.lastPrice != null && record.diffRate != null ? "PASS" : "FAIL",
    sourceType: "intraday_inav",
    dataTime: null,
    navDate: normalizeDate(record.closingNavDate),
    estimatedNav: record.estimateNav,
    latestPrice: record.lastPrice,
    referenceNav: record.closingNav,
    yesterdayPrice: record.closingPrice,
    premiumDiscountPct: record.diffRate,
    marketChange: record.priceRiseFall,
    marketChangePct: record.priceRiseFallPercent,
    navChange: record.navRiseFall,
    navChangePct: record.navRiseFallPercent,
    trackingGap: record.trackingGap,
    currency: record.currency,
    sourceUrl: apiUrl,
    adapter: "cathay_realtime_estimate_nav_list_parser_v1",
    warnings,
  };
}

async function probeCathay(item: MisEtfItem): Promise<CathayRealtimeParserResult> {
  const symbol = safeString(item.symbol) || safeString(item.stock_id) || "UNKNOWN";
  const name = safeString(item.name);
  const sourceUrl = safeString(item.navUrl);
  const fundCode = "CN";

  const fetched = await fetchCathayRealtimeList(symbol, fundCode);
  const officialLikeOutput = buildOfficialLikeOutput(symbol, name, sourceUrl, fetched.apiUrl, fetched.record);

  const warnings: string[] = [];

  if (!fetched.jsonOk) warnings.push("Cathay realtime endpoint did not return valid JSON.");
  if (!fetched.record) warnings.push(`No record matched stockCode=${symbol}, fundCode=${fundCode}.`);
  if (officialLikeOutput.parseStatus === "PASS") warnings.push("Ready for controlled integration after one more live sanity check.");

  return {
    adapter: "cathay_realtime_estimate_nav_list_parser_v1",
    parseStatus: officialLikeOutput.parseStatus,
    symbol,
    name,
    sourceUrl,
    apiUrl: fetched.apiUrl,
    httpStatus: fetched.httpStatus,
    contentType: fetched.contentType,
    jsonOk: fetched.jsonOk,
    recordFound: !!fetched.record,
    record: fetched.record,
    officialLikeOutput,
    warnings,
  };
}

export async function GET(req: NextRequest) {
  const startedAt = new Date().toISOString();
  const url = new URL(req.url);
  const symbols = url.searchParams.get("symbols") || "00878";

  try {
    const items = await fetchMisEtfItems(req, symbols);
    const cathayItems = items.filter((item) => (safeString(item.navUrl)?.toLowerCase() || "").includes("cathaysite.com.tw"));
    const results = await Promise.all(cathayItems.map(probeCathay));

    return NextResponse.json({
      ok: true,
      route: "/api/twse/etf-inav-probe",
      version: BUILD_VERSION,
      startedAt,
      finishedAt: new Date().toISOString(),
      policy: {
        purpose: "Cathay 00878 realtime iNAV parser probe using cwapi ETF GetRealTimeEstimateNavList.",
        doesNotModifyStableInavRoute: true,
        doesNotModifyScore: true,
        doesNotModifyEtfCards: true,
        doesNotReplaceYahooEtf: true,
        parserStatus: "realtime_inav_parser_probe_only_not_merged",
      },
      input: { symbols },
      summary: {
        totalInputItems: items.length,
        cathayItems: cathayItems.length,
        totalResults: results.length,
        pass: results.filter((r) => r.parseStatus === "PASS").length,
        fail: results.filter((r) => r.parseStatus === "FAIL").length,
        recordFound: results.filter((r) => r.recordFound).length,
        jsonOk: results.filter((r) => r.jsonOk).length,
        withEstimatedNav: results.filter((r) => r.officialLikeOutput.estimatedNav != null).length,
        withLatestPrice: results.filter((r) => r.officialLikeOutput.latestPrice != null).length,
        withPremiumDiscountPct: results.filter((r) => r.officialLikeOutput.premiumDiscountPct != null).length,
      },
      results,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/twse/etf-inav-probe",
        version: BUILD_VERSION,
        startedAt,
        finishedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
