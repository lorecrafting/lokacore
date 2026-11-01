// Branching dialogue (mechanics.md dialogue@1) through real SQLite on an edited persuade sampler: a
// conversation paused at a linked dialogue, after a passed or failed check and after a state-picked
// reply, reopens from its receipts (dialogue-save.ts, dialogue-receipt.ts).
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
import { dialogueDetail } from './dialogue-receipt.ts';
import { coldReopen, elapsedHost } from './__tests__/elapsed-host.test.ts';

const LABEL = 'dialogue.guard.persuade';
const SAID = 'narration.guard.persuade';
const VARIANT = 'narration.guard.intimidate';
const talkTo = (choices: object) => ({
  npc: 'guard',
  prompt: 'dialogue.guard.prompt',
  roles: { guard: { role: 'npc', npc: 'guard' } },
  choices,
});

// The guard's charisma decides the opposed check: 5 loses to the player's 6, 99 beats it.
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

function run(path: string, c: ReturnType<typeof compiled>) {
  const l = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${c.canonical},"content_hash":"${c.sha256}"}`),
    INSTALLED,
  );
  if (!l.ok) throw new Error(JSON.stringify(l));
  const fresh = newWorld(
    l.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  const p = elapsedHost(path, undefined, c);
  const story = openStory(p.db, [{ fresh, content_hash: c.sha256 }], p.host);
  if (story.kind !== 'open') throw new Error(JSON.stringify(story));
  let n = 0;
  const go = (command: string, input: object = {}, target_ids: string[] = [], only?: string) => {
    const set = resolved(story.world(), fresh.character);
    const action_key = Object.keys(set).find(
      (k) => set[k]!.command === command && (!only || k.includes(only)),
    )!;
    const r = story.invoke({
      invocation_id: `aaaaaaaa-1414-4414-8414-${String(++n).padStart(12, '0')}`,
      actor_id: fresh.character,
      action_key,
      target_ids,
      input,
    });
    assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted', JSON.stringify(r));
    return (r as any).decision;
  };
  const at = () => {
    const found = pending(story.world(), fresh.character);
    return found && [found[0], found[1].beat, found[1].choice_ids];
  };
  const choose = (choice_id: string) => {
    const [continuation_id] = at()!;
    return go('choose', { choice_id, continuation_id });
  };
  const talk = (only = 'guard') =>
    go('talk', {}, [fresh.entityIds['persuade_sampler@0.0.1:npc/guard']!], only);
  talk();
  // The receipt check runs only on an answer with a save-visible consequence (detailNeeded), so
  // the sampler's answer is read as one that starts a patrol.
  const receiptHolds = () => {
    const r = p.sql
      .prepare('SELECT command_id, command, response FROM receipt ORDER BY revision DESC LIMIT 1')
      .get()!;
    const command = JSON.parse(String(r.command));
    const world = structuredClone(story.world());
    const row = world.state.choices![command.payload.continuation_id]!;
    const dialogue = world.cartridge.dialogues![refString(row.source)]!;
    Object.assign(dialogue.choices[command.payload.choice_id]!, { patrol: {} });
    return dialogueDetail(
      { world } as never,
      r.command_id as string,
      command,
      JSON.parse(String(r.response)),
    );
  };
  return { ...p, at, choose, talk, receiptHolds };
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

const line = { label: LABEL, narration: SAID };
const flag = (value: boolean) => ({ op: 'fact.assign', fact: 'gate_open', value });

// The sampler with a Give-restricted token on the guard and the given dialogues beside guard.json.
function withToken(dialogues: Record<string, object>, quests: Record<string, object> = {}) {
  const src = mkdtempSync(join(tmpdir(), 'loka-branching-src-'));
  cpSync(fileURLToPath(new URL('../../../cartridges/persuade_sampler', import.meta.url)), src, {
    recursive: true,
  });
  mkdirSync(join(src, 'items'));
  writeFileSync(
    join(src, 'items/token.json'),
    JSON.stringify({
      keywords: ['token'],
      name: LABEL,
      room_line: LABEL,
      description: LABEL,
      location: { in: 'npc', npc: 'guard' },
      give_allowed: false,
    }),
  );
  for (const [name, d] of Object.entries(dialogues))
    writeFileSync(join(src, `dialogues/${name}.json`), JSON.stringify(d));
  if (Object.keys(quests).length) {
    mkdirSync(join(src, 'quests'));
    const manifest = JSON.parse(readFileSync(join(src, 'cartridge.json'), 'utf8'));
    manifest.requires.capabilities.quest = 1;
    writeFileSync(join(src, 'cartridge.json'), JSON.stringify(manifest));
  }
  for (const [name, q] of Object.entries(quests))
    writeFileSync(join(src, `quests/${name}.json`), JSON.stringify(q));
  const c = compiled(src);
  rmSync(src, { recursive: true });
  return c;
}

const tokenTalk = (choices: object, has: boolean) => ({
  ...talkTo(choices),
  roles: { guard: { role: 'npc', npc: 'guard' }, token: { role: 'item', item: 'token' } },
  policy: has
    ? { op: 'has_item', item: 'token' }
    : { op: 'not', item: { op: 'has_item', item: 'token' } },
});
const take = (extra: object = {}) =>
  tokenTalk({ take: { ...line, receive: { item: 'token', from: 'guard' }, ...extra } }, false);
const give = (extra: object = {}) =>
  tokenTalk({ give: { ...line, hand_over: { item: 'token', to: 'guard' }, ...extra } }, true);

function reopened(c: ReturnType<typeof compiled>, play: (g: ReturnType<typeof run>) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-branching-'));
  try {
    const path = join(dir, 'save.db');
    const g = run(path, c);
    play(g);
    g.sql.close();
    coldReopen(path, c);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const takeGive = (g: ReturnType<typeof run>) => {
  g.choose('take');
  g.talk('back');
  g.choose('give');
};

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
  const quest = {
    name: LABEL,
    objective: { evidence: 'current_state', policy: { op: 'has_item', item: 'token' } },
    journal: {
      active: LABEL,
      objectives_met: LABEL,
      resolved: LABEL,
      failed: LABEL,
      abandoned: LABEL,
    },
  };
  const open = { op: 'fact_compare', fact: 'gate_open', equals: true };
  const accepted = { op: 'quest_state', quest: 'job', state: 'active' };
  const c = withToken(
    {
      guard: take(),
      a_back: {
        ...give({ steps: [flag(true)] }),
        policy: {
          op: 'all',
          items: [
            { op: 'has_item', item: 'token' },
            { op: 'not', item: open },
          ],
        },
      },
      b_offer: {
        ...talkTo({ job: { ...line, accept: 'job' } }),
        policy: { op: 'all', items: [open, { op: 'not', item: accepted }] },
      },
      z_q: {
        ...give(),
        quest: 'job',
        policy: { op: 'all', items: [{ op: 'has_item', item: 'token' }, open] },
      },
    },
    { job: quest },
  );
  reopened(c, (g) => {
    g.choose('take');
    g.talk('a_back');
    g.choose('give');
    g.talk('b_offer');
    g.choose('job');
    g.talk();
    g.choose('take');
    g.talk('z_q');
    g.choose('give');
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
