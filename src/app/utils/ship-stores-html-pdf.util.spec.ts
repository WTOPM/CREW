import { describe, expect, it } from 'vitest';
import { createEmptyAppData } from '../data/empty-app-data';
import { buildShipStoresHtmlPdfSnapshot } from './ship-stores-html-pdf.util';

describe('buildShipStoresHtmlPdfSnapshot', () => {
  it('builds form 01 HTML structure with arrival and formatted articles', () => {
    const data = createEmptyAppData();
    data.ship.name = 'Test Ship';
    data.ship.portOfCall = 'Rotterdam';
    data.ship.dateOfArrival = '2026-06-01';
    data.ship.dateOfDeparture = '2026-06-03';
    data.shipStoresForm.placeOfStorage = 'Provision Room';
    data.shipStoresForm.rows[1] = { name: 'Cigarettes', quantity: '0', unit: 'Pcs' };

    const snap = buildShipStoresHtmlPdfSnapshot(data, true, '01');

    expect(snap.variant).toBe('01');
    expect(snap.overlayKey).toBe('shipStores');
    expect(snap.form01).toBeDefined();
    expect(snap.form01?.arrival).toBe(true);
    expect(snap.form01?.departure).toBe(false);
    expect(snap.form01?.nameOfShip).toBe('TEST SHIP');
    expect(snap.form01?.placeOfStorage).toBe('Provision Room');
    expect(snap.form01?.periodOfStay).toBe('2 days');
    expect(snap.form01?.articles[1]).toEqual({
      nameOfArticle: 'Cigarettes',
      quantity: 'NIL',
      unit: 'Pcs',
    });
    expect(snap.form01?.articles).toHaveLength(27);
  });

  it('builds form 02 with departure mode when overlay marks departure', () => {
    const data = createEmptyAppData();
    data.ship.name = 'Long Ship';
    data.ship.imoNo = '1234567';
    data.shipStoresForm02.placeOfStorage = 'Store';
    data.documentOverlay.shipStores02.cellValues = { _ssMode: 'departure' };

    const snap = buildShipStoresHtmlPdfSnapshot(data, true, '02');

    expect(snap.variant).toBe('02');
    expect(snap.overlayKey).toBe('shipStores02');
    expect(snap.form02).toBeDefined();
    expect(snap.form02?.arrival).toBe(false);
    expect(snap.form02?.departure).toBe(true);
    expect(snap.form02?.imoNumber).toBe('1234567');
    expect(snap.form02?.placeOfStorage).toBe('Store');
    expect(snap.withOverlay).toBe(true);
  });

  it('ignores stale overlay article/header cells for form 01', () => {
    const data = createEmptyAppData();
    data.ship.name = 'Live Ship';
    data.ship.portOfCall = 'Hamburg';
    data.shipStoresForm.placeOfStorage = 'Live Store';
    data.shipStoresForm.rows[0] = { name: 'Live Tea', quantity: '2', unit: 'kg' };
    data.documentOverlay.shipStores.cellValues = {
      'd-0-0': 'Frozen Tea',
      'd-0-1': '99',
      'h-nameOfShip': 'FROZEN SHIP',
      'h-port': 'FROZEN PORT',
      'h-storage': 'Frozen Store',
      '_ssMode': 'arrival',
      'h-pageNo': '3',
    };

    const snap = buildShipStoresHtmlPdfSnapshot(data, true, '01');
    expect(snap.form01?.nameOfShip).toBe('LIVE SHIP');
    expect(snap.form01?.portOfArrivalDeparture).toContain('HAMBURG');
    expect(snap.form01?.placeOfStorage).toBe('Live Store');
    expect(snap.form01?.articles[0]).toEqual({
      nameOfArticle: 'Live Tea',
      quantity: '2',
      unit: 'kg',
    });
    expect(snap.form01?.pageNo).toBe('3');
  });
});
