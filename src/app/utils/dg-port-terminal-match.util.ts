import type { Port, PortTerminal } from '../models/crew.models';
import { resolveKnownPortName, resolveManifestPortName } from '../models/crew.models';

/** Part after the first `/` in `PORT/TERMINAL …` (empty if none). */
export function extractPortTerminalHint(raw: string): string {
  const slash = raw.indexOf('/');
  if (slash < 0) return '';
  return raw
    .slice(slash + 1)
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeTerminalMatchText(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const STOP_TOKENS = new Set([
  'TERMINAL',
  'CONTAINER',
  'PORT',
  'THE',
  'AND',
  'OF',
  'SEA',
  'NORTH',
  'SOUTH',
  'EAST',
  'WEST',
]);

function significantTokens(raw: string): string[] {
  return normalizeTerminalMatchText(raw)
    .split(' ')
    .filter((t) => t.length >= 2 && !STOP_TOKENS.has(t));
}

/**
 * Score how well a PDF terminal hint matches a user-defined port terminal.
 * Higher is better; 0 = no useful match.
 */
export function scorePortTerminalMatch(pdfTerminalRaw: string, terminal: PortTerminal): number {
  const pdf = normalizeTerminalMatchText(pdfTerminalRaw);
  if (!pdf) return 0;

  const abbrev = normalizeTerminalMatchText(terminal.abbrev);
  const name = normalizeTerminalMatchText(terminal.name);
  const pdfCompact = pdf.replace(/ /g, '');
  let score = 0;

  if (name && pdf === name) score = Math.max(score, 1000);
  if (abbrev && pdf === abbrev) score = Math.max(score, 950);

  if (name) {
    if (pdf.includes(name) || name.includes(pdf)) {
      score = Math.max(score, 720 + Math.min(pdf.length, name.length));
    }
  }

  if (abbrev && abbrev.length >= 3) {
    if (pdfCompact.includes(abbrev)) score = Math.max(score, 820);
    for (const token of significantTokens(pdf)) {
      if (token.length < 3) continue;
      // e.g. PDF "NTB …" vs abbrev "DENTB"
      if (abbrev.includes(token)) score = Math.max(score, 600 + token.length * 25);
      if (token.includes(abbrev)) score = Math.max(score, 560 + abbrev.length * 25);
    }
  }

  const pdfTok = significantTokens(pdf);
  const nameTok = significantTokens(name);
  if (pdfTok.length && nameTok.length) {
    const nameSet = new Set(nameTok);
    let overlap = 0;
    for (const t of pdfTok) {
      if (nameSet.has(t)) overlap += 1;
    }
    const union = new Set([...pdfTok, ...nameTok]).size;
    if (union > 0 && overlap > 0) {
      score = Math.max(score, Math.round((overlap / union) * 500) + overlap * 40);
    }
  }

  return score;
}

const MIN_MATCH_SCORE = 120;

/** Best-matching terminal abbrev for this port, or '' if nothing strong enough. */
export function matchBestPortTerminal(
  pdfTerminalRaw: string,
  port: Port | undefined | null,
): string {
  const hint = pdfTerminalRaw.trim();
  if (!hint || !port?.terminals?.length) return '';

  let bestAbbrev = '';
  let bestScore = 0;
  for (const terminal of port.terminals) {
    const score = scorePortTerminalMatch(hint, terminal);
    if (score > bestScore) {
      bestScore = score;
      bestAbbrev = terminal.abbrev.trim().toUpperCase();
    }
  }
  return bestScore >= MIN_MATCH_SCORE ? bestAbbrev : '';
}

/** Resolve port list entry for a POL/POD label, then best terminal abbrev. */
export function resolveUnifeederTerminalAbbrev(
  portRef: string,
  pdfTerminalRaw: string,
  ports: readonly Port[],
): string {
  const name =
    resolveManifestPortName(portRef, ports) || resolveKnownPortName(portRef, ports) || portRef.trim();
  if (!name) return '';
  const port =
    ports.find((p) => p.name === name) ||
    ports.find((p) => p.name.toLowerCase() === name.toLowerCase());
  return matchBestPortTerminal(pdfTerminalRaw, port);
}
