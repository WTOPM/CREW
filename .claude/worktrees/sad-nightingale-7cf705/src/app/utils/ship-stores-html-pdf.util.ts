import {
  AppData,
  CrewMember,
  filterActiveCrewListFromData,
  formatPortCallPortName,
  portCountry,
} from '../models/crew.models';
import { filterActivePassengerListFromData } from '../models/passenger.models';
import {
  formatShipStoresQuantityText,
  formatShipStoresUnitText,
  normalizeShipStoresForm,
  normalizeShipStoresForm02,
  SHIP_STORES_02_ROW_COUNT,
  SHIP_STORES_ROW_COUNT,
} from '../models/ship-stores.models';
import { formatDisplayDate } from './date.util';
import { formatShipStores02PortsRoute } from '../services/ship-stores-02-field-positions';
import {
  formatShipStoresPeriodOfStay,
  formatShipStoresPortsRoute,
  shipStoresPeriodDays,
} from '../services/ship-stores-field-positions';

export type ShipStoresHtmlVariant = '01' | '02';
export type ShipStoresHtmlOverlayKey = 'shipStores' | 'shipStores02';

export interface ShipStoresForm01ArticleRow {
  nameOfArticle: string;
  quantity: string;
  unit: string;
}

/** Form 01 — full HTML declaration (IMO FAL Form 3). */
export interface ShipStoresForm01HtmlForm {
  arrival: boolean;
  departure: boolean;
  pageNo: string;
  nameOfShip: string;
  portOfArrivalDeparture: string;
  dateOfArrivalDeparture: string;
  nationalityOfShip: string;
  portArrivedFromOrDestination: string;
  numberOfPersonsOnBoard: string;
  periodOfStay: string;
  placeOfStorage: string;
  articles: ShipStoresForm01ArticleRow[];
  footerDate: string;
  footerMaster: string;
}

export interface ShipStoresForm02ArticleRow {
  nameOfArticle: string;
  quantity: string;
  unit: string;
  colAfterQuantity: string;
  officialUse: string;
  colRight1: string;
  colRight2: string;
}

/** Form 02 — full HTML declaration (long table). */
export interface ShipStoresForm02HtmlForm {
  arrival: boolean;
  departure: boolean;
  pageNo: string;
  nameOfShip: string;
  imoNumber: string;
  callSign: string;
  portOfArrivalDeparture: string;
  dateOfArrivalDeparture: string;
  nationalityOfShip: string;
  lastNextPortOfCall: string;
  numberOfPersonsOnBoard: string;
  periodOfStay: string;
  placeOfStorage: string;
  articles: ShipStoresForm02ArticleRow[];
  footerDate: string;
  footerMaster: string;
}

export interface ShipStoresHtmlPdfRow {
  name: string;
  quantity: string;
  unit: string;
}

export interface ShipStoresHtmlPdfSnapshot {
  variant: ShipStoresHtmlVariant;
  overlayKey: ShipStoresHtmlOverlayKey;
  /** Form 01 — structured HTML form fields. */
  form01?: ShipStoresForm01HtmlForm;
  /** Form 02 — structured HTML form fields. */
  form02?: ShipStoresForm02HtmlForm;
  /** Legacy PNG overlay (unused for HTML forms). */
  backgroundUrl?: string;
  header?: Record<string, string>;
  rows?: ShipStoresHtmlPdfRow[];
  documentOverlay: AppData['documentOverlay'];
  withOverlay: boolean;
}

function overlayCellValues(
  data: AppData,
  key: ShipStoresHtmlOverlayKey,
): Record<string, string> | undefined {
  const overlay = data.documentOverlay?.[key] as { cellValues?: Record<string, string> } | undefined;
  return overlay?.cellValues;
}

