// Forged branching saves through real SQLite: each is refused at reload for a broken row or receipt,
// or loads, plays one action and reopens with the literal state below (dialogue-save.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  take,
  give,
  flag,
  oneWay,
  accept,
  retakeQuest,
  retakePlay,
  withToken,
  quest,
  survives,
  refused,
  put,
  del,
  holder,
  quests,
  TOKEN,
  line,
  talkTo,
  type Play,
} from './__tests__/branching-play.ts';

// Breaks: a forged holder on a two-way item throwing in the kernel at the next answer or reopen.
test('a two-way item with a forged holder keeps playing', () => {
  survives(
    withToken({ guard: take(), back: give() }),
    (g) => g.choose('take'),
    (g) =>
      put(
        g.sql,
        'containers',
        g.fresh.entityIds[TOKEN]!,
        g.fresh.entityIds['persuade_sampler@0.0.1:npc/guard'],
      ),
    (g) => {
      g.talk();
      g.choose('take');
    },
    (g) => assert.equal(holder(g), g.fresh.body),
  );
});

// Breaks: a forged fact a take and a give both write throwing at the next answer or reopen.
test('a two-way fact with a forged value keeps playing', () => {
  survives(
    withToken({ guard: take({ steps: [flag(true)] }), back: give({ steps: [flag(false)] }) }),
    (g) => g.choose('take'),
    (g) => put(g.sql, 'facts', '%gate_open%', false),
    (g) => {
      g.talk('back');
      g.choose('give');
    },
    (g) => assert.equal(holder(g), g.fresh.entityIds['persuade_sampler@0.0.1:npc/guard']),
  );
});

// Breaks: a one-way item whose quest row is deleted throwing at the next answer or reopen.
test('a held one-way item with its quest row deleted keeps playing', () => {
  survives(
    oneWay(),
    (g) => {
      g.choose('take');
      accept(g);
    },
    (g) => del(g.sql, 'quests'),
    (g) => {
      accept(g);
    },
    (g) => assert.equal(Object.values(g.story.world().state.quests ?? {})[0]?.state, 'active'),
  );
});

// Breaks: a one-way quest forged closed by its other answer throwing at the next action or reopen.
// A lawful decline looks the same without its row, so reload cannot tell them apart.
test('a one-way quest forged declined keeps playing', () => {
  survives(
    oneWay(),
    (g) => (g.choose('take'), accept(g)),
    (g) => {
      const [key, q] = quests(g);
      put(g.sql, 'quests', key, { ...q, state: 'resolved', outcome: 'decline' });
    },
    (g) => g.go('drop', {}, [g.fresh.entityIds[TOKEN]!]),
    (g) => assert.equal(quests(g)[1].outcome, 'decline'),
  );
});

// Breaks: an answered quest set back to active loading on a two-way item (general load checks).
test('a two-way item whose answered quest is set back to active is refused', () => {
  refused(retakeQuest(), retakePlay, (g) => {
    const [key, q] = quests(g);
    const { outcome: _, ...rest } = q;
    put(g.sql, 'quests', key, { ...rest, state: 'active' });
  });
});

// Breaks: a holder pointing at nothing, or no holder row, throwing at the next answer or reopen.
test('a two-way item held by nothing or with no row keeps playing', () => {
  const c = () => withToken({ guard: take(), back: give() });
  const taken = (g: Play) => g.choose('take');
  const token = (g: Play) => g.fresh.entityIds[TOKEN]!;
  const plays = (edit: (g: Play) => void, kept: (g: Play) => void) =>
    survives(c(), taken, edit, (g) => g.talk(), kept);
  plays(
    (g) => put(g.sql, 'containers', token(g), 'no-such-holder'),
    (g) => assert.equal(holder(g), 'no-such-holder'),
  );
  plays(
    (g) => {
      const row = g.sql.prepare('DELETE FROM state_row WHERE section=? AND key=?');
      assert.equal(row.run('containers', token(g)).changes, 1);
    },
    (g) => assert.equal(holder(g), undefined),
  );
});

