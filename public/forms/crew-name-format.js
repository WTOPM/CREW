/**
 * Crew name formatting for HTML crew-list forms — "FAMILY NAME, Given Names".
 */
(function (global) {
  function formatCrewListName(member, options) {
    const upper = Boolean(options && options.upper);
    let family = (member.familyName || '').trim();
    let given = (member.givenNames || '').trim();
    if (upper) {
      family = family.toUpperCase();
      given = given.toUpperCase();
    }
    if (family && given) return `${family}, ${given}`;
    if (family) return family;
    if (given) return given;
    return '';
  }

  global.CrewNameFormat = { formatCrewListName };
})(typeof window !== 'undefined' ? window : globalThis);
