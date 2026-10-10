// Toolbox row 14 on the compiled persuade sampler: a dialogue choice's opposed check. The player
// (cha 6) talks the guard (cha 5) round; Lean on the guard (intimidate, untaught, growth [1, 2],
// rating 1) fails at level 0, closes the conversation, and passes in a new talk at level 1.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { encode } from '../src/foundation/canonical.ts';
import { choiceView } from '../src/mechanics/dialogue/shared.ts';
import { checkKeys } from '../src/content/cartridge_recipes.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-persuade-'));
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
const P = 'persuade_sampler@0.0.1';
const source = JSON.parse(new TextDecoder().decode(artifact)).cartridge;

function load(c: unknown) {
  const canonical = encode(c as never);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
}

function play(c: unknown) {
  const loaded = load(c);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  let w: World = newWorld(
    loaded.cartridge as Cartridge,
    '4c5e7a9b-1d2f-4a6b-8c0d-2e4f6a8b0c1e' as never,
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
    const r = step(w, command as never, n);
    w = r.world;
    return r.decision as any;
  };
  const pending = () =>
    Object.entries(w.state.choices ?? {}).find(([, r]) => r.status === 'pending')?.[0];
  const talk = () => {
    const d = send({ type: 'talk', target_id: w.entityIds[`${P}:npc/guard`] });
    assert.equal(d.kind, 'accepted', JSON.stringify(d));
    return pending()!;
  };
  const choose = (continuation_id: string, choice_id: string) =>
    send({ type: 'choose', continuation_id, choice_id });
  const fact = (key: string) =>
    Object.entries(w.state.facts ?? {}).find(([k]) => k.includes(`"${key}"`))?.[1];
  const entity = (ref: string) => w.entityIds[ref];
  return { talk, choose, fact, entity, view: () => choiceView(w, w.character), pending };
}

// Breaks: the check reads the actor's cha as the rating or the guard's start (6 vs 6 passes either
// way, so the guard at 7 must fail), or `>=` becomes `>`; or the hub reopens after a pass, so the
// checked choice can be chosen again for free uses.
test('cha 6 talks the guard (cha 5) round; the same words fail on a guard of cha 7', () => {
  const g = play(source);
  const d = g.choose(g.talk(), 'persuade');
  assert.equal(d.outcome, 'persuade');
  assert.deepEqual(
    d.events.map((e: any) => [e.position, e.payload.type, e.payload.check?.key]),
    [
      [1, 'check_passed', 'persuade_guard'],
      [2, 'fact_changed', undefined],
      [3, 'choice_resolved', undefined],
    ],
  );
  assert.equal(g.fact('gate_open'), true);
  assert.equal(g.view(), undefined);
  const strong = structuredClone(source);
  strong.npcs[`${P}:npc/guard`].attributes[0].value = 7;
  const s = play(strong);
  assert.equal(s.choose(s.talk(), 'persuade').outcome, 'check_failed');
  const even = structuredClone(source);
  even.npcs[`${P}:npc/guard`].attributes[0].value = 6;
  const e = play(even);
  assert.equal(e.choose(e.talk(), 'persuade').outcome, 'persuade');
});

// Breaks: the check event names the speaker as its subject when the check names another NPC.
test('a check naming another NPC makes that NPC its subject', () => {
  const c = structuredClone(source);
  const captain = `${P}:npc/captain`;
  c.npcs[captain] = { ...c.npcs[`${P}:npc/guard`], key: 'captain' };
  c.dialogues[`${P}:dialogue/guard`].choices.persuade.check.npc.key = 'captain';
  const g = play(c);
  const d = g.choose(g.talk(), 'persuade');
  assert.equal(d.events[0].payload.subject_id, g.entity(captain));
});

