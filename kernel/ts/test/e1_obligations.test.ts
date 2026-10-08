import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { read } from './read.ts';
import { admitCandidate } from './e1_policy.ts';
import { caseHost, coverage, witnessedObligations } from './e1_case_host.ts';
import { checkDispositions, checkRefusals, obligationReport, replayCase } from './e1_cases.ts';
import { REFUSALS } from './e1_refusals.ts';
import { creditedPolicyPaths, objectivePaths } from './e1_obligations.ts';
import { maudsCellar } from './e1_maud.ts';
import { chandlersDebt } from './e1_optional_quests.ts';
import { hash } from '../src/foundation/canonical.ts';
import { gameView, newWorld } from '../src/index.ts';
import { key } from '../src/foundation/compose.ts';
import type { Key, Policy, WorldContextId } from '../src/contracts.gen.ts';

const pin = read('protocol/fixtures/missing_child_v042_hash.json');
const bytes = new TextEncoder().encode(
  `{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`,
);
const source = {
  source_sha: '1'.repeat(40),
  check_hash: '2'.repeat(64),
  policy_hash: '3'.repeat(64),
};

// Breaks: Maud resolves after five rats but the exact quest objective or last required predicate stays gapped.
test('E1 binds Maud objective only on its committed resolved transition', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-quest-'));
  const a = caseHost(
    admitCandidate(bytes),
    join(dir, 'save.db'),
    join(dir, 'case.jsonl'),
    undefined,
    { case_id: 'mauds-cellar', source, fault_schedule: [] },
  );
  const base = '/quests/ashmere_missing_child@0.0.42:quest/mauds_cellar';
  const expected = [
    base,
    `${base}/objective`,
    `${base}/objective/policy/root`,
    ...Array.from({ length: 5 }, (_, n) => `${base}/objective/policy/root/items/${n}`),
  ];
  try {
    const observed: string[][] = [];
    a.watch((before, after, command, decision) => {
      const paths = witnessedObligations(before, after, command, decision).filter((path) =>
        path.startsWith(base),
      );
      if (paths.length) observed.push(paths);
    });
    maudsCellar(a);
    assert.deepEqual(observed, [expected]);
    a.record({
      kind: 'finish',
      steps: a.commands.length,
      digest: a.digest(),
      state_hash: hash(a.story.world().state as never),
    });
    const replay = replayCase(bytes, readFileSync(join(dir, 'case.jsonl'), 'utf8'), source);
    assert.deepEqual(
      expected.filter((path) => !replay.obligations.includes(path)),
      [],
    );
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
});

// Breaks: Maud's accepted turn-in changes trust and cellar status but its choice effects stay gapped.
test('E1 binds selected dialogue fact adjustment and assignment from committed receipt', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-choice-effects-'));
  const a = caseHost(
    admitCandidate(bytes),
    join(dir, 'save.db'),
    join(dir, 'case.jsonl'),
    undefined,
    {
      case_id: 'mauds-cellar',
      source,
      fault_schedule: [],
    },
  );
  const base = '/dialogues/ashmere_missing_child@0.0.42:dialogue/maud_turn_in/choices/done';
  const expected = [`${base}/sequence/0`, `${base}/sequence/1`];
  try {
    const seen: string[][] = [];
    a.watch((before, after, command, decision) => {
      if (command.payload.type === 'choose') {
        const paths = witnessedObligations(before, after, command, decision).filter((path) =>
          path.startsWith(base),
        );
        if (paths.length) seen.push(paths);
      }
    });
    maudsCellar(a);
    assert.deepEqual(seen, [[base, ...expected]]);
    a.record({
      kind: 'finish',
      steps: a.commands.length,
      digest: a.digest(),
      state_hash: hash(a.story.world().state as never),
    });
    const replay = replayCase(bytes, readFileSync(join(dir, 'case.jsonl'), 'utf8'), source);
    assert.deepEqual(
      expected.filter((path) => !replay.obligations.includes(path)),
      [],
    );
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
});