function buildForm01Data(data: AppData, formatForPdf: boolean): ShipStoresForm01HtmlForm {
  const form = normalizeShipStoresForm(data.shipStoresForm);
  const { ship } = data;
  const cv = overlayCellValues(data, 'shipStores') ?? {};
  const isArrival = cv['_ssMode'] !== 'departure';
  const list = isArrival ? 'arrival' : 'departure';
  const crewCount = filterActiveCrewListFromData(data, list).length;
  const paxCount = filterActivePassengerListFromData(data, list).length;
  const master = findMaster(filterActiveCrewListFromData(data, list));

  const periodDays = shipStoresPeriodDays(ship.dateOfArrival, ship.dateOfDeparture);

  const defaultArticles: ShipStoresForm01ArticleRow[] = form.rows
    .slice(0, SHIP_STORES_ROW_COUNT)
    .map((r) => ({
      nameOfArticle: r.name,
      quantity: formatForPdf ? formatShipStoresQuantityText(r.name, r.quantity) : r.quantity,
      unit: formatForPdf
        ? formatShipStoresUnitText(r.name, r.quantity, r.unit)
        : r.unit === 'NIL'
          ? ''
          : r.unit,
    }));
  while (defaultArticles.length < SHIP_STORES_ROW_COUNT) {
    defaultArticles.push({ nameOfArticle: '', quantity: '', unit: '' });
  }

  const articles: ShipStoresForm01ArticleRow[] = [];
  for (let i = 0; i < SHIP_STORES_ROW_COUNT; i++) {
    const base = defaultArticles[i] ?? { nameOfArticle: '', quantity: '', unit: '' };
    const name = cv[`d-${i}-0`] !== undefined ? String(cv[`d-${i}-0`]) : base.nameOfArticle;
    const quantity = cv[`d-${i}-1`] !== undefined ? String(cv[`d-${i}-1`]) : base.quantity;
    const unit = cv[`d-${i}-2`] !== undefined ? String(cv[`d-${i}-2`]) : base.unit;
    articles.push({
      nameOfArticle: name,
      quantity: formatForPdf ? formatShipStoresQuantityText(name, quantity) : quantity,
      unit: formatForPdf ? formatShipStoresUnitText(name, quantity, unit) : unit,
    });
  }

  return {
    arrival: isArrival,
    departure: !isArrival,
    pageNo: cv['h-pageNo'] ?? '1',
    nameOfShip: cv['h-nameOfShip'] ?? formatPortCallPortName(ship.name),
    portOfArrivalDeparture:
      cv['h-port'] ?? formatPortWithCountry(ship.portOfCall, data.ports),
    dateOfArrivalDeparture:
      cv['h-date'] ?? formatDisplayDate(isArrival ? ship.dateOfArrival : ship.dateOfDeparture),
    nationalityOfShip: cv['h-nationality'] ?? formatPortCallPortName(ship.nationality),
    portArrivedFromOrDestination:
      cv['h-portsRoute'] ??
      formatShipStoresPortsRoute(
        ship.lastPortOfCall,
        ship.nextPortOfCall,
        ship.portOfCall,
        data.ports,
        formatPortCallPortName,
        portCountry,
      ),
    numberOfPersonsOnBoard: cv['h-persons'] ?? String(crewCount + paxCount),
    periodOfStay: cv['h-period'] ?? formatShipStoresPeriodOfStay(periodDays),
    placeOfStorage: cv['h-storage'] ?? form.placeOfStorage,
    articles,
    footerDate:
      cv['footer-date'] ??
      formatDisplayDate(isArrival ? ship.dateOfArrival : ship.dateOfDeparture),
    footerMaster: cv['footer-master'] ?? (master ? formatCaptainName(master) : ''),
  };
}

function findMaster(crew: CrewMember[]): CrewMember | undefined {
  const exact = crew.find((m) => m.rank.trim().toLowerCase() === 'master');
  if (exact) return exact;
  return crew.find((m) => m.rank.trim().toLowerCase().includes('master'));
}

function formatCaptainName(member: Pick<CrewMember, 'familyName' | 'givenNames'>): string {
  const parts = [member.familyName?.trim(), member.givenNames?.trim()].filter(Boolean);
  return parts.join(' ').toUpperCase();
}

function formatPortWithCountry(portName: string, ports: AppData['ports']): string {
  const name = formatPortCallPortName(portName);
  if (!name) return '';
  const country = portCountry(portName, ports);
  return country ? `${name}, ${country.toUpperCase()}` : name;
}

