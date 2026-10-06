import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Game } from '../../packages/game-view/session.ts';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { openGame } from '../../authority/local-story/session.ts';
import { presenter } from './presenter.ts';
import { buttonsOf, actionContext, group, pagesAfter, intentOf, things } from './model.ts';
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
function prepared(bundle = pin, nested = false, atPeg = false) {
  const p = elapsedHost(':memory:', { wall: 10000, mono: 0 }, bundle),
    game = openGame(p.db, bundle, p.host);
  if (!atPeg) {
    invoke(game, 'move', [], { direction: 'north' });
    invoke(game, 'move', [], { direction: 'west' });
  }
  const peg = game.view().view.entities.find((e) => e.name === 'npc.peg.short')!;
  const original = peg.shop!.find((e) => e.name === 'item.waterskin.short')!.item_id;
  const spare = peg.shop!.find((e) => e.name === 'item.spare_waterskin.short')!.item_id;
  invoke(game, 'buy', [peg.id, original], { quoted_price: 4 });
  invoke(game, 'buy', [peg.id, spare], { quoted_price: 4 });
  const bag = peg.shop!.find((e) => e.name === 'item.satchel.short')!.item_id;
  if (nested) invoke(game, 'buy', [peg.id, bag], { quoted_price: 5 });
  invoke(game, 'move', [], { direction: 'east' });
  const well = game.view().view.notices!.find((n) => n.title === 'detail.well.title')!.id;
  return { p, game, original, spare, well, bag };
}
// Breaks: Book drops/reverses a pair, labels both skins alike, or refreshes across changed contents.
test('Book preserves exact water pairs and invalidates changed quantities in displayed context', () => {
  const { p, game, original, spare, well, bag } = prepared(pin, true);
  try {
    invoke(game, 'put', [original, bag]);
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
    assert.equal(pour.detail_id, original);
    assert.ok(!group(buttons).on(spare).includes(pour));
    const ui = presenter(game),
      beforePages = [
        { kind: 'carrying' as const },
        { kind: 'thing' as const, id: bag },
        { kind: 'thing' as const, id: original },
      ];
    const shown = ui
      .screen()
      .buttons.find((b) => b.action_key === 'pour' && b.target_ids[0] === original)!;
    ui.press(shown, original);
    assert.match(ui.screen().detail(original).join(' '), /Water · 1 quarter-litres/);
    assert.ok(!ui.screen().detail(spare).join(' ').includes('You pour'));
    assert.deepEqual(pagesAfter(beforePages, before, game.view().view), beforePages);
    const after = game.view().view;
    assert.deepEqual(
      [
        things(after).find((e) => e.id === original)!.liquid!.quantity,
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

const aliases = { fill: 'draw_water', pour: 'decant', drink: 'sip' } as const;
const sorted = (v: any): any =>
  Array.isArray(v)
    ? v.map(sorted)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, sorted(v[k])]),
        )
      : v;
function aliasBundle(type = 'fill', variant = 'allowed') {
  const c = structuredClone(pin.value),
    prefix = 'ashmere_missing_child@0.0.22';
  c.entry = { ...c.entry, key: 'chandler' };
  for (const [command, key] of Object.entries(aliases))
    c.actions[`${prefix}:action/${key}`] = {
      key,
      command,
      label: `action.${command}`,
      accessibility: `action.${command}`,
      priority: 0,
      target: {
        kind: 'entity',
        scopes: [command === 'fill' ? 'inspectable_details' : 'inventory'],
      },
      input: [],
      policy: { policy_version: 1, root: { op: 'all', items: [] } },
    };
  const action = c.actions[`${prefix}:action/${aliases[type as keyof typeof aliases]}`];
  if (variant === 'target') action.target = { kind: 'none' };
  if (variant === 'input') action.input = ['direction'];
  if (variant === 'policy') action.policy.root = { op: 'not', item: { op: 'all', items: [] } };
  c.rooms[`${prefix}:room/well_lane`].actions = [
    { op: 'replace', actions: Object.values(aliases) },
  ];
  for (const [item, quantity] of [
    ['waterskin', 3],
    ['spare_waterskin', 2],
  ] as const)
    c.items[`${prefix}:item/${item}`].vessel.initial = {
      kind: {
        cartridge_id: 'ashmere_missing_child',
        cartridge_version: '0.0.22',
        kind: 'liquid',
        key: 'water',
      },
      quantity,
    };
  const canonical = JSON.stringify(sorted(c));
  return { canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
}
// Breaks: a loaded authored liquid key loses projection, exact invocation, source ownership or live committed quantity.
test('loaded liquid aliases reach exact Book presses and matching target/input/policy refusal', () => {
  for (const type of ['fill', 'pour', 'drink'] as const)
    for (const variant of ['allowed', 'target', 'input', 'policy']) {
      const bundle = aliasBundle(type, variant),
        { p, game, original, spare, well } = prepared(bundle, false, true);
      try {
        const targets =
          type === 'fill' ? [well, original] : type === 'pour' ? [original, spare] : [original];
        const owner = targets[0],
          key = aliases[type],
          ui = presenter(game),
          view = game.view().view;
        const subject =
          type === 'fill'
            ? view.notices!.find((n) => n.id === owner)!
            : view.inventory.find((e) => e.id === owner)!;
        const offer = subject.actions!.find(
          (a) => a.action_key === key && JSON.stringify(a.target_ids) === JSON.stringify(targets),
        )!;
        assert.ok(offer, `${key}/${variant}`);
        assert.equal(offer.command, type);
        assert.equal(offer.available, variant === 'allowed');
        assert.ok(!ui.screen().buttons.some((b) => b.action_key === type));
        if (variant !== 'allowed') {
          assert.ok(!ui.screen().buttons.some((b) => b.action_key === key));
          const reply = game.invoke({ action_key: key, target_ids: targets, input: {} } as never);
          assert.equal(reply.kind, 'saved');
          if (reply.kind === 'saved') {
            assert.equal(reply.decision.kind, 'rejected');
            if (reply.decision.kind === 'rejected')
              assert.equal(
                reply.decision.error.code,
                variant === 'policy' ? 'invalid_state' : 'unsupported_capability',
              );
          }
          continue;
        }
        const button = ui
          .screen()
          .buttons.find(
            (b) => b.action_key === key && JSON.stringify(b.target_ids) === JSON.stringify(targets),
          )!;
        assert.equal(button.detail_id, owner);
        assert.deepEqual(intentOf(button).target_ids, targets);
        assert.equal(intentOf(button).action_key, key);
        if (type === 'pour') assert.match(button.label, /waterskin.*into.*spare waterskin/);
        p.fault.kind = 'lost';
        p.fault.armed = true;
        assert.equal(ui.press(button, owner), '');
        assert.equal(game.pending(), true);
        p.fault.reads = false;
        const line = ui.press(button, owner),
          quantity = type === 'pour' ? 2 : 1;
        assert.ok(line.includes(`Water · ${quantity} quarter-litres`));
        assert.equal(ui.screen().detail(owner).length, 1);
        const receipt = p.sql
          .prepare('SELECT command,response FROM receipt ORDER BY revision DESC LIMIT 1')
          .get()!;
        const command = JSON.parse(receipt.command as string),
          response = JSON.parse(receipt.response as string);
        assert.equal(command.payload.type, type);
        assert.equal(response.events[0].payload.quantity, quantity);
        assert.deepEqual(
          type === 'fill'
            ? [command.payload.source_id, command.payload.vessel_id]
            : type === 'pour'
              ? [command.payload.source_id, command.payload.receiver_id]
              : [command.payload.vessel_id],
          targets,
        );
        assert.deepEqual(
          [original, spare].map((id) => view.inventory.find((e) => e.id === id)!.liquid!.quantity),
          [3, 2],
        );
        const reopened = presenter(openGame(p.db, bundle, p.host));
        assert.deepEqual(reopened.screen().detail(owner), ui.screen().detail(owner));
      } finally {
        p.sql.close();
      }
    }
});
// Breaks: an aliased liquid button refreshes across changed quantities because freshness checks the authored key.
test('aliased liquid freshness refuses a stale pair after another committed drink', () => {
  const bundle = aliasBundle(),
    { p, game, original, spare } = prepared(bundle, false, true);
  try {
    const ui = presenter(game),
      button = ui
        .screen()
        .buttons.find(
          (b) =>
            b.action_key === 'decant' && b.target_ids[0] === original && b.target_ids[1] === spare,
        )!;
    const before = actionContext(game.view().view, button, 0);
    invoke(game, 'sip', [spare]);
    assert.notEqual(actionContext(game.view().view, button, 0), before);
    assert.equal(ui.press(button, original), 'The page had changed; here it is again.');
    assert.deepEqual(
      [original, spare].map(
        (id) => game.view().view.inventory.find((e) => e.id === id)!.liquid!.quantity,
      ),
      [3, 1],
    );
  } finally {
    p.sql.close();
  }
});
