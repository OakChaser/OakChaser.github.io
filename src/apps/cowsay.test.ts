import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cowSay } from './cowsay';

test('cowsay: single line uses < > corners and pads the border', () => {
  const out = cowSay('hi').split('\n');
  assert.equal(out[0], ' ____');
  assert.equal(out[1], '< hi >');
  assert.equal(out[2], ' ----');
});

test('cowsay: multi line uses / \\ and | | corners', () => {
  const out = cowSay('one\ntwo\nthree\nfour', { noWrap: true }).split('\n');
  assert.equal(out[0], ' _______');
  assert.equal(out[1], '/ one   \\');
  assert.equal(out[2], '| two   |');
  assert.equal(out[3], '| three |');
  assert.equal(out[4], '\\ four  /');
  assert.equal(out[5], ' -------');
});

test('cowsay: default cow and eyes/tongue substitution', () => {
  const out = cowSay('x', { eyes: '$$', tongue: 'U ' });
  assert.match(out, /\^__\^/);
  assert.match(out, /\(\$\$\)\\_______/);
  assert.match(out, /U  \|\|----w \|/);
  assert.match(out, /\|\|     \|\|/);
});

test('cowsay: greedy wrap to width 40', () => {
  const out = cowSay('a b c d e f g h i j k l m n o p q r s t u v w x y z').split('\n');
  assert.equal(out[1], '/ a b c d e f g h i j k l m n o p q r s t \\');
  assert.equal(out[2], '\\ u v w x y z                             /');
});

test('cowsay: hard-breaks over-long words', () => {
  const out = cowSay('a'.repeat(80)).split('\n');
  // 39 + 39 + 2 across three rendered rows
  assert.equal(out[1], '/ ' + 'a'.repeat(39) + ' \\');
  assert.equal(out[2], '| ' + 'a'.repeat(39) + ' |');
  assert.equal(out[3], '\\ ' + 'a'.repeat(2) + ' '.repeat(37) + ' /');
});