// Breaks: entering a room displays its authored item or NPC but leaves that exact definition gapped.
test('E1 binds only visible entity definitions after committed room entry', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-visible-'));
  const a = caseHost(
    admitCandidate(bytes),
    join(dir, 'save.db'),
    join(dir, 'case.jsonl'),
    undefined,
    { case_id: 'topology', source, fault_schedule: [] },
  );
  const boots = '/items/ashmere_missing_child@0.0.42:item/leather_boots';
  const sedge = '/npcs/ashmere_missing_child@0.0.42:npc/sedge';
  const hidden = '/npcs/ashmere_missing_child@0.0.42:npc/wisp';
  try {
    const entered: Record<string, string[]> = {};
    a.watch((before, after, command, decision) => {
      const paths = witnessedObligations(before, after, command, decision);
      if (command.payload.type === 'move') entered[gameView(after).place.title.key] = paths;
      else assert.equal(paths.includes(boots) || paths.includes(sedge), false);
    });
    a.invoke('choose_ancestry', [], { ancestry: 'hill_folk' });
    a.move('north', 'west');
    a.reopen();
    assert.equal(entered['room.chandler.title']?.includes(boots), true);
    a.move('east', 'south', 'west');
    a.invoke('board_ferry', [a.detail('boathouse', 'ferry')], {
      route: {
        cartridge_id: 'ashmere_missing_child',
        cartridge_version: '0.0.42',
        kind: 'transport',
        key: 'fen_outbound',
      },
      quoted_fare: 2,
    });
    a.move('east');
    a.reopen();
    assert.equal(entered['room.isle_hut.title']?.includes(sedge), true);
    assert.equal(Object.values(entered).flat().includes(hidden), false);
    a.record({
      kind: 'finish',
      steps: a.commands.length,
      digest: a.digest(),
      state_hash: hash(a.story.world().state as never),
    });
    const replay = replayCase(bytes, readFileSync(join(dir, 'case.jsonl'), 'utf8'), source);
    assert.equal(replay.obligations.includes(boots), true);
    assert.equal(replay.obligations.includes(sedge), true);
    assert.equal(replay.obligations.includes(hidden), false);
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
});

// Breaks: a used ferry reaches its authored destination but its selected transport stays gapped.
test('E1 binds only the used ferry route on committed arrival', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-ferry-'));
  const a = caseHost(
    admitCandidate(bytes),
    join(dir, 'save.db'),
    join(dir, 'case.jsonl'),
    undefined,
    {
      case_id: 'topology',
      source,
      fault_schedule: [],
    },
  );
  const outbound = '/transports/ashmere_missing_child@0.0.42:transport/fen_outbound';
  const returning = '/transports/ashmere_missing_child@0.0.42:transport/fen_return';
  try {
    a.invoke('choose_ancestry', [], { ancestry: 'hill_folk' });
    a.move('north', 'west', 'east', 'south', 'west');
    const witnessed: string[][] = [];
    a.watch((before, after, command, decision) => {
      if (command.payload.type === 'use_transport') {
        witnessed.push(witnessedObligations(before, after, command, decision));
        const other = after.roomIds['ashmere_missing_child@0.0.42:room/chapel_nave'];
        const arrived = after.state.containers[after.body];
        assert.notEqual(other, before.state.containers[before.body]);
        assert.notEqual(other, arrived);
        const falseArrival = {
          ...after,
          rooms: {
            ...after.rooms,
            [other]: { ...after.rooms[other]!, title: after.rooms[arrived]!.title },
          },
          state: { ...after.state, containers: { ...after.state.containers, [after.body]: other } },
        };
        assert.equal(gameView(falseArrival).place.title.key, gameView(after).place.title.key);
        assert.equal(
          witnessedObligations(before, falseArrival, command, decision).includes(outbound),
          false,
        );
      }
    });
    a.invoke('board_ferry', [a.detail('boathouse', 'ferry')], {
      route: {
        cartridge_id: 'ashmere_missing_child',
        cartridge_version: '0.0.42',
        kind: 'transport',
        key: 'fen_outbound',
      },
      quoted_fare: 2,
    });
    assert.deepEqual(witnessed, [[outbound]]);
    assert.equal(a.view().place.title.key, 'room.fen_isle_landing.title');
    a.record({
      kind: 'finish',
      steps: a.commands.length,
      digest: a.digest(),
      state_hash: hash(a.story.world().state as never),
    });
    const replay = replayCase(bytes, readFileSync(join(dir, 'case.jsonl'), 'utf8'), source);
    assert.equal(replay.obligations.includes(outbound), true);
    assert.equal(replay.obligations.includes(returning), false);
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
});

