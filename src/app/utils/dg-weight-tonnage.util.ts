import { commitDgWeightKgInput, parseDgWeightKg } from '../models/dg-manifest.models';

/** Cargo row with optional gross/net weights from manifest import. */
export interface DgDualWeightLine {
  weightKg?: string;
  grossWeightKg?: string;
  netWeightKg?: string;
}

export function normalizeDgDualWeightFields(
  partial?: Partial<DgDualWeightLine>,
  useGross = true,
): { weightKg: string; grossWeightKg: string; netWeightKg: string } {
  const gross = (partial?.grossWeightKg ?? '').trim();
  const net = (partial?.netWeightKg ?? '').trim();
  const legacy = (partial?.weightKg ?? '').trim();
  const grossWeightKg = gross || (legacy && !net ? legacy : gross);
  const netWeightKg = net || (legacy && !gross ? legacy : net);
  const activeRaw = useGross
    ? grossWeightKg || legacy || netWeightKg
    : netWeightKg || legacy || grossWeightKg;
  const weightKg = activeRaw ? commitDgWeightKgInput(activeRaw, false) : '';
  return {
    weightKg,
    grossWeightKg: grossWeightKg ? commitDgWeightKgInput(grossWeightKg, false) : '',
    netWeightKg: netWeightKg ? commitDgWeightKgInput(netWeightKg, false) : '',
  };
}

export function dgLineActiveWeightRaw(line: DgDualWeightLine, useGross: boolean): string {
  const gross = (line.grossWeightKg ?? '').trim();
  const net = (line.netWeightKg ?? '').trim();
  const legacy = (line.weightKg ?? '').trim();
  if (useGross) return gross || legacy || net;
  return net || legacy || gross;
}

export function dgLineActiveWeightKg(line: DgDualWeightLine, useGross: boolean): number {
  return parseDgWeightKg(dgLineActiveWeightRaw(line, useGross));
}

export function commitDgDualWeightEdit(
  raw: string,
  useGross: boolean,
  roundWeights = false,
): { weightKg: string; grossWeightKg?: string; netWeightKg?: string } {
  const decimal = commitDgWeightKgInput(raw, false);
  if (!decimal) {
    return useGross
      ? { weightKg: '', grossWeightKg: '' }
      : { weightKg: '', netWeightKg: '' };
  }
  const display = roundWeights ? commitDgWeightKgInput(decimal, true) : decimal;
  if (useGross) {
    return { weightKg: display, grossWeightKg: decimal };
  }
  return { weightKg: display, netWeightKg: decimal };
}

export function dualWeightFromImport(
  grossRaw: string,
  netRaw: string,
  useGross: boolean,
): { weightKg: string; grossWeightKg: string; netWeightKg: string } {
  return normalizeDgDualWeightFields(
    {
      grossWeightKg: grossRaw,
      netWeightKg: netRaw,
    },
    useGross,
  );
}
