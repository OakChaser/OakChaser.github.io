import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatUptime } from './fastfetch';

test('formatUptime: seconds only', () => {
  assert.equal(formatUptime(0), '0 secs');
  assert.equal(formatUptime(1000), '1 sec');
  assert.equal(formatUptime(42_000), '42 secs');
});

test('formatUptime: mins and secs', () => {
  assert.equal(formatUptime(90_000), '1 min, 30 secs');
  assert.equal(formatUptime(65_000), '1 min, 5 secs');
});

test('formatUptime: hours, days', () => {
  assert.equal(formatUptime(3_661_000), '1 hour, 1 min, 1 sec');
  assert.equal(formatUptime(86_400_000), '1 day');
  assert.equal(formatUptime(90_061_000), '1 day, 1 hour, 1 min, 1 sec');
});
