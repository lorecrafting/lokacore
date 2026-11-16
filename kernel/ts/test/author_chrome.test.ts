// The editor chrome's two checks (docs/design/editor-chrome-rulings.md): every text role reads on
// every ground in both schemes, and no panel code holds a raw colour, so tokens.ts stays the one
// source. Each check runs first on a planted violation (its red control).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { chrome } from '../../../mobile/app/book/tokens.ts';

// WCAG 2.x relative luminance and contrast ratio, exactly (two lowest pairs sit at 3.00).
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
type Palette = typeof chrome.light;
const TEXT = ['fg', 'dim', 'accent', 'outside', 'refusal', 'warning', 'ok'] as const;
/** Every pair below the ruling's floor, as `scheme role/ground ratio`. */
function short(scheme: string, p: Palette, area: string[]) {
  const pairs: [string, string, number][] = [
    ...TEXT.flatMap((t) =>
      (['bg', 'surface', 'sunken'] as const).map((g) => [t, g, 4.5] as [string, string, number]),
    ),
    ['strong', 'bg', 3],
    ['strong', 'surface', 3],
  ];
  const colours: Record<string, string> = {
    ...p,
    ...Object.fromEntries(area.map((c, i) => [`area${i}`, c])),
  };
  pairs.push(...area.map((_, i) => [`area${i}`, 'bg', 3] as [string, string, number]));
  return pairs
    .filter(([fg, bg, floor]) => ratio(colours[fg], colours[bg]) < floor)
    .map(([fg, bg]) => `${scheme} ${fg}/${bg} ${ratio(colours[fg], colours[bg]).toFixed(2)}`);
}

// Breaks: a token edit leaves a role below 4.5:1 (text) or 3:1 (control borders, map hulls) on a
// ground it is drawn on, in either scheme.
test('every chrome text role reads on every ground in light and dark', () => {
  const planted = short('red', { ...chrome.light, dim: '#8a877f' }, ['#f0f0f0']);
  assert.deepEqual(
    planted.map((row) => row.split(' ').slice(0, 2).join(' ')),
    ['red dim/bg', 'red dim/surface', 'red dim/sunken', 'red area0/bg'],
  );
  assert.deepEqual(short('light', chrome.light, chrome.area.light), []);
  assert.deepEqual(short('dark', chrome.dark, chrome.area.dark), []);
});

const PANEL = join(import.meta.dirname, '../../../tools/author-panel/src');
const HEX = /#[0-9a-f]{3,8}\b/gi;
/** Each raw hex colour in panel code, as `file: #hex`. */
const rawHex = (files: [string, string][]) =>
  files.flatMap(([f, text]) => (text.match(HEX) ?? []).map((h) => `${f}: ${h}`));

// Breaks: a component or stylesheet in the panel writes a colour by hand, so it misses the dark
// scheme and drifts from tokens.ts.
test('no panel code holds a raw hex colour', () => {
  assert.deepEqual(rawHex([['planted.tsx', "<b style={{ color: '#c00' }} />"]]), [
    'planted.tsx: #c00',
  ]);
  const files = readdirSync(PANEL, { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.(tsx?|css)$/.test(f))
    .map((f) => [f, readFileSync(join(PANEL, f), 'utf8')] as [string, string]);
  assert.ok(files.length > 10, `read the panel's files (${files.length})`);
  assert.deepEqual(rawHex(files), []);
});
