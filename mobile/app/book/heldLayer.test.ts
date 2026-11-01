// The under-ink layers' contract: one at a time, and every text role still reads over each.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { heldLayer, lampLit, lowHealth } from './heldLayer.ts';
import { contrast, mixInk, washInk } from './palette.ts';
import { color, opacity } from './tokens.ts';
import type { GameView } from '../../packages/game-view/session.ts';

// Breaks: two layers at once, or the order inverted, so a lamp hides the fatal hold.
test('one held layer, highest first', () => {
  assert.equal(heldLayer({ fatal: true, low: true, lit: true }), 'fatal');
  assert.equal(heldLayer({ fatal: false, low: true, lit: true }), 'vignette');
  assert.equal(heldLayer({ fatal: false, low: false, lit: true }), 'glow');
  assert.equal(heldLayer({ fatal: false, low: false, lit: false }), undefined);
});

// Breaks: a token raised past what the ink can bear (book-ui.md's 4.5:1 at the layer's peak).
test('every text role holds 4.5:1 over every under-ink layer at its peak', () => {
  const roles = ['fg', 'dim', 'action', 'danger', 'warning'] as const;
  for (const [name, p] of Object.entries(color)) {
    const layers: [string, string, number][] = [
      ['fatal', washInk(p), opacity.faint],
      ['vignette', p.fg, opacity.faint],
      ['dream', color.dusk.bg, opacity.faint],
    ];
    if (name === 'dusk' || name === 'dark') layers.push(['glow', color.dark.action, opacity.glow]);
    for (const [layer, ink, peak] of layers)
      for (const role of roles) {
        const ratio = contrast(p[role], mixInk(p.bg, ink, peak));
        assert.ok(ratio >= 4.5, `${name}.${role} over ${layer}: ${ratio.toFixed(2)}`);
      }
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
