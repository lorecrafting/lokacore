// The infirmary fragment for the local-story and Book tests (the Book imports the kernel only here).
import assert from 'node:assert/strict';
import { decode } from '../../../../kernel/ts/src/foundation/canonical.ts';
import {
  sampler,
  infirmary,
  ref,
  prefix,
  fresh as base,
} from '../../../../kernel/ts/test/infirmary_fixture.ts';
export { herbs, bandages, wick, patch, id } from '../../../../kernel/ts/test/infirmary_fixture.ts';
// The infirmary fragment with 100 g ores (pickaxe plus six ores fit the 3000 g ceiling) and a
// second axis writer, a pledge of +2, for the composed-order receipts.
const change = (c: any) => {
  infirmary(c);
  for (const i of [1, 2, 3, 4, 5, 6]) c.items[`${prefix}:item/ore_0${i}`].mass_grams = 100;
  c.dialogues[`${prefix}:dialogue/c_pledge`] = {
    key: 'c_pledge',
    label: 'quest.herbs.accept', // a labelled talk is selected by key, not by policy order
    npc: ref('npc', 'healer'),
    policy: { op: 'all', items: [] },
    prompt: 'dialogue.healer.prompt',
    roles: { healer: { role: 'npc', npc: ref('npc', 'healer') } },
    choices: {
      pledge: {
        label: 'quest.herbs.accept',
        narration: 'narration.healer',
        sequence: [{ op: 'fact.adjust', fact: ref('fact', 'axis'), amount: 2 }],
      },
    },
  };
};
export const bundle = sampler.bundle(change),
  text = (decode(bundle.canonical) as any).text as Record<string, string>,
  fresh = sampler.genesis(change);
assert.deepEqual(fresh.entityIds, base.entityIds);
