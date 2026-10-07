import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { read } from './read.ts';
import { admitCandidate } from './e1_policy.ts';
import { caseHost, witnessedObligations } from './e1_case_host.ts';
import { replayCase } from './e1_cases.ts';
import { maudsCellar } from './e1_maud.ts';
import { hash } from '../src/foundation/canonical.ts';
import { gameView } from '../src/index.ts';

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
