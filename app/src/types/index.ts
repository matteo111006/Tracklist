export type EditionType = 'standard' | 'deluxe' | 'remaster' | 'modified';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  savedViews?: SavedLibraryView[];
  aiConversations?: import('./ai').AiConversation[];
  experiences?: {
    duels?: Record<string, { albumIds: string[]; chosenId: string; scores: (number | null)[] }>;
    discovery?: Record<string, 'known' | 'interested' | 'dismissed'>;
  };
}

export interface LibraryFilters {
  search: string;
  artist: string;
  edition: string;
  sort: 'voto' | 'anno' | 'titolo' | 'artista';
  year: number | 'all';
  status: 'confirmed' | 'all' | 'incomplete' | 'favorites';
}
export interface SavedLibraryView { id: string; name: string; filters: LibraryFilters; createdAt: string; }

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface ArtistRef {
  id: string;
  name: string;
  spotifyId?: string;
}

export interface Artist {
  id: string;
  name: string;
  bio: string;
  imageUrl: string;
  spotifyId?: string;
  genres?: string[];
  monthlyListeners?: number;
  isManualBio?: boolean;
  isManualImage?: boolean;
}

export interface Track {
  id: string;
  albumId: string;
  trackNumber: number;
  title: string;
  artists: string; // e.g. "Shiva, ANNA"
  artistRefs?: ArtistRef[];
  rating: number | null; // null if unrated, 0.00 to 10.00 with 0.25 increment
  durationMs?: number;
  previewUrl?: string | null;
  spotifyUri?: string;
}

export interface AlbumReview {
  id: string;
  albumId: string;
  text: string;
  ratingPersonal?: number;
  date: string;
  listenedAt?: string;
  favoriteTracks?: string[];
  isRelisten?: boolean;
}

export interface Album {
  id: string;
  title: string;
  artistId: string; // Primary artist id for backward compatibility
  artistName: string; // Display string, e.g. "Salmo, Noyz Narcos"
  artistIds?: string[]; // IDs of each main artist (many-to-many relationship)
  artists?: ArtistRef[]; // Structured list of main artists
  releaseDate: string; // YYYY-MM-DD
  releaseDateFormatted: string; // e.g. "10 APR 2026"
  year: number;
  coverUrl: string;
  label: string;
  genres: string;
  duration: string;
  editionType: EditionType;
  spotifyUrl?: string;
  spotifyId?: string;
  tracks: Track[];
  review?: AlbumReview;
  listeningCount?: number;
  parentAlbumId?: string; // Standard edition ID if this is a deluxe/repack
  evaluationStatus?: 'draft' | 'completed' | 'unrated';
  isManualTracklist?: boolean;
  deleted?: boolean;
  history?: AlbumRevision[];
}

export type AlbumRevisionState = Pick<Album, 'title' | 'artistId' | 'artistName' | 'artistIds' | 'artists' | 'label' | 'genres' | 'editionType' | 'tracks' | 'review' | 'evaluationStatus' | 'releaseDate' | 'releaseDateFormatted' | 'year' | 'parentAlbumId'>;
export interface AlbumRevision {
  id: string;
  date: string;
  kind: 'baseline' | 'rating' | 'edit' | 'relisten' | 'restore';
  label: string;
  state: AlbumRevisionState;
}

export interface CustomCollection {
  id: string;
  name: string;
  description: string;
  albumIds: string[];
  isPublic: boolean;
  createdAt: string;
  dreamTracklist?: { theme: string; tracks: { albumId: string; trackId: string }[] };
}

export interface AlbumRatingStats {
  averageRating: number | null;
  ratedCount: number;
  totalTracks: number;
  isFullyRated: boolean;
  topTracks: Track[];
  distribution: {
    '0-4': number;
    '4-6': number;
    '6-8': number;
    '8-10': number;
  };
}

export interface DiscographyItem {
  id: string;
  spotifyId?: string;
  title: string;
  artistName: string;
  releaseDate: string;
  year: number;
  coverUrl: string;
  type: 'album' | 'ep';
  tracksCount?: number;
  spotifyUrl?: string;
  label?: string;
  isCustom?: boolean;
}

export interface ArtistTimelineOverrides {
  hiddenIds: string[];
  customAlbums: DiscographyItem[];
  editedAlbums: Record<string, Partial<DiscographyItem>>;
}
