import { formatDisplayDate } from './date.util';

/** Safe token for PDF file names (ship name, port, etc.). */
export function pdfFileToken(value: string | undefined | null, fallback = 'unknown'): string {
  const v = (value ?? '').trim();
  if (!v) return fallback;
  return (
    v
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || fallback
  );
}

/** Date for file names: DD-MM-YYYY from ISO or display string. */
export function pdfFileDate(value: string | undefined | null): string {
  const display = formatDisplayDate(value);
  if (!display) return 'undated';
  return display.replace(/\./g, '-');
}

export function crewListPdfFileName(
  shipName: string,
  portOfCall: string,
  voyageDate: string,
  isArrival: boolean,
): string {
  const kind = isArrival ? 'Arrival' : 'Departure';
  return `Crew_List_${kind}_${pdfFileToken(shipName, 'ship')}_${pdfFileToken(portOfCall, 'port')}_${pdfFileDate(voyageDate)}.pdf`;
}

export function crewListIdentityPdfFileName(
  shipName: string,
  portOfCall: string,
  voyageDate: string,
  isArrival: boolean,
  identityDocumentType: string,
): string {
  const kind = isArrival ? 'Arrival' : 'Departure';
  const doc = identityDocumentType.toLowerCase().includes('seaman') ? 'Seamans_Book' : 'Passport';
  return `Crew_List_${doc}_${kind}_${pdfFileToken(shipName, 'ship')}_${pdfFileToken(portOfCall, 'port')}_${pdfFileDate(voyageDate)}.pdf`;
}

export function portOfCallPdfFileName(shipName: string, voyageDate: string): string {
  return `Port_of_Call_${pdfFileToken(shipName, 'ship')}_${pdfFileDate(voyageDate)}.pdf`;
}

export function passengerListPdfFileName(
  shipName: string,
  portOfCall: string,
  voyageDate: string,
  isArrival: boolean,
): string {
  const kind = isArrival ? 'Arrival' : 'Departure';
  return `Passenger_List_${kind}_${pdfFileToken(shipName, 'ship')}_${pdfFileToken(portOfCall, 'port')}_${pdfFileDate(voyageDate)}.pdf`;
}
