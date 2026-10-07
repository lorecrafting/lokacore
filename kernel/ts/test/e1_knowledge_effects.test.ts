import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { read } from './read.ts';
import { admitCandidate } from './e1_policy.ts';
import { caseHost, witnessedObligations, type CaseHost } from './e1_case_host.ts';
import { replayCase } from './e1_cases.ts';
import { wispWard } from './e1_wisp_herbs.ts';
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

function learnSwim(a: CaseHost) {
  a.invoke('choose_ancestry', [], { ancestry: 'hill_folk' });
  a.move('west');
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
  a.invoke('sedge_swim', [a.entity('npc', 'sedge')]);
  a.reopen();
  a.choose('learn');
  a.reopen();
  assert.equal(a.flag('skill_swim'), true);
}

// Breaks: selected Swim/ward effects remain gapped, or unrelated/no-transition receipts claim them.
for (const [dialogue, choice, index, fact, route] of [
  ['sedge_swim', 'learn', 0, 'skill_swim', learnSwim],
  ['b_wisp_riddle', 'answer', 1, 'topic_ward_known', wispWard],
] as const)
  test(`E1 binds ${dialogue}/${choice} membership only to its resolved committed effect`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'loka-e1-knowledge-'));
    const log = join(dir, 'case.jsonl');
    const a = caseHost(admitCandidate(bytes), join(dir, 'save.db'), log, undefined, {
      case_id: dialogue === 'sedge_swim' ? 'topology' : 'wisp-ward',
      source,
      fault_schedule: [],
    });
    const path = `/dialogues/ashmere_missing_child@0.0.42:dialogue/${dialogue}/choices/${choice}/sequence/${index}`;
    let witnessed = 0;
    try {
      a.watch((before, after, command, decision) => {
        const has = (b = before, n = after, c = command, d = decision) =>
          witnessedObligations(b, n, c, d).includes(path);
        if (!has()) return;
        witnessed++;
        assert.equal(command.payload.type, 'choose');
        if (command.payload.type !== 'choose' || decision.kind !== 'accepted')
          throw new Error('membership witness requires accepted choose');
        const p = command.payload;
        assert.equal(p.choice_id, choice);
        assert.equal(before.state.choices![p.continuation_id]!.source.key, dialogue);
        assert.equal(has(after), false, 'already known');
        assert.equal(has(before, before), false, 'no change');
        const unresolved = {
          ...after,
          state: {
            ...after.state,
            choices: {
              ...after.state.choices,
              [p.continuation_id]: before.state.choices![p.continuation_id]!,
            },
          },
        };
        assert.equal(has(before, unresolved), false, 'unresolved choice');
        assert.equal(
          has(before, after, { ...command, payload: { ...p, choice_id: 'unselected' as never } }),
          false,
        );
        assert.equal(has(before, after, command, { kind: 'fault', code: 'invalid_state' }), false);
        const event = decision.events.find(
          (e) => e.payload.type === 'fact_changed' && e.payload.fact.key === fact,
        )!;
        assert.ok(event);
        assert.deepEqual(
          event.payload.type === 'fact_changed' && [event.payload.old, event.payload.new],
          [false, true],
        );
        assert.equal(
          has(before, after, command, {
            ...decision,
            events: decision.events.filter((e) => e !== event),
          }),
          false,
        );
        for (const patch of [
          { actor_id: 'unrelated' },
          { world_context_id: 'unrelated' },
          { causation_id: 'unrelated' },
          { correlation_id: 'unrelated' },
          { scope: { kind: 'player', character_id: 'unrelated' } },
          {
            payload: {
              ...event.payload,
              fact: { cartridge_id: 'other', cartridge_version: '0.0.42', kind: 'fact', key: fact },
            },
          },
        ]) {
          const events: unknown[] = decision.events.map((e) =>
            e === event ? { ...e, ...patch } : e,
          );
          assert.equal(has(before, after, command, { ...decision, events } as never), false);
        }
      });
      route(a);
      assert.equal(witnessed, 1);
      a.record({
        kind: 'finish',
        steps: a.commands.length,
        digest: a.digest(),
        state_hash: hash(a.story.world().state as never),
      });
      const text = readFileSync(log, 'utf8');
      assert.equal(replayCase(bytes, text, source).obligations.includes(path), true);
      const missing = text
        .trim()
        .split('\n')
        .map((line) => {
          const row = JSON.parse(line);
          if (row.kind === 'step')
            row.obligations = row.obligations.filter((p: string) => p !== path);
          return JSON.stringify(row);
        })
        .join('\n');
      assert.equal(replayCase(bytes, missing, source).obligations.includes(path), false);
    } finally {
      a.close();
      rmSync(dir, { recursive: true });
    }
  });
