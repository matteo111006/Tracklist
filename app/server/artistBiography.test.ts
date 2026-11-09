import test from 'node:test';
import assert from 'node:assert/strict';
import { findArtistBiography, matchesMusicalArtist } from './artistBiography.ts';

test('artist biography rejects places, mythology and disambiguation even with musical keywords', () => {
  for (const extract of ['Aira è una città del Giappone. Ospita un festival rap con un rapper.', 'Shiva è una divinità induista. Un cantante usa questo nome.', 'Aira può riferirsi a: un rapper, una città.']) {
    assert.equal(matchesMusicalArtist('Aira', { title: 'Aira', extract }), false);
  }
});

test('musical identity requires matching artist and archive discography', () => {
  const summary = { title: 'Aira (rapper)', extract: 'Aira è un rapper. Ha pubblicato il progetto CRASH OUT.' };
  assert.equal(matchesMusicalArtist('Aira', summary, ['CRASH OUT']), true);
  assert.equal(matchesMusicalArtist('Aira', summary, ['Un altro album']), false);
  assert.equal(matchesMusicalArtist('Altro', summary, ['CRASH OUT']), false);
  assert.equal(matchesMusicalArtist('Aira', { title: 'Aira', extract: 'Aira è una cantante. Pubblica un disco diverso.' }, ['CRASH OUT']), false);
});

test('lookup skips geographical first match and returns verified musician, otherwise no biography', async () => {
  const mock = async (url: string | URL) => {
    if (String(url).includes('opensearch')) return Response.json(['Aira', ['Aira', 'Aira (rapper)']]);
    const musical = decodeURIComponent(String(url)).includes('(rapper)');
    return Response.json(musical
      ? { title: 'Aira (rapper)', extract: 'Aira è un rapper. Pubblica CRASH OUT.' }
      : { title: 'Aira', extract: 'Aira è una città del Giappone.' });
  };
  const found = await findArtistBiography('Aira', ['CRASH OUT'], mock);
  assert.equal(found.source, 'wikipedia_it');
  assert.match(found.bio, /rapper/);
  const unknown = await findArtistBiography('Aira', ['Album non corrispondente'], mock);
  assert.equal(unknown.bio, '');
  assert.equal(unknown.source, 'none');
});
