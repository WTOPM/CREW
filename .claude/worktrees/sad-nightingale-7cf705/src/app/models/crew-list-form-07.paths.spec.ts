import { crewListForm07EditorUrl, CREW_LIST_FORM_07_BASE_PATH } from './crew-list-form-07.paths';

describe('crewListForm07EditorUrl', () => {
  it('returns base path when no params', () => {
    expect(crewListForm07EditorUrl()).toBe(CREW_LIST_FORM_07_BASE_PATH);
  });

  it('builds editor URL with mode and return', () => {
    const url = crewListForm07EditorUrl({
      mode: 'arrival',
      return: encodeURIComponent('/?crewListSettings=1'),
    });
    expect(url).toContain('/forms/crew-list-form-07/');
    expect(url).toContain('mode=arrival');
    expect(url).toContain('return');
  });

  it('builds PDF capture URL without inline snapshot payload', () => {
    const url = crewListForm07EditorUrl({
      mode: 'departure',
      pdfExport: '1',
    });
    expect(url).toContain('pdfExport=1');
    expect(url).not.toContain('data=');
  });
});
