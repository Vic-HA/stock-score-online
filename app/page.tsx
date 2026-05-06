"use client";

import React, { useMemo, useState } from "react";

type Stock = {
  symbol: string;
  name: string;
  type: "股票" | "ETF";
  market: "TWSE" | "TPEx";
  price: number;
  prevClose: number;
  volume: number;
  per: number | null;
  eps: number | null;
  ma5: number | null;
  ma20: number | null;
  rsi14: number | null;
  foreign3d: number | null;
  trust3d: number | null;
  dealer3d: number | null;
  marginChange5dPct: number | null;
  nasdaqReturn1d: number | null;
  soxReturn1d: number | null;
  taifexAfterHoursReturn: number | null;
  vixChange1d: number | null;
};

type GoogleRaw = {
  price: number | null;
  prevClose: number | null;
  volume: number | null;
  per: number | null;
  eps: number | null;
  ma5: number | null;
  ma20: number | null;
  rsi14: number | null;
  foreign3d: number | null;
  trust3d: number | null;
  dealer3d: number | null;
  marginChange5dPct: number | null;
  nasdaqReturn1d: number | null;
  soxReturn1d: number | null;
  taifexAfterHoursReturn: number | null;
  vixChange1d: number | null;
  updatedAt: string;
  sourceNote: string;
};

type VerifyApiResponse = {
  ok: boolean;
  version?: string;
  error?: string;
  message?: string;
  csvUrl?: string;
  headers?: string[];
  parsedRows?: number;
  rawPreview?: string[][];
  matchedSymbols?: string[];
  unmatchedSymbols?: string[];
  valuePreview?: Array<Record<string, unknown>>;
  validationMap?: Record<string, { google: GoogleRaw }>;
  rawDataMap?: Record<
    string,
    {
      symbol: string;
      name: string;
      ticker: string;
      google: GoogleRaw;
      dataAvailability: {
        available: string[];
        unavailable: string[];
        availableCount: number;
        unavailableCount: number;
      };
    }
  >;
};

type CompareRow = {
  label: string;
  mainValue: number | null;
  googleValue: number | null;
  diffPct: number | null;
  tolerancePct: number;
  status: "通過" | "需檢查" | "無法取得";
  note: string;
};

const initialStocks: Stock[] = [
  {
    symbol: "2330",
    name: "台積電",
    type: "股票",
    market: "TWSE",
    price: 2250,
    prevClose: 2250,
    volume: 34181963,
    per: 30.25,
    eps: 74.38,
    ma5: 2211,
    ma20: 2085.75,
    rsi14: null,
    foreign3d: null,
    trust3d: null,
    dealer3d: null,
    marginChange5dPct: null,
    nasdaqReturn1d: 0.01030525216,
    soxReturn1d: 0.04232884592,
    taifexAfterHoursReturn: null,
    vixChange1d: -0.08201202843,
  },
  {
    symbol: "2454",
    name: "聯發科",
    type: "股票",
    market: "TWSE",
    price: 3430,
    prevClose: 3155,
    volume: 38462460,
    per: 51.95,
    eps: 66.03,
    ma5: 2765,
    ma20: 2117.25,
    rsi14: null,
    foreign3d: null,
    trust3d: null,
    dealer3d: null,
    marginChange5dPct: null,
    nasdaqReturn1d: 0.01030525216,
    soxReturn1d: 0.04232884592,
    taifexAfterHoursReturn: null,
    vixChange1d: -0.08201202843,
  },
  {
    symbol: "3231",
    name: "緯創",
    type: "股票",
    market: "TWSE",
    price: 146.5,
    prevClose: 142,
    volume: 71828870,
    per: 17.44,
    eps: 8.4,
    ma5: 140.1,
    ma20: 137.475,
    rsi14: null,
    foreign3d: null,
    trust3d: null,
    dealer3d: null,
    marginChange5dPct: null,
    nasdaqReturn1d: 0.01030525216,
    soxReturn1d: 0.04232884592,
    taifexAfterHoursReturn: null,
    vixChange1d: -0.08201202843,
  },
  {
    symbol: "2317",
    name: "鴻海",
    type: "股票",
    market: "TWSE",
    price: 252,
    prevClose: 239.5,
    volume: 239432399,
    per: 18.81,
    eps: 13.4,
    ma5: 227.4,
    ma20: 213.65,
    rsi14: null,
    foreign3d: null,
    trust3d: null,
    dealer3d: null,
    marginChange5dPct: null,
    nasdaqReturn1d: 0.01030525216,
    soxReturn1d: 0.04232884592,
    taifexAfterHoursReturn: null,
    vixChange1d: -0.08201202843,
  },
  {
    symbol: "6446",
    name: "藥華藥",
    type: "股票",
    market: "TPEx",
    price: 620,
    prevClose: 640,
    volume: 3200,
    per: 62,
    eps: 10,
    ma5: 635,
    ma20: 648,
    rsi14: null,
    foreign3d: null,
    trust3d: null,
    dealer3d: null,
    marginChange5dPct: null,
    nasdaqReturn1d: 0.01030525216,
    soxReturn1d: 0.04232884592,
    taifexAfterHoursReturn: null,
    vixChange1d: -0.08201202843,
  },
  {
    symbol: "0050",
    name: "元大台灣50",
    type: "ETF",
    market: "TWSE",
    price: 95.75,
    prevClose: 94.6,
    volume: 111759164,
    per: null,
    eps: null,
    ma5: 92.49,
    ma20: 86.0025,
    rsi14: null,
    foreign3d: null,
    trust3d: null,
    dealer3d: null,
    marginChange5dPct: null,
    nasdaqReturn1d: 0.01030525216,
    soxReturn1d: 0.04232884592,
    taifexAfterHoursReturn: null,
    vixChange1d: -0.08201202843,
  },
];

