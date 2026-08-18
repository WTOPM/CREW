import { crewListForm03EditorUrl, CREW_LIST_FORM_03_BASE_PATH } from './crew-list-form-03.paths';

describe('crewListForm03EditorUrl', () => {
  it('returns base path when no params', () => {
    expect(crewListForm03EditorUrl()).toBe(CREW_LIST_FORM_03_BASE_PATH);
  });

  it('builds query string for editor params', () => {
    const url = crewListForm03EditorUrl({
      mode: 'arrival',
      return: encodeURIComponent('/?crewListSettings=1'),
      pdfExport: '1',
    });
    expect(url).toContain(CREW_LIST_FORM_03_BASE_PATH);
    expect(url).toContain('mode=arrival');
    expect(url).toContain('pdfExport=1');
    expect(url).toContain('return=');
  });
});
