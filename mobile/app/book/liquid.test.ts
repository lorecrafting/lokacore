import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Game } from '../../packages/game-view/session.ts';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { openGame } from '../../authority/local-story/session.ts';
import {
  id,
  liquidBundle,
  water,
} from '../../authority/local-story/__tests__/liquid-bundle.test.ts';
import { presenter } from './presenter.ts';
import { liquidWords } from './pick.ts';
import { lineWords } from './words.ts';
import { view } from './__tests__/combat-book.test.ts';
import { buttonsOf, actionContext, group, pagesAfter, intentOf, things } from './model.ts';
const pin = liquidBundle();
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
    assert.match(ui.screen().detail(original).join(' '), /You pour\./);
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
    // The line names the level the fill left, from its own bindings (book-ui.md, Line placement).
    assert.match(
      presenter(game).screen().detail(well).join(' '),
      /You fill the skin\. The waterskin is full of water\./,
    );
    invoke(game, 'drink', [original]);
    game = openGame(p.db, pin, p.host);
    assert.match(
      presenter(game).screen().detail(original).join(' '),
      /You drink\. The waterskin is nearly full of water\./,
    );
    assert.equal(game.view().view.inventory.find((e) => e.id === original)!.liquid!.quantity, 3);
  } finally {
    p.sql.close();
  }
});

const aliases = { fill: 'draw_water', pour: 'decant', drink: 'sip' } as const;
function aliasBundle(type = 'fill', variant = 'allowed') {
  return liquidBundle((c) => alias(c, type, variant));
}
function alias(c: any, type: string, variant: string) {
  c.entry = { ...c.entry, key: 'chandler' };
  for (const [command, key] of Object.entries(aliases))
    c.actions[id('action', key)] = {
      key,
      command,
      name: `action.${command}`,
      accessibility: `action.${command}`,
      priority: 0,
      target: {
        kind: 'entity',
        scopes: [command === 'fill' ? 'inspectable_details' : 'inventory'],
      },
      input: [],
      policy: { op: 'all', items: [] },
    };
  const action = c.actions[id('action', aliases[type as keyof typeof aliases])];
  if (variant === 'target') action.target = { kind: 'none' };
  if (variant === 'input') action.input = ['direction'];
  if (variant === 'policy') action.policy = { op: 'not', item: { op: 'all', items: [] } };
  c.rooms[id('room', 'well_lane')].actions = [{ op: 'replace', actions: Object.values(aliases) }];
  for (const [item, quantity] of [
    ['waterskin', 3],
    ['spare_waterskin', 2],
  ] as const)
    c.items[id('item', item)].vessel.initial = {
      kind: water,
      quantity,
    };
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
        const line = ui.press(button, owner);
        assert.match(line, /^You (fill the skin|drink|pour)\. The [\w ]+ is [\w ,]+\.$/);
        assert.equal(ui.screen().detail(owner).length, 1);
        const receipt = p.sql
          .prepare('SELECT command,response FROM receipt ORDER BY revision DESC LIMIT 1')
          .get()!;
        const command = JSON.parse(receipt.command as string),
          response = JSON.parse(receipt.response as string);
        assert.equal(command.payload.type, type);
        assert.equal(response.events[0].payload.quantity, type === 'pour' ? 2 : 1);
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

// Breaks: a band edge flips, so a skin one swallow short reads full, a last swallow reads empty, or a count shows.
test('a vessel amount reads in words; exact empty and exact full are unambiguous', () => {
  const say = (quantity: number, capacity: number) =>
    liquidWords({ label: 'Water', quantity, capacity }, (k) => k);
  assert.deepEqual(
    [
      say(0, 4),
      say(1, 4),
      say(2, 4),
      say(3, 4),
      say(4, 4),
      say(0, 1),
      say(1, 1),
      say(1, 2),
      say(1, 3),
      say(2, 3),
    ],
    [
      'Empty.',
      'Nearly empty, a little water left.',
      'Half full of water.',
      'Nearly full of water.',
      'Full of water.',
      'Empty.',
      'Full of water.',
      'Half full of water.',
      // book-ui.md Line placement: "a third or less" and "two thirds or more", edges included
      'Nearly empty, a little water left.',
      'Nearly full of water.',
    ],
  );
});

// Breaks: a Fill, Pour or Drink line drops its level, words it from the view's current amount
// instead of the line's own bindings, names the source not the bound vessel, keeps the short's
// indefinite article, or adds a level to a line with no vessel (book-ui.md, Line placement).
test('a liquid line names the level it left in its vessel, from its own bindings', () => {
  const SAY: Record<string, string> = {
    'liquid.drank': 'You drink.',
    'liquid.poured': 'You pour it out.',
    'liquid.water': 'Water',
    skin: 'a waterskin',
    cup: 'a cup',
  };
  const say = (k: string) => SAY[k] ?? k;
  const liquid = { label: 'liquid.water', quantity: 4, capacity: 4 }; // today's level, not the line's
  const v = view({
    entities: [],
    inventory: [
      { id: 's', kind: 'item', name: 'skin', actions: [], liquid },
      { id: 'c', kind: 'item', name: 'cup', actions: [] },
    ],
  } as never);
  const line = (key: string, vessel: string | undefined, remaining: number, capacity = 4) =>
    lineWords(
      {
        key,
        participants: vessel ? { vessel } : {},
        bindings: { kind: 'liquid.water', remaining, capacity },
      },
      say,
      v,
    );
  assert.deepEqual(
    [line('liquid.drank', 's', 0), line('liquid.drank', 's', 2), line('liquid.poured', 'c', 3, 3)],
    [
      'You drink. The waterskin is empty.',
      'You drink. The waterskin is half full of water.',
      'You pour it out. The cup is full of water.',
    ],
  );
  assert.equal(line('liquid.drank', undefined, 2), 'You drink.');
});