// Breaks: a holder cycle reaching the kernel's holder walks, which never return, so launch hangs.
test('a two-way item held by itself is refused', () => {
  refused(
    withToken({ guard: take(), back: give() }),
    (g) => g.choose('take'),
    (g) => put(g.sql, 'containers', g.fresh.entityIds[TOKEN]!, g.fresh.entityIds[TOKEN]!),
  );
});

// A second row and receipt for an answer already saved, so only the count can refuse it.
const COPY = '44444444-5555-8666-8777-888888888888';
const answeredTwice = (g: Play, choice: string, swaps: [string, string][] = []) => {
  const rows = g.sql.prepare('SELECT key, value FROM state_row WHERE section=?').all('choices');
  const row = rows.find((r) => JSON.parse(String(r.value)).choice_id === choice)!;
  const id = String(row.key);
  const receipts = g.sql.prepare('SELECT * FROM receipt').all();
  const r = receipts.find((x) => JSON.parse(String(x.command)).payload?.continuation_id === id)!;
  const copied = (text: unknown) =>
    [[String(r.command_id), COPY], [id, COPY], ...swaps].reduce(
      (out, [from, to]) => out.replaceAll(from, to),
      String(text),
    );
  g.sql
    .prepare('INSERT INTO state_row(section, key, value) VALUES (?, ?, ?)')
    .run('choices', COPY, copied(row.value));
  const values = {
    ...r,
    invocation_id: COPY,
    command_id: COPY,
    command: copied(r.command),
    response: copied(r.response),
  };
  const names = Object.keys(values);
  g.sql
    .prepare(`INSERT INTO receipt(${names}) VALUES (${names.map(() => '?')})`)
    .run(...(Object.values(values) as string[]));
};

// Breaks: a duplicate answer row and receipt throwing at the next action or reopen.
test('a one-way answer saved twice keeps playing', () => {
  survives(
    oneWay(),
    (g) => g.choose('take'),
    (g) => answeredTwice(g, 'take'),
    (g) => g.go('drop', {}, [g.fresh.entityIds[TOKEN]!]),
    (g) => assert.equal(holder(g), g.story.world().state.containers[g.fresh.body]),
  );
});

// Breaks: a one-way item off its giver with no answer behind it throwing at the next action or reopen.
test('a one-way item moved with no take keeps playing', () => {
  survives(
    oneWay(),
    () => {},
    (g) => put(g.sql, 'containers', g.fresh.entityIds[TOKEN]!, g.fresh.body),
    (g) => g.go('drop', {}, [g.fresh.entityIds[TOKEN]!]),
    (g) => assert.equal(holder(g), g.story.world().state.containers[g.fresh.body]),
  );
});

// Breaks: the early return skipping a forged escort row when no dialogue can start an escort.
test('an escort row in a world with no escort answer is refused', () => {
  refused(
    withToken({ guard: talkTo({ leave: line }) }),
    (g) => g.choose('leave'),
    (g) =>
      g.sql
        .prepare('INSERT INTO state_row(section, key, value) VALUES (?, ?, ?)')
        .run('escorts', g.story.world().character, '{"forged":true}'),
  );
});

// Breaks: a dropped clause in checkRow: a row bound to another actor, beat or item, a forged attempt
// count, or a choice on a row still open, each loading and moving the wrong thing.
test('a dialogue row that does not bind is refused', async (t) => {
  const row = (g: Play) => Object.entries(g.story.world().state.choices!)[0]!;
  const forge = (g: Play, change: (r: any) => object) => {
    const [id, value] = row(g);
    put(g.sql, 'choices', id, { ...value, ...change(value) });
  };
  const c = withToken({ guard: take(), back: give() });
  // An open row: a resolved one is also caught by its receipt, hiding these clauses.
  const cases: [string, (r: any, g: Play) => object][] = [
    ['actor', (_, g) => ({ actor_id: g.fresh.entityIds[TOKEN] })],
    ['beat', () => ({ beat: 'back' })],
    ['bindings', (r) => ({ roles: r.roles.filter((b: any) => b.role !== 'token') })],
    ['attempts', () => ({ attempts: 1 })],
    ['choice on an open row', () => ({ choice_id: 'take' })],
  ];
  for (const [name, change] of cases)
    await t.test(name, () =>
      refused(
        c,
        () => {},
        (g) => forge(g, (r) => change(r, g)),
      ),
    );
});
