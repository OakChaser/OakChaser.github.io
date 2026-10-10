import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './store';

test('store: lists all compiled documents', () => {
  const slugs = createStore()
    .all()
    .map((d) => d.slug)
    .sort();
  assert.deepEqual(slugs, ['help', 'index', 'repos']);
});

test('store: title derived from h1', () => {
  const index = createStore().get('index');
  assert.ok(index);
  assert.equal(index.title, 'OakChaser');
  assert.equal(index.kind, 'page');
});

test('store: missing slug', () => {
  assert.equal(createStore().get('does-not-exist'), undefined);
});
