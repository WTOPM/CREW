import { crewListForm04EditorUrl, CREW_LIST_FORM_04_BASE_PATH } from './crew-list-form-04.paths';

describe('crewListForm04EditorUrl', () => {
  it('returns base path without params', () => {
    expect(crewListForm04EditorUrl()).toBe(CREW_LIST_FORM_04_BASE_PATH);
  });

  it('appends query params', () => {
    const url = crewListForm04EditorUrl({
      mode: 'arrival',
      return: '/?crewListSettings=1',
      pdfExport: '1',
    });
    expect(url).toContain(CREW_LIST_FORM_04_BASE_PATH);
    expect(url).toContain('mode=arrival');
    expect(url).toContain('pdfExport=1');
  });
});
