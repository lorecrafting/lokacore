// Homestead H2 at 390 px (`LOKA_WALK=toolbox_showcase npm run walkthrough`): the guided loop
// (docs/showcase/homestead-district.md steps 2 to 12) in the Book; the farm step is kernel-only.
// Law 2-law: bank, shop, hide, lift, fence, strongroom (docs/showcase/economy-law-district.md),
// reduced: the commission waits and the seen lift with its fine are kernel-only (showcase_economy).
// Magic 3-magic: lux, hush, grimoire, ward, winch, dark crypt, flamma, golem yard
// (docs/showcase/magic-district.md); the reactions' statuses are kernel-only (showcase_magic).
// Traps 4-traps: the shout in the chief's den and the frightened pack's flight
// (docs/showcase/traps-district.md step 8); the plates, levers, wheels and chief are kernel-only
// (showcase_traps).
import { expect } from 'e2e';
import { LABEL } from '../book/labels.ts';
import { go } from '../tests/steps.ts';
import { scene, settle, walk, type Screen, type Walk } from './walk.ts';

const steps = ({ screen, room }: Walk) => {
  // Every arrival checks the room page against its GameView (walk.ts room).
  const moves = async (...directions: string[]) => {
    for (const d of directions) {
      await go(screen, d);
      await room();
    }
  };
  const tap = async (label: string | RegExp) => {
    await settle();
    await screen.getByRole('button', label).first().tap();
  };
  const take = async (thing: RegExp, label: RegExp) => {
    await tap(thing);
    await tap(label);
  };
  const lesson = async (...choices: string[]) => {
    await tap(/^The carpenter is here/);
    await tap('Talk to the carpenter');
    for (const c of choices) await tap(c);
    await tap(LABEL.leaveConversation);
    await tap(LABEL.leave);
  };
  const held = async (item: RegExp) => {
    await tap(/opens Contents/);
    await tap(new RegExp(`^${LABEL.inventory}`));
    await tap(item);
  };
  const position = async (to: string) => {
    for (
      let i = 0;
      i < 4 && !(await screen.getByRole('button', new RegExp(`^${to}, change`)).isVisible());
      i++
    )
      await tap(/change position$/);
  };
  return { tap, take, lesson, held, position, moves };
};
type Steps = ReturnType<typeof steps>;

const crafts = async (screen: Screen, { tap, take, lesson, held, moves }: Steps) => {
  await moves('north', 'west', 'west');
  await lesson('Learn whittling', 'Learn woodcutting');
  await take(/^An axe is here/, /^Take an axe/);
  for (let i = 0; i < 2; i++) await take(/^A stick is here/, /^Take a stick/);
  for (let i = 0; i < 2; i++) await tap('Carve a spoon');
  await lesson('Learn carving (2 pennies)');
  await take(/^A cot is here/, /^Take a cot/);
  await moves('east', 'south', 'west');
  for (let i = 0; i < 4; i++) await tap('Chop wood');
  for (let i = 0; i < 2; i++) await take(/^A rabbit pelt is here/, /^Take a rabbit pelt/);
  await moves('east', 'north', 'west');
  await lesson('Learn carpentry (2 pennies)');
  for (let i = 0; i < 2; i++) await tap('Saw timber');
  await moves('east');
  await tap('Raise a timbered hut');
  await moves('north', 'south');
  await moves('south');
  await take(/^A red apple is here/, /^Take a red apple/);
  await held(/^a red apple/);
  await tap(/^Give a red apple to the farmer/);
  await tap(/^The farmer/);
  await tap('Trade two pelts for a knife');
  await tap(LABEL.leave);
};

const pondAndStew = async (screen: Screen, { tap, take, held, position, moves }: Steps) => {
  await moves('east');
  await take(/^A fishing rod is here/, /^Take a fishing rod/);
  const fish = /^An? (trout|salmon|eel) is here/;
  let landed = 0;
  for (let i = 0; landed < 2 && i < 12; i++) {
    await held(/^a fishing rod/);
    await tap(/^Fish in/);
    await tap(LABEL.leave);
    if (await screen.getByRole('button', fish).first().isVisible()) {
      await take(fish, /^Take an? (trout|salmon|eel)/);
      landed++;
    }
    await new Promise((done) => setTimeout(done, 13_000)); // the 600 s cooldown at rate 50
  }
  if (landed < 2) throw new Error(`landed ${landed} fish in 12 casts; the stew order needs 2`);
  // Resting in the hut applies nothing (H1 finding 1): the cot rests on the lane floor.
  await moves('west', 'north');
  await held(/^a cot/);
  await tap(/^Drop/);
  await position('resting');
  await position('standing');
  await moves('south', 'south');
  await tap(/^The cook/);
  await tap(/^Order a stew from two fish/);
  await tap(LABEL.leave);
  await new Promise((done) => setTimeout(done, 7_000)); // 300 s at rate 50
  await tap(/^The cook/);
  await tap(/^Claim your stew/);
  await tap(LABEL.leave);
  await held(/^a bowl of stew/);
  await tap(/^Eat/);
  await settle();
  await tap(/^fed.*opens Character$/i);
  await settle();
};

