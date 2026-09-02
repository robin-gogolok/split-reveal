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

  test('takes a written step as is, so the stagger keeps its density as the copy grows', () => {
    // The point of the option: `(end - start) / step` characters are in flight
    // whatever the length, where a derived step puts the whole paragraph in
    // flight at once and the wave stops reading as a wave.
    const short = splitText('abcdef', { step: 0.25 });
    const long = splitText('abcdef '.repeat(30), { step: 0.25 });
    assert.equal(short.step, 0.25);
    assert.equal(long.step, 0.25);
    assert.ok(long.count > 150);
    assert.match(short.attributes.style, /--split-step:0\.25%/);
  });

  test('refuses spread and step at once', () => {
    // Both describe the same stagger. Honouring one silently is the bug that
    // reads as "my spread does nothing".
    assert.throws(() => splitText('abc', { spread: 20, step: 0.25 }), RangeError);
  });

  test('treats a null step as no step, so a wrapper can pass the prop unset', () => {
    const result = splitText('abcdef', { spread: 20, step: null });
    assert.equal(result.step, 4);
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
    const result = splitText('abc', {
      mode: undefined,
      start: undefined,
      spread: undefined,
      step: undefined,
    });
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
