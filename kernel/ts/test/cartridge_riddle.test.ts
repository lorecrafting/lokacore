import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { INSTALLED, loadCartridge } from '../src/index.ts';
import { encode } from '../src/foundation/canonical.ts';
import { read } from './read.ts';

const prefix = 'ashmere_ferry@0.0.1:';
const dialogue = (c: any) => c.dialogues[prefix + 'dialogue/bram'];
const quest = (c: any) => c.quests[prefix + 'quest/lantern'];
const variant = (c: any) => quest(c).journal.active_variants[0];
function load(change: (c: any) => void = () => {}, installed = INSTALLED) {
  const c = structuredClone(read('protocol/fixtures/cartridge_ferry_hash.json').value);
  c.manifest.requires.kernel_api.at_least = '1.9';
  dialogue(c).riddle = {
    choice_id: 'carry',
    answer: 'lantern',
    bank: ['R', 'N', 'A', 'O', 'L', 'T', 'E', 'N', 'S'],
    wrong: 'narration.bram.leave',
  };
  quest(c).journal = {
    active: 'quest.lantern.title',
    objectives_met: 'quest.lantern.title',
    resolved: 'quest.lantern.title',
    failed: 'quest.lantern.title',
    abandoned: 'quest.lantern.title',
    active_variants: [
      {
        when: {
          policy_version: 1,
          root: {
            op: 'fact_compare',
            fact: {
              cartridge_id: 'ashmere_ferry',
              cartridge_version: '0.0.1',
              kind: 'fact',
              key: 'search_plan',
            },
            equals: 'player_led',
          },
        },
        text: 'narration.bram.carry',
      },
    ],
  };
  change(c);
  const content_hash = createHash('sha256').update(encode(c)).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(JSON.stringify({ cartridge: c, content_hash })),
    installed,
  );
}

// Breaks: required compiler/loader semantics disappear despite structurally valid artifacts.
test('loader accepts API1.9 and rejects invalid riddle and journal references', () => {
  assert.ok(load().ok);
  const cases: [string, string, (c: any) => void][] = [
    [
      'choice',
      'UNRESOLVED_REFERENCE',
      (c) => {
        dialogue(c).riddle.choice_id = 'missing';
      },
    ],
    [
      'wrong text',
      'UNRESOLVED_REFERENCE',
      (c) => {
        dialogue(c).riddle.wrong = 'missing';
      },
    ],
    [
      'repeated tile',
      'OUTCOME_MISMATCH',
      (c) => {
        dialogue(c).riddle.bank.splice(7, 1);
      },
    ],
    [
      'answer syntax',
      'SCHEMA_VIOLATION',
      (c) => {
        dialogue(c).riddle.answer = 'Lantern';
      },
    ],
    [
      'variant text',
      'UNRESOLVED_REFERENCE',
      (c) => {
        variant(c).text = 'missing';
      },
    ],
    [
      'policy fact',
      'UNRESOLVED_REFERENCE',
      (c) => {
        variant(c).when.root.fact.key = 'missing';
      },
    ],
    [
      'policy type',
      'FACT_TYPE_MISMATCH',
      (c) => {
        variant(c).when.root.equals = true;
      },
    ],
    [
      'policy version',
      'SCHEMA_VIOLATION',
      (c) => {
        variant(c).when.policy_version = 2;
      },
    ],
  ];
  for (const [name, code, change] of cases) {
    const result = load(change);
    assert.ok(!result.ok, name);
    assert.equal(result.diagnostic.code, code, name);
  }
});

// Breaks: either feature bypasses its minimum API, or a kernel below the declared range loads it.
test('riddles and active variants independently require API1.9', () => {
  for (const feature of ['riddle', 'active_variants']) {
    const result = load((c) => {
      c.manifest.requires.kernel_api.at_least = '1.8';
      if (feature === 'riddle') delete quest(c).journal;
      else delete dialogue(c).riddle;
    });
    assert.ok(!result.ok);
    assert.equal(result.diagnostic.code, 'KERNEL_API_RANGE_INVALID');
  }
  const result = load(() => {}, { ...INSTALLED, kernel_api: '1.8' });
  assert.ok(!result.ok);
  assert.equal(result.diagnostic.code, 'KERNEL_API_UNSUPPORTED');
});
