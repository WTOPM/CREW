/** Safe single path segment for authority folders / file stems. */
export function sanitizePathSegment(raw: string, fallback = 'Authority'): string {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();
  return cleaned || fallback;
}

/** Join base dir with a relative subfolder (Windows or POSIX). */
export function joinOutputDir(baseDir: string, subdir: string): string {
  const base = String(baseDir ?? '').replace(/[\\/]+$/, '');
  const sub = sanitizePathSegment(subdir);
  if (!base) return sub;
  const sep = base.includes('\\') && !base.includes('/') ? '\\' : '/';
  return `${base}${sep}${sub}`;
}

/**
 * Append copy count before `.pdf`, e.g. `Crew_List_….pdf` → `Crew_List_…_x2.pdf`.
 */
export function fileNameWithCopyCount(fileName: string, copies: number): string {
  const n = Math.max(1, Math.floor(Number(copies) || 1));
  const raw = String(fileName || 'document.pdf').trim() || 'document.pdf';
  const pdf = raw.toLowerCase().endsWith('.pdf') ? raw.slice(0, -4) : raw;
  return `${pdf}_x${n}.pdf`;
}
