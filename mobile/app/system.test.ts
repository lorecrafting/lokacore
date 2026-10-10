// The System pages' colours (stories/system/, docs/design/system-dashboard/spec.md §2): one hue per
// layer on each page, at least 3:1 on its paper, and no hex colour outside the palette file.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { contrast } from './book/palette.ts';
import { color } from './book/tokens.ts';
import { hue } from './stories/system/palette.ts';

const layers = ['Content', 'Capabilities', 'Change', 'State', 'Save', 'View'];

// Breaks: a re-picked hue that fades into the paper, or one hue used on both pages.
test('each layer hue stands 3:1 on the light and dark paper', () => {
  for (const l of layers) {
    for (const p of [color.light, color.dark])
      assert.ok(contrast(hue(l, p), p.bg) >= 3, `${l} on ${p.bg}: ${contrast(hue(l, p), p.bg)}`);
    assert.notEqual(hue(l, color.light), hue(l, color.dark), l);
  }
  assert.equal(new Set(layers.map((l) => hue(l, color.light))).size, layers.length);
});

// Breaks: a colour literal written into a System component instead of the palette or tokens.
test('no hex colour under stories/system/ outside palette.ts', () => {
  const dir = new URL('stories/system/', import.meta.url);
  const hex = readdirSync(dir)
    .filter((f) => f !== 'palette.ts')
    .flatMap((f) =>
      (readFileSync(new URL(f, dir), 'utf8').match(/#[0-9a-f]{6}\b/gi) ?? []).map(
        (m) => `${f}: ${m}`,
      ),
    );
  assert.deepEqual(hex, []);
});
