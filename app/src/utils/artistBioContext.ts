import type { Album } from '../types';

export function artistBioUrl(name: string, albums: Album[]): string {
  const target = name.trim().toLocaleLowerCase();
  const titles = albums.filter(album =>
    album.artists?.some(artist => artist.name.trim().toLocaleLowerCase() === target) ||
    album.artistName.split(/[,;&]/).some(artist => artist.trim().toLocaleLowerCase() === target)
  ).map(album => album.title);
  const params = new URLSearchParams({ name });
  for (const title of [...new Set(titles)].slice(0, 5)) params.append('album', title);
  return `/api/artist/bio?${params}`;
}