// Law L (docs/showcase/economy-law-district.md, Book e2e), reduced: bank, shop, hide, lift from the
// merchant's Held list, fence, strongroom. The seen lift (wanted, fine) is a separate branch, kernel-only.
const law = async (screen: Screen, { tap, take, moves }: Steps) => {
  const npc = async (who: RegExp, ...labels: RegExp[]) => {
    await tap(who);
    for (const l of labels) await tap(l);
    await tap(LABEL.leave);
  };
  await moves('down', 'east');
  await npc(/^The clerk is here/, /^Deposit five pennies/);
  await moves('west', 'north');
  await npc(/^The market clerk is here/, /^Withdraw five pennies/);
  await npc(/^The chandler is here/, /^Buy a tallow candle/);
  await moves('south', 'west');
  await tap('Hide');
  await moves('east', 'north');
  await tap(/^The merchant is here/);
  await take(/^The merchant's purse, open/, /^Lift$/);
  await moves('south', 'west');
  await npc(/^The fence/, /^Sell the merchant's purse/);
  await moves('east', 'east');
  await npc(/^The clerk is here/, /^Buy the strongroom/);
  await take(/^The strongroom key is here/, /^Take the strongroom key/);
  await moves('west');
  await tap('Map');
  await tap(/^Unlock the strongroom door/);
  await tap(/^Open the strongroom door/);
  await tap('Go south');
  await take(/^A strongroom chest is here/, /^Put a tallow candle/);
  await take(/^A tallow candle, open/, /^Take a tallow candle/);
  await settle();
};

// Magic M2 (docs/showcase/magic-district.md steps 1 to 9), the Book e2e; ward is cast, not fought.
const loft = async (r: Walk, { tap, take, held, moves }: Steps) => {
  const { screen } = r;
  const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));
  const wizard = async (choice: string) => {
    await tap(/^The hedge-wizard/);
    await tap(/^Talk/);
    await tap(choice);
    await tap(LABEL.leaveConversation);
    await tap(LABEL.leave);
  };
  await moves('up');
  await expect(screen.getByRole('button', /ma 5\/5/).first()).toBeVisible();
  await wizard('Learn the word lux');
  await wizard('Fetch the second word');
  await tap('Gather ash');
  await take(/^The lantern is here/, /^Take the lantern/);
  await tap('lux, cast');
  await moves('north');
  await pause(4_000); // the 120 s hush at rate 50
  await take(/^The grimoire is here/, /^Take the grimoire/);
  await held(/^the grimoire/);
  await tap(/^Read/);
  await tap(LABEL.leave);
  await moves('south');
  await tap(/opens Contents$/);
  await tap(/^Character/);
  await tap('Raise CHA');
  await tap(LABEL.backToWorld);
  await tap('ward, cast');
};

const magic = async (r: Walk, steps: Steps) => {
  const { screen } = r;
  const { tap, take, held, moves } = steps;
  await loft(r, steps);
  await take(/^The oilcan is here/, /^Take the oilcan/);
  await take(/^The loft bucket is here/, /^Take the loft bucket/);
  await moves('east');
  await held(/^the oilcan/); // a use recipe is offered on the held tool
  await tap(/^Oil/);
  await tap(LABEL.leave);
  await tap('Map');
  await tap(/^Open/);
  await held(/^the lantern/);
  await tap(/^Drop/); // the lit lantern left on the stair: the crypt below is dark
  await moves('down');
  await r.note('The dark crypt');
  await moves('up');
  await take(/^The lantern is here/, /^Take the lantern/);
  await moves('down');
  await tap('flamma, cast');
  await tap(/^Flee/);
  await tap(LABEL.backToWorld);
  await moves('down');
  await tap('flamma, cast'); // the second bolt kills the wight (magic 7)
  // No Quench: the bier burns 180 game s, about 3.6 s of wall time at rate 50, a race the walk
  // cannot win reliably; kernel test magic 8 pins the quench. The bucket stays held.
  await moves('up', 'west', 'west');
  await r.note('The golem yard');
  await settle();
};

walk(
  '1-homestead',
  'Homestead: lessons, carve, build, rest, give, barter, fish, stew',
  async (r) => {
    const { screen } = r;
    await r.app.clearState();
    await settle();
    await scene(screen);
    await r.room();
    const s = steps(r);
    await crafts(screen, s);
    await pondAndStew(screen, s);
  },
);

walk('2-law', 'Law: bank, shop, hide, lift, fence, strongroom', async (r) => {
  const { screen } = r;
  await r.app.clearState();
  await settle();
  await scene(screen);
  await r.room();
  await law(screen, steps(r));
});

walk('3-magic', 'Magic: lux, hush, grimoire, ward, winch, flamma, golem', async (r) => {
  await r.app.clearState();
  await settle();
  await scene(r.screen);
  await r.room();
  await magic(r, steps(r));
});

walk('4-traps', "Traps: the shout in the chief's den; the goblins flee", async (r) => {
  const { screen } = r;
  await r.app.clearState();
  await settle();
  await scene(screen);
  await r.room();
  const { tap, moves } = steps(r);
  await moves('west', 'down', 'north', 'north'); // the passage plate bites on the way
  // Afraid lasts 600 game s (~12 s of wall time at rate 50): nothing slow between shout and Attack.
  await tap('begone, shout');
  await tap(/^A goblin is here/);
  await tap(/Attack/);
  // A round is 150 game s, 3 s of wall time at rate 50.
  await expect(screen.getByText(/A goblin flees south/).first()).toBeVisible({ timeout: 10_000 });
  await r.note('The pack flees');
});
