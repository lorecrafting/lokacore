import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import type { Game } from '../../packages/game-view/session.ts';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { openGame } from '../../authority/local-story/session.ts';
import { presenter } from './presenter.ts';
import { narrationLines } from './logs.ts';
import { buttonsOf, actionContext } from './model.ts';
const pin = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/missing_child_b7_hash.json', import.meta.url),
    'utf8',
  ),
);
function invoke(game: Game, action_key: string, target_ids: string[] = [], input: object = {}) {
  const reply = game.invoke({ action_key, target_ids, input } as never);
  assert.equal(reply.kind, 'saved', JSON.stringify(reply));
  if (reply.kind === 'saved') assert.equal(reply.decision.kind, 'accepted', JSON.stringify(reply));
}
function prepared() {
  const p = elapsedHost(':memory:', { wall: 10000, mono: 0 }, pin),
    game = openGame(p.db, pin, p.host);
  invoke(game, 'move', [], { direction: 'north' });
  invoke(game, 'move', [], { direction: 'west' });
  const peg = game.view().view.entities.find((e) => e.name === 'npc.peg.short')!;
  const original = peg.shop!.find((e) => e.name === 'item.waterskin.short')!.item_id;
  const spare = peg.shop!.find((e) => e.name === 'item.spare_waterskin.short')!.item_id;
  invoke(game, 'buy', [peg.id, original], { quoted_price: 4 });
  invoke(game, 'buy', [peg.id, spare], { quoted_price: 4 });
  invoke(game, 'move', [], { direction: 'east' });
  const well = game.view().view.notices!.find((n) => n.title === 'detail.well.title')!.id;
  return { p, game, original, spare, well };
}
// Breaks: Book drops/reverses a pair, labels both skins alike, or refreshes across changed contents.
test('Book preserves exact water pairs and invalidates changed quantities in displayed context', () => {
  const { p, game, original, spare, well } = prepared();
  try {
    invoke(game, 'fill', [well, original]);
    invoke(game, 'fill', [well, spare]);
    invoke(game, 'drink', [spare]);
    const before = game.view().view,
      text = (key: string) => game.text(key) ?? key,
      buttons = buttonsOf(before, text, text);
    const pour = buttons.find(
      (b) => b.action_key === 'pour' && b.target_ids[0] === original && b.target_ids[1] === spare,
    )!;
    const fill = buttons.find(
      (b) => b.action_key === 'fill' && b.target_ids[0] === well && b.target_ids[1] === spare,
    )!;
    assert.ok(pour);
    assert.ok(fill);
    assert.match(pour.label, /waterskin.*into.*spare waterskin/);
    assert.match(fill.label, /spare waterskin/);
    assert.equal(fill.detail_id, well);
    invoke(game, 'pour', pour.target_ids);
    const after = game.view().view;
    assert.deepEqual(
      [
        after.inventory.find((e) => e.id === original)!.liquid!.quantity,
        after.inventory.find((e) => e.id === spare)!.liquid!.quantity,
      ],
      [3, 4],
    );
    assert.notEqual(actionContext(before, pour, 0), actionContext(after, pour, 0));
    assert.notEqual(actionContext(before, fill, 0), actionContext(after, fill, 0));
  } finally {
    p.sql.close();
  }
});
// Breaks: Book displays a template/raw quantity or reads today's vessel instead of committed bindings.
test('liquid narration displays authored labels and the original committed amount', () => {
  const { p, game } = prepared();
  try {
    const text = (key: string) =>
      (
        ({
          'liquid.poured': 'You pour into the other skin.',
          'liquid.water': 'Water',
          'liquid.units': 'quarter-litres',
        }) as Record<string, string>
      )[key] ?? key;
    const last = {
      command_id: 'saved-command',
      lines: [
        {
          key: 'liquid.poured',
          bindings: { kind: 'liquid.water', unit_label: 'liquid.units', quantity: 3 },
        },
      ],
    } as never;
    assert.deepEqual(narrationLines(last, game.view().view, text), [
      'You pour into the other skin.\nWater · 3 quarter-litres',
      '',
    ]);
  } finally {
    p.sql.close();
  }
});
// Breaks: cold narration loses its exact well/vessel route or substitutes today's remaining quantity.
test('Book restores liquid narration on the exact saved source detail after SQLite reopen', () => {
  const opened = prepared(),
    { p, original, well } = opened;
  try {
    let game = opened.game;
    invoke(game, 'fill', [well, original]);
    assert.equal(game.lastNarration()!.detail_id, well);
    game = openGame(p.db, pin, p.host);
    assert.match(presenter(game).screen().detail(well).join(' '), /Water · 4 quarter-litres/);
    invoke(game, 'drink', [original]);
    game = openGame(p.db, pin, p.host);
    assert.match(presenter(game).screen().detail(original).join(' '), /Water · 1 quarter-litres/);
    assert.equal(game.view().view.inventory.find((e) => e.id === original)!.liquid!.quantity, 3);
  } finally {
    p.sql.close();
  }
});
