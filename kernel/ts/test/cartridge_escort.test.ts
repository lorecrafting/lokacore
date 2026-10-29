import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { encode } from '../src/foundation/canonical.ts';
import { INSTALLED, loadCartridge } from '../src/index.ts';
import { read } from './read.ts';

const prefix = 'ferry_sampler@0.0.1:';
const dialogue = (c: any) => c.dialogues[prefix + 'dialogue/bram'];
const effect = (c: any) => dialogue(c).choices.carry.escort;
const quest = {
  cartridge_id: 'ferry_sampler',
  cartridge_version: '0.0.1',
  kind: 'quest',
  key: 'lantern',
};
function load(change: (c: any) => void = () => {}) {
  const c = structuredClone(read('protocol/fixtures/cartridge_ferry_hash.json').value);
  delete c.story_points;
  c.manifest.requires.kernel_api.at_least = '1.11';
  c.manifest.requires.capabilities.escort = 1;
  c.lock.capabilities.escort = 1;
  delete dialogue(c).quest;
  dialogue(c).choices.carry.escort = { npc: 'bram', quest, transition: 'start' };
  delete dialogue(c).choices.leave; // an escort start is a one-shot offer (loka-x6t.5)
  c.quests[prefix + 'quest/other'] = { ...c.quests[prefix + 'quest/lantern'], key: 'other' };
  change(c);
  const content_hash = createHash('sha256').update(encode(c)).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(JSON.stringify({ cartridge: c, content_hash })),
    INSTALLED,
  );
}

// Breaks: legitimate start/rejoin/complete forms or nullable-independent policy references stop loading.
test('loader accepts API1.11 escort effects and policy leaves', () => {
  for (const transition of ['start', 'rejoin', 'complete']) {
    const result = load((c) => {
      effect(c).transition = transition;
      if (transition === 'complete') dialogue(c).quest = quest;
      dialogue(c).policy.root = { op: 'escort_state', quest, state: 'following' };
    });
    assert.ok(result.ok, JSON.stringify(result));
  }
});
