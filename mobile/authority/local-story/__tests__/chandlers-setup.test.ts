// The Chandler's Debt tests' shared real-SQLite story (v016) and the saved-receipt forgery.
import assert from 'node:assert/strict';
import {
  gameView,
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../../kernel/ts/src/index.ts';
import { read } from '../../../../kernel/ts/test/read.ts';
import { elapsedHost } from './elapsed-host.test.ts';
import { openStory } from '../authority.ts';

export const bundle = read('protocol/fixtures/missing_child_v016_hash.json');
const loaded = loadCartridge(
  new TextEncoder().encode(
    JSON.stringify({ cartridge: bundle.value, content_hash: bundle.sha256 }),
  ),
  INSTALLED,
);
assert.ok(loaded.ok, JSON.stringify(loaded));
export const fresh = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);

export function setup() {
  const p = elapsedHost(':memory:', { wall: 10000, mono: 0 }, bundle);
  const opened = openStory(p.db, [{ fresh, content_hash: bundle.sha256 }], p.host);
  assert.equal(opened.kind, 'open');
  if (opened.kind !== 'open') throw new Error('open');
  let story = opened;
  let n = 0;
  const entity = (kind: string, name: string) =>
    fresh.entityIds[`ashmere_missing_child@0.0.16:${kind}/${name}`];
  const invoke = (
    action_key: string,
    target_ids: string[] = [],
    input: object = {},
    expected = 'accepted',
  ) => {
    const reply = story.invoke({
      invocation_id: `dddddddd-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      actor_id: fresh.character,
      action_key,
      target_ids,
      input,
    });
    assert.equal(reply.kind, 'saved', JSON.stringify(reply));
    if (reply.kind === 'saved') {
      const decision = reply.decision as { kind: string; error?: { code: string }; code?: string };
      assert.equal(
        decision.kind === 'accepted' ? 'accepted' : (decision.error?.code ?? decision.code),
        expected,
        JSON.stringify(reply),
      );
    }
    return reply;
  };
  const move = (...directions: string[]) =>
    directions.forEach((direction) => invoke('move', [], { direction }));
  const answer = (choice_id: string) =>
    invoke('choose', [], {
      continuation_id: gameView(story.world()).choice!.continuation_id,
      choice_id,
    });
  const reopen = () => {
    const result = openStory(p.db, [{ fresh, content_hash: bundle.sha256 }], p.host);
    assert.equal(result.kind, 'open', JSON.stringify(result));
    if (result.kind !== 'open') throw new Error('reopen');
    story = result;
  };
  return {
    ...p,
    entity,
    invoke,
    move,
    answer,
    reopen,
    world: () => story.world(),
    story: () => story,
  };
}

export type Forged = {
  delta: { ops: { op: string; [field: string]: unknown }[] };
  events: {
    logical_time: number;
    causation_id?: string;
    scope?: unknown;
    payload: { type: string; [field: string]: unknown };
  }[];
};

// Saves the accept receipt (and with `expire`, the expiry receipt), forges one field of it, and reopens.
export function forge(
  expire: boolean,
  mutate: (receipt: Forged) => void,
  forgeCommand?: (command: { id: string; payload: { [field: string]: unknown } }) => void,
) {
  const a = setup();
  a.move('north', 'west');
  a.invoke('a_peg_debt', [a.entity('npc', 'peg')]);
  a.answer('accept_on_time');
  if (expire) {
    const story = a.story();
    const from = story.world().state.clock;
    assert.equal(
      story.elapsed({ expected_run_id: story.runId(), from, until: 237601 }).kind,
      'saved',
    );
  }
  const rows = a.sql
    .prepare(
      "SELECT rowid,command,response FROM receipt WHERE json_extract(command,'$.payload.type')=?",
    )
    .all(expire ? 'elapsed' : 'choose') as { rowid: number; command: string; response: string }[];
  assert.equal(rows.length, 1);
  const receipt = JSON.parse(rows[0].response) as Forged;
  mutate(receipt);
  a.sql
    .prepare('UPDATE receipt SET response=? WHERE rowid=?')
    .run(JSON.stringify(receipt), rows[0].rowid);
  if (forgeCommand) {
    const command = JSON.parse(rows[0].command);
    forgeCommand(command);
    a.sql
      .prepare('UPDATE receipt SET command=?,command_id=? WHERE rowid=?')
      .run(JSON.stringify(command), command.id, rows[0].rowid);
  }
  return openStory(a.db, [{ fresh, content_hash: bundle.sha256 }], a.host).kind;
}

export const only = (receipt: Forged, op: string, key?: string) => {
  const ops = receipt.delta.ops.filter(
    (o) => o.op === op && (!key || (o.fact as { key: string }).key === key),
  );
  assert.equal(ops.length, 1);
  return ops[0];
};
export const otherId = 'eeeeeeee-0000-4000-8000-000000000001';