// Breaks: the objective is judged only after the turn-in hands over the ledger, so its root is lost.
test('E1 credits a dialogue-resolved objective on the state before the turn-in', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-debt-'));
  const a = caseHost(
    admitCandidate(bytes),
    join(dir, 'save.db'),
    join(dir, 'case.jsonl'),
    undefined,
    {
      case_id: 'debt-on_time',
      source,
      fault_schedule: [],
    },
  );
  const base = '/quests/ashmere_missing_child@0.0.42:quest/chandlers_debt';
  try {
    const observed: string[][] = [];
    a.watch((before, after, command, decision) => {
      const paths = witnessedObligations(before, after, command, decision).filter((path) =>
        path.startsWith(base),
      );
      if (paths.length) observed.push(paths);
    });
    chandlersDebt(a);
    assert.deepEqual(observed, [[base, `${base}/objective`, `${base}/objective/policy/root`]]);
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
});

// Branch evidence (architecture.md#e1-policy-branch-evidence) over v042 policy roots and facts.
const v042 = JSON.parse(pin.canonical);
const k = 'ashmere_missing_child@0.0.42:';
const bellRoot: Policy = v042.quests[`${k}quest/bell_of_ashmere`].objective.policy.root;
const [prior, fox] = (bellRoot as Extract<Policy, { op: 'any' }>).items as [Policy, Policy];
const allegianceWorld = (allegiance: 'prior' | 'fox') => {
  const world = newWorld(
    admitCandidate(bytes).cartridge,
    'e1-branch' as WorldContextId,
    [1, 2, 3, 4],
  );
  const fact = {
    kind: 'fact',
    fact: { ...(prior as { fact: object }).fact },
    scope: { kind: 'player', character_id: world.character },
  };
  return {
    ...world,
    state: {
      ...world.state,
      facts: { ...world.state.facts, [key(fact as never)]: allegiance as Key },
    },
  };
};
const credit = (root: Policy) => {
  const world = allegianceWorld('prior');
  return creditedPolicyPaths(world, world.character, root, 'r');
};

// Breaks: every `any` child is credited, so the fox branch counts on the prior ending; or a root
// that no longer holds in the evaluated state still credits its children.
test('E1 credits only the true child of an any objective', () => {
  assert.deepEqual(credit(bellRoot), ['r', 'r/items/0']);
  assert.deepEqual(credit({ op: 'all', items: [fox] }), []);
});

// Breaks: a reaction resolves any(prior, fox) after the command turns prior into fox, but the
// objective is judged only on the before state, so the no-longer-true prior branch is credited.
test('E1 credits an objective holding at both boundaries only where both agree', () => {
  const before = allegianceWorld('prior');
  const after = allegianceWorld('fox');
  assert.deepEqual(objectivePaths(before, after, before.character, bellRoot, 'r'), ['r']);
});

// Breaks: a `not` passes credit to its false child, so Peg's untouched debt guard counts as fired.
test('E1 never credits a negated guard for staying false', () => {
  assert.deepEqual(credit(v042.dialogues[`${k}dialogue/a_peg_debt`].policy.root), ['r']);
});

// Breaks: polarity is not restored by a second `not`, so a true doubly negated leaf stays pending.
test('E1 double not credits its true positive leaf only', () => {
  assert.deepEqual(credit({ op: 'not', item: { op: 'not', item: prior } }), ['r', 'r/item/item']);
});

// Breaks: an `all` under `not` is treated as holding, so its false children are never evaluated
// and the true leaf under `not(prior)` (positive again) stays pending.
test('E1 not(all) credits only a polarity-restored true leaf', () => {
  assert.deepEqual(
    credit({ op: 'not', item: { op: 'all', items: [fox, { op: 'not', item: prior }] } }),
    ['r', 'r/item/items/1/item'],
  );
});

