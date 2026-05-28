import { NextRequest, NextResponse } from "next/server";
import { getOrFetchCached, isForceRefresh, normalizeCacheKeyPart, parseTtlMs } from "@/lib/serverCache";

export const dynamic = "force-dynamic";

const BUILD_VERSION = "ETF_INAV_CACHE_BUILD_27_TTL_20S";
const DEFAULT_CACHE_TTL_MS = 20 * 1000;

type MisEtfItem = {
  symbol?: string;
  stock_id?: string;
  name?: string;
  displayPrice?: number | string | null;
  displayPriceType?: string | null;
  volume?: number | string | null;
  tradetime?: string | null;
  navUrl?: string | null;
  isEtfCandidate?: boolean;
};

type YuantaValue = string | number | boolean | null;

type YuantaResolvedInav = {
  parseStatus: "PASS" | "PARTIAL" | "FAIL";
  symbol: string;
  isinCode: string | null;
  fundIdToken: string | null;
  stkCdToken: string | null;
  stkCdValue: YuantaValue | null;
  stkNameToken: string | null;
  stkNameValue: YuantaValue | null;
  rawRecord: string | null;
  tokens: Record<string, string | null>;
  values: Record<string, YuantaValue | null>;
  unresolvedTokens: string[];
  warnings: string[];
};

type YuantaOfficialParserResult = {
  adapter: "yuanta_official_iife_parser_v1";
  parseStatus: "PASS" | "PARTIAL" | "FAIL" | "SKIP";
  symbol: string;
  name: string | null;
  sourceUrl: string | null;
  isinCode: string | null;

  dataTime: string | null;
  navDate: string | null;

  estimatedNav: number | null;
  latestPrice: number | null;
  referenceNav: number | null;
  yesterdayPrice: number | null;

  index: number | null;
  indexFluct: number | null;

  premiumDiscountPct: number | null;
  trackingDiffRaw: number | null;
  currency: string | null;
  businessDay: boolean | null;

  rawTokens: {
    etfId: string | null;
    inav: string | null;
    nav: string | null;
    price: string | null;
    rnav: string | null;
    updateTime: string | null;
    navDate: string | null;
  };

  warnings: string[];
};

type FubonOfficialParserResult = {
  adapter: "fubon_html_table_v1";
  parseStatus: "PASS" | "PARTIAL" | "FAIL" | "SKIP";
  symbol: string;
  name: string | null;
  sourceUrl: string | null;

  dataTime: string | null;
  navDate: string | null;

  estimatedNav: number | null;
  latestPrice: number | null;
  referenceNav: number | null;
  yesterdayPrice: number | null;

  premiumDiscountPct: number | null;
  currency: string | null;
  businessDay: boolean | null;

  scopedRowText: string | null;
  warnings: string[];
};

type CathayOfficialParserResult = {
  adapter: "cathay_realtime_estimate_nav_list_parser_v1";
  parseStatus: "PASS" | "FAIL";
  sourceType: "intraday_inav";
  symbol: string;
  name: string | null;
  sourceUrl: string | null;

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
  businessDay: boolean | null;
  httpStatus: number | null;
  contentType: string | null;
  jsonOk: boolean;
  recordFound: boolean;
  rawRecord: unknown;
  warnings: string[];
};

type CompactInavResult = {
  symbol: string;
  name: string | null;
  fundCompany: string;
  parseStatus: "PASS" | "PARTIAL" | "FAIL" | "SKIP";
  sourceType: string | null;
  dataTime: string | null;
  navDate: string | null;
  estimatedNav: number | null;
  latestPrice: number | null;
  referenceNav: number | null;
  yesterdayPrice: number | null;
  premiumDiscountPct: number | null;
  currency: string | null;
  businessDay: boolean | null;
  sourceUrl: string | null;
  adapter: string | null;
  warnings: string[];
};

type YuantaIifeResolverResult = {
  adapter: "yuanta_iife_alias_resolver_v1";
  parseStatus: "PASS" | "PARTIAL" | "FAIL" | "SKIP";
  symbol: string;
  sourceUrl: string | null;
  nuxtFound: boolean;
  nuxtLength: number | null;
  targetIsinPrefix: string;
  iifeParamCount: number;
  iifeArgCount: number;
  aliasCount: number;
  aliasSamples: Array<{ key: string; value: YuantaValue }>;
  fundBlockFound: boolean;
  fundBlock: string | null;
  allInavRecordCount: number;
  matchedInavRecordFound: boolean;
  resolved: YuantaResolvedInav | null;
  warnings: string[];
};

type ScriptDiscovery = {
  scriptCount: number;
  jsonScriptCount: number;
  nuxtDataFound: boolean;
  apiUrlCandidates: string[];
};

type ProbeResult = {
  symbol: string;
  name: string | null;
  displayPrice: number | null;
  displayPriceType: string | null;
  volume: number | null;
  tradetime: string | null;
  navUrl: string | null;
  probeUrl: string | null;
  fundCompany: string;

  probeStatus: "PASS" | "FAIL" | "SKIP";
  httpStatus: number | null;
  finalUrl: string | null;
  contentType: string | null;
  htmlLength: number | null;
  title: string | null;
  keywordHits: string[];
  discovery: ScriptDiscovery | null;

  yuantaIifeResolverResult: YuantaIifeResolverResult | null;
  yuantaOfficialParserResult: YuantaOfficialParserResult | null;
  fubonOfficialParserResult: FubonOfficialParserResult | null;
  cathayOfficialParserResult: CathayOfficialParserResult | null;

  error: string | null;
};

function safeString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function toNumberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, "").replace("%", "").replace("+", "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function detectFundCompany(navUrl: string | null): string {
  const u = (navUrl || "").toLowerCase();
  if (u.includes("yuantaetfs.com")) return "yuanta";
  if (u.includes("fsit.com.tw") || u.includes("fubonetf")) return "fubon";
  if (u.includes("cathaysite.com.tw")) return "cathay";
  if (u.includes("capitalfund.com.tw")) return "capital";
  return "unknown";
}

