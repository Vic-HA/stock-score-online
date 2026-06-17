export function volumeRatioBaseDisplayLabel(volumeBaseLabel = "") {
  const label = String(volumeBaseLabel || "");
  if (/TWSE\s*Snapshot|TWSE snapshot|snapshot|自算10日/.test(label)) return "TWSE snapshot 自算10日均量";
  if (/自算20日/.test(label)) return "TWSE snapshot 自算20日均量";
  if (label.includes("FinMind 10日")) return "FinMind 10日均量";
  if (label.includes("Google 10日")) return "Google 10日均量";
  if (label.includes("10日均量")) return "10日均量";
  if (label.includes("20日均量")) return "20日均量";
  if (label.includes("備援")) return "均量備援";
  return label || "歷史均量";
}

export function volumeRatioRuntimeSourceLabel(volumeBaseLabel = "") {
  return `目前主成交量 / ${volumeRatioBaseDisplayLabel(volumeBaseLabel)}`;
}

export function volumeBaseShortDisplayLabel(volumeBaseLabel = "") {
  const label = String(volumeBaseLabel || "").trim();
  if (!label) return "基準量";
  if (/10日|10 日|10ma|volume10/i.test(label)) return "10日均量";
  if (/20日|20 日|20ma|avgVolume20/i.test(label)) return "20日均量";
  return label;
}
