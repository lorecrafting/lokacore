// Homestead H2 at 390 px (`LOKA_WALK=toolbox_showcase npm run walkthrough`): the guided loop
// (docs/showcase/homestead-district.md steps 2 to 12) in the Book; the farm step is kernel-only.
// Law 2-law: bank, shop, hide, lift, fence, strongroom (docs/showcase/economy-law-district.md),
// reduced: the commission waits and the seen lift with its fine are kernel-only (showcase_economy).
// Magic 3-magic: lux, hush, grimoire, ward, winch, dark crypt, flamma, golem yard
// (docs/showcase/magic-district.md); the reactions' statuses are kernel-only (showcase_magic).
import { expect } from 'e2e';
import { LABEL } from '../book/labels.ts';
import { moves, scene, settle, walk, type Screen, type Walk } from './walk.ts';

const steps = (screen: Screen) => {
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
    await tap('Talk the carpenter');
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
  return { tap, take, lesson, held, position };
};
type Steps = ReturnType<typeof steps>;

const crafts = async (screen: Screen, { tap, take, lesson, held }: Steps) => {
  await moves(screen, 'north', 'west', 'west');
  await lesson('Learn whittling', 'Learn woodcutting');
  await take(/^An axe is here/, /^Take an axe/);
  for (let i = 0; i < 2; i++) await take(/^A stick is here/, /^Take a stick/);
  for (let i = 0; i < 2; i++) await tap('Carve a spoon');
  await lesson('Learn carving (2 pennies)');
  await take(/^A cot is here/, /^Take a cot/);
  await moves(screen, 'east', 'south', 'west');
  for (let i = 0; i < 4; i++) await tap('Chop wood');
  for (let i = 0; i < 2; i++) await take(/^A rabbit pelt is here/, /^Take a rabbit pelt/);
  await moves(screen, 'east', 'north', 'west');
  await lesson('Learn carpentry (2 pennies)');
  for (let i = 0; i < 2; i++) await tap('Saw timber');
  await moves(screen, 'east');
  await tap('Raise a timbered hut');
  await moves(screen, 'north', 'south');
  await moves(screen, 'south');
  await take(/^A red apple is here/, /^Take a red apple/);
  await held(/^a red apple/);
  await tap(/^Give a red apple to the farmer/);
  await tap(/^The farmer/);
  await tap('Trade two pelts for a knife');
  await tap(LABEL.leave);
};

