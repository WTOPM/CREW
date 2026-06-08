/** Crew List v2 — template PDF (fill coordinates TBD). */

export const CREW_LIST_V2_TEMPLATE_URL = '/crew-list-v2-empty.pdf';

/** Bump when public/crew-list-v2-empty.pdf changes. */
export const CREW_LIST_V2_TEMPLATE_VERSION = 1;

/** Portrait A4 (pt) — matches Crew List v2 — empty.pdf. */
export const CREW_LIST_V2_PAGE = { w: 595.22, h: 842 } as const;

/** Max crew rows per page (placeholder until fill layout is mapped). */
export const CREW_LIST_V2_MAX_ROWS = 13;
