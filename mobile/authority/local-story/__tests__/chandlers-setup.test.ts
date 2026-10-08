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

// offered: nothing accepted; accept: Peg's offer accepted on time; late: accepted late; expire:
// accepted on time, then the deadline passes; deliver: the ledger handed to Aldric on time;
// kept: delivered, then the deadline passes.
export type Stage = 'offered' | 'accept' | 'late' | 'expire' | 'deliver' | 'kept';
export function staged(stage: Stage) {
  const a = setup();
  const elapse = (until: number) => {
    const story = a.story();
    const from = story.world().state.clock;
    assert.equal(story.elapsed({ expected_run_id: story.runId(), from, until }).kind, 'saved');
  };
  if (stage === 'offered') return a;
  a.move('north', 'west');
  if (stage === 'late') elapse(151201);
  a.invoke('a_peg_debt', [a.entity('npc', 'peg')]);
  a.answer(stage === 'late' ? 'accept_late' : 'accept_on_time');
  if (stage === 'deliver' || stage === 'kept') {
    a.move('east', 'north', 'north', 'north', 'north');
    a.invoke('a_aldric_debt', [a.entity('npc', 'aldric')]);
    a.answer('on_time');
  }
  if (stage === 'expire' || stage === 'kept') elapse(237601);
  return a;
}
const reopen = (a: ReturnType<typeof setup>) =>
  openStory(a.db, [{ fresh, content_hash: bundle.sha256 }], a.host).kind;

const choiceOf = { accept: 'accept_on_time', late: 'accept_late', deliver: 'on_time' };
// Forges one field of the stage's own receipt (acceptance, expiry or on-time turn-in) and reopens.
export function forge(
  stage: Exclude<Stage, 'offered' | 'kept'>,
  mutate: (receipt: Forged) => void,
  forgeCommand?: (command: { id: string; payload: { [field: string]: unknown } }) => void,
) {
  const a = staged(stage);
  const rows = a.sql
    .prepare(
      `SELECT rowid,command,response FROM receipt WHERE json_extract(command,'$.payload.${
        stage === 'expire' ? "type')='elapsed'" : "choice_id')=?"
      }`,
    )
    .all(...(stage === 'expire' ? [] : [choiceOf[stage]])) as {
    rowid: number;
    command: string;
    response: string;
  }[];
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
  return reopen(a);
}

type Rows = Record<string, Record<string, any>>;
// Forges the stage's saved state rows (section -> key -> value) and reopens.
export function forgeRows(stage: Stage, mutate: (rows: Rows, a: ReturnType<typeof setup>) => void) {
  const a = staged(stage);
  const read = () => {
    const rows: Rows = {};
    for (const r of a.sql.prepare('SELECT section,key,value FROM state_row').all() as {
      section: string;
      key: string;
      value: string;
    }[])
      (rows[r.section] ??= {})[r.key] = JSON.parse(r.value);
    return rows;
  };
  const before = read();
  const after = structuredClone(before);
  mutate(after, a);
  for (const section of new Set([...Object.keys(before), ...Object.keys(after)]))
    for (const key of new Set([
      ...Object.keys(before[section] ?? {}),
      ...Object.keys(after[section] ?? {}),
    ])) {
      const value = after[section]?.[key];
      if (JSON.stringify(value) === JSON.stringify(before[section]?.[key])) continue;
      a.sql.prepare('DELETE FROM state_row WHERE section=? AND key=?').run(section, key);
      if (value !== undefined)
        a.sql
          .prepare('INSERT INTO state_row(section,key,value) VALUES (?,?,?)')
          .run(section, key, JSON.stringify(value));
    }
  return reopen(a);
}

export const only = (receipt: Forged, op: string, key?: string) => {
  const ops = receipt.delta.ops.filter(
    (o) => o.op === op && (!key || (o.fact as { key: string }).key === key),
  );
  assert.equal(ops.length, 1);
  return ops[0];
};
export const otherId = 'eeeeeeee-0000-4000-8000-000000000001';
