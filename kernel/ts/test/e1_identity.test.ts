import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { read } from './read.ts';
import { admitCandidate } from './e1_policy.ts';
import { caseHost, witnessedObligations, type CaseHost } from './e1_case_host.ts';
import { replayCase } from './e1_cases.ts';
import { feyAncestry } from './e1_paths.ts';
import { infirmaryHerbs } from './e1_wisp_herbs.ts';
import { maudsCellar } from './e1_maud.ts';
import { hash } from '../src/foundation/canonical.ts';

const pin = read('protocol/fixtures/missing_child_v042_hash.json');
const bytes = new TextEncoder().encode(
  `{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`,
);
const source = {
  source_sha: '1'.repeat(40),
  check_hash: '2'.repeat(64),
  policy_hash: '3'.repeat(64),
};
function finish(a: CaseHost, log: string) {
  a.record({
    kind: 'finish',
    steps: a.commands.length,
    digest: a.digest(),
    state_hash: hash(a.story.world().state as never),
  });
  return replayCase(bytes, readFileSync(log, 'utf8'), source).obligations;
}

// Breaks: a selected ancestry stays pending, or an unchanged/mismatched selection receipt earns credit.
test('E1 ancestry witness requires the exact new committed selection', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-ancestry-'));
  try {
    for (const ancestry of ['fen_born', 'road_born', 'hill_folk', 'fey_touched']) {
      const log = join(dir, `${ancestry}.jsonl`);
      const a = caseHost(admitCandidate(bytes), join(dir, `${ancestry}.db`), log, undefined, {
        case_id: ancestry === 'fey_touched' ? 'ancestry-fey' : 'topology',
        source,
        fault_schedule: [],
      });
      const expected = [`/ancestries/${ancestry}`];
      try {
        a.watch((before, after, command, decision) => {
          assert.deepEqual(witnessedObligations(before, after, command, decision), expected);
          assert.deepEqual(witnessedObligations(after, after, command, decision), []);
          assert.deepEqual(witnessedObligations(before, before, command, decision), []);
          assert.equal(decision.kind, 'accepted');
          if (decision.kind !== 'accepted') return;
          assert.deepEqual(
            witnessedObligations(before, after, command, {
              ...decision,
              delta: { ops: [] },
            }),
            [],
          );
        });
        if (ancestry === 'fey_touched') feyAncestry(a);
        else {
          a.invoke('choose_ancestry', [], { ancestry });
          a.reopen();
        }
        assert.deepEqual(finish(a, log), expected);
      } finally {
        a.close();
      }
    }
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// Breaks: completed exchanges/quest rewards miss the transferred original items, or stock gets credit early.
test('E1 item witnesses bind the exact original transfer and receipt holders', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-transfers-'));
  try {
    for (const [case_id, route, expected] of [
      [
        'infirmary-herbs',
        infirmaryHerbs,
        [
          'bandage_01',
          'bandage_02',
          'bandage_03',
          'bandage_04',
          'bandage_05',
          'bandage_06',
          'bandage_07',
          'bandage_08',
          'bandage_09',
          'bandage_10',
          'bandage_11',
          'bandage_12',
        ],
      ],
      ['mauds-cellar', maudsCellar, ['cellar_key']],
    ] as const) {
      const log = join(dir, `${case_id}.jsonl`);
      const a = caseHost(admitCandidate(bytes), join(dir, `${case_id}.db`), log, undefined, {
        case_id,
        source,
        fault_schedule: [],
      });
      const paths = expected.map((key) => `/items/ashmere_missing_child@0.0.42:item/${key}`);
      const observed = new Set<string>();
      try {
        a.watch((before, after, command, decision) => {
          const witnessed = witnessedObligations(before, after, command, decision);
          const earned = witnessed.filter((path) => paths.includes(path));
          for (const path of earned) observed.add(path);
          if (!earned.length) return;
          assert.equal(command.payload.type, 'choose');
          assert.equal(decision.kind, 'accepted');
          if (decision.kind !== 'accepted') return;
          for (const path of earned) {
            const id = before.entityIds[path.slice('/items/'.length)]!;
            assert.equal(
              before.state.containers[id],
              a.entity('npc', case_id === 'infirmary-herbs' ? 'wick' : 'maud'),
            );
            assert.equal(after.state.containers[id], after.body);
          }
          assert.deepEqual(
            witnessedObligations({ ...before, entityIds: {} }, after, command, decision).filter(
              (p) => paths.includes(p),
            ),
            [],
          );
          for (const altered of [
            { ...decision, events: [] },
            {
              ...decision,
              delta: { ops: decision.delta.ops.filter((op) => op.op !== 'entity.transfer') },
            },
          ])
            assert.deepEqual(
              witnessedObligations(before, after, command, altered).filter((p) =>
                paths.includes(p),
              ),
              [],
            );
          assert.deepEqual(
            witnessedObligations(after, after, command, decision).filter((p) => paths.includes(p)),
            [],
          );
        });
        route(a);
        assert.deepEqual([...observed].sort(), [...paths].sort());
        assert.deepEqual(
          finish(a, log)
            .filter((p) => paths.includes(p))
            .sort(),
          [...paths].sort(),
        );
      } finally {
        a.close();
      }
    }
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// Breaks: a revealed NPC engaged in dialogue remains pending, or the offered target alone gets credit.
test('E1 NPC witness requires the accepted target in a newly opened dialogue', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-npc-'));
  const log = join(dir, 'wisp.jsonl');
  const a = caseHost(admitCandidate(bytes), join(dir, 'save.db'), log, undefined, {
    case_id: 'wisp-ward',
    source,
    fault_schedule: [],
  });
  const path = '/npcs/ashmere_missing_child@0.0.42:npc/wisp';
  try {
    const observed: string[] = [];
    a.watch((before, after, command, decision) => {
      const earned = witnessedObligations(before, after, command, decision).filter(
        (p) => p === path,
      );
      observed.push(...earned);
      if (!earned.length) return;
      assert.equal(command.payload.type, 'talk');
      assert.deepEqual(
        witnessedObligations(before, before, command, decision).filter((p) => p === path),
        [],
      );
      assert.deepEqual(
        witnessedObligations(before, after, command, {
          kind: 'rejected',
          error: { code: 'not_present' },
        }).filter((p) => p === path),
        [],
      );
    });
    a.invoke('choose_ancestry', [], { ancestry: 'road_born' });
    a.move('south', 'south', 'south', 'east');
    a.invoke('seek_wisp', [a.detail('marsh_light', 'glow')]);
    assert.deepEqual(observed, []);
    a.invoke('a_wisp_offer', [a.entity('npc', 'wisp')]);
    a.reopen();
    assert.deepEqual(observed, [path]);
    assert.equal(finish(a, log).includes(path), true);
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
});
