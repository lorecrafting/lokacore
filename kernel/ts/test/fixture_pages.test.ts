// Fixture pages (loka-x6t.120; mechanics.md inspectable_detail@1): a scripted action aimed at a room detail
// is offered on that detail's NoticeView only, never in view.actions, and the detail is projected
// with its authored title (kernel_api 1.120) or its description. The spells sampler edited
// in-test: kernel_api 1.120, the hearth titled "The cold hearth"; the sigil keeps no title.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step } from '../src/index.ts';
import { bodyOf, type Cartridge, type World } from '../src/runtime/decision.ts';
import { encode } from '../src/foundation/canonical.ts';
import { validate } from '../src/foundation/validate.ts';
import { check } from '../src/runtime/invariants.ts';
import { resolved } from '../src/commands/actions.ts';
import { offerMaps } from '../src/view/invariants_view.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { ctx } from './harness.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-fixture-pages-'));
const file = join(scratch, 'artifact.json');
execFileSync('mix', ['loka.compile', 'cartridges/spells_sampler', file], {
  cwd: fileURLToPath(new URL('../../../', import.meta.url)),
  stdio: 'pipe',
});
const artifact = readFileSync(file);
rmSync(scratch, { recursive: true });
const P = 'spells_sampler@0.0.1';
const TOWER = `${P}:room/tower`;

function load(change: (c: Record<string, any>) => void = () => {}) {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  c.manifest.requires.kernel_api.at_least = '1.120';
  c.rooms[TOWER].details.hearth.title = 'detail.hearth.title';
  c.text['detail.hearth.title'] = 'The cold hearth';
  change(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
}
const world = (change?: (c: Record<string, any>) => void): World => {
  const loaded = load(change);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(
    loaded.cartridge as Cartridge,
    ctx('3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e29'),
    [1, 2, 3, 4],
  );
};
const view = (w: World) => {
  const v = gameView(w);
  assert.deepEqual(validate('GameView', v), []);
  return v as any;
};
const notice = (v: any, key: string) => v.notices?.find((n: { key: string }) => n.key === key);
const perform = (w: World, action: string) =>
  step(
    w,
    {
      id: 'eeeeeeee-1200-4120-8120-000000000001',
      world_context_id: w.context,
      payload: { type: 'perform', actor_id: w.character, action },
    } as never,
    1,
  );
const command = (w: World, action: string) => ({
  world_context_id: w.context,
  payload: { type: 'perform', actor_id: w.character, action },
});
const listed = (v: any) => v.actions.map((a: { action_key: string }) => a.action_key);
const guard = (w: World, v: unknown) =>
  check('world_lists_no_fixture_action', {
    view: v,
    ...offerMaps(Object.values(resolved(w, w.character))),
  });

// Breaks: the World card stays (gather_ash or trace_sigil in view.actions), the detail gets no
// page, or the title falls back wrongly (authored title lost, or the sigil not on its description).
test('a scripted action aimed at a detail is its page card, titled by title or description', () => {
  const v = view(world());
  assert.deepEqual(
    listed(v).filter((k: string) => ['gather_ash', 'trace_sigil'].includes(k)),
    [],
  );
  const { key, title, actions } = notice(v, 'hearth');
  assert.deepEqual(
    { key, title, actions },
    {
      key: 'hearth',
      title: 'detail.hearth.title',
      actions: [
        {
          action_key: 'gather_ash',
          label: 'actions.gather_ash',
          target: { kind: 'none' },
          input: [],
          available: true,
        },
      ],
    },
  );
  const sigil = notice(v, 'sigil');
  assert.equal(sigil.title, 'detail.sigil');
  assert.deepEqual(
    sigil.actions.map((a: { action_key: string }) => a.action_key),
    ['trace_sigil'],
  );
});

// Breaks: the page card is not admitted (perform refused), or the admission invariant no longer
// finds a notice card for an accepted perform.
test('the page card performs and the view agrees with admission', () => {
  const w = world();
  const v = view(w);
  const r = perform(w, 'gather_ash');
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  assert.equal(level(r.world, bodyOf(r.world, r.world.character)!, resourceRef(r.world, 'ash')), 1);
  assert.ok(
    check('gameview_agrees_with_admission', {
      view: v,
      command: command(w, 'gather_ash'),
      decision: r.decision,
      ...offerMaps(Object.values(resolved(w, w.character))),
    }),
  );
});

// Break: every detail becomes a page, not only one a scripted action targets (or one of the kinds).
test('a detail no scripted action targets and of no page kind gets no page', () => {
  const v = view(
    world((c) => {
      c.rooms[TOWER].details.rug = { aliases: ['rug'], description: 'detail.hearth' };
    }),
  );
  assert.equal(notice(v, 'rug'), undefined);
});

// Breaks: a failing policy drops the card (or shows it available), or the perform is admitted.
test("a card whose policy fails lists unavailable with the policy's reason; perform refused", () => {
  const w = world((c) => {
    c.scripted_actions[`${P}:action/gather_ash`].policy = { op: 'level_compare', at_least: 5 };
  });
  const card = notice(view(w), 'hearth').actions[0];
  assert.deepEqual([card.available, card.reason?.code], [false, 'invalid_state']);
  const r = perform(w, 'gather_ash');
  assert.equal(r.decision.kind === 'rejected' && r.decision.error.code, 'invalid_state');
});

// Breaks: the guard passes a World list carrying a detail scripted action, or fails the projected view.
test('world_lists_no_fixture_action: false with a detail scripted action in actions, true without', () => {
  const w = world();
  const v = view(w);
  assert.equal(guard(w, v), true);
  const bad = structuredClone(v);
  bad.actions.push(notice(v, 'hearth').actions[0]);
  assert.equal(guard(w, bad), false);
});

// Break: a bed detail's page replaces its actions with the bed's Rest, dropping the scripted action card
// aimed at it (offered nowhere, since view.actions never lists a detail scripted action).
test('a scripted action aimed at a bed detail keeps its card on that page', () => {
  const v = view(
    world((c) => {
      for (const caps of [c.lock.capabilities, c.manifest.requires.capabilities])
        Object.assign(caps, { position: 1, service: 1 });
      c.facts[`${P}:fact/position`] = {
        key: 'position',
        version: 1,
        value_type: {
          type: 'enum',
          values: ['standing', 'sitting', 'resting', 'sleeping'],
          default: 'standing',
        },
        scopes: ['player'],
        meaning: "The character's position (position@1): only its rule writes it.",
      };
      c.rooms[TOWER].details.hearth.bed = {
        title: 'detail.hearth.title',
        entitlement: {
          cartridge_id: 'spells_sampler',
          cartridge_version: '0.0.1',
          kind: 'fact',
          key: 'sigil_traced',
        },
      };
    }),
  );
  const { bed, actions } = notice(v, 'hearth');
  assert.deepEqual(
    [bed, actions?.map((a: { action_key: string }) => a.action_key)],
    [true, ['gather_ash']],
  );
});
