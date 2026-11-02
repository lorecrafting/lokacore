// The play harness of the dialogue tests: the compiled persuade sampler, edited, then played.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameView, INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { encode } from '../src/foundation/canonical.ts';
import { hydrate } from '../src/runtime/created.ts';
import { ctx } from './harness.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-branching-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/persuade_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
export const P = 'persuade_sampler@0.0.1';
export const base = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
export const ref = (kind: string, key: string) => ({
  cartridge_id: 'persuade_sampler',
  cartridge_version: '0.0.1',
  kind,
  key,
});
export const LABEL = 'dialogue.guard.persuade';
export const SAID = 'narration.guard.persuade';
export const FAILED = 'narration.guard.persuade_failed';
export const plain = (extra: object = {}) => ({ label: LABEL, narration: SAID, ...extra });
export const set = (key: string, value: unknown = true) => ({
  op: 'fact.assign',
  fact: ref('fact', key),
  value,
});
export const is = (key: string, equals: unknown) => ({
  op: 'fact_compare',
  fact: ref('fact', key),
  equals,
});

// The sampler with `choices` on the guard, `more` further dialogues of the guard, and bool facts
// `flag` and `other`; `edit` then changes anything else.
export function content(choices: object, more: Record<string, object> = {}, edit = (_: any) => {}) {
  const c = structuredClone(base);
  const guard = c.dialogues[`${P}:dialogue/guard`];
  guard.choices = choices;
  for (const [key, opts] of Object.entries(more))
    c.dialogues[`${P}:dialogue/${key}`] = { ...structuredClone(guard), key, choices: opts };
  for (const key of ['flag', 'other'])
    c.facts[`${P}:fact/${key}`] = { ...c.facts[`${P}:fact/gate_open`], key };
  edit(c);
  return c;
}

export function play(c: unknown) {
  const canonical = encode(c as Parameters<typeof encode>[0]);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const loaded = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  let w: World = newWorld(
    loaded.cartridge as Cartridge,
    ctx('4c5e7a9b-1d2f-4a6b-8c0d-2e4f6a8b0c1e'),
    [1, 2, 3, 4],
  );
  let n = 0;
  const send = (payload: object) => {
    n += 1;
    const command = {
      id: `ffffffff-9999-4999-8999-${String(n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    };
    const r = step(w, command as unknown as Parameters<typeof step>[1], n);
    w = r.world;
    return r.decision as any;
  };
  const view = () => gameView(w).choice as any;
  const talk = (npc = 'guard') => send({ type: 'talk', target_id: w.entityIds[`${P}:npc/${npc}`] });
  const opened = () => {
    const d = talk();
    assert.equal(d.kind, 'accepted', JSON.stringify(d));
    return view().continuation_id as string;
  };
  const choose = (choice_id: string) =>
    send({ type: 'choose', continuation_id: view().continuation_id, choice_id });
  const ids = () => view()?.choices.map((o: any) => o.choice_id);
  // a reload holds only what the save holds: the state, as JSON
  const reload = () => {
    w = hydrate(w, JSON.parse(JSON.stringify(w.state)), true)!;
  };
  return { send, talk, opened, choose, ids, view, reload, world: () => w };
}
export const ops = (d: any) => d.delta.ops.map((o: any) => o.op);
export const events = (d: any) => d.events.map((e: any) => [e.position, e.payload.type]);
export const opens = (d: any) => d.delta.ops.find((o: any) => o.op === 'choice.open');
