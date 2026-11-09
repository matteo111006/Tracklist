import type { Album, Artist, UserProfile } from '../types';
export const initialUserProfile: UserProfile = { id: 'user-default', name: 'Il tuo profilo', email: '', avatarUrl: '' };
// New accounts start empty. Historical seed records are available only to
// their existing owner via an authenticated server migration endpoint.
export const initialArtists: Artist[] = [];
export const initialAlbums: Album[] = [];
export const legacyArtists: Artist[] = [];
export const legacyAlbums: Album[] = [];
export function setLegacyCatalog(data: { albums?: Album[]; artists?: Artist[] }) {
  legacyAlbums.splice(0, legacyAlbums.length, ...(data.albums || []));
  legacyArtists.splice(0, legacyArtists.length, ...(data.artists || []));
}
