// scripts/build-twse-snapshot-batch.mjs
// BUILD: V73A3_TWSE_SNAPSHOT_BATCH_BUILDER_01
//
// Purpose:
// Build TWSE snapshot without hitting /api/twse/history with 50 symbols at once.
// It calls the already-verified route in small batches, waits between batches,
// merges results, and writes data/twse-history-snapshot.json.
//
// This does NOT change UI, scoring formulas, FinMind logic, or route internals.

import fs from "node:fs/promises";
import path from "node:path";

const BUILD = "V73A3_TWSE_SNAPSHOT_BATCH_BUILDER_01";

const DEFAULT_SYMBOLS = ["2330", "0050", "2454"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    baseUrl: "http://localhost:3000",
    symbols: DEFAULT_SYMBOLS,
    symbolsFile: "",
    monthsBack: 8,
    output: "data/twse-history-snapshot.json",
    batchSize: 5,
    delayMs: 1500,
    retry: 2,
    force: true,
    concurrency: 2,
  };

  for (const arg of args) {
    if (arg.startsWith("--baseUrl=")) out.baseUrl = arg.slice("--baseUrl=".length);
    if (arg.startsWith("--symbols=")) {
      out.symbols = arg
        .slice("--symbols=".length)
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }
    if (arg.startsWith("--symbolsFile=")) out.symbolsFile = arg.slice("--symbolsFile=".length);
    if (arg.startsWith("--monthsBack=")) out.monthsBack = Number(arg.slice("--monthsBack=".length));
    if (arg.startsWith("--output=")) out.output = arg.slice("--output=".length);
    if (arg.startsWith("--batchSize=")) out.batchSize = Number(arg.slice("--batchSize=".length));
    if (arg.startsWith("--delayMs=")) out.delayMs = Number(arg.slice("--delayMs=".length));
    if (arg.startsWith("--retry=")) out.retry = Number(arg.slice("--retry=".length));
    if (arg.startsWith("--concurrency=")) out.concurrency = Number(arg.slice("--concurrency=".length));
    if (arg === "--noForce") out.force = false;
  }

  return out;
}

async function readSymbols(config) {
  if (!config.symbolsFile) return config.symbols;

  const raw = await fs.readFile(path.resolve(config.symbolsFile), "utf8");
  return raw
    .split(/[\r\n,]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x, i, arr) => arr.indexOf(x) === i);
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function toSnapshotRow(row) {
  if (!row) return null;

  const d = row.date || row.d || null;
  const o = row.open ?? row.o ?? null;
  const h = row.high ?? row.h ?? null;
  const l = row.low ?? row.l ?? null;
  const c = row.close ?? row.c ?? null;
  const v = row.volume ?? row.v ?? null;

  if (!d) return null;
  return { d, o, h, l, c, v };
}

function uniqueByDate(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!row?.d) continue;
    map.set(row.d, row);
  }
  return Array.from(map.values()).sort((a, b) => String(a.d).localeCompare(String(b.d)));
}

function extractRows(item) {
  const candidateRows = [
    ...(Array.isArray(item.historyRows) ? item.historyRows : []),
    ...(Array.isArray(item.last220Rows) ? item.last220Rows : []),
    ...(Array.isArray(item.last120Rows) ? item.last120Rows : []),
    ...(Array.isArray(item.last60Rows) ? item.last60Rows : []),
    ...(Array.isArray(item.last20Rows) ? item.last20Rows : []),
    ...(Array.isArray(item.last10Rows) ? item.last10Rows : []),
    ...(Array.isArray(item.rows) ? item.rows : []),
  ];

  return uniqueByDate(candidateRows.map(toSnapshotRow).filter(Boolean)).slice(-220);
}