const compareFields: Array<{
  key: keyof GoogleRaw;
  label: string;
  stockKey: keyof Stock;
  tolerancePct: number;
  note: string;
}> = [
  {
    key: "price",
    stockKey: "price",
    label: "現價 price",
    tolerancePct: 0.5,
    note: "GoogleFinance 可驗證行情價格；若差異過大需檢查交易日、延遲或除權息。",
  },
  {
    key: "prevClose",
    stockKey: "prevClose",
    label: "昨收 prevClose",
    tolerancePct: 0.5,
    note: "昨收應高度一致；若偏差大優先檢查資料日期。",
  },
  {
    key: "volume",
    stockKey: "volume",
    label: "成交量 volume",
    tolerancePct: 5,
    note: "成交量可能因單位、延遲或更新時間不同而有差異。",
  },
  {
    key: "per",
    stockKey: "per",
    label: "本益比 PER",
    tolerancePct: 8,
    note: "PER 口徑可能不同，只作輔助驗證。",
  },
  {
    key: "eps",
    stockKey: "eps",
    label: "EPS",
    tolerancePct: 8,
    note: "EPS 口徑可能不同，只作輔助驗證。",
  },
  {
    key: "ma5",
    stockKey: "ma5",
    label: "5MA",
    tolerancePct: 1,
    note: "短線技術面驗證欄位，正式 RSI 後續由後端或 FinMind close series 計算。",
  },
  {
    key: "ma20",
    stockKey: "ma20",
    label: "20MA",
    tolerancePct: 1,
    note: "波段均線驗證欄位。",
  },
  {
    key: "nasdaqReturn1d",
    stockKey: "nasdaqReturn1d",
    label: "Nasdaq 一日變化",
    tolerancePct: 5,
    note: "市場面驗證欄位。",
  },
  {
    key: "soxReturn1d",
    stockKey: "soxReturn1d",
    label: "SOX 一日變化",
    tolerancePct: 5,
    note: "半導體市場面驗證欄位。",
  },
  {
    key: "vixChange1d",
    stockKey: "vixChange1d",
    label: "VIX 一日變化",
    tolerancePct: 5,
    note: "風險面驗證欄位。",
  },
];

function normalizeStockSymbol(value: unknown) {
  const raw = String(value || "").trim().toUpperCase();

  const cleaned = raw
    .replace(/^TPE:/, "")
    .replace(/^TWO:/, "")
    .replace(/\.TW$/, "")
    .replace(/\.TWO$/, "")
    .replace(/[^0-9A-Z]/g, "");

  if (/^\d{1,4}$/.test(cleaned)) {
    return cleaned.padStart(4, "0");
  }

  return cleaned;
}