function normalizeProbeUrl(navUrl: string | null): string | null {
  if (!navUrl) return null;

  const raw = navUrl.trim();
  const lower = raw.toLowerCase();

  if (
    lower.includes("yuantaetfs.com") &&
    (
      lower.includes("#/rtnav/index") ||
      lower === "http://www.yuantaetfs.com/" ||
      lower === "https://www.yuantaetfs.com/" ||
      lower === "http://yuantaetfs.com/" ||
      lower === "https://yuantaetfs.com/"
    )
  ) {
    return "https://www.yuantaetfs.com/tradeInfo/INav";
  }

  if (lower.startsWith("http://www.yuantaetfs.com")) {
    return raw.replace(/^http:\/\/www\.yuantaetfs\.com/i, "https://www.yuantaetfs.com");
  }

  if (lower.startsWith("http://yuantaetfs.com")) {
    return raw.replace(/^http:\/\/yuantaetfs\.com/i, "https://www.yuantaetfs.com");
  }

  return raw;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/\\u002f/gi, "/")
    .replace(/\\u002F/g, "/")
    .replace(/\\\//g, "/")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/g, "/")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m?.[1]) return null;
  return decodeHtmlEntities(m[1]).replace(/\s+/g, " ").trim().slice(0, 160);
}

function extractKeywordHits(html: string): string[] {
  const lower = html.toLowerCase();
  const keywords = [
    "iNAV",
    "INAV",
    "預估淨值",
    "即時預估淨值",
    "基金淨值",
    "淨值",
    "折溢價",
    "市價",
    "更新時間",
    "ETF",
    "estimate",
    "nav",
    "networth",
    "api",
    "json",
    "__NUXT__",
  ];

  const hits: string[] = [];
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) hits.push(kw);
  }
  return Array.from(new Set(hits));
}

function uniqueLimit(items: string[], limit: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const s = item.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

function extractScriptTags(html: string): string[] {
  const scripts: string[] = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) scripts.push(m[0]);
  return scripts;
}

function extractJsonScriptCount(scripts: string[]): number {
  let count = 0;
  for (const s of scripts) {
    const lower = s.toLowerCase();
    if (
      lower.includes('type="application/json"') ||
      lower.includes("type='application/json'") ||
      lower.includes("application/ld+json") ||
      lower.includes("__next_data__") ||
      lower.includes("__nuxt__")
    ) {
      count += 1;
    }
  }
  return count;
}

function extractApiUrlCandidates(html: string): string[] {
  const candidates: string[] = [];
  const patterns = [
    /https?:\/\/[^"'\\\s<>]+/gi,
    /["'](\/(?:api|ETF|etf|Trade|trade|fund|Fund|ajax|Ajax|Home|home|Product|product|INav|inav)[^"']+)["']/g,
    /["']([^"']+\.(?:asmx|ashx|aspx|json|do|action|api)(?:\?[^"']*)?)["']/gi,
  ];

  for (const re of patterns) {
    for (const m of html.matchAll(re)) {
      const raw = (m[1] || m[0] || "").trim();
      if (!raw) continue;
      const decoded = decodeHtmlEntities(raw);
      const lower = decoded.toLowerCase();

      const looksUseful =
        lower.includes("api") ||
        lower.includes("ajax") ||
        lower.includes("json") ||
        lower.includes("inav") ||
        lower.includes("nav") ||
        lower.includes("estimate") ||
        lower.includes("networth") ||
        lower.includes("fund") ||
        lower.includes("etf") ||
        lower.includes("trade") ||
        lower.includes("stock") ||
        lower.includes("product") ||
        lower.includes("yuantaetfs");

      if (looksUseful && decoded.length <= 300) candidates.push(decoded);
    }
  }

  return uniqueLimit(candidates, 100);
}

function discoverScriptData(html: string): ScriptDiscovery {
  const scripts = extractScriptTags(html);
  return {
    scriptCount: scripts.length,
    jsonScriptCount: extractJsonScriptCount(scripts),
    nuxtDataFound: /__NUXT__/i.test(html) || /window\.__NUXT__/i.test(html),
    apiUrlCandidates: extractApiUrlCandidates(html),
  };
}

function extractNuxtStateText(html: string): string | null {
  const marker = "window.__NUXT__=";
  const idx = html.indexOf(marker);
  if (idx < 0) return null;

  const scriptEnd = html.indexOf("</script>", idx);
  if (scriptEnd < 0) {
    return decodeHtmlEntities(html.slice(idx, Math.min(html.length, idx + 1200000)));
  }

  return decodeHtmlEntities(html.slice(idx, scriptEnd));
}

function normalizeSample(s: string, max = 1800): string {
  return decodeHtmlEntities(s)
    .replace(/\s+/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\\t/g, " ")
    .trim()
    .slice(0, max);
}

function parsePrimitiveLiteral(raw: string): YuantaValue | undefined {
  const s = raw.trim();

  if (s === "null") return null;
  if (s === "void 0" || s === "undefined") return null;
  if (s === "!0" || s === "true") return true;
  if (s === "!1" || s === "false") return false;

  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return decodeHtmlEntities(s.slice(1, -1));
  }

  if (/^-?\d+(?:\.\d+)?$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }

  return undefined;
}

function splitTopLevelArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let quote: '"' | "'" | "`" | null = null;
  let escaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (quote) {
      current += ch;

      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }

      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      current += ch;
      continue;
    }

    if (ch === "(") depthParen += 1;
    if (ch === ")") depthParen -= 1;
    if (ch === "[") depthBracket += 1;
    if (ch === "]") depthBracket -= 1;
    if (ch === "{") depthBrace += 1;
    if (ch === "}") depthBrace -= 1;

    if (ch === "," && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      args.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.trim()) args.push(current.trim());

  return args;
}

