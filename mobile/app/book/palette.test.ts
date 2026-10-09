import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paletteOf } from './palette.ts';
import { color } from './tokens.ts';

// Breaks: a phase shows the wrong palette, an unknown or inherited name ('constructor') or a world
// without a calendar shows anything but light (docs/system/book-ui.md#world-and-status-entry).
test('the solar phase name picks the palette', () => {
  for (const [solar, bg] of [
    ['day', '#ebe6d7'],
    ['dawn', '#d5d9da'],
    ['dusk', '#2b1e16'],
    ['night', '#0c0b09'],
    ['twilight', '#ebe6d7'],
    ['constructor', '#ebe6d7'],
    [undefined, '#ebe6d7'],
  ] as const)
    assert.equal(paletteOf(solar).bg, bg, String(solar));
});

// WCAG 2 contrast ratio of two #rrggbb colours.
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

// Breaks: a palette value that leaves a text role under 4.5:1 on its paper or card
// (docs/BOOK-UI-COMPONENTS.md#design-tokens).
test('every text role is at least 4.5:1 on bg and card in every palette', () => {
  assert.equal(contrast('#000000', '#ffffff').toFixed(0), '21');
  for (const [name, p] of Object.entries(color))
    for (const role of ['fg', 'dim', 'action', 'danger', 'warning'] as const)
      for (const paper of ['bg', 'card'] as const)
        assert.ok(contrast(p[role], p[paper]) >= 4.5, `${name}.${role} on ${paper}`);
});
