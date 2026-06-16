# Stock Score Online APP — Phase D History Cache SPEC V0

更新時間：2026-06-16  
階段：Phase D0 / D1 / D2 / D3 local-first  
目標：只工程化股票 / ETF 長日線 OHLCV cache，不改 UI、不改公式、不新增 market / derivatives / iNAV durable cache。

---

## 1. Phase D 第一版核心目標

Phase D 第一版只處理：

```text
股票 / ETF 的 100～220 天以上 OHLCV history cache
```

用途：

```text
5MA / 20MA / 60MA
RSI
KD
MACD
ATR
high20 / low20
return20d / return60d
```

避免：

```text
每次新增股票都打 TWSE / FinMind API
每次刷新都重抓所有股票
一檔股票錯誤影響整包 snapshot
多人使用時所有股票 cache 混在同一個大檔不好維護
```

---

## 2. 第一版不處理的範圍

以下 route 維持現況，不新增 durable JSON cache：

```text
/api/finmind/market
/api/finmind/derivatives
/api/etf/inav
/api/twse/mis
/api/yahoo/ohlcv
/api/yahoo/etf
/api/google/verify
```

理由：

```text
這些不是 100～220 天 OHLCV 技術預熱問題
原本 route 已能即時取得或已有 server memory TTL cache
現在卡住的是股票 / ETF history cache 不會自動補齊與刷新
過早把 market / derivatives / iNAV durable 化會增加維護成本
```

---

## 3. 資料來源原則：去重，但不單點依賴

Phase D 的去重不是刪掉 FinMind / Google / Yahoo。

正確原則：

```text
TWSE / TWSE MIS / ETF 官方即時估值優先當主資料
FinMind / Google / Yahoo 保留為補足、交叉驗證、異常偵測與 fallback
每個計分欄位只能有一個 primary source
其他來源不得靜默覆蓋 primary source
fallback 必須記錄 source / reason / warning
```

長日線 OHLCV 第一版 primary：

```text
TWSE STOCK_DAY
```

補足 / 驗證來源保留，但不在第一版強制 durable 化：

```text
FinMind daily
Yahoo OHLCV
Google reference
```

---

## 4. 實體 per-symbol cache

Phase D 第一版採用實體 per-symbol history cache：

```text
data/history-cache/stocks/{symbol}.json
```

例如：

```text
data/history-cache/stocks/2330.json
data/history-cache/stocks/0050.json
data/history-cache/stocks/2454.json
```

每個檔案只管理該股票 / ETF 自己的 history rows、刷新狀態與驗證資訊。

---

## 5. 目錄結構

新增：

```text
data/history-cache/
  symbol-registry.json
  status.json              # 由 script 產生
  stocks/
    2330.json              # 由 script 產生
    0050.json              # 由 script 產生
    .gitkeep

scripts/phase-d-refresh-history-cache.mjs
doc/PHASE_D_HISTORY_CACHE_SPEC_V0.md
```

保留既有相容輸出：

```text
data/twse-history-snapshot.json
```

`data/twse-history-snapshot.json` 不再視為唯一 cache 本體，而是給現有 `/api/twse/history` snapshot-first route 使用的相容合併檔。

---

## 6. 單檔股票 cache schema

```json
{
  "schemaVersion": 1,
  "build": "PHASE_D_HISTORY_CACHE_V0",
  "symbol": "2330",
  "type": "stock",
  "active": true,
  "createdAt": "2026-06-16T00:00:00.000Z",
  "updatedAt": "2026-06-16T00:00:00.000Z",
  "inactiveAt": null,
  "source": {
    "primary": "twse",
    "fallback": null,
    "validatedBy": ["finmind", "yahoo", "google"]
  },
  "rows": [
    { "d": "2026-06-12", "o": 2325, "h": 2325, "l": 2290, "c": 2310, "v": 26306885 }
  ],
  "meta": {
    "latestDate": "2026-06-12",
    "rowCount": 147,
    "retentionRows": 220,
    "ma60Ready": true,
    "macdWarmupReady": true,
    "kdReady": true,
    "rsiReady": true,
    "atrReady": true
  },
  "validation": {
    "status": "pass",
    "warnings": []
  },
  "status": {
    "state": "pass",
    "lastRequestedAt": "2026-06-16T00:00:00.000Z",
    "lastRefreshAt": "2026-06-16T00:00:00.000Z",
    "lastGoodAt": "2026-06-16T00:00:00.000Z",
    "lastError": null
  }
}
```

---

## 7. PASS / PARTIAL / FAILED 定義

因為 Phase D 第一版只處理 OHLCV history cache，所以狀態定義要簡單。

### PASS

```text
該 symbol 成功取得足夠 OHLCV
rows >= minGoodRows，預設 120
latestDate 不比既有 cache 舊
OHLCV 可解析
可更新該 symbol cache
可更新相容 snapshot
```

### PARTIAL

```text
有取得 OHLCV，但 rows 不足以完整支援所有技術預熱
例如 rows < minGoodRows
可以保留資料與 warning
但不應該覆蓋比它更完整、日期更新或 rowCount 更多的既有 cache
```

### FAILED

```text
API 失敗
沒有該 symbol
OHLCV 為空
latestDate 比既有 cache 舊，可能 rollback
資料解析失敗
```

FAILED 不更新該檔 rows，也不讓相容 snapshot 被壞資料覆蓋。

---

## 8. 新增股票流程

沒有登入系統，所以 server 不分辨使用者 A/B/C。

規則：

```text
瀏覽器 localStorage 仍管理該裝置自己的觀察清單
server 只維護 shared per-symbol history cache
某 symbol 被 script 或 route 請求過，就更新 lastRequestedAt
```

新增股票時：

```text
1. 該 symbol 被請求
2. 若 data/history-cache/stocks/{symbol}.json 不存在，建立該檔
3. 只刷新該 symbol
4. 成功後回寫相容 data/twse-history-snapshot.json
5. 其他股票 cache 不動
```

---

## 9. 移除 / prune 策略

沒有登入系統，某個瀏覽器移除股票不代表全站沒人需要。

所以第一版不做 user watcherCount，只看：

```text
lastRequestedAt
inactiveAt
active
```

prune 規則第一版就要有：

```text
inactive 超過 30 天才刪除
總股票 cache 檔超過 300 檔時，優先刪 inactive 最久的
active 股票永不 prune
```

`symbol-registry.json` 內建：

```json
{
  "prunePolicy": {
    "inactiveTtlDays": 30,
    "maxStockCacheFiles": 300,
    "deleteOnlyInactive": true
  }
}
```

---

## 10. 本機驗證優先

Phase D 必須先本機驗證，通過後才開線上排程。

建議本機驗證順序：

```powershell
node scripts\phase-d-refresh-history-cache.mjs --mode=migrate
node scripts\phase-d-refresh-history-cache.mjs --mode=verify
node scripts\phase-d-refresh-history-cache.mjs --symbols=2330,0050 --mode=refresh --baseUrl=http://localhost:3000
npm run build
```

驗證項目：

```text
可從現有 data/twse-history-snapshot.json 拆出 per-symbol cache
可回產 data/twse-history-snapshot.json
新增一檔只新增該檔 cache
單檔失敗不影響其他 cache
inactive / prune 規則存在
npm run build PASS
```

---

## 11. 線上排程流程

本機驗證完成後，下一階段才新增 GitHub Actions。

建議順序：

```text
1. workflow_dispatch 手動跑
2. 保留 artifact
3. 確認 generated cache 正確
4. 才開 schedule
```

線上排程不是 Phase D 第一個動作；它是本機 cache refresh 驗證完成後的部署步驟。
