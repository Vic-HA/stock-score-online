#!/usr/bin/env node
// scripts/phase-d-refresh-history-cache.mjs
// BUILD: PHASE_D_HISTORY_CACHE_V0_5_REFRESH_STATUS
//
// Purpose:
// - Maintain per-symbol durable TWSE history cache files for stocks / ETFs.
// - Keep existing data/twse-history-snapshot.json as a compatibility output for /api/twse/history.
// - Do NOT change UI, scoring formula, market/derivatives/iNAV routes, or source priority.

import fs from "node:fs/promises";
import path from "node:path";

const BUILD = "PHASE_D_HISTORY_CACHE_V0_5_REFRESH_STATUS";
const ROOT = process.cwd();
const DEFAULT_SNAPSHOT_PATH = "data/twse-history-snapshot.json";
const DEFAULT_CACHE_DIR = "data/history-cache";
const DEFAULT_STOCKS_DIR = "data/history-cache/stocks";
const DEFAULT_REGISTRY_PATH = "data/history-cache/symbol-registry.json";
const DEFAULT_STATUS_PATH = "data/history-cache/status.json";

const DEFAULT_RETENTION_ROWS = 220;
const DEFAULT_MIN_GOOD_ROWS = 120;
const DEFAULT_MONTHS_BACK = 8;
const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_INACTIVE_TTL_DAYS = 30;
const DEFAULT_MAX_STOCK_CACHE_FILES = 300;

function nowIso() {
  return new Date().toISOString();
}

function resolveRepoPath(inputPath) {
  return path.resolve(ROOT, inputPath);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    mode: "refresh", // migrate | verify | refresh | prune
    symbols: [],
    symbolsFile: "",
    baseUrl: DEFAULT_BASE_URL,
    snapshotPath: DEFAULT_SNAPSHOT_PATH,
    cacheDir: DEFAULT_CACHE_DIR,
    stocksDir: DEFAULT_STOCKS_DIR,
    registryPath: DEFAULT_REGISTRY_PATH,
    statusPath: DEFAULT_STATUS_PATH,
    retentionRows: DEFAULT_RETENTION_ROWS,
    minGoodRows: DEFAULT_MIN_GOOD_ROWS,
    monthsBack: DEFAULT_MONTHS_BACK,
    delayMs: 800,
    retry: 2,
    force: false,
    noFetch: false,
    writeSnapshot: true,
    deactivate: [],
    prune: true,
    inactiveTtlDays: DEFAULT_INACTIVE_TTL_DAYS,
    maxStockCacheFiles: DEFAULT_MAX_STOCK_CACHE_FILES,
    // V0.4 auto mode: simulate scheduled refresh in the same script.
    // It uses the same refresh path as GitHub Actions will use later.
    autoStaleHours: 12,
    autoMaxSymbols: 0,
    autoFailOnPartial: false,
    explicitSymbols: false,
    dryRun: false,
  };

  for (const arg of args) {
    if (arg.startsWith("--mode=")) config.mode = arg.slice("--mode=".length).trim();
    if (arg.startsWith("--symbols=")) {
      config.explicitSymbols = true;
      config.symbols = arg
        .slice("--symbols=".length)
        .split(",")
        .map(normalizeSymbol)
        .filter(Boolean);
    }
    if (arg.startsWith("--symbolsFile=")) {
      config.explicitSymbols = true;
      config.symbolsFile = arg.slice("--symbolsFile=".length).trim();
    }
    if (arg.startsWith("--baseUrl=")) config.baseUrl = arg.slice("--baseUrl=".length).trim();
    if (arg.startsWith("--snapshotPath=")) config.snapshotPath = arg.slice("--snapshotPath=".length).trim();
    if (arg.startsWith("--cacheDir=")) config.cacheDir = arg.slice("--cacheDir=".length).trim();
    if (arg.startsWith("--stocksDir=")) config.stocksDir = arg.slice("--stocksDir=".length).trim();
    if (arg.startsWith("--registryPath=")) config.registryPath = arg.slice("--registryPath=".length).trim();
    if (arg.startsWith("--statusPath=")) config.statusPath = arg.slice("--statusPath=".length).trim();
    if (arg.startsWith("--retentionRows=")) config.retentionRows = Number(arg.slice("--retentionRows=".length));
    if (arg.startsWith("--minGoodRows=")) config.minGoodRows = Number(arg.slice("--minGoodRows=".length));
    if (arg.startsWith("--monthsBack=")) config.monthsBack = Number(arg.slice("--monthsBack=".length));
    if (arg.startsWith("--delayMs=")) config.delayMs = Number(arg.slice("--delayMs=".length));
    if (arg.startsWith("--retry=")) config.retry = Number(arg.slice("--retry=".length));
    if (arg.startsWith("--deactivate=")) {
      config.deactivate = arg
        .slice("--deactivate=".length)
        .split(",")
        .map(normalizeSymbol)
        .filter(Boolean);
    }
    if (arg.startsWith("--inactiveTtlDays=")) config.inactiveTtlDays = Number(arg.slice("--inactiveTtlDays=".length));
    if (arg.startsWith("--maxStockCacheFiles=")) config.maxStockCacheFiles = Number(arg.slice("--maxStockCacheFiles=".length));
    if (arg.startsWith("--autoStaleHours=")) config.autoStaleHours = Number(arg.slice("--autoStaleHours=".length));
    if (arg.startsWith("--autoMaxSymbols=")) config.autoMaxSymbols = Number(arg.slice("--autoMaxSymbols=".length));
    if (arg === "--autoFailOnPartial") config.autoFailOnPartial = true;
    if (arg === "--force") config.force = true;
    if (arg === "--noFetch") config.noFetch = true;
    if (arg === "--noSnapshot") config.writeSnapshot = false;
    if (arg === "--noPrune") config.prune = false;
    if (arg === "--dryRun") config.dryRun = true;
  }

  if (config.mode === "migrate" || config.mode === "verify") {
    config.noFetch = true;
  }

  return config;
}

