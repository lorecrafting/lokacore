// The under-ink layers' contract: one at a time, and every text role still reads over each.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  heldLayer,
  lampLit,
  lowHealth,
  TREATMENTS,
  treatmentInk,
  type Treatment,
} from './heldLayer.ts';
import { contrast, mix, mixInk, washInk } from './palette.ts';
import { color, opacity, size, space } from './tokens.ts';
import type { GameView } from '../../packages/game-view/session.ts';

// Breaks: two layers at once, or the order inverted, so a lamp hides the fatal hold or a
// treatment shows under a glow (book-ui.md, Book treatments: the treatment wins).
test('one held layer, highest first', () => {
  for (const treatment of ['spirit', 'reverie'] as const)
    assert.equal(heldLayer({ treatment, fatal: true, low: true, lit: true }), treatment);
  assert.equal(heldLayer({ fatal: true, low: true, lit: true }), 'fatal');
  assert.equal(heldLayer({ fatal: false, low: true, lit: true }), 'vignette');
  assert.equal(heldLayer({ fatal: false, low: false, lit: true }), 'glow');
  assert.equal(heldLayer({ fatal: false, low: false, lit: false }), undefined);
});

const roles = ['fg', 'dim', 'action', 'danger', 'warning'] as const;
// Every palette, and the mid-blends a cross-fade passes through (the ink is chosen by polarity).
const papers = [
  ...Object.entries(color),
  ['dusk~dark', mix(color.dusk, color.dark, 0.5)],
  ['light~dawn', mix(color.light, color.dawn, 0.5)],
] as const;

// Breaks: a token raised past what the ink can bear (book-ui.md's 4.5:1 at the layer's peak), or a
// treatment's wash chosen by exact paper hex, so a mid-blend gets the light ink under light text.
test('every text role holds 4.5:1 over every under-ink layer at its peak', () => {
  for (const [name, p] of papers) {
    const layers: [string, string, number][] = [
      ['fatal', washInk(p), opacity.fatal],
      ['vignette', p.fg, opacity.faint],
      ...Object.keys(TREATMENTS).map(
        (t) => [t, ...treatmentInk(t as Treatment, p)] as [string, string, number],
      ),
    ];
    if (name === 'dusk' || name === 'dark') layers.push(['glow', color.dark.action, opacity.glow]);
    for (const [layer, ink, peak] of layers)
      for (const role of roles) {
        const ratio = contrast(p[role], mixInk(p.bg, ink, peak));
        assert.ok(ratio >= 4.5, `${name}.${role} over ${layer}: ${ratio.toFixed(2)}`);
      }
  }
});

// Every `treatment` enum in a schema document.
const enums = (file: string) => {
  const found: string[][] = [];
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return;
    for (const [k, v] of Object.entries(n)) {
      if (k === 'treatment' && (v as { enum?: string[] }).enum)
        found.push((v as { enum: string[] }).enum);
      walk(v);
    }
  };
  walk(JSON.parse(readFileSync(new URL(`../../../protocol/${file}`, import.meta.url), 'utf8')));
  return found;
};

// Breaks: a treatment a scene may name with no Book drawing for it, or a Book treatment the
// contract cannot carry (spirit is the Book's own state, never named by a scene).
test('the registry is the contract treatments plus spirit', () => {
  const named = [...enums('scene.schema.json'), ...enums('gameview.schema.json')];
  assert.equal(named.length, 2);
  for (const e of named) assert.deepEqual(['spirit', ...e].sort(), Object.keys(TREATMENTS).sort());
});

// The fatal hold's rim is a blur of standard deviation half its width (CSS box-shadow): its share at
// the page margin, at most φ(x)/x past x deviations from each edge, twice in a corner.
const x = space.page / (size.bloodshot / 2);
const rim = (2 * opacity.bloodshot * Math.exp((-x * x) / 2)) / (x * Math.sqrt(2 * Math.PI));

// Breaks: the bloodshot rim widened or deepened until it reaches the ink at the page margins.
test('every text role holds 4.5:1 at the page margin over the fatal hold and its rim', () => {
  for (const [name, p] of Object.entries(color))
    for (const role of ['fg', 'dim', 'action', 'danger', 'warning'] as const) {
      const under = mixInk(mixInk(p.bg, washInk(p), opacity.fatal), washInk(p), rim);
      const ratio = contrast(p[role], under);
      assert.ok(ratio >= 4.5, `${name}.${role} at the margin: ${ratio.toFixed(2)}`);
    }
});

const view = (over: object) =>
  ({ inventory: [], equipment: [], entities: [], ...over }) as unknown as GameView;
const flame = (lit: boolean) => ({ id: 'lamp', fuel: { remaining: 5, capacity: 9, lit } });

// Breaks: a lamp on the floor, or an unlit one, or daylight deciding the glow wrongly.
test('a lit flame anywhere in the view shows on dusk and dark only', () => {
  const on = color.dusk.bg;
  for (const row of ['inventory', 'entities'])
    assert.ok(lampLit(view({ [row]: [flame(true)] }), on), row);
  const worn = (lit: boolean) =>
    view({ equipment: [{ slot: 'hand' }, { slot: 'light', item: flame(lit) }] });
  assert.ok(lampLit(worn(true), on), 'worn in the light slot');
  assert.ok(!lampLit(worn(false), on));
  assert.ok(lampLit(view({ inventory: [flame(true)] }), color.dark.bg));
  assert.ok(!lampLit(view({ inventory: [flame(false)] }), on));
  assert.ok(!lampLit(view({ inventory: [flame(true)] }), color.light.bg));
});

// Breaks: another pool's danger, or the warning band, darkening the page's edges.
test('low health is the hp pool in danger', () => {
  const pool = (key: string, tone: string) => ({ resources: [{ resource: { key }, tone }] });
  assert.ok(lowHealth(view(pool('hp', 'danger'))));
  assert.ok(!lowHealth(view(pool('hp', 'warning'))));
  assert.ok(!lowHealth(view(pool('mv', 'danger'))));
});
