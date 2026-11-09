import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanRecordLabel } from './labelCleaner';

test('cleanRecordLabel cleans Sony Music legal boilerplate with Epic release', () => {
  const raw = 'an epic release (P) 2026 Sony Music Entertainment Italy S.p.A.';
  assert.equal(cleanRecordLabel(raw), 'Sony Music');
});

test('cleanRecordLabel cleans Universal Music with copyright symbol and Srl', () => {
  const raw = '℗ 2024 Universal Music Italia Srl';
  assert.equal(cleanRecordLabel(raw), 'Universal Music');
});

test('cleanRecordLabel cleans Warner Music with company suffix', () => {
  const raw = '(P) 2022 Warner Music Italy a Warner Music Group company';
  assert.equal(cleanRecordLabel(raw), 'Warner Music');
});

test('cleanRecordLabel cleans independent company and corporate suffixes', () => {
  const raw = '© 2023 DND ENTERTAINMENT SRL';
  assert.equal(cleanRecordLabel(raw), 'DND');
});

test('cleanRecordLabel handles empty or null', () => {
  assert.equal(cleanRecordLabel(''), 'Indipendente');
  assert.equal(cleanRecordLabel(null), 'Indipendente');
  assert.equal(cleanRecordLabel(undefined), 'Indipendente');
});

test('cleanRecordLabel preserves well-known Italian labels', () => {
  assert.equal(cleanRecordLabel('Milano Ovest'), 'Milano Ovest');
  assert.equal(cleanRecordLabel('Sto Records'), 'Sto Records');
  assert.equal(cleanRecordLabel('Thaurus'), 'Thaurus');
  assert.equal(cleanRecordLabel('Bomba Dischi'), 'Bomba Dischi');
  assert.equal(cleanRecordLabel('Maciste Dischi'), 'Maciste Dischi');
});

test('cleanRecordLabel cleans standalone imprint or unknown label', () => {
  assert.equal(cleanRecordLabel('Columbia'), 'Columbia');
  assert.equal(cleanRecordLabel('Epic'), 'Epic');
  assert.equal(cleanRecordLabel('Bullz Records'), 'Bullz Records');
});