const pondAndStew = async (screen: Screen, { tap, take, held, position }: Steps) => {
  await moves(screen, 'east');
  await take(/^A fishing rod is here/, /^Take a fishing rod/);
  const fish = /^An? (trout|salmon|eel) is here/;
  let landed = 0;
  for (let i = 0; landed < 2 && i < 12; i++) {
    await held(/^a fishing rod/);
    await tap(/^Cast the rod/);
    await tap(LABEL.leave);
    if (await screen.getByRole('button', fish).first().isVisible()) {
      await take(fish, /^Take an? (trout|salmon|eel)/);
      landed++;
    }
    await new Promise((done) => setTimeout(done, 13_000)); // the 600 s cooldown at rate 50
  }
  if (landed < 2) throw new Error(`landed ${landed} fish in 12 casts; the stew order needs 2`);
  // Resting in the hut applies nothing (H1 finding 1): the cot rests on the lane floor.
  await moves(screen, 'west', 'north');
  await held(/^a cot/);
  await tap(/^Drop/);
  await position('resting');
  await position('standing');
  await moves(screen, 'south', 'south');
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
const law = async (screen: Screen, { tap, take }: Steps) => {
  const npc = async (who: RegExp, ...labels: RegExp[]) => {
    await tap(who);
    for (const l of labels) await tap(l);
    await tap(LABEL.leave);
  };
  await moves(screen, 'down', 'east');
  await npc(/^The clerk is here/, /^Deposit five pennies/);
  await moves(screen, 'west', 'north');
  await npc(/^The market clerk is here/, /^Withdraw five pennies/);
  await npc(/^The chandler is here/, /^Buy a tallow candle/);
  await moves(screen, 'south', 'west');
  await tap('Hide');
  await moves(screen, 'east', 'north');
  await tap(/^The merchant is here/);
  await take(/^The merchant's purse, open/, /^Take the merchant's purse/);
  await moves(screen, 'south', 'west');
  await npc(/^The fence/, /^Sell the merchant's purse/);
  await moves(screen, 'east', 'east');
  await npc(/^The clerk is here/, /^Buy the strongroom/);
  await take(/^The strongroom key is here/, /^Take the strongroom key/);
  await moves(screen, 'west');
  await tap('Map');
  await tap(/^Unlock the strongroom door/);
  await tap(/^Open the strongroom door/);
  await tap('Go south');
  await take(/^A strongroom chest is here/, /^Put a tallow candle/);
  await take(/^A tallow candle, open/, /^Take a tallow candle/);
  await settle();
};

// Magic M2 (docs/showcase/magic-district.md steps 1 to 9), the Book e2e; ward is cast, not fought.
const loft = async (r: Walk, { tap, take, held }: Steps) => {
  const { screen } = r;
  const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));
  const wizard = async (choice: string) => {
    await tap(/^The hedge-wizard/);
    await tap(/^Talk/);
    await tap(choice);
    await tap(LABEL.leaveConversation);
    await tap(LABEL.leave);
  };
  await moves(screen, 'up');
  await expect(screen.getByRole('button', /ma 5\/5/).first()).toBeVisible();
  await wizard('Learn the word lux');
  await wizard('Fetch the second word');
  await tap('Gather ash');
  await take(/^The lantern is here/, /^Take the lantern/);
  await tap('lux, cast');
  await moves(screen, 'north');
  await pause(4_000); // the 120 s hush at rate 50
  await take(/^The grimoire is here/, /^Take the grimoire/);
  await held(/^the grimoire/);
  await tap(/^Read/);
  await tap(LABEL.leave);
  await moves(screen, 'south');
  await tap(/opens Contents$/);
  await tap(/^Character/);
  await tap('Raise CHA');
  await tap(LABEL.backToWorld);
  await tap('ward, cast');
};

const magic = async (r: Walk, steps: Steps) => {
  const { screen } = r;
  const { tap, take, held } = steps;
  await loft(r, steps);
  await take(/^The oilcan is here/, /^Take the oilcan/);
  await take(/^The loft bucket is here/, /^Take the loft bucket/);
  await moves(screen, 'east');
  await held(/^the oilcan/); // a use recipe is offered on the held tool
  await tap(/^Oil/);
  await tap(LABEL.leave);
  await tap('Map');
  await tap(/^Open/);
  await held(/^the lantern/);
  await tap(/^Drop/); // the lit lantern left on the stair: the crypt below is dark
  await moves(screen, 'down');
  await r.note('The dark crypt');
  await moves(screen, 'up');
  await take(/^The lantern is here/, /^Take the lantern/);
  await moves(screen, 'down');
  await tap('flamma, cast');
  await tap(/^Flee/);
  await tap(LABEL.backToWorld);
  await moves(screen, 'down');
  await tap('flamma, cast'); // the second bolt kills the wight (magic 7)
  await held(/^the loft bucket/); // the bier burns 180 s: quench it at once (magic 8)
  await tap(/^Quench/);
  await tap(LABEL.leave);
  await moves(screen, 'up', 'west', 'west');
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
    const s = steps(screen);
    await crafts(screen, s);
    await pondAndStew(screen, s);
  },
);

walk('2-law', 'Law: bank, shop, hide, lift, fence, strongroom', async (r) => {
  const { screen } = r;
  await r.app.clearState();
  await settle();
  await scene(screen);
  await law(screen, steps(screen));
});

walk('3-magic', 'Magic: lux, hush, grimoire, ward, winch, flamma, golem', async (r) => {
  await r.app.clearState();
  await settle();
  await scene(r.screen);
  await magic(r, steps(r.screen));
});