async function fetchBatch(config, batch, index, total) {
  const params = new URLSearchParams();
  params.set("symbols", batch.join(","));
  params.set("monthsBack", String(config.monthsBack));
  params.set("concurrency", String(config.concurrency));
  params.set("retry", String(config.retry));
  if (config.force) params.set("force", "1");

  const url = `${config.baseUrl.replace(/\/$/, "")}/api/twse/history?${params.toString()}`;

  console.log(`[${BUILD}] batch ${index + 1}/${total} symbols=${batch.join(",")}`);
  console.log(url);

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "stock-score-online-v73a3-batch-snapshot-builder",
    },
  });

  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Batch ${index + 1} returned non-JSON HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  if (!res.ok || json.ok === false) {
    throw new Error(`Batch ${index + 1} failed HTTP ${res.status}: ${JSON.stringify({
      ok: json.ok,
      error: json.error,
      errors: json.errors,
      warnings: json.warnings,
    }).slice(0, 1200)}`);
  }

  const history = Array.isArray(json.history)
    ? json.history
    : Array.isArray(json.data)
      ? json.data
      : [];

  return {
    url,
    status: res.status,
    passCount: json.passCount ?? null,
    count: json.count ?? null,
    dataTimeSummary: json.dataTimeSummary ?? null,
    technicalSummary: json.technicalSummary ?? null,
    cache: json.cache ?? null,
    history,
  };
}

async function main() {
  const config = parseArgs();
  const symbols = await readSymbols(config);

  if (!symbols.length) throw new Error("Missing symbols");
  if (!Number.isFinite(config.batchSize) || config.batchSize < 1) throw new Error("Invalid batchSize");
  if (!Number.isFinite(config.delayMs) || config.delayMs < 0) throw new Error("Invalid delayMs");

  const batches = chunkArray(symbols, config.batchSize);

  console.log(`[${BUILD}] START symbols=${symbols.length} batches=${batches.length} batchSize=${config.batchSize} delayMs=${config.delayMs} monthsBack=${config.monthsBack}`);

  const mergedSymbols = {};
  const diagnostics = {
    build: BUILD,
    requestedSymbols: symbols,
    batchSize: config.batchSize,
    delayMs: config.delayMs,
    monthsBack: config.monthsBack,
    batches: [],
    rowCounts: {},
    missingOrEmptySymbols: [],
  };

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const result = await fetchBatch(config, batch, i, batches.length);

    diagnostics.batches.push({
      index: i + 1,
      symbols: batch,
      passCount: result.passCount,
      count: result.count,
      cache: result.cache,
      dataTimeSummary: result.dataTimeSummary,
      technicalSummary: result.technicalSummary,
    });

    for (const item of result.history) {
      const symbol = String(item.symbol || "").trim();
      if (!symbol) continue;
      mergedSymbols[symbol] = extractRows(item);
    }

    if (i < batches.length - 1 && config.delayMs > 0) {
      await sleep(config.delayMs);
    }
  }

  for (const symbol of symbols) {
    const rows = mergedSymbols[symbol] || [];
    diagnostics.rowCounts[symbol] = rows.length;
    if (!rows.length) diagnostics.missingOrEmptySymbols.push(symbol);
  }

  const sourceLatestDates = Object.values(mergedSymbols)
    .flatMap((rows) => rows.map((row) => row.d))
    .filter(Boolean)
    .sort();

  const snapshot = {
    build: "TWSE_HISTORY_SNAPSHOT_V02_BATCH",
    builder: BUILD,
    updatedAt: new Date().toISOString(),
    sourceLatestDate: sourceLatestDates[sourceLatestDates.length - 1] || null,
    retentionRows: 220,
    symbols: mergedSymbols,
    meta: {
      source: "TWSE STOCK_DAY via batched existing /api/twse/history route",
      note: "Built in small batches to avoid TWSE blocking. Source data dates, not fetch/cache timestamps.",
    },
    diagnostics,
  };

  const outputPath = path.resolve(config.output);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(snapshot, null, 2), "utf8");

  const passed = diagnostics.missingOrEmptySymbols.length === 0;

  console.log(`[${BUILD}] ${passed ? "PASS" : "PARTIAL_PASS"}`);
  console.log(`output=${outputPath}`);
  console.log(`sourceLatestDate=${snapshot.sourceLatestDate}`);
  console.log(`symbolsWritten=${Object.keys(mergedSymbols).length}/${symbols.length}`);
  console.log(`missingOrEmptySymbols=${diagnostics.missingOrEmptySymbols.join(",") || "none"}`);
  console.log(`rowCounts=${JSON.stringify(diagnostics.rowCounts)}`);

  if (!passed) process.exitCode = 2;
}

main().catch((error) => {
  console.error(`[${BUILD}] FAIL`);
  console.error(error);
  process.exit(1);
});