function findMatchingBrace(input: string, openBraceIndex: number): number {
  let depth = 0;
  let quote: '"' | "'" | "`" | null = null;
  let escaped = false;

  for (let i = openBraceIndex; i < input.length; i += 1) {
    const ch = input[i];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function findMatchingParen(input: string, openParenIndex: number): number {
  let depth = 0;
  let quote: '"' | "'" | "`" | null = null;
  let escaped = false;

  for (let i = openParenIndex; i < input.length; i += 1) {
    const ch = input[i];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === "(") depth += 1;
    if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function findIifeArgsAfterFunctionBody(nuxt: string, functionBodyClose: number): { argStart: number; argEnd: number; mode: string } {
  let p = functionBodyClose + 1;

  while (p < nuxt.length && /\s/.test(nuxt[p])) p += 1;

  // Nuxt 可能格式 A：
  // (function(a,b){return ...})(arg0,arg1)
  // body close 後先遇到 ")"，再遇到 args "("
  if (nuxt[p] === ")") {
    p += 1;
    while (p < nuxt.length && /\s/.test(nuxt[p])) p += 1;

    if (nuxt[p] === "(") {
      const end = findMatchingParen(nuxt, p);
      return { argStart: p, argEnd: end, mode: "classic_parenthesized_function_call" };
    }
  }

  // Nuxt 可能格式 B：
  // (function(a,b){return ...}(arg0,arg1))
  // body close 後直接遇到 args "("
  if (nuxt[p] === "(") {
    const end = findMatchingParen(nuxt, p);
    return { argStart: p, argEnd: end, mode: "direct_function_call" };
  }

  // fallback：從 body close 後小範圍找第一個像 args 的 "("
  const searchEnd = Math.min(nuxt.length, functionBodyClose + 300);
  for (let i = functionBodyClose + 1; i < searchEnd; i += 1) {
    if (nuxt[i] === "(") {
      const end = findMatchingParen(nuxt, i);
      if (end > i) return { argStart: i, argEnd: end, mode: "nearby_first_paren_fallback" };
    }
  }

  return { argStart: -1, argEnd: -1, mode: "not_found" };
}

function extractIifeAliasMap(nuxt: string): {
  params: string[];
  args: string[];
  aliases: Map<string, YuantaValue>;
  warnings: string[];
} {
  const warnings: string[] = [];
  const aliases = new Map<string, YuantaValue>();

  // Nuxt 2 常見格式：
  // window.__NUXT__=(function(a,b,c,...){ return ... }(...))
  // 或：
  // window.__NUXT__=(function(a,b,c,...){ return ... })(...)
  const paramMatch =
    nuxt.match(/window\.__NUXT__\s*=\s*\(function\s*\(([^)]{1,40000})\)\s*\{/) ||
    nuxt.match(/window\.__NUXT__\s*=\s*function\s*\(([^)]{1,40000})\)\s*\{/);

  if (!paramMatch?.[1]) {
    return { params: [], args: [], aliases, warnings: ["IIFE parameter list not found."] };
  }

  const params = paramMatch[1]
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const functionOpenBrace = nuxt.indexOf("{", paramMatch.index || 0);
  if (functionOpenBrace < 0) {
    return { params, args: [], aliases, warnings: ["IIFE function body open brace not found."] };
  }

  const functionCloseBrace = findMatchingBrace(nuxt, functionOpenBrace);
  if (functionCloseBrace < 0) {
    return { params, args: [], aliases, warnings: ["IIFE function body close brace not found."] };
  }

  const callsite = findIifeArgsAfterFunctionBody(nuxt, functionCloseBrace);
  if (callsite.argStart < 0 || callsite.argEnd < 0 || callsite.argEnd <= callsite.argStart) {
    return {
      params,
      args: [],
      aliases,
      warnings: [
        "IIFE argument list not found after function body.",
        `IIFE callsite mode=${callsite.mode}`,
        `functionCloseBrace=${functionCloseBrace}`,
      ],
    };
  }

  const argText = nuxt.slice(callsite.argStart + 1, callsite.argEnd);
  const args = splitTopLevelArgs(argText);

  const n = Math.min(params.length, args.length);

  for (let i = 0; i < n; i += 1) {
    const value = parsePrimitiveLiteral(args[i]);
    if (value !== undefined) aliases.set(params[i], value);
  }

  if (params.length !== args.length) {
    warnings.push(`IIFE params/args length mismatch: params=${params.length}, args=${args.length}`);
  }

  warnings.push(`IIFE callsite mode=${callsite.mode}`);

  if (aliases.size === 0) {
    warnings.push("IIFE alias map extracted zero primitive aliases.");
  }

  return { params, args, aliases, warnings };
}

function resolveToken(token: string | null, aliases: Map<string, YuantaValue>): YuantaValue | null {
  if (!token) return null;

  const primitive = parsePrimitiveLiteral(token);
  if (primitive !== undefined) return primitive;

  if (/^-?\d+(?:\.\d+)?$/.test(token)) return Number(token);

  return aliases.has(token) ? aliases.get(token)! : null;
}

function extractTokenAfterKey(block: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const quoted = new RegExp(`${escaped}\\s*:\\s*("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*')`);
  const mq = block.match(quoted);
  if (mq?.[1]) return mq[1];

  const bare = new RegExp(`${escaped}\\s*:\\s*([A-Za-z_$][\\w$]*|-?\\d+(?:\\.\\d+)?)`);
  const mb = block.match(bare);
  if (mb?.[1]) return mb[1];

  return null;
}

function makeTargetIsinPrefix(symbol: string): string {
  return `TW000${symbol}`;
}

function findFundBlockByIsinPrefix(nuxt: string, symbol: string): string | null {
  const isinPrefix = makeTargetIsinPrefix(symbol);
  const idx = nuxt.indexOf(isinPrefix);

  if (idx < 0) return null;

  const left = Math.max(0, idx - 6200);
  const right = Math.min(nuxt.length, idx + 2200);
  const windowText = nuxt.slice(left, right);

  const fundIdx = Math.max(
    windowText.lastIndexOf("{FUND_ID:"),
    windowText.lastIndexOf(",{FUND_ID:")
  );

  if (fundIdx >= 0) {
    return normalizeSample(windowText.slice(fundIdx, Math.min(windowText.length, fundIdx + 6200)), 6200);
  }

  return normalizeSample(windowText, 6200);
}

function findFundBlockByLiteralSymbol(nuxt: string, symbol: string): string | null {
  const needles = [
    `product/detail/${symbol}`,
    `product/detail\\/${symbol}`,
    symbol,
  ];

  for (const needle of needles) {
    const idx = nuxt.indexOf(needle);
    if (idx < 0) continue;

    const left = Math.max(0, idx - 6200);
    const right = Math.min(nuxt.length, idx + 3000);
    const windowText = nuxt.slice(left, right);

    if (windowText.includes("FUND_ID") && windowText.includes("STK_CD")) {
      return normalizeSample(windowText, 6200);
    }
  }

  return null;
}

function extractIsinFromBlock(block: string | null): string | null {
  if (!block) return null;
  const m = block.match(/ISINCODE\s*:\s*"([^"]+)"/);
  return m?.[1] || null;
}

function extractAllInavRecords(nuxt: string): string[] {
  const records: string[] = [];
  const recordRe = /\{[^{}]{0,80}?chkNavDate\s*:[^{}]{0,1200}?rtTd\s*:[^{}]{0,260}?tdCrncy\s*:[^{}]{0,120}?\}/g;

  for (const m of nuxt.matchAll(recordRe)) {
    records.push(normalizeSample(m[0], 2200));
    if (records.length >= 320) break;
  }

  return records;
}

function buildResolvedRecord(raw: string, aliases: Map<string, YuantaValue>): YuantaResolvedInav["tokens"] {
  const keys = [
    "chkNavDate",
    "etfId",
    "inav",
    "inavType",
    "index",
    "indexFluct",
    "nav",
    "navDate",
    "navFluct",
    "navPct",
    "priYdDate",
    "price",
    "priceFluct",
    "pricePct",
    "rnav",
    "updateTime",
    "yestIndex",
    "yestNav",
    "yestPrice",
    "rtTd",
    "bussDay",
    "tdCrncy",
  ];

  const tokens: Record<string, string | null> = {};
  for (const key of keys) tokens[key] = extractTokenAfterKey(raw, key);
  return tokens;
}

function resolveRecordValues(tokens: Record<string, string | null>, aliases: Map<string, YuantaValue>): Record<string, YuantaValue | null> {
  const values: Record<string, YuantaValue | null> = {};
  for (const [key, token] of Object.entries(tokens)) values[key] = resolveToken(token, aliases);
  return values;
}

function discoverYuantaIifeResolved(html: string, symbol: string, sourceUrl: string | null): YuantaIifeResolverResult {
  const nuxt = extractNuxtStateText(html);
  const targetIsinPrefix = makeTargetIsinPrefix(symbol);

  const base: YuantaIifeResolverResult = {
    adapter: "yuanta_iife_alias_resolver_v1",
    parseStatus: "SKIP",
    symbol,
    sourceUrl,
    nuxtFound: !!nuxt,
    nuxtLength: nuxt ? nuxt.length : null,
    targetIsinPrefix,
    iifeParamCount: 0,
    iifeArgCount: 0,
    aliasCount: 0,
    aliasSamples: [],
    fundBlockFound: false,
    fundBlock: null,
    allInavRecordCount: 0,
    matchedInavRecordFound: false,
    resolved: null,
    warnings: [],
  };

  if (!nuxt) {
    return {
      ...base,
      parseStatus: "FAIL",
      warnings: ["window.__NUXT__ not found."],
    };
  }

  const { params, args, aliases, warnings: aliasWarnings } = extractIifeAliasMap(nuxt);

  const fundBlock = findFundBlockByIsinPrefix(nuxt, symbol) || findFundBlockByLiteralSymbol(nuxt, symbol);
  const fundIdToken = extractTokenAfterKey(fundBlock || "", "FUND_ID");
  const stkCdToken = extractTokenAfterKey(fundBlock || "", "STK_CD");
  const stkNameToken = extractTokenAfterKey(fundBlock || "", "STK_NAME");
  const isinCode = extractIsinFromBlock(fundBlock);

  const stkCdValue = resolveToken(stkCdToken, aliases);
  const stkNameValue = resolveToken(stkNameToken, aliases);

  const allRecords = extractAllInavRecords(nuxt);
  const matchedRaw =
    allRecords.find((r) => stkCdToken && extractTokenAfterKey(r, "etfId") === stkCdToken) || null;

  let resolved: YuantaResolvedInav | null = null;

  if (matchedRaw) {
    const tokens = buildResolvedRecord(matchedRaw, aliases);
    const values = resolveRecordValues(tokens, aliases);
    const unresolvedTokens = Object.entries(tokens)
      .filter(([_, token]) => token && resolveToken(token, aliases) == null)
      .map(([key, token]) => `${key}:${token}`);

    const required = ["inav", "nav", "price", "rnav", "updateTime", "navDate"];
    const warnings: string[] = [];

    for (const key of required) {
      if (values[key] == null) warnings.push(`Unresolved value: ${key}:${tokens[key]}`);
    }

    resolved = {
      parseStatus: warnings.length === 0 ? "PASS" : "PARTIAL",
      symbol,
      isinCode,
      fundIdToken,
      stkCdToken,
      stkCdValue,
      stkNameToken,
      stkNameValue,
      rawRecord: matchedRaw,
      tokens,
      values,
      unresolvedTokens,
      warnings,
    };
  }

  const aliasSamples = Array.from(aliases.entries())
    .filter(([key, value]) => {
      const s = String(value);
      return (
        s === symbol ||
        s === makeTargetIsinPrefix(symbol) ||
        s.includes(symbol) ||
        ["aZ", "y", "b", stkCdToken, fundIdToken, stkNameToken].filter(Boolean).includes(key)
      );
    })
    .slice(0, 80)
    .map(([key, value]) => ({ key, value }));

  const warnings: string[] = [...aliasWarnings];

  if (!fundBlock) warnings.push(`No fundBlock found by ISIN prefix ${targetIsinPrefix} or literal symbol.`);
  if (fundBlock && !isinCode) warnings.push("fundBlock found but ISINCODE not extracted.");
  if (!stkCdToken) warnings.push("STK_CD token not extracted from target fundBlock.");
  if (!matchedRaw) warnings.push(`No iNAV record found with etfId token matching STK_CD token ${stkCdToken}.`);
  if (aliases.size === 0) warnings.push("No IIFE aliases extracted.");

  const parseStatus =
    resolved?.parseStatus === "PASS"
      ? "PASS"
      : resolved
        ? "PARTIAL"
        : "FAIL";

  return {
    ...base,
    parseStatus,
    iifeParamCount: params.length,
    iifeArgCount: args.length,
    aliasCount: aliases.size,
    aliasSamples,
    fundBlockFound: !!fundBlock,
    fundBlock,
    allInavRecordCount: allRecords.length,
    matchedInavRecordFound: !!matchedRaw,
    resolved,
    warnings,
  };
}

function asNumberValue(v: YuantaValue | null | undefined): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, "").replace("%", "").replace("+", "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asStringValue(v: YuantaValue | null | undefined): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return String(v);
  return null;
}

function asBooleanValue(v: YuantaValue | null | undefined): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    if (v.toLowerCase() === "true") return true;
    if (v.toLowerCase() === "false") return false;
  }
  return null;
}

