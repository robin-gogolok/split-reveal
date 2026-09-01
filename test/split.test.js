import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { splitText, defaults } from '../src/split.js';

describe('splitText', () => {
  test('counts characters, not words or bytes', () => {
    assert.equal(splitText('ab cd').count, 4);
  });

  test('derives the step so the last character always lands spread points after the first', () => {
    const result = splitText('abcdef', { spread: 20 });
    assert.equal(result.count, 6);
    assert.equal(result.step, 4); // 20 / (6 - 1)
    assert.equal(result.end + result.step * (result.count - 1), result.end + 20);
  });

  test('does not divide by zero on a single character', () => {
    const result = splitText('a');
    assert.ok(Number.isFinite(result.step));
    assert.equal(result.step, defaults.spread);
  });

  test('keeps whitespace as its own token so wrapping is unchanged', () => {
    const { tokens } = splitText('one two  three');
    assert.deepEqual(
      tokens.map((t) => t.type),
      ['word', 'space', 'word', 'space', 'word'],
    );
    // Runs of whitespace collapse to the single space HTML would render anyway.
    assert.equal(tokens[3].value, ' ');
  });

  test('treats grapheme clusters as one character', () => {
    // Flag emoji is two regional indicators; "é" here is e + combining acute.
    assert.equal(splitText('🇩🇪').count, 1);
    assert.equal(splitText('é').count, 1);
    assert.equal(splitText('café').count, 4);
  });

  test('escapes markup in the copy', () => {
    const html = splitText('<b>&').toHTML();
    assert.ok(html.includes('&lt;'));
    assert.ok(html.includes('&amp;'));
    assert.ok(!html.includes('<b>'));
  });

  test('escapes attribute values passed to toElement', () => {
    const html = splitText('x').toElement('h2', { class: 'a" onload="alert(1)' });
    assert.ok(!html.includes('onload="alert(1)"'));
    assert.ok(html.includes('&quot;'));
  });

  test('merges a caller style in front of the generated custom properties', () => {
    const html = splitText('x').toElement('p', { style: 'color:red' });
    assert.match(html, /style="color:red;--split-start:/);
  });

  test('leaves no text node between the hidden copy and the split copy', () => {
    // A space there would render as a leading indent before the first glyph.
    assert.ok(splitText('x').toHTML().includes('</span><span aria-hidden="true">'));
  });

  test('carries the mode on the element', () => {
    assert.equal(splitText('x', { mode: 'fade' }).attributes['data-split-reveal'], 'fade');
    assert.equal(splitText('x').attributes['data-split-reveal'], 'rise');
  });

  test('treats an explicit undefined option as absent', () => {
    // Framework wrappers pass every prop through, set or not.
    const result = splitText('abc', { mode: undefined, start: undefined, spread: undefined });
    assert.equal(result.mode, defaults.mode);
    assert.equal(result.start, defaults.start);
    assert.ok(Number.isFinite(result.step));
    assert.ok(!result.attributes.style.includes('undefined'));
    assert.ok(!result.attributes.style.includes('NaN'));
  });

  test('rejects unusable input instead of rendering something broken', () => {
    assert.throws(() => splitText(42), TypeError);
    assert.throws(() => splitText('x', { mode: 'slide' }), RangeError);
  });
});