// Breaks: a reviewed disposition is merged into the witnessed list, still listed as pending, or a
// malformed row (unknown path, duplicate, missing review) is accepted.
test('E1 reports a disposition apart from witnessed and pending paths', () => {
  const loaded = admitCandidate(bytes);
  const root = `/dialogues/${k}dialogue/a_peg_debt/policy/root`;
  const path = `${root}/item`;
  const row = { path, reason: 'r', evidence: 'e', review: 'v' };
  const report = obligationReport(loaded, coverage(), new Set([root]), [row]);
  assert.deepEqual(report.witnessed_obligations, [root]);
  assert.deepEqual(report.dispositioned_obligations, [path]);
  assert.equal(report.gaps.authored_obligations.includes(path), false);
  assert.throws(() => obligationReport(loaded, coverage(), new Set([path]), [row]), /witnessed/);
  assert.throws(() => checkDispositions(loaded, [row, row]), /duplicate disposition/);
  for (const bad of [
    { ...row, review: 1 as never },
    { ...row, path: `${path}/x` },
    { ...row, refusal: { case: 'refuse-peg-active', code: '' } },
    { ...row, refusal: null as never },
    { ...row, refusal: { case: 'debt-on_time', code: 'invalid_state' } },
  ])
    assert.throws(() => checkDispositions(loaded, [bad]), /invalid disposition/);
});

// Breaks: a dispositioned dialogue or choice path still shows as a family gap, or one row closes
// a sibling choice it does not name.
test('E1 a dispositioned dialogue or choice path closes its family gap', () => {
  const root = `/dialogues/${k}dialogue/a_elspeth_lost`;
  const rows = [root, `${root}/choices/acknowledge`].map((path) => ({
    path,
    reason: 'r',
    evidence: 'e',
    review: 'v',
  }));
  const { gaps } = obligationReport(admitCandidate(bytes), coverage(), new Set(), rows);
  assert.equal(gaps.dialogues.includes('a_elspeth_lost'), false);
  assert.equal(gaps.choices.includes('a_elspeth_lost/acknowledge'), false);
  assert.equal(gaps.choices.includes('a_elspeth_lost/directions'), true);
});

// Breaks: a refusal row passes although its case is missing, its guarded talk was accepted, it was
// refused for another reason or by another dialogue; or replay keeps a refusal a later accepted step
// overrode.
test('E1 binds a refusal row to its case final replayed refusal', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-refusal-'));
  const [name, recipe] = REFUSALS.find(([n]) => n === 'refuse-peg-active')!;
  const replayed = (run: string, steps: (a: ReturnType<typeof caseHost>) => unknown) => {
    const log = join(dir, `${run}.jsonl`),
      a = caseHost(admitCandidate(bytes), join(dir, `${run}.db`), log, undefined, {
        case_id: name,
        source,
        fault_schedule: [],
      });
    try {
      steps(a);
      a.record({
        kind: 'finish',
        steps: a.commands.length,
        digest: a.digest(),
        state_hash: hash(a.story.world().state as never),
      });
    } finally {
      a.close();
    }
    return replayCase(bytes, readFileSync(log, 'utf8'), source).final;
  };
  try {
    const final = replayed('refused', recipe);
    assert.deepEqual(final, { code: 'invalid_state', action: 'a_peg_debt' });
    const accepted = replayed('accepted', (a) => (recipe(a), a.move('east')));
    assert.equal(accepted, null);
    const path = `/dialogues/${k}dialogue/a_peg_debt/policy/root/item/items/0`;
    const row = { path, reason: 'r', evidence: 'e', review: 'v' };
    const refusal = { case: name, code: 'invalid_state' };
    checkRefusals(new Map([[name, final]]), [{ ...row, refusal }]);
    for (const [finals, bad] of [
      [new Map(), row], // case missing
      [new Map([[name, { ...final!, code: 'not_present' }]]), row], // other reason
      [new Map([[name, accepted]]), row], // accepted
      [new Map([[name, final]]), { ...row, path: path.replace('a_peg_debt', 'maud_offer') }],
    ] as const)
      assert.throws(() => checkRefusals(finals, [{ ...bad, refusal }]), /refusal/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
