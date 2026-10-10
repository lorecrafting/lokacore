// Toolbox row W2 fact rows through real SQLite on cartridges/scoped_facts_sampler: pair and entity
// rows survive cold reopen and replay, and a forged fact row is save_corrupt (facts-save.ts;
// docs/system/save.md, Scoped fact recovery).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { decode, encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';
import { openStory } from './authority.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const SAMPLER = join(root, 'cartridges/scoped_facts_sampler');

// The sampler compiled (after `change` edits a copy of its sources), and one release of it.
function build(change?: (dir: string) => void) {
  const scratch = mkdtempSync(join(tmpdir(), 'loka-scoped-facts-save-'));
  try {
    const src = change ? join(scratch, 'src') : SAMPLER;
    if (change) {
      cpSync(SAMPLER, src, { recursive: true });
      change(src);
    }
    const file = join(scratch, 'artifact.json');
    execFileSync('mix', ['loka.compile', src, file], { cwd: root, stdio: 'pipe' });
    const artifact = JSON.parse(readFileSync(file, 'utf8'));
    const loaded = loadCartridge(new TextEncoder().encode(JSON.stringify(artifact)), INSTALLED);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded));
    const bundle = {
      canonical: encode(artifact.cartridge),
      sha256: artifact.content_hash as string,
    };
    const initial = newWorld(
      loaded.cartridge as Cartridge,
      '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
      [1, 2, 3, 4],
    );
    return {
      initial,
      bundle,
      releases: [{ fresh: initial, content_hash: bundle.sha256 }] as const,
    };
  } finally {
    rmSync(scratch, { recursive: true });
  }
}
type Release = ReturnType<typeof build>;
const base = build();
const S = 'scoped_facts_sampler@0.0.1';
const id = (k: string, r: Release = base) => r.initial.entityIds[`${S}:${k}`]!;
const fact = (key: string) =>
  ({
    cartridge_id: 'scoped_facts_sampler',
    cartridge_version: '0.0.1',
    kind: 'fact',
    key,
  }) as const;
const read = (w: World, key: string, who: string) =>
  value(w, w.character, fact(key) as never, w.entityIds[`${S}:${who}`] as never);

// One save file in a fresh directory: invocations that save, cold reopen and replay once.
function save(t: TestContext, name: string, r: Release = base) {
  const { releases, bundle, initial } = r;
  const dir = mkdtempSync(join(tmpdir(), 'loka-scoped-facts-saves-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, `${name}.db`);
  const open = () => {
    const s = openStory(h.p.db, releases, h.p.host);
    if (s.kind !== 'open') throw new Error(s.kind);
    return s;
  };
  const h = { p: elapsedHost(path, undefined, bundle), n: 0 } as any;
  h.story = open();
  h.reopen = () => {
    h.p.sql.close();
    h.p = elapsedHost(path, undefined, bundle);
    h.story = open();
  };
  h.run = (action_key: string, target_ids: string[] = [], input = {}) => {
    const i = {
      invocation_id: `dddddddd-4747-4777-8777-${String(++h.n).padStart(12, '0')}`,
      actor_id: initial.character,
      action_key,
      target_ids,
      input,
    };
    assert.equal(h.story.invoke(i).kind, 'saved', action_key);
    h.reopen();
    const again = h.story.invoke(i);
    assert.equal(again.kind === 'saved' && again.replay, true, action_key);
  };
  // Talk to `who` by dialogue `talk` (its key is the talk action), then pick `choice_id`.
  h.chat = (who: string, choice_id: string, talk = `${who}_talk`, input = {}) => {
    h.run(talk, [id(`npc/${who}`, r)]);
    const rows = Object.entries(h.story.world().state.choices ?? {}) as [string, any][];
    const continuation_id = rows.find(([, row]) => row.status === 'pending')![0];
    h.run('choose', [], { choice_id, continuation_id, ...input });
  };
  return h;
}

// Breaks: the facts section drops the subject on write or reopen (the smith's rows read back as
// shared or default), or a talk, choose or give receipt replays into a second write.
test('pair and entity fact rows survive cold reopen and replay', (t) => {
  const h = save(t, 'reopen');
  h.chat('smith', 'greet');
  h.chat('smith', 'help');
  h.run('take', [id('item/apple')]);
  h.run('give', [id('item/apple'), id('npc/smith')]);
  const w = h.story.world();
  const smith = ['times_met', 'trust', 'fed'].map((k) => read(w, k, 'npc/smith'));
  assert.deepEqual(smith, [1, 1, true]);
  assert.deepEqual([read(w, 'times_met', 'npc/miller'), read(w, 'fed', 'npc/miller')], [0, false]);
  h.p.sql.close();
});

// Breaks (facts-save.ts): a forged fact row loads and is read or faults later instead of giving
// typed save_corrupt: a pair row without its subject, a subject that is no NPC, item or detail, a
// row of another character, a key with an extra field or in non-canonical text, or an untyped value.
test('a forged fact row is save_corrupt', (t) => {
  const h = save(t, 'forged');
  h.chat('smith', 'greet');
  const sql = h.p.sql;
  const row = sql.prepare("SELECT key, value FROM state_row WHERE section='facts'").get()!;
  const target = JSON.parse(JSON.stringify(decode(String(row.key))));
  const write = (key: string, v: string) => {
    sql.prepare("DELETE FROM state_row WHERE section='facts'").run();
    sql.prepare("INSERT INTO state_row VALUES ('facts', ?, ?)").run(key, v);
  };
  const opened = () => openStory(h.p.db, base.releases, h.p.host).kind;
  const { subject_id: _, ...bare } = target;
  for (const [key, v] of [
    [encode(bare), '1'],
    [encode({ ...target, subject_id: '00000000-0000-4000-8000-0000000000ff' }), '1'],
    [encode({ ...target, scope: { ...target.scope, character_id: id('npc/miller') } }), '1'],
    [encode({ ...target, extra: 1 }), '1'],
    [JSON.stringify(target, null, 1), '1'],
    [String(row.key), '-1'],
  ]) {
    write(key, v);
    assert.equal(opened(), 'save_corrupt', key + v);
  }
  write(String(row.key), String(row.value));
  assert.equal(opened(), 'open');
  sql.close();
});

// The sampler with entity-fact writes in choices that save recovery re-checks (dialogue-receipt.ts
// detailNeeded): a riddle answer (the stranger), a choice that also acquires a skill (the miller)
// and a dialogue of a quest with a generic deadline (the smith's errand). Each assigns trust 2.
const put = (dir: string, file: string, o: object) => {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), JSON.stringify(o));
};
const json = (dir: string, file: string, edit: (o: any) => object) =>
  put(dir, file, edit(JSON.parse(readFileSync(join(dir, file), 'utf8'))));
