export interface DiscographyAnchor { title: string; year: number; spotifyId?: string }
const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function parseDiscographyAnchors(raw: string | null): DiscographyAnchor[] {
  try {
    const data = JSON.parse(raw || '[]');
    return Array.isArray(data) ? data.slice(0, 40).filter(a => a && typeof a.title === 'string' && a.title.length <= 200 && Number.isInteger(a.year) && a.year >= 1900 && a.year <= 2200 && (a.spotifyId === undefined || typeof a.spotifyId === 'string')) : [];
  } catch { return []; }
}
export function catalogMatchesArchive(items: DiscographyAnchor[], anchors: DiscographyAnchor[]): boolean {
  return items.some(item => anchors.some(anchor =>
    (anchor.spotifyId && item.spotifyId === anchor.spotifyId) ||
    (normalize(anchor.title).length >= 4 && normalize(item.title) === normalize(anchor.title) && item.year === anchor.year)
  ));
}