// Breaks: a failure applies the choice's sequence, resolves the choice (choice_resolved), keeps
// the conversation open so the same sitting retries, skips the use, names the actor (not the
// speaker) as the check's subject, or GameView still offers a
// choice the choose would refuse; or a use is not counted, so the second talk fails again.
test('a failed check reads its failure line, closes the talk, counts a use; a new talk passes', () => {
  const g = play(source);
  const first = g.talk();
  const d = g.choose(first, 'intimidate');
  assert.equal(d.outcome, 'check_failed');
  assert.deepEqual(
    d.events.map((e: any) => [e.position, e.payload.type]),
    [
      [1, 'check_failed'],
      [2, 'fact_changed'],
    ],
  );
  assert.equal(d.events[0].payload.subject_id, g.entity(`${P}:npc/guard`));
  assert.equal(d.narration[0].key, 'narration.guard.intimidate_failed');
  assert.equal(g.fact('gate_open'), undefined);
  assert.equal(g.fact('uses_intimidate'), 1);
  assert.equal(g.view(), undefined);
  assert.deepEqual(g.choose(first, 'intimidate'), {
    kind: 'rejected',
    error: { code: 'invalid_state' },
  });
  const again = g.choose(g.talk(), 'intimidate');
  assert.equal(again.outcome, 'intimidate');
  assert.equal(again.events[0].payload.type, 'check_passed');
  assert.equal(g.fact('gate_open'), true);
  assert.equal(g.fact('uses_intimidate'), 2);
});

// Breaks: the loader (twin of lib/loka/content/choice_checks.ex) drops a row 14 rule, so an
// unsound check loads and fails or misbehaves in play.
test('the loader refuses each unsound dialogue choice check', () => {
  const guard = `${P}:dialogue/guard`;
  const at = `.cartridge.dialogues[${JSON.stringify(guard)}].choices`;
  const persuade = (c: any) => c.dialogues[guard].choices.persuade;
  const rows: [(c: any) => void, string, string][] = [
    [(c) => delete persuade(c).check.npc, 'SCHEMA_VIOLATION', `${at}.persuade.check`],
    [(c) => (persuade(c).check.rating = 3), 'SCHEMA_VIOLATION', `${at}.persuade.check`],
    [
      (c) => delete c.npcs[`${P}:npc/guard`].attributes,
      'SCHEMA_VIOLATION',
      `${at}.persuade.check.npc`,
    ],
    [
      (c) => (persuade(c).check.failure = 'missing'),
      'UNRESOLVED_REFERENCE',
      `${at}.persuade.check.failure`,
    ],
    [
      (c) => (persuade(c).check.key = 'intimidate_guard'),
      'DUPLICATE_DEFINITION',
      `${at}.intimidate.check`,
    ],
    [(c) => (persuade(c).exchange = true), 'OUTCOME_MISMATCH', `${at}.persuade.check`],
    [
      (c) =>
        (c.dialogues[guard].riddle = {
          choice_id: 'leave',
          answer: 'x',
          bank: ['X'],
          wrong: 'dialogue.guard.leave',
        }),
      'OUTCOME_MISMATCH',
      `${at}.intimidate.check`,
    ],
    [
      (c) =>
        persuade(c).sequence.push({
          op: 'skill.acquire',
          skill: c.dialogues[guard].choices.intimidate.check.skill,
        }),
      'OUTCOME_MISMATCH',
      `${at}.persuade.check`,
    ],
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.46'),
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
    [
      (c) => {
        delete c.manifest.requires.capabilities.check;
        delete c.lock.capabilities.check;
      },
      'UNDECLARED_CAPABILITY',
      `${at}.intimidate.check`,
    ],
  ];
  for (const [change, code, path] of rows) {
    const c = structuredClone(source);
    change(c);
    const r = load(c);
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [code, path], path);
  }
});

// Breaks: the duplicate-key scan drops recipes or choices, so a recipe and a dialogue choice (one
// check DefinitionRef) both define one key and load.
test('check keys gather every recipe check and every dialogue choice check', () => {
  const c = {
    recipes: { a: { check: { key: 'k' } }, b: {} },
    dialogues: { d: { choices: { x: { check: { key: 'k' } }, y: {} } } },
  };
  assert.deepEqual(checkKeys(c), ['k', 'k']);
});