function normalizeYuantaDate(s: string | null): string | null {
  if (!s) return null;
  const compact = s.replace(/\D/g, "");
  if (compact.length === 8) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  }
  return s;
}


function htmlToLooseText(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(tr|td|th|div|li|p|span|br|section|article|ul|ol|table)>/gi, "\n")
    .replace(/<(tr|td|th|div|li|p|span|br|section|article|ul|ol|table)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function findFubonRowText(text: string, symbol: string, name: string | null): string | null {
  const lines = text.split("\n").map((x) => x.trim()).filter(Boolean);
  const candidates: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.includes(symbol) && !(name && line.includes(name))) continue;

    const start = Math.max(0, i - 12);
    const end = Math.min(lines.length, i + 52);
    const block = lines.slice(start, end).join(" | ");

    const useful =
      block.includes("預估淨值") ||
      block.includes("最新市價") ||
      block.includes("昨收市價") ||
      block.includes("昨收淨值") ||
      block.includes("折溢價") ||
      block.includes("資料時間") ||
      block.includes(symbol);

    if (useful) candidates.push(block);
  }

  const sorted = candidates.sort((a, b) => {
    const score = (s: string) =>
      (s.includes("最新市價") ? 10 : 0) +
      (s.includes("預估淨值") ? 10 : 0) +
      (s.includes("昨收市價") ? 5 : 0) +
      (s.includes("昨收淨值") ? 5 : 0) +
      (s.includes("資料時間") ? 4 : 0) +
      (s.includes(symbol) ? 2 : 0);
    return score(b) - score(a);
  });

  return sorted[0]?.slice(0, 2600) || null;
}