const STRIPPED_LEADING_ZERO_SYMBOL_ALIASES = new Map([
  ["50", "0050"],
  ["56", "0056"],
  ["6208", "006208"],
  ["878", "00878"],
  ["922", "00922"],
  ["923", "00923"],
  ["929", "00929"],
  ["939", "00939"],
  ["940", "00940"],
]);

function normalizeSymbol(value) {
  const raw = String(value ?? "")
    .trim()
    .replace(/\.(TW|TWO)$/i, "")
    .replace(/[^0-9A-Za-z_-]/g, "")
    .toUpperCase();

  // PowerShell can strip leading zeros from comma-separated native command args.
  // Example: --symbols=2330,0050,2454 may become --symbols=2330,50,2454.
  // Keep known TW ETF aliases safe, and reject unknown 1-3 digit symbols later.
  return STRIPPED_LEADING_ZERO_SYMBOL_ALIASES.get(raw) || raw;
}

function validateSymbolInput(symbols) {
  const invalid = symbols.filter((symbol) => /^\d{1,3}$/.test(symbol));
  if (invalid.length) {
    throw new Error(
      `Invalid symbol(s): ${invalid.join(",")}. `
      + "PowerShell may have stripped leading zeros. "
      + "Quote the argument like '--symbols=2330,0050,2454' or use --symbolsFile=backtest-symbols.txt."
    );
  }
}

function isEtfSymbol(symbol) {
  // TW ETFs are usually 00xx/006xx/007xx/008xx/009xx. Keep this as a hint only.
  return /^00/.test(symbol);
}

function safeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toCompactRow(row) {
  if (!row) return null;
  const d = row.d || row.date || row.rawDate || null;
  if (!d) return null;
  const compact = {
    d: String(d),
    o: safeNumber(row.o ?? row.open),
    h: safeNumber(row.h ?? row.high),
    l: safeNumber(row.l ?? row.low),
    c: safeNumber(row.c ?? row.close),
    v: safeNumber(row.v ?? row.volume),
  };
  if (!compact.d || compact.c === null) return null;
  return compact;
}

function uniqueRows(rows, retentionRows) {
  const map = new Map();
  for (const row of rows) {
    const compact = toCompactRow(row);
    if (!compact?.d) continue;
    map.set(compact.d, compact);
  }
  return Array.from(map.values())
    .sort((a, b) => String(a.d).localeCompare(String(b.d)))
    .slice(-retentionRows);
}

function latestDate(rows) {
  return rows.length ? rows[rows.length - 1].d : null;
}

function buildMeta(rows, retentionRows) {
  const rowCount = rows.length;
  return {
    latestDate: latestDate(rows),
    rowCount,
    retentionRows,
    ma60Ready: rowCount >= 60,
    macdWarmupReady: rowCount >= 35,
    kdReady: rowCount >= 9,
    rsiReady: rowCount >= 15,
    atrReady: rowCount >= 15,
  };
}

function classifyRows(rows, minGoodRows) {
  if (!rows.length) return "failed";
  if (rows.length < minGoodRows) return "partial";
  return "pass";
}

const READ_JSON_NO_FALLBACK = Symbol("READ_JSON_NO_FALLBACK");

async function readJson(filePath, fallback = READ_JSON_NO_FALLBACK) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (fallback !== READ_JSON_NO_FALLBACK) return fallback;
    throw error;
  }
}

