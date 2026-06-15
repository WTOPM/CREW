import type { ShipInfo } from '../models/crew.models';
import type { DgPageShipContext } from '../models/dg-page-archive.models';
import type { ReeferPageShipContext } from '../models/reefer-page-archive.models';

/** DG page voyage fields — independent from the main ship form. */
export interface DgPageContext {
  portOfCall: string;
  nextPortOfCall: string;
  dateOfDeparture: string;
  dateOfArrival: string;
}

/** Reefer page voyage fields — independent from the main ship form. */
export interface ReeferPageContext {
  portOfCall: string;
  dateOfDeparture: string;
}

export function createEmptyDgPageContext(): DgPageContext {
  return {
    portOfCall: '',
    nextPortOfCall: '',
    dateOfDeparture: '',
    dateOfArrival: '',
  };
}

export function createEmptyReeferPageContext(): ReeferPageContext {
  return {
    portOfCall: '',
    dateOfDeparture: '',
  };
}

export function normalizeDgPageContext(
  raw: Partial<DgPageContext> | undefined,
  hasExplicitKey: boolean,
  shipSeed?: Pick<ShipInfo, 'portOfCall' | 'nextPortOfCall' | 'dateOfDeparture' | 'dateOfArrival'>,
): DgPageContext {
  if (hasExplicitKey || raw) {
    return {
      portOfCall: String(raw?.portOfCall ?? '').trim(),
      nextPortOfCall: String(raw?.nextPortOfCall ?? '').trim(),
      dateOfDeparture: String(raw?.dateOfDeparture ?? '').trim(),
      dateOfArrival: String(raw?.dateOfArrival ?? '').trim(),
    };
  }
  if (shipSeed) {
    return {
      portOfCall: shipSeed.portOfCall?.trim() ?? '',
      nextPortOfCall: shipSeed.nextPortOfCall?.trim() ?? '',
      dateOfDeparture: shipSeed.dateOfDeparture?.trim() ?? '',
      dateOfArrival: shipSeed.dateOfArrival?.trim() ?? '',
    };
  }
  return createEmptyDgPageContext();
}

export function normalizeReeferPageContext(
  raw: Partial<ReeferPageContext> | undefined,
  hasExplicitKey: boolean,
  shipSeed?: Pick<ShipInfo, 'portOfCall' | 'dateOfDeparture'>,
): ReeferPageContext {
  if (hasExplicitKey || raw) {
    return {
      portOfCall: String(raw?.portOfCall ?? '').trim(),
      dateOfDeparture: String(raw?.dateOfDeparture ?? '').trim(),
    };
  }
  if (shipSeed) {
    return {
      portOfCall: shipSeed.portOfCall?.trim() ?? '',
      dateOfDeparture: shipSeed.dateOfDeparture?.trim() ?? '',
    };
  }
  return createEmptyReeferPageContext();
}

export function dgShipForExport(ship: ShipInfo, ctx: DgPageContext): ShipInfo {
  return {
    ...ship,
    portOfCall: ctx.portOfCall,
    nextPortOfCall: ctx.nextPortOfCall,
    dateOfDeparture: ctx.dateOfDeparture,
    dateOfArrival: ctx.dateOfArrival,
  };
}

export function reeferShipForExport(ship: ShipInfo, ctx: ReeferPageContext): ShipInfo {
  return {
    ...ship,
    portOfCall: ctx.portOfCall,
    dateOfDeparture: ctx.dateOfDeparture,
  };
}

export function dgPageShipContextFromLibrary(
  ship: ShipInfo,
  ctx: DgPageContext,
): DgPageShipContext {
  return {
    voyageNumber: ship.voyageNumber?.trim() ?? '',
    portOfCall: ctx.portOfCall,
    nextPortOfCall: ctx.nextPortOfCall,
    dateOfDeparture: ctx.dateOfDeparture,
    dateOfArrival: ctx.dateOfArrival,
  };
}

export function reeferPageShipContextFromLibrary(
  ship: ShipInfo,
  ctx: ReeferPageContext,
): ReeferPageShipContext {
  return {
    voyageNumber: ship.voyageNumber?.trim() ?? '',
    portOfCall: ctx.portOfCall,
    dateOfDeparture: ctx.dateOfDeparture,
  };
}

export function resolveDgPageContextFromSnapshot(
  ctx: DgPageContext,
  shipCtx: DgPageShipContext,
): DgPageContext {
  const hasPageContext =
    ctx.portOfCall || ctx.nextPortOfCall || ctx.dateOfDeparture || ctx.dateOfArrival;
  if (hasPageContext) return ctx;
  return {
    portOfCall: shipCtx.portOfCall,
    nextPortOfCall: shipCtx.nextPortOfCall,
    dateOfDeparture: shipCtx.dateOfDeparture,
    dateOfArrival: shipCtx.dateOfArrival,
  };
}

export function resolveReeferPageContextFromSnapshot(
  ctx: ReeferPageContext,
  shipCtx: ReeferPageShipContext,
): ReeferPageContext {
  const hasPageContext = ctx.portOfCall || ctx.dateOfDeparture;
  if (hasPageContext) return ctx;
  return {
    portOfCall: shipCtx.portOfCall,
    dateOfDeparture: shipCtx.dateOfDeparture,
  };
}
