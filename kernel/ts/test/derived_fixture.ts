// The compiled derived sampler (toolbox row 2) and the helpers its tests share.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { gameView } from '../src/view/view.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-derived-sampler-'));
export let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/derived_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
export const content = loaded.cartridge as Cartridge;
export const anvil = (w: World) => w.entityIds['derived_sampler@0.0.1:item/anvil'];
export const MIGHT = 'derived_sampler@0.0.1:status/might';
export const dummy = (w: World) => w.entityIds['derived_sampler@0.0.1:npc/dummy'];
let n = 0;
export function act(w: World, p: object) {
  n += 1;
  return step(
    w,
    {
      id: `dddddddd-5555-4333-8444-${String(n).padStart(12, '0')}` as never,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p } as never,
    },
    n,
  );
}
export function play(w: World, p: object): World {
  const r = act(w, p);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
export const chosen = (ancestry: string, c: Cartridge = content) =>
  play(newWorld(c, '1d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]), {
    type: 'choose_ancestry',
    ancestry,
  });
export function wait(w: World, seconds: number): World {
  n += 1;
  const run_id = 'aaaaaaaa-0000-4000-8000-000000000020';
  const until = w.state.clock + seconds;
  const r = stepElapsed(
    w,
    {
      id: elapsedCommandId(run_id, w.context, w.state.clock, until) as never,
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id, from: w.state.clock, until },
    } as never,
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  if (r.decision.kind === 'accepted')
    seen.push(
      ...r.decision.events.map((e) => e.payload.type as string),
      ...(r.decision.narration ?? []).map((t) => t.key as string),
    );
  return r.world;
}
export const seen: string[] = []; // every elapsed run's event types, then its narration keys

export const hpView = (w: World) => {
  const { current, maximum } = gameView(w).resources!.find((r) => r.resource.key === 'hp')!;
  return [current, maximum];
};

const ancestryRef = (kind: string, name: string) =>
  ({ cartridge_id: 'derived_sampler', cartridge_version: '0.0.1', kind, key: name }) as never;
const ancestryNamed = (kind: string, name: string) => `derived_sampler@0.0.1:${kind}/${name}`;

/** The sampler with strong inheriting skill swim and standing -2, and hardy seeing in the dark. */
export function ancestrySource() {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  for (const cap of ['skills', 'light'])
    // light@1 gates dark_sight
    c.manifest.requires.capabilities[cap] = c.lock.capabilities[cap] = 1;
  c.skills = {
    [ancestryNamed('skill', 'swim')]: {
      key: 'swim',
      name: 'ancestry.strong.label',
      requirement: 'ancestry.strong.label',
      qualification: {
        op: 'stat_compare',
        attribute: ancestryRef('attribute', 'str'),
        at_least: 100,
      },
    },
  };
  c.facts[ancestryNamed('fact', 'skill_swim')] = {
    key: 'skill_swim',
    version: 1,
    value_type: { type: 'bool', default: false },
    scopes: ['player'],
    meaning: "Skill swim's acquisition (skills@1): only skills@1 writes it.",
  };
  c.facts[ancestryNamed('fact', 'standing')] = {
    key: 'standing',
    version: 1,
    value_type: { type: 'int', default: 0 },
    scopes: ['player'],
    meaning: 'Controlled faction standing.',
  };
  c.ancestries.strong.skill = ancestryRef('skill', 'swim');
  c.ancestries.strong.faction = { fact: ancestryRef('fact', 'standing'), value: -2 };
  c.ancestries.hardy.dark_sight = true;
  return c;
}
