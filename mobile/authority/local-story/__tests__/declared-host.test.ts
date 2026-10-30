// Every stock cartridge compiled in one BEAM and opened as a World, for the declared-visible Book
// test (loka-kgd.174); the kernel half, since only local-story imports the kernel. Named .test.ts
// (as elapsed-host.test.ts) so the display-text lint skips its Elixir script; it defines no test.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  gameView,
  INSTALLED,
  loadCartridge,
  newWorld,
  step,
} from '../../../../kernel/ts/src/index.ts';
import type { Cartridge, World } from '../../../../kernel/ts/src/runtime/decision.ts';
import { statusKey } from '../../../../kernel/ts/src/mechanics/status/shared.ts';

export type { Cartridge, World };
export { gameView };

/** Each cartridge directory's compiled artifact bytes, by name. */
export function artifacts(): Map<string, Uint8Array> {
  const root = fileURLToPath(new URL('../../../../', import.meta.url));
  const scratch = mkdtempSync(join(tmpdir(), 'loka-declared-'));
  try {
    const script = `for d <- File.ls!("cartridges"), File.dir?(Path.join("cartridges", d)) do
      {:ok, b, _} = Loka.Content.compile(Path.join("cartridges", d))
      File.write!(Path.join(${JSON.stringify(scratch)}, d), b)
    end`;
    execFileSync('mix', ['run', '--no-start', '-e', script], { cwd: root, stdio: 'pipe' });
    return new Map(readdirSync(scratch).map((f) => [f, readFileSync(join(scratch, f))]));
  } finally {
    rmSync(scratch, { recursive: true });
  }
}

/** The start World with the player embodied (an ancestry chosen where the cartridge asks). */
export function open(bytes: Uint8Array): World | undefined {
  const loaded = loadCartridge(bytes, INSTALLED);
  assert.ok(loaded.ok, JSON.stringify(loaded).slice(0, 300));
  const c = loaded.cartridge as Cartridge;
  if (!c.entry) return undefined;
  const w = newWorld(c, 'aaaaaaaa-0000-4000-8000-000000000001' as never, [1, 2, 3, 4]);
  const ancestry = Object.keys(c.ancestries ?? {})[0];
  if (!ancestry) return w;
  const r = step(
    w,
    {
      id: 'cccccccc-0000-4000-8000-000000000001',
      world_context_id: w.context,
      payload: { type: 'choose_ancestry', actor_id: w.character, ancestry },
    } as never,
    1,
  );
  assert.equal(r.decision.kind, 'accepted');
  return r.world;
}

/** `w` with every declared status on the player body, as a permanent active row. */
export const withStatuses = (w: World): World => ({
  ...w,
  state: {
    ...w.state,
    statuses: Object.fromEntries(
      Object.values(w.cartridge.statuses ?? {}).map((s) => [
        statusKey(w.body, {
          cartridge_id: w.cartridge.manifest.id,
          cartridge_version: w.cartridge.manifest.version,
          kind: 'status',
          key: s.key,
        }),
        { active: true, generation: 1 },
      ]),
    ),
  },
});

/** `w` with the player body standing in the room that holds `npc` (an entity-id ref string). */
export const besides = (w: World, npc: string): World => ({
  ...w,
  state: {
    ...w.state,
    containers: { ...w.state.containers, [w.body]: w.state.containers[w.entityIds[npc]!]! },
  },
});
