import type {
  OutputFolderPrefs,
  OutputFolderSection,
  OutputSettings,
} from '../models/crew.models';
import { createDefaultOutputFolderPrefs, OUTPUT_FOLDER_SECTIONS } from '../models/crew.models';

/** Resolve which save-folder bucket applies for the current route, or null on ETA/Settings. */
export function outputFolderSectionFromRoute(urlPath: string): OutputFolderSection | null {
  const path = urlPath.split('?')[0].split('#')[0];
  if (path === '/eta' || path.startsWith('/eta/')) return null;
  if (path === '/fuel' || path.startsWith('/fuel/')) return null;
  if (path === '/settings' || path.startsWith('/settings/')) return null;
  if (path === '/dg' || path.startsWith('/dg/')) return 'dg';
  if (path === '/reefer' || path.startsWith('/reefer/')) return 'reefer';
  // Home, crew-arr, and any other document route share the Home bucket.
  return 'home';
}

export function getOutputFolderPrefs(
  settings: OutputSettings,
  section: OutputFolderSection,
): OutputFolderPrefs {
  return settings.bySection?.[section] ?? createDefaultOutputFolderPrefs();
}

export function emptyOutputFolderBySection(): Record<OutputFolderSection, OutputFolderPrefs> {
  return {
    home: createDefaultOutputFolderPrefs(),
    dg: createDefaultOutputFolderPrefs(),
    reefer: createDefaultOutputFolderPrefs(),
  };
}

export function isOutputFolderSection(value: string): value is OutputFolderSection {
  return (OUTPUT_FOLDER_SECTIONS as string[]).includes(value);
}
