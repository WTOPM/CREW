import { crewListForm05EditorUrl, CREW_LIST_FORM_05_BASE_PATH } from './crew-list-form-05.paths';

describe('crewListForm05EditorUrl', () => {
  it('returns base path when no params', () => {
    expect(crewListForm05EditorUrl()).toBe(CREW_LIST_FORM_05_BASE_PATH);
  });

  it('builds editor URL with mode and return', () => {
    const url = crewListForm05EditorUrl({
      mode: 'arrival',
      return: encodeURIComponent('/?crewListSettings=1'),
    });
    expect(url).toContain('/forms/crew-list-form-05/');
    expect(url).toContain('mode=arrival');
    expect(url).toContain('return');
  });

  it('builds PDF capture URL with data snapshot', () => {
    const url = crewListForm05EditorUrl({
      mode: 'departure',
      pdfExport: '1',
      data: '{"ship":{}}',
    });
    expect(url).toContain('pdfExport=1');
    expect(url).toContain('data=');
  });
});
