// Branching dialogue (mechanics.md dialogue@1) through real SQLite on an edited persuade sampler: a
// conversation paused at a linked dialogue, after a passed or failed check and after a state-picked
// reply, reopens from its receipts (dialogue-save.ts, dialogue-receipt.ts).
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { resolved } from '../../../kernel/ts/src/commands/actions.ts';
import { refString } from '../../../kernel/ts/src/runtime/decision.ts';
import { pending } from '../../../kernel/ts/src/mechanics/dialogue/shared.ts';
import { compiled } from './__tests__/compiled.ts';
import { openStory } from './authority.ts';
import { coldReopen } from './__tests__/elapsed-host.test.ts';
import {
  LABEL,
  SAID,
  VARIANT,
  talkTo,
  line,
  flag,
  take,
  give,
  retakeQuest,
  retakePlay,
  oneWay,
  accept,
  run,
  withToken,
  reopened,
  takeGive,
} from './__tests__/branching-play.ts';

function build(cha: number) {
  const src = mkdtempSync(join(tmpdir(), 'loka-branching-src-'));
  cpSync(fileURLToPath(new URL('../../../cartridges/persuade_sampler', import.meta.url)), src, {
    recursive: true,
  });
  const write = (name: string, choices: object) =>
    writeFileSync(join(src, `dialogues/${name}.json`), JSON.stringify(talkTo(choices)));
  const guard = JSON.parse(readFileSync(join(src, 'dialogues/guard.json'), 'utf8'));
  const persuade = guard.choices.persuade;
  delete persuade.steps;
  write('guard', { persuade: { ...persuade, then: 'won', then_failed: 'lost' } });
  write('won', {
    w: {
      label: LABEL,
      narration: SAID,
      narration_variants: [
        { when: { op: 'fact_compare', fact: 'gate_open', equals: false }, description: VARIANT },
      ],
      then: 'deep',
    },
  });
  write('deep', { d: { label: LABEL, narration: SAID } });
  write('lost', { l: { label: LABEL, narration: SAID } });
  const npc = JSON.parse(readFileSync(join(src, 'npcs/guard.json'), 'utf8'));
  npc.attributes[0].value = cha;
  writeFileSync(join(src, 'npcs/guard.json'), JSON.stringify(npc));
  const c = compiled(src);
  rmSync(src, { recursive: true });
  return c;
}

// Breaks: the receipt check holding a nested row to the opening dialogue's key or its narration to
// the plain line (dialogue-receipt.ts), so a custody or escort save past the first answer is
// save_corrupt.
test('a talk saved at each linked step reopens, with the variant reply on the receipt', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-branching-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const c = build(5);
  const walks: [string[], unknown, string?][] = [
    [['persuade'], ['won', ['w']]],
    [['persuade', 'w'], ['deep', ['d']], VARIANT],
    [['persuade', 'w', 'd'], undefined],
  ];
  for (const [i, [picks, expected, said]] of walks.entries()) {
    const path = join(dir, `${i}.db`);
    const g = run(path, c);
    assert.deepEqual(g.at()?.slice(1), ['guard', ['persuade']]);
    const last = picks.map((pick) => g.choose(pick)).at(-1);
    assert.deepEqual(g.at()?.slice(1), expected);
    if (said) assert.equal(last.narration[0].key, said);
    assert.ok(g.receiptHolds());
    g.sql.close();
    coldReopen(path, c);
  }
});

// Breaks: a failed check's closed row and its then_failed row in one commit not surviving a reopen.
test('a talk saved after a failed check reopens at then_failed', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-branching-failed-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'lost.db');
  const c = build(99);
  const g = run(path, c);
  g.choose('persuade');
  assert.deepEqual(g.at()?.slice(1), ['lost', ['l']]);
  g.sql.close();
  coldReopen(path, c);
});

// Breaks: a non-quest hand_over of a Give-restricted item read as a corrupt custody path, so an
// ordinary answer makes the next load save_corrupt for good (dialogue-save.ts).
test('a save reopens after a Give-restricted item is handed back and taken again', () => {
  const c = withToken({ guard: take(), back: give() });
  reopened(c, takeGive);
  reopened(c, (g) => {
    takeGive(g);
    g.talk();
    g.choose('take');
    assert.equal(g.at(), undefined);
  });
});

// Breaks: a take and a give-back read as disagreeing because they set one fact differently.
test('a save reopens after a take sets a fact and the give clears it', () => {
  reopened(
    withToken({ guard: take({ steps: [flag(true)] }), back: give({ steps: [flag(false)] }) }),
    takeGive,
  );
});

// Breaks: receipt evidence failing on a narrate step, which sets no fact, on a saved custody answer.
test('a save reopens after a narrate step on a Give-restricted receive', () => {
  reopened(withToken({ guard: take({ steps: [{ op: 'narrate', text: SAID }] }) }), (g) => {
    g.choose('take');
  });
});

// Breaks: learning a skill with a narrate step refused at reload as an assignment without evidence.
test('a save reopens after a narrate step on a skill.acquire answer', () => {
  const steps = [
    { op: 'skill.acquire', skill: 'intimidate' },
    { op: 'narrate', text: SAID },
  ];
  reopened(withToken({ guard: talkTo({ learn: { ...line, steps } }) }), (g) => g.choose('learn'));
});

// Breaks: walking the hand-overs in dialogue key order, so a give (a_back) then a retake then a
// quest hand_over (z_q) reads as a second completion and refuses the lawful save.
test('a save reopens after a retake and a quest hand_over', () => {
  reopened(retakeQuest(), (g) => {
    retakePlay(g);
    assert.equal(g.at(), undefined);
  });
});

// Breaks: one-way inference refusing what branching makes lawful: a quest taken after the item, a
// receive and a delivery writing one fact differently, or a quest closed by another answer.
test('a one-way item reopens taken before the quest, delivered, or declined', () => {
  const c = oneWay();
  reopened(c, (g) => g.choose('take'));
  for (const answer of ['give', 'decline'])
    reopened(c, (g) => {
      g.choose('take');
      accept(g);
      g.talk('z_q');
      g.choose(answer);
      assert.equal(g.at(), undefined);
    });
});

// Breaks: the row's own receipt going unchecked, so a save claiming a Give-restricted item moved
// with no committed answer behind it loads.
test('a resolved take or give with no receipt is refused at reload', () => {
  const c = withToken({ guard: take(), back: give() });
  for (const [plays, gone] of [
    [1, 'take'],
    [3, 'give'],
  ] as const) {
    const dir = mkdtempSync(join(tmpdir(), 'loka-branching-'));
    const path = join(dir, 'save.db');
    const g = run(path, c);
    g.choose('take');
    if (plays === 3) {
      g.talk('back');
      g.choose('give');
    }
    const receipts = g.sql.prepare('SELECT command_id, command FROM receipt').all();
    const row = receipts.find((r) => JSON.parse(String(r.command)).payload.choice_id === gone)!;
    g.sql.prepare('DELETE FROM receipt WHERE command_id = ?').run(row.command_id as string);
    g.sql.close();
    assert.throws(() => coldReopen(path, c));
    rmSync(dir, { recursive: true, force: true });
  }
});
