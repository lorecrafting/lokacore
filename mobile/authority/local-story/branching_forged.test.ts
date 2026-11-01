// Forged branching saves through real SQLite: each is refused at reload, or loads, plays one action
// and reopens with the literal state below (dialogue-save.ts).
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
  survives,
  refused,
  put,
  del,
  holder,
  quests,
  TOKEN,
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

// Breaks: the terminal row check reaching only one-way items, so a quest forged resolved as its
// hand-over answer, with no such answer saved, loads in either shape.
test('a quest forged resolved as its hand-over answer is refused', () => {
  const asGive = (g: Play) => {
    const [key, q] = quests(g);
    put(g.sql, 'quests', key, { ...q, state: 'resolved', outcome: 'give' });
  };
  refused(oneWay(), (g) => (g.choose('take'), accept(g)), asGive);
  refused(
    retakeQuest(),
    (g) => {
      g.choose('take');
      g.talk('a_back');
      g.choose('give');
      g.talk('b_offer');
      g.choose('job');
    },
    asGive,
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

// Breaks: a two-way item's holder chain not reaching a room or NPC. Each action on the item is then
// rejected for good and the bad row is saved again, so the item is lost.
test('a two-way item held by nothing, by itself, or with no row is refused', () => {
  const c = () => withToken({ guard: take(), back: give() });
  const taken = (g: Play) => g.choose('take');
  const token = (g: Play) => g.fresh.entityIds[TOKEN]!;
  refused(c(), taken, (g) => put(g.sql, 'containers', token(g), 'no-such-holder'));
  refused(c(), taken, (g) => put(g.sql, 'containers', token(g), token(g)));
  refused(c(), taken, (g) => {
    const row = g.sql.prepare('DELETE FROM state_row WHERE section=? AND key=?');
    assert.equal(row.run('containers', token(g)).changes, 1);
  });
});

// A second row and receipt for an answer already saved, so only the count can refuse it.
const answeredTwice = (g: Play, choice: string) => {
  const rows = g.sql.prepare('SELECT key, value FROM state_row WHERE section=?').all('choices');
  const row = rows.find((r) => JSON.parse(String(r.value)).choice_id === choice)!;
  const id = String(row.key);
  const copy = `${id}-copy`;
  g.sql
    .prepare('INSERT INTO state_row(section, key, value) VALUES (?, ?, ?)')
    .run('choices', copy, row.value);
  const receipts = g.sql.prepare('SELECT * FROM receipt').all();
  const r = receipts.find((x) => JSON.parse(String(x.command)).payload?.continuation_id === id)!;
  const command = JSON.parse(String(r.command));
  command.payload.continuation_id = copy;
  const values = {
    ...r,
    invocation_id: `${r.invocation_id}-copy`,
    command_id: `${r.command_id}-copy`,
    command: JSON.stringify(command),
  };
  const names = Object.keys(values);
  g.sql
    .prepare(`INSERT INTO receipt(${names}) VALUES (${names.map(() => '?')})`)
    .run(...(Object.values(values) as string[]));
};

// Breaks: a one-way item's answers not being counted, so one answer saved twice loads.
test('a one-way answer saved twice is refused', () => {
  const taken = (g: Play) => g.choose('take');
  const delivered = (g: Play) => {
    g.choose('take');
    accept(g);
    g.talk('z_q');
    g.choose('give');
  };
  refused(oneWay(), taken, (g) => answeredTwice(g, 'take'));
  refused(oneWay(), delivered, (g) => answeredTwice(g, 'give'));
});

// Breaks: a one-way item off its giver with no take behind it loading: moved with no answers, or
// delivered with the take's row removed.
test('a one-way item moved with no take is refused', () => {
  refused(
    oneWay(),
    () => {},
    (g) => put(g.sql, 'containers', g.fresh.entityIds[TOKEN]!, g.fresh.body),
  );
  refused(
    oneWay(),
    (g) => {
      g.choose('take');
      accept(g);
      g.talk('z_q');
      g.choose('give');
    },
    (g) => {
      const rows = g.sql.prepare('SELECT key, value FROM state_row WHERE section=?').all('choices');
      const row = rows.find((r) => JSON.parse(String(r.value)).choice_id === 'take')!;
      const gone = g.sql.prepare('DELETE FROM state_row WHERE section=? AND key=?');
      assert.equal(gone.run('choices', row.key).changes, 1);
    },
  );
});
