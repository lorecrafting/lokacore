// The local authority passes the invoked action_key to step (04 §19, ACT-09; R6P P5a), on Node with
// real SQLite (node:sqlite). The world is T's probe world (kernel/ts/test/ferry_probe.ts) with a
// `chat` talk alias whose policy fails. Expected codes are literals from 04 §19.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { at, chat, F, PRESENT, world } from '../../../kernel/ts/test/ferry_probe.ts';
import { openStory, type Saved } from './authority.ts';

/** A connection adapted to expo-sqlite's sync names, as local_story.test.ts. */
const adapt = (sql: DatabaseSync) => ({
  execSync: (s: string) => void sql.exec(s),
  runSync: (s: string, ...p: (string | number | null)[]) => sql.prepare(s).run(...p),
  getFirstSync: <T>(s: string, ...p: (string | number | null)[]) =>
    (sql.prepare(s).get(...p) ?? null) as T | null,
  getAllSync: <T>(s: string, ...p: (string | number | null)[]) => sql.prepare(s).all(...p) as T[],
  isInTransactionSync: () => sql.isTransaction,
});

// Breaks: the authority stepping without the key, so a failing chat on Bram is admitted through
// Bram's own talk while the GameView lists chat invalid_state.
test('openStory.invoke refuses a failing chat on Bram by its key', () => {
  const fresh = world((c) => (c.actions[`${F}:action/chat`] = chat({ op: 'not', item: PRESENT })));
  const kernel_version = `loka-kernel@${'0123456789'.repeat(4)}`;
  const o = openStory(adapt(new DatabaseSync(':memory:')), [{ content_hash: 'probe', fresh }], {
    kernel_version,
    newId: randomUUID,
  });
  assert.equal(o.kind, 'open');
  if (o.kind !== 'open') return;
  const invoke = (action_key: string, target_ids: string[]) => {
    const i = { invocation_id: randomUUID(), action_key, actor_id: fresh.character };
    const r = o.invoke({ ...i, target_ids, input: {} }) as Saved;
    const d = r.decision as { kind: string; error?: { code: string } };
    return d.error?.code ?? d.kind;
  };
  assert.equal(invoke('lantern', []), 'accepted');
  assert.equal(invoke('chat', [at(fresh, 'npc/bram')]), 'invalid_state');
});
