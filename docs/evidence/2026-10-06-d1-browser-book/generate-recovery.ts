import { writeFileSync } from 'node:fs';
import { bundle, prefix, ref } from './kernel/ts/test/transport_fixture.ts';

// Controlled authored inputs from transport.test.ts::deathSetup; not a production release.
const fixture = bundle((c) => {
  c.resources[`${prefix}:resource/pennies`].start = 2;
  c.resources[`${prefix}:resource/hp`].start = 1;
  c.resources[`${prefix}:resource/hp`].gain = 0;
  for (const name of ['torch', 'satchel'])
    c.items[`${prefix}:item/${name}`].location = { in: 'room', room: ref('room', 'boathouse') };
  c.npcs[`${prefix}:npc/peg`].shop.offers = c.npcs[`${prefix}:npc/peg`].shop.offers.filter(
    (o) => !['torch', 'satchel'].includes(o.item.key),
  );
  const rat = structuredClone(c.npcs[`${prefix}:npc/cellar_rat_1`]);
  rat.key = 'loft_test_rat';
  rat.room = ref('room', 'hut_loft');
  rat.attack.chance = 100;
  rat.perception = { discovered: ref('fact', 'fen_wisp_discovered') };
  c.npcs[`${prefix}:npc/loft_test_rat`] = rat;
  c.world.combat.player_attack.chance = 0;
  // A real scheduled round within the browser proof budget; no mocked clock/RNG.
  c.world.combat.interval = 1;
});
writeFileSync('protocol/fixtures/d1-recovery-browser-fixture.json', JSON.stringify(fixture));
console.log(`controlled_fixture_sha256=${fixture.sha256}`);
