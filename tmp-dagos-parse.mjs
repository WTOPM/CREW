// src/app/utils/dg-unifeeder-dagos-pdf.util.ts
var CONTAINER_RE = /^[A-Z]{4}\d{7}$/;
var POSITION_RE = /^\d{6}$/;
var UN_RE = /^\d{4}$/;
var NET_RE = /^\d+\.\d+$/;
var POS_COL = [25, 65];
var SERIAL_COL = [65, 150];
var UN_COL = [175, 210];
var NET_COL = [515, 570];
function normalizeContainerNo(raw) {
  return raw.trim().toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
}
function normalizeNetWeightKg(raw) {
  const n = Number.parseFloat(raw.trim().replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return "";
  const rounded = Math.round(n * 1e3) / 1e3;
  return String(rounded);
}
function inCol(x, range) {
  return x >= range[0] && x <= range[1];
}
function groupRowItems(items, yTol = 3) {
  const groups = [];
  for (const it of items) {
    const group = groups.find((g) => Math.abs(g.y - it.y) <= yTol);
    if (group) {
      group.items.push(it);
    } else {
      groups.push({ y: it.y, items: [it] });
    }
  }
  groups.sort((a, b) => a.y - b.y);
  return groups;
}
function pickInCol(items, col, pred) {
  for (const it of items) {
    if (!inCol(it.x, col)) continue;
    const value = it.str.trim();
    if (pred(value)) return value;
  }
  return "";
}
function extractPageLines(pageItems) {
  const rows = [];
  let lastPosition = "";
  for (const group of groupRowItems(pageItems)) {
    const position = pickInCol(group.items, POS_COL, (value) => POSITION_RE.test(value));
    const serialRaw = pickInCol(
      group.items,
      SERIAL_COL,
      (value) => CONTAINER_RE.test(normalizeContainerNo(value))
    );
    const unNo = pickInCol(group.items, UN_COL, (value) => UN_RE.test(value));
    const netRaw = pickInCol(group.items, NET_COL, (value) => NET_RE.test(value));
    if (position) lastPosition = position;
    if (!serialRaw) continue;
    if (!position && !unNo && !netRaw) continue;
    const resolvedPos = position || lastPosition;
    if (!resolvedPos) continue;
    rows.push({
      containerNo: normalizeContainerNo(serialRaw),
      position: resolvedPos,
      unNo,
      netWeightKg: netRaw ? normalizeNetWeightKg(netRaw) : ""
    });
  }
  return rows;
}
function isUnifeederDagosPositionsPdf(items) {
  const joined = items.map((it) => it.str).join(" ");
  if (/Dangerous Cargo Manifest/i.test(joined)) return false;
  if (!/Dagos on Board/i.test(joined)) return false;
  return /\bPos\.?\b/i.test(joined) && /Serial Number/i.test(joined);
}
function parseUnifeederDagosLines(items) {
  const pages = [...new Set(items.map((it) => it.page))].sort((a, b) => a - b);
  const out = [];
  for (const page of pages) {
    out.push(...extractPageLines(items.filter((it) => it.page === page)));
  }
  return out;
}
function parseUnifeederDagosPositions(items) {
  const byContainer = /* @__PURE__ */ new Map();
  for (const row of parseUnifeederDagosLines(items)) {
    byContainer.set(row.containerNo, row.position);
  }
  return [...byContainer.entries()].map(([containerNo, position]) => ({ containerNo, position })).sort((a, b) => a.containerNo.localeCompare(b.containerNo));
}
export {
  isUnifeederDagosPositionsPdf,
  parseUnifeederDagosLines,
  parseUnifeederDagosPositions
};
