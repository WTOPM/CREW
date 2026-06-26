import { crewListForm06EditorUrl, CREW_LIST_FORM_06_BASE_PATH } from './crew-list-form-06.paths';

describe('crewListForm06EditorUrl', () => {
  it('returns base path when no params', () => {
    expect(crewListForm06EditorUrl()).toBe(CREW_LIST_FORM_06_BASE_PATH);
  });

  it('builds editor URL with mode and return', () => {
    const url = crewListForm06EditorUrl({
      mode: 'arrival',
      return: encodeURIComponent('/?crewListSettings=1'),
    });
    expect(url).toContain('/forms/crew-list-form-06/');
    expect(url).toContain('mode=arrival');
    expect(url).toContain('return');
  });

  it('builds PDF capture URL with data snapshot', () => {
    const url = crewListForm06EditorUrl({
      mode: 'departure',
      pdfExport: '1',
      data: '{"ship":{}}',
    });
    expect(url).toContain('pdfExport=1');
    expect(url).toContain('data=');
  });
});
