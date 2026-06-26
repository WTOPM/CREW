import { normalizeCrewListDocumentPrefs } from './document-overlay.models';
import { normalizeAppData } from '../services/app-data-normalizer';

describe('normalizeCrewListDocumentPrefs', () => {
  it('preserves Form 05 stamp/signature toggles and CSS overlay boxes', () => {
    const normalized = normalizeCrewListDocumentPrefs({
      listType: 'type4V3Sbk',
      byType: {
        type4V3Sbk: {
          useStamp: true,
          useSignature: false,
          stampBox: {
            left: '120px',
            top: '80px',
            width: '38mm',
            height: '38mm',
          },
          signatureBox: {
            left: '10px',
            top: '20px',
            width: '50mm',
            height: '20mm',
          },
          cellStyles: { '0-1': { fontSize: '8pt' } },
        },
      },
    });

    const variant = normalized.byType.type4V3Sbk!;
    expect(variant.useStamp).toBe(true);
    expect(variant.useSignature).toBe(false);
    expect(variant.stampBox).toEqual({
      left: '120px',
      top: '80px',
      width: '38mm',
      height: '38mm',
    });
    expect(variant.signatureBox).toEqual({
      left: '10px',
      top: '20px',
      width: '50mm',
      height: '20mm',
    });
    expect(variant.cellStyles).toEqual({ '0-1': { fontSize: '8pt' } });
  });
});

describe('normalizeAppData Form 05 overlay', () => {
  it('round-trips Form 05 overlay settings through full normalization', () => {
    const data = normalizeAppData({
      documentOverlay: {
        crewList: {
          listType: 'type4V3Sbk',
          byType: {
            type4V3Sbk: {
              useStamp: false,
              useSignature: true,
              stampBox: {
                left: 'calc(100% - 50mm)',
                top: 'calc(100% - 50mm)',
                width: '38mm',
                height: '38mm',
              },
              signatureBox: {
                left: 'calc(100% - 60mm)',
                top: 'calc(100% - 28mm)',
                width: '50mm',
                height: '20mm',
              },
            },
          },
        },
      },
    } as never);

    const variant = data.documentOverlay.crewList.byType.type4V3Sbk!;
    expect(variant.useStamp).toBe(false);
    expect(variant.useSignature).toBe(true);
    expect(variant.stampBox).toEqual({
      left: 'calc(100% - 50mm)',
      top: 'calc(100% - 50mm)',
      width: '38mm',
      height: '38mm',
    });
    expect(variant.signatureBox).toEqual({
      left: 'calc(100% - 60mm)',
      top: 'calc(100% - 28mm)',
      width: '50mm',
      height: '20mm',
    });
  });
});
