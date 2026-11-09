import test from 'node:test';
import assert from 'node:assert/strict';
import type { Album } from '../types';
import { preferredSearchGenre, rankMusicResults } from './searchRelevance';
const archive = [{ title: 'Noi, loro, gli altri', artistName: 'Marracash', genres: 'Rap Italiano' }] as Album[];
const album = (artistName: string, title = 'Persona', genres = 'Musica') => ({ artistName, title, genres });

test('Persona by a known archive artist outranks unfamiliar namesakes without hiding new music', () => {
  const results = rankMusicResults('Persona', [album('Unrelated'), album('Marracash', 'Persona', 'Hip-Hop/Rap'), album('Nuovo rapper', 'Persona', 'Rap')], archive);
  assert.equal(results[0].artistName, 'Marracash');
  assert.equal(results[1].artistName, 'Nuovo rapper');
  assert.equal(results.length, 3);
});
test('same-title albums by different artists survive deduplication and partial-word noise is excluded', () => {
  const results = rankMusicResults('Persona', [album('Marracash'), album('Other'), album('Marracash'), album('Other', 'Personaggio')]);
  assert.equal(results.length, 2);
});
test('explicit artist queries remain authoritative and genre comes from archive rather than a rap default', () => {
  assert.equal(rankMusicResults('Persona Other', [album('Marracash'), album('Other')], archive)[0].artistName, 'Other');
  assert.equal(preferredSearchGenre(archive), 'rap');
  assert.equal(preferredSearchGenre([{ genres: 'Rock' }] as Album[]), 'rock');
  assert.equal(preferredSearchGenre([]), '');
});