function buildForm02Data(data: AppData, formatForPdf: boolean): ShipStoresForm02HtmlForm {
  const form = normalizeShipStoresForm02(data.shipStoresForm02);
  const { ship } = data;
  const cv = overlayCellValues(data, 'shipStores02') ?? {};
  const isArrival = cv['_ssMode'] !== 'departure';
  const list = isArrival ? 'arrival' : 'departure';
  const crewCount = filterActiveCrewListFromData(data, list).length;
  const paxCount = filterActivePassengerListFromData(data, list).length;
  const periodDays = shipStoresPeriodDays(ship.dateOfArrival, ship.dateOfDeparture);

  const defaultArticles: ShipStoresForm02ArticleRow[] = form.rows
    .slice(0, SHIP_STORES_02_ROW_COUNT)
    .map((r) => {
      const unit = r.unit === 'NIL' ? '' : r.unit;
      return {
        nameOfArticle: r.name,
        quantity: formatForPdf ? formatShipStoresQuantityText(r.name, r.quantity) : r.quantity,
        unit: formatForPdf ? formatShipStoresUnitText(r.name, r.quantity, unit) : unit,
        colAfterQuantity: formatForPdf
          ? formatShipStoresUnitText(r.name, r.quantity, unit)
          : unit,
        officialUse: '',
        colRight1: '',
        colRight2: '',
      };
    });
  while (defaultArticles.length < SHIP_STORES_02_ROW_COUNT) {
    defaultArticles.push({
      nameOfArticle: '',
      quantity: '',
      unit: '',
      colAfterQuantity: '',
      officialUse: '',
      colRight1: '',
      colRight2: '',
    });
  }

  const articles: ShipStoresForm02ArticleRow[] = [];
  for (let i = 0; i < SHIP_STORES_02_ROW_COUNT; i++) {
    const base = defaultArticles[i] ?? {
      nameOfArticle: '',
      quantity: '',
      unit: '',
      colAfterQuantity: '',
      officialUse: '',
      colRight1: '',
      colRight2: '',
    };
    const name = cv[`d-${i}-0`] !== undefined ? String(cv[`d-${i}-0`]) : base.nameOfArticle;
    const quantity = cv[`d-${i}-1`] !== undefined ? String(cv[`d-${i}-1`]) : base.quantity;
    const unit = cv[`d-${i}-2`] !== undefined ? String(cv[`d-${i}-2`]) : base.unit;
    const colAfterQuantity =
      cv[`d-${i}-2`] !== undefined ? String(cv[`d-${i}-2`]) : base.colAfterQuantity;
    const officialUse = cv[`d-${i}-3`] !== undefined ? String(cv[`d-${i}-3`]) : base.officialUse;
    const colRight1 = cv[`d-${i}-4`] !== undefined ? String(cv[`d-${i}-4`]) : base.colRight1;
    const colRight2 = cv[`d-${i}-5`] !== undefined ? String(cv[`d-${i}-5`]) : base.colRight2;
    articles.push({
      nameOfArticle: name,
      quantity: formatForPdf ? formatShipStoresQuantityText(name, quantity) : quantity,
      unit: formatForPdf ? formatShipStoresUnitText(name, quantity, unit) : unit,
      colAfterQuantity: formatForPdf
        ? formatShipStoresUnitText(name, quantity, colAfterQuantity)
        : colAfterQuantity,
      officialUse,
      colRight1,
      colRight2,
    });
  }

  return {
    arrival: isArrival,
    departure: !isArrival,
    pageNo: cv['h-pageNo'] ?? '1',
    nameOfShip: cv['h-nameOfShip'] ?? formatPortCallPortName(ship.name),
    imoNumber: cv['h-imo'] ?? ship.imoNo,
    callSign: cv['h-callSign'] ?? ship.callSign,
    portOfArrivalDeparture:
      cv['h-port'] ?? formatPortWithCountry(ship.portOfCall, data.ports),
    dateOfArrivalDeparture:
      cv['h-date'] ?? formatDisplayDate(isArrival ? ship.dateOfArrival : ship.dateOfDeparture),
    nationalityOfShip: cv['h-nationality'] ?? formatPortCallPortName(ship.nationality),
    lastNextPortOfCall:
      cv['h-portsRoute'] ??
      formatShipStores02PortsRoute(
        ship.lastPortOfCall,
        ship.nextPortOfCall,
        ship.portOfCall,
        data.ports,
        formatPortCallPortName,
        portCountry,
      ),
    numberOfPersonsOnBoard: cv['h-persons'] ?? String(crewCount + paxCount),
    periodOfStay: cv['h-period'] ?? formatShipStoresPeriodOfStay(periodDays),
    placeOfStorage: cv['h-storage'] ?? form.placeOfStorage,
    articles,
    footerDate:
      cv['footer-date'] ??
      formatDisplayDate(isArrival ? ship.dateOfArrival : ship.dateOfDeparture),
    footerMaster:
      cv['footer-master'] ??
      (() => {
        const master = findMaster(filterActiveCrewListFromData(data, list));
        return master ? formatCaptainName(master) : '';
      })(),
  };
}

export function buildShipStoresHtmlPdfSnapshot(
  data: AppData,
  withOverlay: boolean,
  variant: ShipStoresHtmlVariant,
): ShipStoresHtmlPdfSnapshot {
  if (variant === '02') {
    return {
      variant: '02',
      overlayKey: 'shipStores02',
      form02: buildForm02Data(data, withOverlay),
      documentOverlay: data.documentOverlay,
      withOverlay,
    };
  }

  return {
    variant: '01',
    overlayKey: 'shipStores',
    form01: buildForm01Data(data, withOverlay),
    documentOverlay: data.documentOverlay,
    withOverlay,
  };
}