function number(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-";
  return Number(value).toLocaleString("zh-TW");
}

function pct(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-";
  return `${(Number(value) * 100).toFixed(2)}%`;
}

function displayValue(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-";
  return Number(value).toLocaleString("zh-TW");
}

function scoreTone(score: number) {
  if (score >= 85) return "bg-emerald-100 text-emerald-800";
  if (score >= 70) return "bg-lime-100 text-lime-800";
  if (score >= 55) return "bg-yellow-100 text-yellow-800";
  if (score >= 40) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

function statusTone(status: string) {
  if (status === "通過") return "bg-emerald-100 text-emerald-800";
  if (status === "需檢查") return "bg-orange-100 text-orange-800";
  return "bg-slate-100 text-slate-700";
}

function getTicker(stock: Stock) {
  return `${stock.market === "TPEx" ? "TWO" : "TPE"}:${stock.symbol}`;
}

function createTemplate(stocks: Stock[]) {
  const tab = "\t";
  const newline = "\n";

  const rows: string[][] = [
    [
      "symbol",
      "name",
      "ticker",
      "price",
      "prevClose",
      "volume",
      "per",
      "eps",
      "ma5",
      "ma20",
      "rsi14",
      "foreign3d",
      "trust3d",
      "dealer3d",
      "marginChange5dPct",
      "nasdaqReturn1d",
      "soxReturn1d",
      "taifexAfterHoursReturn",
      "vixChange1d",
      "updatedAt",
      "sourceNote",
    ],
  ];

  stocks.forEach((stock, index) => {
    const row = index + 2;
    const symbolCell = stock.symbol.startsWith("0") ? `'${stock.symbol}` : stock.symbol;

    rows.push([
      symbolCell,
      stock.name,
      getTicker(stock),
      `=IFERROR(GOOGLEFINANCE(C${row},"price"),"")`,
      `=IFERROR(GOOGLEFINANCE(C${row},"closeyest"),"")`,
      `=IFERROR(GOOGLEFINANCE(C${row},"volume"),"")`,
      `=IFERROR(GOOGLEFINANCE(C${row},"pe"),"")`,
      `=IFERROR(GOOGLEFINANCE(C${row},"eps"),"")`,
      `=IFERROR(AVERAGE(QUERY(GOOGLEFINANCE(C${row},"close",TODAY()-10,TODAY()),"select Col2 order by Col1 desc limit 5",1)),"")`,
      `=IFERROR(AVERAGE(QUERY(GOOGLEFINANCE(C${row},"close",TODAY()-40,TODAY()),"select Col2 order by Col1 desc limit 20",1)),"")`,
      "",
      "",
      "",
      "",
      "",
      `=IFERROR(GOOGLEFINANCE("INDEXNASDAQ:.IXIC","changepct")/100,"")`,
      `=IFERROR(GOOGLEFINANCE("INDEXNASDAQ:SOX","changepct")/100,"")`,
      "",
      `=IFERROR(GOOGLEFINANCE("INDEXCBOE:VIX","changepct")/100,"")`,
      `=NOW()`,
      "GoogleFinance",
    ]);
  });

  return rows.map((row) => row.join(tab)).join(newline);
}

function getTodayReturn(stock: Stock) {
  if (!stock.prevClose) return 0;
  return ((stock.price - stock.prevClose) / stock.prevClose) * 100;
}

function pass(value: boolean) {
  return value ? 1 : 0;
}

function shortScore(stock: Stock) {
  const rules = [
    { key: "ma5", weight: 0.15, ok: stock.ma5 !== null && stock.price > stock.ma5 },
    { key: "ma20", weight: 0.15, ok: stock.ma20 !== null && stock.price > stock.ma20 },
    { key: "rsi14", weight: 0.1, ok: stock.rsi14 !== null && stock.rsi14 < 70 },
    {
      key: "institutional3d",
      weight: 0.2,
      ok:
        stock.foreign3d !== null &&
        stock.trust3d !== null &&
        stock.dealer3d !== null &&
        stock.foreign3d + stock.trust3d + stock.dealer3d > 0,
    },
    {
      key: "margin5d",
      weight: 0.1,
      ok: stock.marginChange5dPct !== null && stock.marginChange5dPct <= 8,
    },
    {
      key: "usMarket",
      weight: 0.15,
      ok:
        (stock.nasdaqReturn1d !== null && stock.nasdaqReturn1d > 0) ||
        (stock.soxReturn1d !== null && stock.soxReturn1d > 0),
    },
    {
      key: "vix",
      weight: 0.15,
      ok:
        (stock.taifexAfterHoursReturn !== null && stock.taifexAfterHoursReturn > 0) ||
        (stock.vixChange1d !== null && stock.vixChange1d < 0),
    },
  ];

  return rules.reduce((sum, rule) => sum + rule.weight * pass(rule.ok), 0) * 100;
}

function recommendation(score: number) {
  if (score >= 85) return "強力買入 / 適合短線做多";
  if (score >= 70) return "偏多 / 可分批試單";
  if (score >= 55) return "橫盤觀望 / 等確認";
  if (score >= 40) return "偏弱 / 不追價";
  return "避開 / 等待轉強";
}

function createCompareRows(stock: Stock, google?: GoogleRaw): CompareRow[] {
  return compareFields.map((field) => {
    const mainValue = stock[field.stockKey] as number | null;
    const googleValue = google ? (google[field.key] as number | null) : null;

    const hasBoth =
      mainValue !== null &&
      googleValue !== null &&
      Number.isFinite(Number(mainValue)) &&
      Number.isFinite(Number(googleValue)) &&
      Number(mainValue) !== 0;

    const diffPct = hasBoth ? ((Number(googleValue) - Number(mainValue)) / Number(mainValue)) * 100 : null;
    const absDiff = diffPct === null ? null : Math.abs(diffPct);

    return {
      label: field.label,
      mainValue,
      googleValue,
      diffPct,
      tolerancePct: field.tolerancePct,
      status: !hasBoth ? "無法取得" : absDiff !== null && absDiff <= field.tolerancePct ? "通過" : "需檢查",
      note: field.note,
    };
  });
}

function validationSummary(rows: CompareRow[]) {
  const passCount = rows.filter((row) => row.status === "通過").length;
  const checkCount = rows.filter((row) => row.status === "需檢查").length;
  const unavailableCount = rows.filter((row) => row.status === "無法取得").length;

  if (checkCount > 0) {
    return `有 ${checkCount} 項超過容忍值，需檢查資料日期、單位、除權息或資料源口徑。`;
  }

  if (passCount > 0 && unavailableCount === 0) {
    return "可驗證欄位皆在容忍範圍內，主資料可信。";
  }

  if (passCount > 0) {
    return `已有 ${passCount} 項通過驗證，仍有 ${unavailableCount} 項驗證來源無法取得；該欄位僅保留主資料，不判定為驗證失敗。`;
  }

  return "目前驗證來源無法取得可比對欄位；系統先保留主資料，不判定為驗證失敗。";
}

function buildGoogleApiUrl(csvUrl: string, stocks: Stock[]) {
  const symbols = stocks.map((stock) => stock.symbol).join(",");
  return `/api/google/verify?url=${encodeURIComponent(csvUrl)}&symbols=${encodeURIComponent(symbols)}`;
}

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

function Button({
  children,
  disabled,
  onClick,
  variant = "primary",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  variant?: "primary" | "outline";
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={
        variant === "outline"
          ? "h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          : "h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300 ${
        props.className || ""
      }`}
    />
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

export default function Page() {
  const [stocks, setStocks] = useState<Stock[]>(initialStocks);
  const [selected, setSelected] = useState("2330");
  const [csvUrl, setCsvUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [debug, setDebug] = useState<VerifyApiResponse | null>(null);
  const [validationMap, setValidationMap] = useState<Record<string, { google: GoogleRaw }>>({});
  const [rawDataMap, setRawDataMap] = useState<VerifyApiResponse["rawDataMap"]>({});
  const [newAsset, setNewAsset] = useState({
    symbol: "",
    name: "",
    type: "股票" as "股票" | "ETF",
    market: "TWSE" as "TWSE" | "TPEx",
  });

  const selectedStock = stocks.find((stock) => stock.symbol === selected) || stocks[0];
  const selectedGoogle = validationMap[selectedStock.symbol]?.google;
  const compareRows = useMemo(
    () => createCompareRows(selectedStock, selectedGoogle),
    [selectedStock, selectedGoogle]
  );

  const overviewRows = useMemo(() => {
    return stocks
      .map((stock) => {
        const score = shortScore(stock);
        const google = validationMap[stock.symbol]?.google;
        const checks = createCompareRows(stock, google);
        const passCount = checks.filter((row) => row.status === "通過").length;
        const checkCount = checks.filter((row) => row.status === "需檢查").length;
        const unavailableCount = checks.filter((row) => row.status === "無法取得").length;

        return {
          stock,
          score,
          checks,
          passCount,
          checkCount,
          unavailableCount,
          verifyLabel:
            checkCount > 0 ? "需檢查" : passCount > 0 && unavailableCount === 0 ? "可信" : passCount > 0 ? "部分驗證" : "無法取得",
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [stocks, validationMap]);

  const template = useMemo(() => createTemplate(stocks), [stocks]);

  async function loadGoogleVerify() {
    if (!csvUrl.trim()) {
      setMessage("請先貼上 Google Sheet 發佈 CSV URL。");
      return;
    }

    setLoading(true);
    setMessage("讀取中...");

    try {
      const res = await fetch(buildGoogleApiUrl(csvUrl.trim(), stocks), {
        cache: "no-store",
      });

      const json = (await res.json()) as VerifyApiResponse;

      if (!res.ok || !json.ok) {
        throw new Error(json.message || json.error || `HTTP ${res.status}`);
      }

      setDebug(json);
      setValidationMap(json.validationMap || {});
      setRawDataMap(json.rawDataMap || {});
      setMessage(`Google 驗證成功：${json.matchedSymbols?.length || 0}/${json.parsedRows || 0} 檔`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setMessage(`Google 驗證失敗：${msg}`);
      setDebug({ ok: false, error: msg });
    } finally {
      setLoading(false);
    }
  }

  function addAsset() {
    const symbol = normalizeStockSymbol(newAsset.symbol);

    if (!symbol) {
      setMessage("請輸入股票或 ETF 代號。");
      return;
    }

    if (stocks.some((stock) => stock.symbol === symbol)) {
      setMessage(`${symbol} 已在清單中。`);
      return;
    }

    const asset: Stock = {
      symbol,
      name: newAsset.name.trim() || symbol,
      type: newAsset.type,
      market: newAsset.market,
      price: 100,
      prevClose: 100,
      volume: 0,
      per: null,
      eps: null,
      ma5: null,
      ma20: null,
      rsi14: null,
      foreign3d: null,
      trust3d: null,
      dealer3d: null,
      marginChange5dPct: null,
      nasdaqReturn1d: null,
      soxReturn1d: null,
      taifexAfterHoursReturn: null,
      vixChange1d: null,
    };

    setStocks((prev) => [...prev, asset]);
    setSelected(symbol);
    setNewAsset({ symbol: "", name: "", type: "股票", market: "TWSE" });
    setMessage(`${symbol} 已加入，請更新 Google Sheet 模板後重新發佈 CSV。`);
  }

  function removeAsset(symbol: string) {
    if (stocks.length <= 1) {
      setMessage("至少要保留一檔標的。");
      return;
    }

    const next = stocks.filter((stock) => stock.symbol !== symbol);
    setStocks(next);

    if (selected === symbol) {
      setSelected(next[0]?.symbol || "");
    }

    setMessage(`${symbol} 已移除。`);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">股票短中長分析 App — 線上驗證版</h1>
          <p className="text-sm text-slate-500">
            朋友只要貼自己的 Google Sheet CSV URL，App 會透過 /api/google/verify 讀取資料並做交叉驗證。
          </p>
        </header>

        <Card>
          <div className="space-y-3 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-bold">Google Sheet CSV 驗證來源</h2>
                <p className="text-sm text-slate-500">
                  Google Sheet 只當驗證來源；App 不會寫入、不會重建表格，也不會把你的 URL 寫死。
                </p>
              </div>
              <Badge className="bg-slate-100 text-slate-700">API：/api/google/verify</Badge>
            </div>

            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <Input
                value={csvUrl}
                onChange={(e) => setCsvUrl(e.target.value)}
                placeholder="貼上朋友自己的 Google Sheet 發佈 CSV URL"
              />
              <Button onClick={loadGoogleVerify} disabled={loading || !csvUrl.trim()}>
                {loading ? "讀取中..." : "讀取 Google 驗證"}
              </Button>
            </div>

            {message && (
              <div className="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</div>
            )}
          </div>
        </Card>

        <Card>
          <div className="space-y-3 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-bold">新增股票 / ETF</h2>
                <p className="text-sm text-slate-500">新增後請重新複製模板到 Google Sheet，再發佈 CSV。</p>
              </div>
              <Badge className="bg-slate-100 text-slate-700">目前 {stocks.length} 檔</Badge>
            </div>

            <div className="grid gap-2 md:grid-cols-[150px_1fr_120px_120px_auto]">
              <Input
                placeholder="代號"
                value={newAsset.symbol}
                onChange={(e) => setNewAsset((prev) => ({ ...prev, symbol: e.target.value }))}
              />
              <Input
                placeholder="名稱"
                value={newAsset.name}
                onChange={(e) => setNewAsset((prev) => ({ ...prev, name: e.target.value }))}
              />
              <select
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                value={newAsset.type}
                onChange={(e) => setNewAsset((prev) => ({ ...prev, type: e.target.value as "股票" | "ETF" }))}
              >
                <option value="股票">股票</option>
                <option value="ETF">ETF</option>
              </select>
              <select
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                value={newAsset.market}
                onChange={(e) => setNewAsset((prev) => ({ ...prev, market: e.target.value as "TWSE" | "TPEx" }))}
              >
                <option value="TWSE">TWSE</option>
                <option value="TPEx">TPEx</option>
              </select>
              <Button onClick={addAsset}>加入</Button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-3 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-bold">全部股票 / ETF 總覽</h2>
                <p className="text-sm text-slate-500">
                  短線分數目前使用主資料計算；Google 只用來驗證欄位是否對得起來。
                </p>
              </div>
              <Badge className="bg-slate-100 text-slate-700">線上測試版</Badge>
            </div>

            <div className="max-h-[320px] overflow-auto rounded-xl border">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="sticky top-0 bg-white text-left text-slate-500">
                  <tr className="border-b">
                    <th className="px-3 py-2">排名</th>
                    <th>標的</th>
                    <th>類型</th>
                    <th>市場</th>
                    <th>現價</th>
                    <th>今日</th>
                    <th>短線</th>
                    <th>建議</th>
                    <th>驗證</th>
                    <th>可用欄位</th>
                    <th className="text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {overviewRows.map((row, index) => {
                    const raw = rawDataMap?.[row.stock.symbol];

                    return (
                      <tr
                        key={row.stock.symbol}
                        onClick={() => setSelected(row.stock.symbol)}
                        className={`cursor-pointer border-b last:border-0 hover:bg-slate-50 ${
                          selected === row.stock.symbol ? "bg-slate-100" : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-semibold">{index + 1}</td>
                        <td className="font-semibold">
                          {row.stock.symbol} {row.stock.name}
                        </td>
                        <td>{row.stock.type}</td>
                        <td>{row.stock.market}</td>
                        <td>{number(row.stock.price)}</td>
                        <td>{getTodayReturn(row.stock).toFixed(2)}%</td>
                        <td>
                          <Badge className={scoreTone(row.score)}>{Math.round(row.score)}</Badge>
                        </td>
                        <td>
                          <Badge className={scoreTone(row.score)}>{recommendation(row.score)}</Badge>
                        </td>
                        <td>
                          <Badge
                            className={
                              row.verifyLabel === "可信"
                                ? "bg-emerald-100 text-emerald-800"
                                : row.verifyLabel === "需檢查"
                                  ? "bg-orange-100 text-orange-800"
                                  : row.verifyLabel === "部分驗證"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-slate-100 text-slate-700"
                            }
                          >
                            {row.verifyLabel}
                          </Badge>
                        </td>
                        <td>
                          {raw
                            ? `${raw.dataAvailability.availableCount}/${raw.dataAvailability.availableCount + raw.dataAvailability.unavailableCount}`
                            : "-"}
                        </td>
                        <td className="text-center">
                          <Button variant="outline" onClick={() => removeAsset(row.stock.symbol)}>
                            移除
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card>
            <div className="space-y-3 p-4">
              <div>
                <h2 className="text-lg font-bold">
                  {selectedStock.symbol} {selectedStock.name}｜主資料 vs Google 驗證
                </h2>
                <p className="text-sm text-slate-500">{validationSummary(compareRows)}</p>
              </div>

              <div className="overflow-auto rounded-xl border">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-white text-left text-slate-500">
                    <tr className="border-b">
                      <th className="px-3 py-2">欄位</th>
                      <th>主資料</th>
                      <th>Google 驗證</th>
                      <th>偏差</th>
                      <th>容忍值</th>
                      <th>狀態</th>
                      <th>備註</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareRows.map((row) => (
                      <tr key={row.label} className="border-b last:border-0">
                        <td className="px-3 py-2 font-semibold">{row.label}</td>
                        <td>{displayValue(row.mainValue)}</td>
                        <td>{displayValue(row.googleValue)}</td>
                        <td>{row.diffPct === null ? "-" : `${row.diffPct.toFixed(2)}%`}</td>
                        <td>±{row.tolerancePct}%</td>
                        <td>
                          <Badge className={statusTone(row.status)}>{row.status}</Badge>
                        </td>
                        <td className="max-w-md text-slate-500">{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-3 p-4">
              <h2 className="text-lg font-bold">Google rawDataMap</h2>
              {rawDataMap?.[selectedStock.symbol] ? (
                <div className="space-y-2 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="font-semibold">來源</div>
                    <div>{rawDataMap[selectedStock.symbol].google.sourceNote || "-"}</div>
                    <div>{rawDataMap[selectedStock.symbol].google.updatedAt || "-"}</div>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <div className="font-semibold text-emerald-900">可取得</div>
                    <div className="mt-1 text-emerald-800">
                      {rawDataMap[selectedStock.symbol].dataAvailability.available.join(", ") || "-"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="font-semibold text-slate-900">無法取得</div>
                    <div className="mt-1 text-slate-600">
                      {rawDataMap[selectedStock.symbol].dataAvailability.unavailable.join(", ") || "-"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-500">
                  尚未讀取 Google 驗證資料，或此標的沒有對上。
                </div>
              )}
            </div>
          </Card>
        </div>

        <Card>
          <div className="space-y-3 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-bold">Google 驗證模板 V2</h2>
                <p className="text-sm text-slate-500">
                  複製下方 TSV，貼到 Google Sheet A1。發佈成 CSV 後，把 CSV URL 貼回上方。
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(template);
                  setMessage("Google 模板已複製。");
                }}
              >
                複製模板
              </Button>
            </div>
            <textarea
              readOnly
              value={template}
              className="h-64 w-full rounded-xl border bg-slate-950 p-3 font-mono text-xs text-slate-100"
            />
          </div>
        </Card>

        <Card>
          <div className="space-y-3 p-4">
            <h2 className="text-lg font-bold">API 診斷</h2>
            {debug ? (
              <pre className="max-h-[420px] overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">
                {JSON.stringify(
                  {
                    ok: debug.ok,
                    version: debug.version,
                    csvUrl: debug.csvUrl,
                    parsedRows: debug.parsedRows,
                    headers: debug.headers,
                    matchedSymbols: debug.matchedSymbols,
                    unmatchedSymbols: debug.unmatchedSymbols,
                    valuePreview: debug.valuePreview,
                  },
                  null,
                  2
                )}
              </pre>
            ) : (
              <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-500">
                尚未讀取資料。
              </div>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}