function scopeFubonRow(rowText: string, symbol: string): string {
  const idx = rowText.indexOf(symbol);
  if (idx < 0) return rowText;

  let scoped = rowText.slice(idx);

  // 遇到下一檔富邦 ETF 就截斷，避免折溢價抓到下一檔。
  const nextEtfMatch = scoped.slice(symbol.length).match(/\|\s*00\d{2,4}[A-Z]?\s+富邦/);
  if (nextEtfMatch?.index != null) {
    scoped = scoped.slice(0, symbol.length + nextEtfMatch.index);
  }

  return scoped.trim();
}

function extractFubonDateTime(text: string): string | null {
  const patterns = [
    /資料時間[：:\s]*([0-9]{4}[/-][0-9]{1,2}[/-][0-9]{1,2}\s+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)/,
    /更新時間[：:\s]*([0-9]{4}[/-][0-9]{1,2}[/-][0-9]{1,2}\s+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)/,
    /([0-9]{4}[/-][0-9]{1,2}[/-][0-9]{1,2}\s+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)/,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].replace(/\//g, "-").replace(" ", "T");
  }

  return null;
}

function extractFubonNumberAfterLabel(text: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}\\s*\\|\\s*(-?\\d{1,4}(?:,\\d{3})*(?:\\.\\d{1,6})?)`);
  const m = text.match(re);
  if (!m?.[1]) return null;
  return toNumberOrNull(m[1]);
}

function extractFubonPremiumDiscountPct(text: string, estimatedNav: number | null, latestPrice: number | null): number | null {
  const direct = text.match(/折溢價\s*\|\s*幅度\s*\|\s*(-?\d{1,3}(?:\.\d{1,4})?)%/);
  if (direct?.[1]) return toNumberOrNull(direct[1]);

  if (estimatedNav != null && latestPrice != null && estimatedNav !== 0) {
    return Number((((latestPrice - estimatedNav) / estimatedNav) * 100).toFixed(4));
  }

  return null;
}

function extractFubonNavDate(text: string, dataTime: string | null): string | null {
  const m = text.match(/昨收淨值\s*\|\s*-?\d{1,4}(?:,?\d{3})*(?:\.\d{1,6})?\s*\|\s*\(([0-9]{1,2})\/([0-9]{1,2})\)/);
  if (!m?.[1] || !m?.[2]) return null;

  const year = dataTime?.slice(0, 4) || new Date().getFullYear().toString();
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");

  return `${year}-${mm}-${dd}`;
}

function buildFubonOfficialParserResult(
  html: string,
  symbol: string,
  name: string | null,
  sourceUrl: string | null
): FubonOfficialParserResult {
  const text = htmlToLooseText(html);
  const rowText = findFubonRowText(text, symbol, name);
  const dataTime = extractFubonDateTime(text);

  if (!rowText) {
    return {
      adapter: "fubon_html_table_v1",
      parseStatus: "FAIL",
      symbol,
      name,
      sourceUrl,
      dataTime,
      navDate: null,
      estimatedNav: null,
      latestPrice: null,
      referenceNav: null,
      yesterdayPrice: null,
      premiumDiscountPct: null,
      currency: "NTD",
      businessDay: null,
      scopedRowText: null,
      warnings: ["No symbol/name nearby row text found in Fubon HTML."],
    };
  }

  const scopedRowText = scopeFubonRow(rowText, symbol);

  const latestPrice = extractFubonNumberAfterLabel(scopedRowText, "最新市價");
  const estimatedNav = extractFubonNumberAfterLabel(scopedRowText, "預估淨值");
  const yesterdayPrice = extractFubonNumberAfterLabel(scopedRowText, "昨收市價");
  const referenceNav = extractFubonNumberAfterLabel(scopedRowText, "昨收淨值");
  const premiumDiscountPct = extractFubonPremiumDiscountPct(scopedRowText, estimatedNav, latestPrice);
  const navDate = extractFubonNavDate(scopedRowText, dataTime);

  const warnings: string[] = [];

  if (latestPrice == null) warnings.push("Missing latestPrice from 最新市價.");
  if (estimatedNav == null) warnings.push("Missing estimatedNav from 預估淨值.");
  if (referenceNav == null) warnings.push("Missing referenceNav from 昨收淨值.");
  if (yesterdayPrice == null) warnings.push("Missing yesterdayPrice from 昨收市價.");
  if (premiumDiscountPct == null) warnings.push("Missing premiumDiscountPct.");
  if (dataTime == null) warnings.push("Missing dataTime.");
  if (navDate == null) warnings.push("Missing navDate.");

  return {
    adapter: "fubon_html_table_v1",
    parseStatus: warnings.length === 0 ? "PASS" : "PARTIAL",
    symbol,
    name,
    sourceUrl,
    dataTime,
    navDate,
    estimatedNav,
    latestPrice,
    referenceNav,
    yesterdayPrice,
    premiumDiscountPct,
    currency: "NTD",
    businessDay: scopedRowText.includes("Y") ? true : null,
    scopedRowText,
    warnings,
  };
}

function buildYuantaOfficialParserResult(
  symbol: string,
  name: string | null,
  sourceUrl: string | null,
  resolver: YuantaIifeResolverResult | null
): YuantaOfficialParserResult | null {
  if (!resolver) return null;

  const resolved = resolver.resolved;
  if (!resolved) {
    return {
      adapter: "yuanta_official_iife_parser_v1",
      parseStatus: "FAIL",
      symbol,
      name,
      sourceUrl,
      isinCode: null,
      dataTime: null,
      navDate: null,
      estimatedNav: null,
      latestPrice: null,
      referenceNav: null,
      yesterdayPrice: null,
      index: null,
      indexFluct: null,
      premiumDiscountPct: null,
      trackingDiffRaw: null,
      currency: null,
      businessDay: null,
      rawTokens: {
        etfId: null,
        inav: null,
        nav: null,
        price: null,
        rnav: null,
        updateTime: null,
        navDate: null,
      },
      warnings: ["Yuanta IIFE resolver did not produce a resolved record."],
    };
  }

  const v = resolved.values;
  const t = resolved.tokens;

  const estimatedNav = asNumberValue(v.inav ?? v.nav);
  const latestPrice = asNumberValue(v.price);
  const referenceNav = asNumberValue(v.rnav);
  const yesterdayPrice = asNumberValue(v.yestPrice);
  const index = asNumberValue(v.index);
  const indexFluct = asNumberValue(v.indexFluct);
  const dataTime = asStringValue(v.updateTime);
  const navDate = normalizeYuantaDate(asStringValue(v.navDate));
  const currency = asStringValue(v.tdCrncy);
  const businessDay = asBooleanValue(v.bussDay);

  let premiumDiscountPct: number | null = null;
  if (estimatedNav != null && latestPrice != null && estimatedNav !== 0) {
    premiumDiscountPct = Number((((latestPrice - estimatedNav) / estimatedNav) * 100).toFixed(4));
  }

  const trackingDiffRaw = asNumberValue(v.rtTd);

  const warnings: string[] = [];

  if (estimatedNav == null) warnings.push("Missing estimatedNav from inav/nav.");
  if (latestPrice == null) warnings.push("Missing latestPrice from price.");
  if (referenceNav == null) warnings.push("Missing referenceNav from rnav.");
  if (dataTime == null) warnings.push("Missing dataTime from updateTime.");
  if (navDate == null) warnings.push("Missing navDate.");

  // Sanity checks only, not investment judgement.
  if (estimatedNav != null && estimatedNav <= 0) warnings.push("estimatedNav <= 0.");
  if (latestPrice != null && latestPrice <= 0) warnings.push("latestPrice <= 0.");
  if (premiumDiscountPct != null && Math.abs(premiumDiscountPct) > 10) {
    warnings.push("premiumDiscountPct absolute value > 10%; requires manual verification.");
  }

  return {
    adapter: "yuanta_official_iife_parser_v1",
    parseStatus: warnings.length === 0 ? "PASS" : "PARTIAL",
    symbol,
    name,
    sourceUrl,
    isinCode: resolved.isinCode,
    dataTime,
    navDate,
    estimatedNav,
    latestPrice,
    referenceNav,
    yesterdayPrice,
    index,
    indexFluct,
    premiumDiscountPct,
    trackingDiffRaw,
    currency,
    businessDay,
    rawTokens: {
      etfId: t.etfId,
      inav: t.inav,
      nav: t.nav,
      price: t.price,
      rnav: t.rnav,
      updateTime: t.updateTime,
      navDate: t.navDate,
    },
    warnings,
  };
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

  const res = await fetch(misUrl, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });

  if (!res.ok) throw new Error(`TWSE MIS route failed: HTTP ${res.status}`);

  const json = await res.json();
  return pickItemsFromMisJson(json);
}


function normalizeDateString(s: string | null): string | null {
  if (!s) return null;
  return s.replace(/\//g, "-");
}

function flattenJsonObjects(json: unknown): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
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

function findCathayRealtimeRecord(json: unknown, symbol: string, fundCode: string): Record<string, unknown> | null {
  for (const obj of flattenJsonObjects(json)) {
    const stockCode = safeString(obj.stockCode);
    const code = safeString(obj.fundCode);
    const estimateNav = toNumberOrNull(obj.estimateNav);
    const lastPrice = toNumberOrNull(obj.lastPrice);
    const diffRate = toNumberOrNull(obj.diffRate);

    if (stockCode === symbol && code === fundCode && estimateNav != null && lastPrice != null && diffRate != null) {
      return obj;
    }
  }

  return null;
}

async function buildCathayOfficialParserResult(
  symbol: string,
  name: string | null,
  sourceUrl: string | null
): Promise<CathayOfficialParserResult> {
  const apiUrl = "https://cwapi.cathaysite.com.tw/api/ETF/GetRealTimeEstimateNavList";
  const warnings: string[] = [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(apiUrl, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "application/json,text/plain,*/*",
        "accept-language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        referer: "https://www.cathaysite.com.tw/ETF/estimate?lang=zh_TW",
        origin: "https://www.cathaysite.com.tw",
        "x-requested-with": "XMLHttpRequest",
      },
    });

    clearTimeout(timeout);

    const contentType = res.headers.get("content-type");
    const text = await res.text();

    let json: unknown | null = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    const record = json ? findCathayRealtimeRecord(json, symbol, "CN") : null;

    if (!res.ok) warnings.push(`HTTP ${res.status}`);
    if (!json) warnings.push("Cathay realtime endpoint did not return valid JSON.");
    if (!record) warnings.push(`No Cathay realtime record matched stockCode=${symbol}, fundCode=CN.`);

    if (!record) {
      return {
        adapter: "cathay_realtime_estimate_nav_list_parser_v1",
        parseStatus: "FAIL",
        sourceType: "intraday_inav",
        symbol,
        name,
        sourceUrl: apiUrl,
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
        businessDay: null,
        httpStatus: res.status,
        contentType,
        jsonOk: json != null,
        recordFound: false,
        rawRecord: null,
        warnings,
      };
    }

    const estimateNav = toNumberOrNull(record.estimateNav);
    const lastPrice = toNumberOrNull(record.lastPrice);
    const diffRate = toNumberOrNull(record.diffRate);
    const isSettle = typeof record.isSettle === "boolean" ? record.isSettle : null;

    if (estimateNav == null) warnings.push("estimateNav missing.");
    if (lastPrice == null) warnings.push("lastPrice missing.");
    if (diffRate == null) warnings.push("diffRate missing.");
    if (isSettle === true) warnings.push("isSettle=true; data may be after-market/settled.");
    warnings.push("Cathay realtime iNAV parser integrated from BUILD_25 probe; compare once with page/TWSE MIS after merge.");

    return {
      adapter: "cathay_realtime_estimate_nav_list_parser_v1",
      parseStatus: estimateNav != null && lastPrice != null && diffRate != null ? "PASS" : "FAIL",
      sourceType: "intraday_inav",
      symbol,
      name: safeString(record.stockShortNameFix) || safeString(record.fundSName) || name,
      sourceUrl: apiUrl,
      dataTime: null,
      navDate: normalizeDateString(safeString(record.closingNavDate)),
      estimatedNav: estimateNav,
      latestPrice: lastPrice,
      referenceNav: toNumberOrNull(record.closingNav),
      yesterdayPrice: toNumberOrNull(record.closingPrice),
      premiumDiscountPct: diffRate,
      marketChange: toNumberOrNull(record.priceRiseFall),
      marketChangePct: toNumberOrNull(record.priceRiseFallPercent),
      navChange: toNumberOrNull(record.navRiseFall),
      navChangePct: toNumberOrNull(record.navRiseFallPercent),
      trackingGap: toNumberOrNull(record.trackingGap),
      currency: safeString(record.currency),
      businessDay: null,
      httpStatus: res.status,
      contentType,
      jsonOk: json != null,
      recordFound: true,
      rawRecord: record,
      warnings,
    };
  } catch (err) {
    return {
      adapter: "cathay_realtime_estimate_nav_list_parser_v1",
      parseStatus: "FAIL",
      sourceType: "intraday_inav",
      symbol,
      name,
      sourceUrl: apiUrl,
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
      businessDay: null,
      httpStatus: null,
      contentType: null,
      jsonOk: false,
      recordFound: false,
      rawRecord: null,
      warnings: [err instanceof Error ? err.message : String(err)],
    };
  }
}

async function probeNavUrl(item: MisEtfItem): Promise<ProbeResult> {
  const symbol = safeString(item.symbol) || safeString(item.stock_id) || "UNKNOWN";
  const name = safeString(item.name);
  const navUrl = safeString(item.navUrl);
  const probeUrl = normalizeProbeUrl(navUrl);
  const fundCompany = detectFundCompany(navUrl || probeUrl);

  const base: ProbeResult = {
    symbol,
    name,
    displayPrice: toNumberOrNull(item.displayPrice),
    displayPriceType: safeString(item.displayPriceType),
    volume: toNumberOrNull(item.volume),
    tradetime: safeString(item.tradetime),
    navUrl,
    probeUrl,
    fundCompany,
    probeStatus: "SKIP",
    httpStatus: null,
    finalUrl: null,
    contentType: null,
    htmlLength: null,
    title: null,
    keywordHits: [],
    discovery: null,
    yuantaIifeResolverResult: null,
    yuantaOfficialParserResult: null,
    fubonOfficialParserResult: null,
    cathayOfficialParserResult: null,
    error: null,
  };

  if (!probeUrl) {
    return {
      ...base,
      probeStatus: "SKIP",
      error: "No navUrl/probeUrl from TWSE MIS raw.nu",
    };
  }

  if (fundCompany === "cathay") {
    const cathayOfficialParserResult = await buildCathayOfficialParserResult(symbol, name, navUrl || probeUrl);

    return {
      ...base,
      probeStatus: cathayOfficialParserResult.parseStatus === "PASS" ? "PASS" : "FAIL",
      httpStatus: cathayOfficialParserResult.httpStatus,
      finalUrl: cathayOfficialParserResult.sourceUrl,
      contentType: cathayOfficialParserResult.contentType,
      htmlLength: null,
      title: null,
      keywordHits: [],
      discovery: null,
      cathayOfficialParserResult,
      error: cathayOfficialParserResult.parseStatus === "PASS" ? null : cathayOfficialParserResult.warnings.join("; "),
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(probeUrl, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
        "accept-language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });

    clearTimeout(timeout);

    const contentType = res.headers.get("content-type");
    const html = await res.text();
    const discovery = discoverScriptData(html);

    const yuantaIifeResolverResult =
      fundCompany === "yuanta"
        ? discoverYuantaIifeResolved(html, symbol, res.url || probeUrl)
        : null;

    const yuantaOfficialParserResult =
      fundCompany === "yuanta"
        ? buildYuantaOfficialParserResult(symbol, name, res.url || probeUrl, yuantaIifeResolverResult)
        : null;

    const fubonOfficialParserResult =
      fundCompany === "fubon"
        ? buildFubonOfficialParserResult(html, symbol, name, res.url || probeUrl)
        : null;

    const cathayOfficialParserResult: CathayOfficialParserResult | null = null;

    return {
      ...base,
      probeStatus: res.ok ? "PASS" : "FAIL",
      httpStatus: res.status,
      finalUrl: res.url || probeUrl,
      contentType,
      htmlLength: html.length,
      title: extractTitle(html),
      keywordHits: extractKeywordHits(html),
      discovery,
      yuantaIifeResolverResult,
      yuantaOfficialParserResult,
      fubonOfficialParserResult,
      cathayOfficialParserResult,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ...base,
      probeStatus: "FAIL",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function toCompactInavResult(r: ProbeResult): CompactInavResult {
  const y = r.yuantaOfficialParserResult;
  const f = r.fubonOfficialParserResult;
  const c = r.cathayOfficialParserResult;

  if (y) {
    return {
      symbol: y.symbol,
      name: y.name,
      fundCompany: r.fundCompany,
      parseStatus: y.parseStatus,
      sourceType: "intraday_inav",
      dataTime: y.dataTime,
      navDate: y.navDate,
      estimatedNav: y.estimatedNav,
      latestPrice: y.latestPrice,
      referenceNav: y.referenceNav,
      yesterdayPrice: y.yesterdayPrice,
      premiumDiscountPct: y.premiumDiscountPct,
      currency: y.currency,
      businessDay: y.businessDay,
      sourceUrl: y.sourceUrl,
      adapter: y.adapter,
      warnings: y.warnings,
    };
  }

  if (f) {
    return {
      symbol: f.symbol,
      name: f.name,
      fundCompany: r.fundCompany,
      parseStatus: f.parseStatus,
      sourceType: "intraday_estimate_table",
      dataTime: f.dataTime,
      navDate: f.navDate,
      estimatedNav: f.estimatedNav,
      latestPrice: f.latestPrice,
      referenceNav: f.referenceNav,
      yesterdayPrice: f.yesterdayPrice,
      premiumDiscountPct: f.premiumDiscountPct,
      currency: f.currency,
      businessDay: f.businessDay,
      sourceUrl: f.sourceUrl,
      adapter: f.adapter,
      warnings: f.warnings,
    };
  }

  if (c) {
    return {
      symbol: c.symbol,
      name: c.name,
      fundCompany: r.fundCompany,
      parseStatus: c.parseStatus,
      sourceType: c.sourceType,
      dataTime: c.dataTime,
      navDate: c.navDate,
      estimatedNav: c.estimatedNav,
      latestPrice: c.latestPrice,
      referenceNav: c.referenceNav,
      yesterdayPrice: c.yesterdayPrice,
      premiumDiscountPct: c.premiumDiscountPct,
      currency: c.currency,
      businessDay: c.businessDay,
      sourceUrl: c.sourceUrl,
      adapter: c.adapter,
      warnings: c.warnings,
    };
  }

  return {
    symbol: r.symbol,
    name: r.name,
    fundCompany: r.fundCompany,
    parseStatus: r.probeStatus === "PASS" ? "SKIP" : "FAIL",
    sourceType: null,
    dataTime: null,
    navDate: null,
    estimatedNav: null,
    latestPrice: null,
    referenceNav: null,
    yesterdayPrice: null,
    premiumDiscountPct: null,
    currency: null,
    businessDay: null,
    sourceUrl: r.finalUrl || r.probeUrl,
    adapter: null,
    warnings: r.error ? [r.error] : [`No official parser for fundCompany=${r.fundCompany}`],
  };
}

async function uncachedGET(req: NextRequest) {
  const startedAt = new Date().toISOString();
  const url = new URL(req.url);
  const symbols = url.searchParams.get("symbols") || "0050,0056,00940,006208,00878";
  const debug = url.searchParams.get("debug") === "1";

  try {
    const items = await fetchMisEtfItems(req, symbols);
    const results = await Promise.all(items.map((item) => probeNavUrl(item)));

    const summary = {
      total: results.length,
      pass: results.filter((r) => r.probeStatus === "PASS").length,
      fail: results.filter((r) => r.probeStatus === "FAIL").length,
      skip: results.filter((r) => r.probeStatus === "SKIP").length,
      withKeywordHits: results.filter((r) => r.keywordHits.length > 0).length,
      normalizedProbeUrl: results.filter((r) => r.navUrl && r.probeUrl && r.navUrl !== r.probeUrl).length,
      withApiUrlCandidates: results.filter((r) => (r.discovery?.apiUrlCandidates.length || 0) > 0).length,
      withNuxtData: results.filter((r) => r.discovery?.nuxtDataFound).length,
      yuantaIifeResolverPass: results.filter((r) => r.yuantaIifeResolverResult?.parseStatus === "PASS").length,
      yuantaIifeResolverPartial: results.filter((r) => r.yuantaIifeResolverResult?.parseStatus === "PARTIAL").length,
      yuantaIifeResolverFail: results.filter((r) => r.yuantaIifeResolverResult?.parseStatus === "FAIL").length,
      yuantaMatchedInavRecord: results.filter((r) => r.yuantaIifeResolverResult?.matchedInavRecordFound).length,
      yuantaOfficialParserPass: results.filter((r) => r.yuantaOfficialParserResult?.parseStatus === "PASS").length,
      yuantaOfficialParserPartial: results.filter((r) => r.yuantaOfficialParserResult?.parseStatus === "PARTIAL").length,
      yuantaOfficialParserFail: results.filter((r) => r.yuantaOfficialParserResult?.parseStatus === "FAIL").length,
      cathayOfficialParserPass: results.filter((r) => r.cathayOfficialParserResult?.parseStatus === "PASS").length,
      cathayOfficialParserFail: results.filter((r) => r.cathayOfficialParserResult?.parseStatus === "FAIL").length,
    };

    const compactResults = results.map(toCompactInavResult);

    const compactSummary = {
      total: compactResults.length,
      pass: compactResults.filter((r) => r.parseStatus === "PASS").length,
      partial: compactResults.filter((r) => r.parseStatus === "PARTIAL").length,
      fail: compactResults.filter((r) => r.parseStatus === "FAIL").length,
      skip: compactResults.filter((r) => r.parseStatus === "SKIP").length,
      yuanta: compactResults.filter((r) => r.fundCompany === "yuanta").length,
      fubon: compactResults.filter((r) => r.fundCompany === "fubon").length,
      cathay: compactResults.filter((r) => r.fundCompany === "cathay").length,
      withEstimatedNav: compactResults.filter((r) => r.estimatedNav != null).length,
      withLatestPrice: compactResults.filter((r) => r.latestPrice != null).length,
    };

    return NextResponse.json({
      ok: true,
      route: "/api/etf/inav",
      version: BUILD_VERSION,
      startedAt,
      finishedAt: new Date().toISOString(),
      input: { symbols },
      summary: compactSummary,
      policy: {
        purpose: "Compact ETF iNAV endpoint. BUILD_26 supports Yuanta, Fubon, and Cathay official/probed parsers.",
        doesNotModifyScore: true,
        doesNotModifyEtfCards: true,
        doesNotReplaceYahooEtf: true,
        supportedFundCompanies: ["yuanta", "fubon", "cathay"],
        cathaySource: "https://cwapi.cathaysite.com.tw/api/ETF/GetRealTimeEstimateNavList",
        unsupportedFundCompaniesReturnSkip: true,
      },
      results: compactResults,
      debug: debug ? { probeSummary: summary, rawResults: results } : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/etf/inav",
        version: BUILD_VERSION,
        startedAt,
        finishedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}


export async function GET(req: NextRequest) {
  const wrapperStartedAt = new Date().toISOString();
  const url = new URL(req.url);
  const symbols = url.searchParams.get("symbols") || "0050,0056,00940,006208,00878";
  const debug = url.searchParams.get("debug") === "1";
  const force = isForceRefresh(url.searchParams);
  const cacheTtlMs = parseTtlMs(url.searchParams, DEFAULT_CACHE_TTL_MS);
  const cacheKey = ["etf_inav", normalizeCacheKeyPart(symbols), debug ? "debug=1" : "debug=0"].join(":");

  try {
    const cached = await getOrFetchCached({
      key: cacheKey,
      ttlMs: cacheTtlMs,
      force,
      meta: { symbols, debug },
      fetcher: async () => {
        const res = await uncachedGET(req);
        const payload = await res.json();
        return {
          payload,
          status: res.status,
        };
      },
    });

    return NextResponse.json(
      {
        ...cached.value.payload,
        version: BUILD_VERSION,
        cache: cached.cache,
        cachePolicy: {
          realtime: true,
          ttlMs: cacheTtlMs,
          force,
          sourceUpdateTimeField: "results[].dataTime / results[].navDate / finishedAt",
        },
        wrapperStartedAt,
        wrapperFinishedAt: new Date().toISOString(),
      },
      { status: cached.value.status || 200 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        route: "/api/etf/inav",
        version: BUILD_VERSION,
        wrapperStartedAt,
        wrapperFinishedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
