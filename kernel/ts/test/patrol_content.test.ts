import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { encode } from '../src/foundation/canonical.ts';
import { loadCartridge, INSTALLED } from '../src/index.ts';
import { patrolBundle, ref, fresh } from './patrol_fixture.ts';

// Breaks: finite-route validation admits disconnected/repeated or unreachable checkpoint definitions, a competing leader writer or forged trust.
test('loader refuses malformed patrol route, writer ownership and bare quest activation', () => {
  const mutations: [string, string, (c: any, q: any) => void][] = [
    ['bad occurrence cursor', 'OUTCOME_MISMATCH', (_c, q) => (q.patrol.initial_cursor = 6)],
    [
      'disconnected edge',
      'OUTCOME_MISMATCH',
      (_c, q) => (q.patrol.route[1] = ref(fresh, 'room', 'chapel_nave')),
    ],
    [
      'duplicate checkpoint',
      'OUTCOME_MISMATCH',
      (_c, q) => (q.patrol.checkpoints[1] = q.patrol.checkpoints[0]),
    ],
    ['too much credit required', 'OUTCOME_MISMATCH', (_c, q) => (q.patrol.required = 5)],
    [
      'nonplayer trust',
      'OUTCOME_MISMATCH',
      (c, q) =>
        (c.facts[`${c.manifest.id}@${c.manifest.version}:fact/${q.patrol.trust_fact.key}`].scopes =
          ['instance']),
    ],
    [
      'mortal leader',
      'OUTCOME_MISMATCH',
      (c) =>
        (c.npcs[`${c.manifest.id}@${c.manifest.version}:npc/tobin`].hp = {
          minimum: 0,
          maximum: 10,
          start: 10,
          gain: 0,
        }),
    ],
    [
      'other location writer',
      'OUTCOME_MISMATCH',
      (c) => {
        c.manifest.requires.capabilities.behavior = c.lock.capabilities.behavior = 1;
        c.npcs[`${c.manifest.id}@${c.manifest.version}:npc/tobin`].daily_schedule = {
          '23': ref(fresh, 'room', 'watch_post'),
        };
      },
    ],
    [
      'missing capability',
      'UNDECLARED_CAPABILITY',
      (c) => {
        delete c.manifest.requires.capabilities.patrol;
        delete c.lock.capabilities.patrol;
      },
    ],
    [
      'bare activation',
      'OUTCOME_MISMATCH',
      (c) => {
        const d: any = Object.values(c.dialogues).find((d: any) => d.key === 'tobin_watch');
        delete d.choices.start.patrol;
      },
    ],
    [
      'ordinary trust write',
      'RESERVED_FACT',
      (c, q) => {
        const d: any = Object.values(c.dialogues).find((d: any) => d.key === 'b_aldric');
        (Object.values(d.choices)[0] as any).sequence = [
          { op: 'fact.assign', fact: q.patrol.trust_fact, value: true },
        ];
      },
    ],
    [
      'reaction activation without a patrol',
      'OUTCOME_MISMATCH',
      (c) => {
        const r: any = Object.values(c.reactions).find(
          (r: any) => r.apply[0].op === 'quest.activate',
        );
        r.apply[0].quest = ref(fresh, 'quest', 'watch_rounds');
      },
    ],
    [
      'ordinary dialogue completion without patrol credit',
      'OUTCOME_MISMATCH',
      (c) => {
        const d: any = Object.values(c.dialogues).find((d: any) => d.quest);
        d.quest = ref(fresh, 'quest', 'watch_rounds');
      },
    ],
  ];
  for (const [name, code, change] of mutations) {
    const c = patrolBundle().value;
    const q: any = Object.values(c.quests).find((q: any) => q.key === 'watch_rounds');
    change(c, q);
    const canonical = encode(c);
    const content_hash = createHash('sha256').update(canonical).digest('hex');
    const result = loadCartridge(
      new TextEncoder().encode(JSON.stringify({ cartridge: c, content_hash })),
      INSTALLED,
    );
    assert.equal(result.ok, false, name);
    if (!result.ok) assert.equal(result.diagnostic.code, code, name);
  }
});
