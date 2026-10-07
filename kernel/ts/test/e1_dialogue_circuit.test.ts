import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { hash } from '../src/foundation/canonical.ts';
import { read } from './read.ts';
import { admitCandidate } from './e1_policy.ts';
import { caseHost } from './e1_case_host.ts';
import { replayCase } from './e1_cases.ts';
import { dialogueCircuit } from './e1_dialogue_circuit.ts';

const pin = read('protocol/fixtures/missing_child_v042_hash.json');
const bytes = new TextEncoder().encode(
  `{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`,
);
const source = {
  source_sha: '1'.repeat(40),
  check_hash: '2'.repeat(64),
  policy_hash: '3'.repeat(64),
};

// Breaks: dropping an ordinary conversation silently leaves a promised selected choice unexecuted.
test('E1 training/social circuit pays for lessons and replays every selected conversation', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-dialogue-'));
  const log = join(dir, 'case.jsonl');
  const a = caseHost(admitCandidate(bytes), join(dir, 'save.db'), log, undefined, {
    case_id: 'dialogue-circuit',
    source,
    fault_schedule: [],
  });
  try {
    assert.deepEqual(dialogueCircuit(a), { lessons: 6, pennies: 10, terminal_room: 'fox_hollow' });
    a.record({
      kind: 'finish',
      steps: a.commands.length,
      digest: a.digest(),
      state_hash: hash(a.story.world().state as never),
    });
    const replay = replayCase(bytes, readFileSync(log, 'utf8'), source);
    const choices = [
      'ada/leave',
      'ash/leave',
      'b_aldric/bell',
      'b_aldric/leave',
      'elspeth/directions',
      'elspeth/inn',
      'elspeth/wren',
      'gareth/leave',
      'hale/leave',
      'hob/leave',
      'peg_haggle/learn',
      'sedge_herbalism/learn',
      'sedge_swim/learn',
      'tobin_dodge/learn',
      'tobin_swords/learn',
      'vesper/greet',
      'wick_bandage/learn',
      'wren/greet',
    ];
    assert.deepEqual([...a.seen.choices].sort(), choices);
    for (const choice of choices) {
      const [dialogue, option] = choice.split('/');
      assert.ok(
        replay.obligations.includes(
          `/dialogues/ashmere_missing_child@0.0.42:dialogue/${dialogue}/choices/${option}`,
        ),
        choice,
      );
    }
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
});