const trust2 = { op: 'fact.assign', fact: 'trust', value: 2 };
const all = { policy_version: 1, root: { op: 'all', items: [] } };
const variant = build((dir) => {
  json(dir, 'cartridge.json', (c) => {
    Object.assign(c.requires.capabilities, { skills: 1, quest: 1 });
    return c;
  });
  json(dir, 'dialogues/stranger_talk.json', (d) => {
    d.riddle = { choice_id: 'help', answer: 'ab', bank: ['A', 'B'], wrong: 'narration.talk.greet' };
    d.choices.help.sequence = [trust2];
    return d;
  });
  json(dir, 'dialogues/miller_talk.json', (d) => {
    d.choices.help.sequence = [{ op: 'skill.acquire', skill: 'pick' }, trust2];
    return d;
  });
  json(dir, 'text.json', (t) => ({
    ...t,
    'skill.pick': 'Lockpicking.',
    'quest.errand': 'Errand.',
  }));
  put(dir, 'skills/pick.json', {
    label: 'skill.pick',
    requirement: 'skill.pick',
    qualification: all,
  });
  put(dir, 'quests/errand.json', {
    title: 'quest.errand',
    offer: { label: 'quest.errand', policy: all },
    objective: { evidence: 'current_state', policy: all },
    deadline: { after: 120000, outcome: 'late' },
  });
  put(dir, 'dialogues/smith_errand.json', {
    npc: 'smith',
    policy: { policy_version: 1, root: { op: 'quest_state', quest: 'errand', state: 'active' } },
    prompt: 'dialogue.talk.prompt',
    roles: { smith: { role: 'npc', npc: 'smith' } },
    quest: 'errand',
    choices: {
      done: { label: 'dialogue.talk.help', narration: 'narration.talk.help', sequence: [trust2] },
    },
  });
});

// Breaks (dialogue-consequences.ts): recovery checks a re-checked choice's fact.assign and its
// fact_changed without the speaker's subject_id, so its own legitimate receipt reopens as
// save_corrupt, or at a subject other than the speaker's.
test('entity-fact writes in riddle, skill and deadline-quest choices reopen', (t) => {
  const h = save(t, 'rechecked', variant);
  h.chat('stranger', 'help', 'stranger_talk', { answer: 'ab' });
  h.chat('miller', 'help');
  h.run('errand');
  h.chat('smith', 'done', 'smith_errand');
  const w = h.story.world();
  const trust = ['stranger', 'miller', 'smith'].map((who) => read(w, 'trust', `npc/${who}`));
  assert.deepEqual(trust, [2, 2, 2]);
  h.p.sql.close();
});

// Breaks (dialogue-consequences.ts): recovery takes the subject from the receipt instead of the
// dialogue's speaker, or skips the op's subject, so a receipt whose write moved to another NPC
// (the op alone, or the op and its fact_changed) loads.
test('a receipt writing at another subject than the speaker is save_corrupt', (t) => {
  for (const moved of ['op', 'events']) {
    const h = save(t, moved, variant);
    h.chat('stranger', 'help', 'stranger_talk', { answer: 'ab' });
    const sql = h.p.sql;
    const rows = sql
      .prepare("SELECT command_id, response FROM receipt WHERE response LIKE '%subject_id%'")
      .all();
    assert.equal(rows.length, 1);
    const miller = id('npc/miller', variant);
    const response = JSON.parse(String(rows[0].response));
    response.delta.ops.find((o: any) => o.op === 'fact.assign').subject_id = miller;
    if (moved === 'events')
      response.events.find((e: any) => e.payload.type === 'fact_changed').payload.subject_id =
        miller;
    sql
      .prepare('UPDATE receipt SET response=? WHERE command_id=?')
      .run(JSON.stringify(response), rows[0].command_id);
    assert.throws(
      () => h.reopen(),
      (e: any) => e.cause.kind === 'save_corrupt',
      moved,
    );
  }
});
