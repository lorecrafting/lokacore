// Branching dialogue (mechanics.md dialogue@1) through real SQLite on an edited persuade sampler: a
// conversation paused at a linked dialogue, after a passed or failed check and after a state-picked
// reply, reopens from its receipts (dialogue-save.ts, dialogue-receipt.ts).
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  const go = (command: string, input: object = {}, target_ids: string[] = []) => {
    const set = resolved(story.world(), fresh.character);
    const action_key = Object.keys(set).find((k) => set[k]!.command === command)!;
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
  go('talk', {}, [fresh.entityIds['persuade_sampler@0.0.1:npc/guard']!]);
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
  return { ...p, at, choose, receiptHolds };
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
