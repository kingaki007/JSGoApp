/** Centralizes installer destinations; unpublished builds stay unavailable instead of linking to missing files. */
export interface DesktopDownload {
  platform: string;
  symbol: string;
  description: string;
  url: string | null;
}

export const desktopDownloads: readonly DesktopDownload[] = [
  { platform: 'Windows', symbol: '⊞', description: 'A space on your desktop.', url: null },
  { platform: 'macOS', symbol: '⌘', description: 'Ready for your next idea.', url: null },
  { platform: 'Linux', symbol: '◇', description: 'A little room to experiment.', url: null },
];
