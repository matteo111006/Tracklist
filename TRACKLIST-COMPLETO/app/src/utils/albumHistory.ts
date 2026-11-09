import { uniqueId } from './uniqueId';
import type { Album, AlbumRevision, AlbumRevisionState } from '../types';

export function revisionState(album: Album): AlbumRevisionState {
  const { title, artistId, artistName, artistIds, artists, label, genres, editionType, tracks, review, evaluationStatus, releaseDate, releaseDateFormatted, year, parentAlbumId } = album;
  return structuredClone({ title, artistId, artistName, artistIds, artists, label, genres, editionType, tracks, review, evaluationStatus, releaseDate, releaseDateFormatted, year, parentAlbumId });
}

export function appendRevision(previous: Album | undefined, next: Album, kind?: AlbumRevision['kind'], label?: string, date = new Date().toISOString()): Album {
  if (next.deleted || !previous) return next;
  const before = revisionState(previous), after = revisionState(next);
  const changed = JSON.stringify(before) !== JSON.stringify(after);
  if (!changed && kind !== 'relisten') return { ...next, history: previous.history };
  const ratingsChanged = JSON.stringify(before.tracks.map(t => [t.id, t.rating])) !== JSON.stringify(after.tracks.map(t => [t.id, t.rating]));
  const entry = (state: AlbumRevisionState, entryKind: AlbumRevision['kind'], text: string): AlbumRevision => ({ id: uniqueId(), date, kind: entryKind, label: text, state });
  const history = [...(previous.history || [])];
  if (!history.length) history.push(entry(before, 'baseline', 'Stato iniziale registrato (data dei vecchi voti sconosciuta)'));
  history.push(entry(after, kind || (ratingsChanged ? 'rating' : 'edit'), label || (ratingsChanged ? 'Valutazione aggiornata' : 'Scheda aggiornata')));
  // A bounded journal prevents repeated slider updates from exhausting browser storage.
  return { ...next, history: history.slice(-100) };
}