async function writeJson(filePath, value, dryRun = false) {
  if (dryRun) return;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readSymbolsFromFile(symbolsFile) {
  const raw = await fs.readFile(resolveRepoPath(symbolsFile), "utf8");
  return raw
    .split(/[\r\n,]+/)
    .map(normalizeSymbol)
    .filter(Boolean)
    .filter((x, i, arr) => arr.indexOf(x) === i);
}

async function readExistingSnapshot(config) {
  const fullPath = resolveRepoPath(config.snapshotPath);
  return readJson(fullPath, {
    build: "EMPTY",
    updatedAt: null,
    sourceLatestDate: null,
    retentionRows: config.retentionRows,
    symbols: {},
    meta: {},
    diagnostics: {},
  });
}

async function readRegistry(config) {
  const registry = await readJson(resolveRepoPath(config.registryPath), {
    schemaVersion: 1,
    build: BUILD,
    updatedAt: null,
    symbols: {},
    prunePolicy: {
      inactiveTtlDays: config.inactiveTtlDays,
      maxStockCacheFiles: config.maxStockCacheFiles,
      deleteOnlyInactive: true,
    },
  });

  registry.schemaVersion = registry.schemaVersion || 1;
  registry.build = registry.build || BUILD;
  registry.symbols = registry.symbols || {};
  registry.prunePolicy = registry.prunePolicy || {};
  registry.prunePolicy.inactiveTtlDays = Number(registry.prunePolicy.inactiveTtlDays ?? config.inactiveTtlDays);
  registry.prunePolicy.maxStockCacheFiles = Number(registry.prunePolicy.maxStockCacheFiles ?? config.maxStockCacheFiles);
  registry.prunePolicy.deleteOnlyInactive = registry.prunePolicy.deleteOnlyInactive !== false;
  return registry;
}

async function determineSymbols(config, snapshot, registry) {
  let symbols = config.symbols;

  // Priority 1: explicit CLI symbols for manual subset refresh.
  if (!symbols.length && config.symbolsFile) {
    symbols = await readSymbolsFromFile(config.symbolsFile);
  }

  // V0.3 safety rule:
  // Without explicit --symbols / --symbolsFile, default to the existing full snapshot.
  // Do NOT default to symbol-registry first, because a test registry with only 3 symbols
  // would silently limit refresh/verify to 3 symbols.
  if (!symbols.length) {
    symbols = Object.keys(snapshot.symbols || {}).map(normalizeSymbol).filter(Boolean);
  }

  // Fallback only when there is no existing snapshot, such as first bootstrap.
  if (!symbols.length) {
    const activeRegistrySymbols = Object.entries(registry.symbols || {})
      .filter(([, entry]) => entry?.active !== false)
      .map(([symbol]) => normalizeSymbol(symbol))
      .filter(Boolean);
    symbols = activeRegistrySymbols;
  }

  return symbols.filter((x, i, arr) => x && arr.indexOf(x) === i);
}

function buildStockCache({ symbol, rows, existingCache, state, now, retentionRows, warnings = [], lastError = null }) {
  const existing = existingCache || {};
  const existingStatus = existing.status || {};
  const existingValidation = existing.validation || {};
  const existingSource = existing.source || {};
  const createdAt = existing.createdAt || now;
  const meta = buildMeta(rows, retentionRows);

  const passLike = state === "pass";
  const lastGoodAt = passLike ? now : (existingStatus.lastGoodAt || existing.lastGoodAt || null);

  return {
    schemaVersion: 1,
    build: BUILD,
    symbol,
    type: existing.type || (isEtfSymbol(symbol) ? "etf" : "stock"),
    active: existing.active !== false,
    createdAt,
    updatedAt: now,
    inactiveAt: existing.inactiveAt || null,
    source: {
      primary: existingSource.primary || "twse",
      fallback: existingSource.fallback ?? null,
      validatedBy: existingSource.validatedBy || ["finmind", "yahoo", "google"],
    },
    rows,
    meta,
    validation: {
      status: state,
      warnings: [...(existingValidation.warnings || []), ...warnings].filter(Boolean).slice(-20),
    },
    status: {
      state,
      lastRequestedAt: now,
      lastRefreshAt: state === "failed" ? (existingStatus.lastRefreshAt || null) : now,
      lastGoodAt,
      lastError,
    },
  };
}

async function readStockCache(config, symbol) {
  const filePath = path.join(resolveRepoPath(config.stocksDir), `${symbol}.json`);
  return readJson(filePath, null);
}

async function writeStockCache(config, symbol, cache) {
  const filePath = path.join(resolveRepoPath(config.stocksDir), `${symbol}.json`);
  await writeJson(filePath, cache, config.dryRun);
}

function extractRowsFromRouteItem(item, retentionRows) {
  const candidateRows = [
    ...(Array.isArray(item?.historyRows) ? item.historyRows : []),
    ...(Array.isArray(item?.last220Rows) ? item.last220Rows : []),
    ...(Array.isArray(item?.last120Rows) ? item.last120Rows : []),
    ...(Array.isArray(item?.last60Rows) ? item.last60Rows : []),
    ...(Array.isArray(item?.last20Rows) ? item.last20Rows : []),
    ...(Array.isArray(item?.last10Rows) ? item.last10Rows : []),
    ...(Array.isArray(item?.rows) ? item.rows : []),
  ];
  return uniqueRows(candidateRows, retentionRows);
}

async function fetchRowsFromRoute(config, symbol) {
  const params = new URLSearchParams();
  params.set("symbols", symbol);
  params.set("monthsBack", String(config.monthsBack));
  params.set("retry", String(config.retry));
  params.set("force", "1");

  const url = `${config.baseUrl.replace(/\/$/, "")}/api/twse/history?${params.toString()}`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "stock-score-online-phase-d-history-cache",
    },
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  if (!response.ok || json.ok === false) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify({ ok: json.ok, error: json.error, errors: json.errors }).slice(0, 800)}`);
  }

  const history = Array.isArray(json.history) ? json.history : Array.isArray(json.data) ? json.data : [];
  const item = history.find((x) => normalizeSymbol(x?.symbol) === symbol) || history[0];
  if (!item) return [];
  return extractRowsFromRouteItem(item, config.retentionRows);
}

function shouldKeepExistingRows(existingRows, candidateRows) {
  if (!existingRows.length) return false;
  if (!candidateRows.length) return true;

  const existingLatest = latestDate(existingRows);
  const candidateLatest = latestDate(candidateRows);
  if (existingLatest && candidateLatest && candidateLatest < existingLatest) return true;

  // If the candidate is much shorter and not newer, avoid degrading the cache.
  if (candidateRows.length < existingRows.length && (!candidateLatest || candidateLatest <= existingLatest)) return true;
  return false;
}

async function refreshSymbol(config, symbol, snapshot, now) {
  const existingCache = await readStockCache(config, symbol);
  const snapshotRows = uniqueRows(snapshot.symbols?.[symbol] || [], config.retentionRows);
  const existingRows = uniqueRows(existingCache?.rows || [], config.retentionRows);
  const seedRows = existingRows.length ? existingRows : snapshotRows;

  if (config.mode === "migrate" || config.mode === "verify" || config.noFetch) {
    const state = classifyRows(seedRows, config.minGoodRows);
    const warnings = [];
    if (state === "partial") warnings.push(`ROW_COUNT_BELOW_MIN_GOOD:${seedRows.length}<${config.minGoodRows}`);
    if (state === "failed") warnings.push("NO_HISTORY_ROWS_AVAILABLE");

    const cache = buildStockCache({
      symbol,
      rows: seedRows,
      existingCache,
      state,
      now,
      retentionRows: config.retentionRows,
      warnings,
      lastError: state === "failed" ? "NO_HISTORY_ROWS_AVAILABLE" : null,
    });

    await writeStockCache(config, symbol, cache);
    return { symbol, state, rowCount: seedRows.length, latestDate: latestDate(seedRows), source: "snapshot_or_existing", warnings };
  }

  let fetchedRows = [];
  try {
    fetchedRows = await fetchRowsFromRoute(config, symbol);
  } catch (error) {
    const cache = buildStockCache({
      symbol,
      rows: seedRows,
      existingCache,
      state: seedRows.length ? "partial" : "failed",
      now,
      retentionRows: config.retentionRows,
      warnings: [`FETCH_FAILED_KEEPING_EXISTING:${error?.message || String(error)}`],
      lastError: error?.message || String(error),
    });
    await writeStockCache(config, symbol, cache);
    return { symbol, state: "failed", rowCount: seedRows.length, latestDate: latestDate(seedRows), source: "existing_after_fetch_failed", error: error?.message || String(error) };
  }

  const mergedRows = uniqueRows([...seedRows, ...fetchedRows], config.retentionRows);
  const finalRows = shouldKeepExistingRows(seedRows, mergedRows) ? seedRows : mergedRows;
  let state = classifyRows(finalRows, config.minGoodRows);
  const warnings = [];

  if (fetchedRows.length === 0) {
    state = finalRows.length ? "partial" : "failed";
    warnings.push("FETCH_RETURNED_NO_ROWS");
  }
  if (state === "partial") warnings.push(`ROW_COUNT_BELOW_MIN_GOOD:${finalRows.length}<${config.minGoodRows}`);

  const fetchedLatest = latestDate(fetchedRows);
  const seedLatest = latestDate(seedRows);
  if (fetchedLatest && seedLatest && fetchedLatest < seedLatest) {
    warnings.push(`ROLLBACK_GUARD_FETCH_OLDER:${fetchedLatest}<${seedLatest}`);
  }

  const cache = buildStockCache({
    symbol,
    rows: finalRows,
    existingCache,
    state,
    now,
    retentionRows: config.retentionRows,
    warnings,
    lastError: state === "failed" ? "NO_USABLE_HISTORY_ROWS" : null,
  });

  await writeStockCache(config, symbol, cache);
  return { symbol, state, rowCount: finalRows.length, latestDate: latestDate(finalRows), source: "twse_route", warnings };
}

function touchRegistrySymbol(registry, symbol, now) {
  const prev = registry.symbols[symbol] || {};
  registry.symbols[symbol] = {
    active: true,
    lastRequestedAt: now,
    lastRefreshAt: prev.lastRefreshAt || null,
    lastGoodAt: prev.lastGoodAt || null,
    inactiveAt: null,
  };
}

function updateRegistryAfterResult(registry, result, now) {
  const prev = registry.symbols[result.symbol] || {};
  registry.symbols[result.symbol] = {
    ...prev,
    active: prev.active !== false,
    lastRequestedAt: prev.lastRequestedAt || now,
    lastRefreshAt: result.state === "failed" ? (prev.lastRefreshAt || null) : now,
    lastGoodAt: result.state === "pass" ? now : (prev.lastGoodAt || null),
    inactiveAt: prev.inactiveAt || null,
  };
}

function deactivateSymbols(registry, symbols, now) {
  for (const symbol of symbols) {
    const prev = registry.symbols[symbol] || {};
    registry.symbols[symbol] = {
      ...prev,
      active: false,
      lastRequestedAt: prev.lastRequestedAt || null,
      lastRefreshAt: prev.lastRefreshAt || null,
      lastGoodAt: prev.lastGoodAt || null,
      inactiveAt: prev.inactiveAt || now,
    };
  }
}

async function listStockCacheFiles(config) {
  const dir = resolveRepoPath(config.stocksDir);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name.replace(/\.json$/i, ""))
      .map(normalizeSymbol)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function daysBetween(startIso, endIso) {
  const start = Date.parse(startIso || "");
  const end = Date.parse(endIso || "");
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return (end - start) / 86_400_000;
}

async function pruneInactiveCaches(config, registry, now) {
  if (!config.prune) return [];

  const policy = registry.prunePolicy || {};
  const inactiveTtlDays = Number(policy.inactiveTtlDays ?? config.inactiveTtlDays);
  const maxStockCacheFiles = Number(policy.maxStockCacheFiles ?? config.maxStockCacheFiles);
  const deleteOnlyInactive = policy.deleteOnlyInactive !== false;
  const existingFiles = await listStockCacheFiles(config);
  const deleted = [];

  const inactiveCandidates = existingFiles
    .map((symbol) => ({ symbol, entry: registry.symbols[symbol] || {} }))
    .filter(({ entry }) => entry.active === false)
    .map(({ symbol, entry }) => ({
      symbol,
      inactiveAt: entry.inactiveAt || entry.lastRequestedAt || "1970-01-01T00:00:00.000Z",
      ttlExpired: daysBetween(entry.inactiveAt, now) >= inactiveTtlDays,
    }))
    .sort((a, b) => String(a.inactiveAt).localeCompare(String(b.inactiveAt)));

  const toDelete = new Set();
  for (const candidate of inactiveCandidates) {
    if (candidate.ttlExpired) toDelete.add(candidate.symbol);
  }

  const projectedCount = existingFiles.length - toDelete.size;
  if (projectedCount > maxStockCacheFiles) {
    const extraNeeded = projectedCount - maxStockCacheFiles;
    inactiveCandidates
      .filter((candidate) => !toDelete.has(candidate.symbol))
      .slice(0, extraNeeded)
      .forEach((candidate) => toDelete.add(candidate.symbol));
  }

  for (const symbol of toDelete) {
    if (deleteOnlyInactive && registry.symbols[symbol]?.active !== false) continue;
    const filePath = path.join(resolveRepoPath(config.stocksDir), `${symbol}.json`);
    if (!config.dryRun) {
      await fs.rm(filePath, { force: true });
    }
    deleted.push(symbol);
    delete registry.symbols[symbol];
  }

  return deleted;
}

async function rebuildCompatibilitySnapshot(config, registry, status, existingSnapshot) {
  if (!config.writeSnapshot) return null;

  // V0.2 safety rule:
  // data/twse-history-snapshot.json is still the compatibility output for existing /api/twse/history.
  // Refreshing a subset such as --symbols=2330,0050,2454 must NOT delete other existing snapshot symbols.
  // Start from the current snapshot, then overlay per-symbol cache rows for known active cache symbols.
  const mergedSymbols = { ...(existingSnapshot?.symbols || {}) };
  const rowCounts = {};
  const missingOrEmptySymbols = [];
  const sourceLatestDates = [];

  const activeCacheSymbols = Object.entries(registry.symbols || {})
    .filter(([, entry]) => entry?.active !== false)
    .map(([symbol]) => normalizeSymbol(symbol))
    .filter(Boolean)
    .sort();

  for (const symbol of activeCacheSymbols) {
    const cache = await readStockCache(config, symbol);
    const rows = uniqueRows(cache?.rows || [], config.retentionRows);
    if (!rows.length) {
      missingOrEmptySymbols.push(symbol);
      continue;
    }
    mergedSymbols[symbol] = rows;
  }

  const allSymbols = Object.keys(mergedSymbols).map(normalizeSymbol).filter(Boolean).sort();
  const sortedSymbols = {};
  for (const symbol of allSymbols) {
    const rows = uniqueRows(mergedSymbols[symbol] || [], config.retentionRows);
    if (!rows.length) continue;
    sortedSymbols[symbol] = rows;
    rowCounts[symbol] = rows.length;
    if (latestDate(rows)) sourceLatestDates.push(latestDate(rows));
  }

  sourceLatestDates.sort();

  const snapshot = {
    ...(existingSnapshot || {}),
    build: "TWSE_HISTORY_SNAPSHOT_V03_PHASE_D_PER_SYMBOL_COMPAT",
    builder: BUILD,
    updatedAt: nowIso(),
    sourceLatestDate: sourceLatestDates[sourceLatestDates.length - 1] || existingSnapshot?.sourceLatestDate || null,
    retentionRows: config.retentionRows,
    symbols: sortedSymbols,
    meta: {
      ...(existingSnapshot?.meta || {}),
      source: "Phase D per-symbol history cache compatibility output",
      primarySource: "TWSE STOCK_DAY",
      note: "Generated by overlaying data/history-cache/stocks/{symbol}.json onto the existing snapshot so subset refresh does not delete other symbols.",
    },
    diagnostics: {
      ...(existingSnapshot?.diagnostics || {}),
      build: BUILD,
      activeCacheSymbols,
      snapshotSymbolsPreserved: Object.keys(existingSnapshot?.symbols || {}).length,
      snapshotSymbolsWritten: Object.keys(sortedSymbols || {}).length,
      rowCounts,
      missingOrEmptySymbols,
      phaseDStatus: {
        lastRunAt: status.finishedAt || status.startedAt || null,
        passSymbols: status.passSymbols || [],
        partialSymbols: status.partialSymbols || [],
        failedSymbols: status.failedSymbols || [],
        prunedSymbols: status.prunedSymbols || [],
      },
    },
  };

  await writeJson(resolveRepoPath(config.snapshotPath), snapshot, config.dryRun);
  return snapshot;
}

function hoursBetween(startIso, endIso) {
  const start = Date.parse(startIso || "");
  const end = Date.parse(endIso || "");
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Infinity;
  return (end - start) / 3_600_000;
}

function normalizeMaybeDate(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function buildStatusSummary(status, compatibilitySnapshot, config) {
  const results = Array.isArray(status?.results) ? status.results : [];
  const latestDates = results
    .map((result) => normalizeMaybeDate(result?.latestDate))
    .filter(Boolean)
    .sort();
  const sourceLatestDate = normalizeMaybeDate(compatibilitySnapshot?.sourceLatestDate) || latestDates[latestDates.length - 1] || null;
  const snapshotSymbols = compatibilitySnapshot?.symbols && typeof compatibilitySnapshot.symbols === "object"
    ? Object.keys(compatibilitySnapshot.symbols).length
    : null;

  return {
    updatedAt: status?.finishedAt || status?.startedAt || null,
    sourceLatestDate,
    totalSymbols: results.length,
    requestedCount: Array.isArray(status?.requestedSymbols) ? status.requestedSymbols.length : 0,
    passCount: Array.isArray(status?.passSymbols) ? status.passSymbols.length : 0,
    partialCount: Array.isArray(status?.partialSymbols) ? status.partialSymbols.length : 0,
    failCount: Array.isArray(status?.failedSymbols) ? status.failedSymbols.length : 0,
    prunedCount: Array.isArray(status?.prunedSymbols) ? status.prunedSymbols.length : 0,
    snapshotPath: config?.snapshotPath || DEFAULT_SNAPSHOT_PATH,
    snapshotSymbols,
    latestResultDate: latestDates[latestDates.length - 1] || null,
  };
}


async function selectAutoSymbols(config, symbols, snapshot, registry, now) {
  // Explicit --symbols / --symbolsFile is always respected. This makes local smoke tests fast.
  if (config.explicitSymbols) return symbols;

  const scored = [];
  for (const symbol of symbols) {
    const cache = await readStockCache(config, symbol);
    const snapshotRows = uniqueRows(snapshot.symbols?.[symbol] || [], config.retentionRows);
    const cacheRows = uniqueRows(cache?.rows || [], config.retentionRows);
    const rows = cacheRows.length ? cacheRows : snapshotRows;
    const registryEntry = registry.symbols?.[symbol] || {};
    const lastRefreshAt = cache?.status?.lastRefreshAt || registryEntry.lastRefreshAt || null;
    const ageHours = hoursBetween(lastRefreshAt, now);
    const rowCount = rows.length;
    const isEmpty = rowCount === 0;
    const isPartial = rowCount > 0 && rowCount < config.minGoodRows;
    const cacheLatest = latestDate(rows);
    const snapshotLatest = latestDate(snapshotRows);
    const latestMismatch = Boolean(cacheLatest && snapshotLatest && cacheLatest < snapshotLatest);
    const stale = config.force || !Number.isFinite(ageHours) || ageHours >= config.autoStaleHours;

    if (config.force || isEmpty || isPartial || latestMismatch || stale) {
      const score = [
        isEmpty ? 0 : 1,
        isPartial ? 0 : 1,
        latestMismatch ? 0 : 1,
        Number.isFinite(ageHours) ? -ageHours : -999999,
        symbol,
      ];
      scored.push({ symbol, score, reason: { isEmpty, isPartial, latestMismatch, ageHours, stale } });
    }
  }

  scored.sort((a, b) => {
    for (let i = 0; i < a.score.length; i += 1) {
      if (a.score[i] < b.score[i]) return -1;
      if (a.score[i] > b.score[i]) return 1;
    }
    return 0;
  });

  let selected = scored.map((item) => item.symbol);
  if (config.autoMaxSymbols > 0) selected = selected.slice(0, config.autoMaxSymbols);

  if (!selected.length) {
    console.log(`[${BUILD}] AUTO no stale symbols found; verifying existing cache only.`);
  } else {
    console.log(`[${BUILD}] AUTO selected symbols=${selected.length}${config.autoMaxSymbols > 0 ? ` max=${config.autoMaxSymbols}` : ""}`);
  }

  return selected;
}

function validateCompatibilitySnapshot({ beforeSnapshot, afterSnapshot, config, status }) {
  const beforeCount = Object.keys(beforeSnapshot?.symbols || {}).length;
  const afterCount = Object.keys(afterSnapshot?.symbols || {}).length;
  if (afterCount < beforeCount) {
    status.ok = false;
    status.warnings.push(`SNAPSHOT_SYMBOL_COUNT_ROLLBACK:${afterCount}<${beforeCount}`);
  }

  const beforeLatest = normalizeMaybeDate(beforeSnapshot?.sourceLatestDate);
  const afterLatest = normalizeMaybeDate(afterSnapshot?.sourceLatestDate);
  if (beforeLatest && afterLatest && afterLatest < beforeLatest) {
    status.ok = false;
    status.warnings.push(`SNAPSHOT_SOURCE_LATEST_ROLLBACK:${afterLatest}<${beforeLatest}`);
  }

  if (config.mode === "auto" && config.autoFailOnPartial && status.partialSymbols.length) {
    status.ok = false;
    status.warnings.push(`AUTO_PARTIAL_SYMBOLS:${status.partialSymbols.join(",")}`);
  }
}

async function main() {
  const config = parseArgs();
  const startedAt = nowIso();
  const snapshot = await readExistingSnapshot(config);
  const registry = await readRegistry(config);
  let symbols = await determineSymbols(config, snapshot, registry);
  validateSymbolInput(symbols);

  if (config.mode === "auto") {
    symbols = await selectAutoSymbols(config, symbols, snapshot, registry, startedAt);
    validateSymbolInput(symbols);
  }

  if (!["migrate", "verify", "refresh", "auto", "prune"].includes(config.mode)) {
    throw new Error(`Invalid --mode=${config.mode}. Use migrate, verify, refresh, auto, or prune.`);
  }

  if (!Number.isFinite(config.retentionRows) || config.retentionRows < 60) throw new Error("Invalid retentionRows");
  if (!Number.isFinite(config.minGoodRows) || config.minGoodRows < 20) throw new Error("Invalid minGoodRows");

  await fs.mkdir(resolveRepoPath(config.stocksDir), { recursive: true });
  await fs.mkdir(resolveRepoPath(config.cacheDir), { recursive: true });

  const now = nowIso();
  const status = {
    schemaVersion: 1,
    build: BUILD,
    mode: config.mode,
    ok: true,
    startedAt,
    finishedAt: null,
    requestedSymbols: symbols,
    passSymbols: [],
    partialSymbols: [],
    failedSymbols: [],
    prunedSymbols: [],
    results: [],
    warnings: [],
    dryRun: config.dryRun,
    auto: config.mode === "auto" ? {
      staleHours: config.autoStaleHours,
      maxSymbols: config.autoMaxSymbols,
      failOnPartial: config.autoFailOnPartial,
      explicitSymbols: config.explicitSymbols,
    } : null,
  };

  console.log(`[${BUILD}] START mode=${config.mode} symbols=${symbols.length} noFetch=${config.noFetch} dryRun=${config.dryRun}`);

  for (const symbol of symbols) touchRegistrySymbol(registry, symbol, now);
  if (config.deactivate.length) deactivateSymbols(registry, config.deactivate, now);

  if (config.mode !== "prune") {
    if (!symbols.length && config.mode !== "auto") {
      status.ok = false;
      status.warnings.push("NO_SYMBOLS_FOUND");
    }

    for (let index = 0; index < symbols.length; index += 1) {
      const symbol = symbols[index];
      const result = await refreshSymbol(config, symbol, snapshot, now);
      status.results.push(result);
      if (result.state === "pass") status.passSymbols.push(symbol);
      else if (result.state === "partial") status.partialSymbols.push(symbol);
      else status.failedSymbols.push(symbol);
      updateRegistryAfterResult(registry, result, now);
      console.log(`[${BUILD}] ${symbol} ${result.state.toUpperCase()} rows=${result.rowCount} latest=${result.latestDate || "none"}`);
      if (index < symbols.length - 1 && config.delayMs > 0 && !config.noFetch) await sleep(config.delayMs);
    }
  }

  const prunedSymbols = await pruneInactiveCaches(config, registry, now);
  status.prunedSymbols = prunedSymbols;

  registry.updatedAt = nowIso();
  registry.prunePolicy = {
    inactiveTtlDays: config.inactiveTtlDays,
    maxStockCacheFiles: config.maxStockCacheFiles,
    deleteOnlyInactive: true,
  };

  await writeJson(resolveRepoPath(config.registryPath), registry, config.dryRun);
  const compatibilitySnapshot = await rebuildCompatibilitySnapshot(config, registry, status, snapshot);

  status.finishedAt = nowIso();
  status.ok = status.failedSymbols.length === 0 && !status.warnings.includes("NO_SYMBOLS_FOUND");
  if (compatibilitySnapshot) validateCompatibilitySnapshot({ beforeSnapshot: snapshot, afterSnapshot: compatibilitySnapshot, config, status });
  status.compatibilitySnapshot = compatibilitySnapshot
    ? {
        path: config.snapshotPath,
        symbols: Object.keys(compatibilitySnapshot.symbols || {}).length,
        sourceLatestDate: compatibilitySnapshot.sourceLatestDate || null,
      }
    : null;

  Object.assign(status, buildStatusSummary(status, compatibilitySnapshot, config));

  await writeJson(resolveRepoPath(config.statusPath), status, config.dryRun);

  console.log(`[${BUILD}] ${status.ok ? "PASS" : "PARTIAL_OR_FAILED"}`);
  console.log(`pass=${status.passSymbols.length} partial=${status.partialSymbols.length} failed=${status.failedSymbols.length} pruned=${status.prunedSymbols.length}`);
  if (compatibilitySnapshot) {
    console.log(`snapshot=${config.snapshotPath} symbols=${Object.keys(compatibilitySnapshot.symbols || {}).length} sourceLatestDate=${compatibilitySnapshot.sourceLatestDate || "none"}`);
  }
  if (!status.ok) process.exitCode = 2;
}

main().catch(async (error) => {
  const message = error?.message || String(error);
  console.error(`[${BUILD}] FAIL`);
  console.error(message);
  try {
    const config = parseArgs();
    const failedAt = nowIso();
    await writeJson(resolveRepoPath(config.statusPath), {
      schemaVersion: 1,
      build: BUILD,
      ok: false,
      mode: config.mode,
      startedAt: null,
      finishedAt: failedAt,
      updatedAt: failedAt,
      sourceLatestDate: null,
      totalSymbols: 0,
      requestedCount: 0,
      passCount: 0,
      partialCount: 0,
      failCount: 1,
      prunedCount: 0,
      snapshotPath: config.snapshotPath || DEFAULT_SNAPSHOT_PATH,
      snapshotSymbols: null,
      latestResultDate: null,
      error: message,
    }, config.dryRun);
  } catch {
    // ignore status write failure
  }
  process.exit(1);
});
