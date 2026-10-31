// Homestead H2 at 390 px (`npm run walkthrough`, the bundled chapter): the guided loop
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

// Change position until `to` shows, at most four turns.
const turnTo = (screen: Screen, tap: (label: RegExp) => Promise<void>) => async (to: string) => {
  for (
    let i = 0;
    i < 4 && !(await screen.getByRole('button', new RegExp(`^${to}, change`)).isVisible());
    i++
  )
    await tap(/change position$/);
};

// size: allow 46, the shared step helpers (tap, take, lesson, fixture ...) close over one screen
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
    await tap('carpenter, open');
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
  const position = turnTo(screen, tap);
  // A known word through the say field: open it, press the word's chip, press the send.
  const speak = async (word: string, how: string) => {
    await tap(LABEL.sayToRoom);
    await tap(new RegExp(`^${word}$`));
    await tap(new RegExp(`^${how}$`));
  };
  // A fixture's verbs live on its page (book-ui.md, Room page anatomy): open it, press, Leave.
  const fixture = async (name: string, verb: string, times = 1) => {
    await tap(`${name}, open`);
    for (let i = 0; i < times; i++) await tap(verb);
    await tap(LABEL.leave);
  };
  return { tap, take, lesson, held, position, moves, speak, fixture };
};
type Steps = ReturnType<typeof steps>;

const crafts = async (screen: Screen, { tap, take, lesson, held, moves, fixture }: Steps) => {
  await moves('north', 'west', 'west');
  await lesson('Learn whittling', 'Learn woodcutting');
  await take(/^(?:an )?axe, open$/i, /^Take an axe/);
  for (let i = 0; i < 2; i++) await take(/^(?:two sticks|stick), open$/i, /^Take a stick/);
  await fixture('saw bench', 'Carve a spoon', 2);
  await lesson('Learn carving (2 pennies)');
  await take(/^(?:a )?cot, open$/i, /^Take a cot/);
  await moves('east', 'south', 'west');
  await fixture('oak', 'Chop wood', 4);
  for (let i = 0; i < 2; i++)
    await take(/^(?:three|two) rabbit pelts, open$/i, /^Take a rabbit pelt/);
  await moves('east', 'north', 'west');
  await lesson('Learn carpentry (2 pennies)');
  await fixture('saw bench', 'Saw timber', 2);
  await moves('east');
  await fixture('stakes', 'Raise a timbered hut');
  await moves('north', 'south');
  await moves('south');
  await take(/^(?:a )?red apple, open$/i, /^Take a red apple/);
  await held(/^a red apple/);
  await tap(LABEL.giveTo);
  await tap(/^The farmer, give a red apple/);
  await tap(/^(?:the )?farmer, open$/i);
  await tap('Trade two pelts for a knife');
  await tap(LABEL.leave);
};

const pondAndStew = async (screen: Screen, { tap, take, held, position, moves }: Steps) => {
  await moves('east');
  await take(/^(?:a )?fishing rod, open$/i, /^Take a fishing rod/);
  const fish = /^(?:an? )?(trout|salmon|eel), open$/i;
  let landed = 0;
  for (let i = 0; landed < 2 && i < 12; i++) {
    await held(/^a fishing rod/);
    await tap(LABEL.useOn); // the rod's Pick list; a pick returns to World (loka-x6t.109)
    await tap(/, fish in the pond$/);
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
  await tap(LABEL.backToContents); // a Drop returns to Inventory (loka-8lpm)
  await tap(LABEL.backToWorld);
  await position('resting');
  await position('standing');
  await moves('south', 'south');
  await tap(/^(?:the )?cook, open$/i);
  await tap(/^Order a stew from two fish/);
  await tap(LABEL.leave);
  await new Promise((done) => setTimeout(done, 7_000)); // 300 s at rate 50
  await tap(/^(?:the )?cook, open$/i);
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
const law = async (screen: Screen, { tap, take, moves, fixture }: Steps) => {
  const npc = async (who: RegExp, ...labels: (string | RegExp)[]) => {
    await tap(who);
    for (const l of labels) await tap(l);
    await tap(LABEL.leave);
  };
  // Trade opens the person's buy page and its Sell card the sell page: Leave each, then the person.
  const shop = async (who: RegExp, ...labels: (string | RegExp)[]) => {
    await npc(who, LABEL.trade, ...labels);
    await tap(LABEL.leave);
    if (labels.includes(LABEL.sell)) await tap(LABEL.leave);
  };
  await moves('down', 'east');
  await npc(/^(?:the )?clerk, open$/i, /^Deposit five pennies/);
  await moves('west', 'north');
  await npc(/^(?:the )?market clerk, open$/i, /^Withdraw five pennies/);
  await shop(/^(?:the )?chandler, open$/i, /^Tallow candle — /);
  await moves('south', 'west');
  await fixture('barrels', 'Hide');
  await moves('east', 'north');
  await tap(/^(?:the )?merchant, open$/i);
  await tap(LABEL.lookPerson); // what a person carries is on their Look page (loka-aqnc)
  await take(/^(?:the )?merchant's purse, open/i, /^Lift$/);
  await moves('south', 'west');
  await shop(/^(?:the )?fence, open$/i, LABEL.sell, /^Merchant's purse — /);
  await moves('east', 'east');
  await npc(/^(?:the )?clerk, open$/i, /^Buy the strongroom/);
  await take(/^(?:the )?strongroom key, open$/i, /^Take the strongroom key/);
  await moves('west');
  await tap('Map');
  await tap(/^Unlock the strongroom door/);
  await tap(/^Open the strongroom door/);
  await tap('Go south');
  await take(/^(?:a )?strongroom chest, open$/i, /^Open a strongroom chest/);
  // Open turns to the chest's Inside page; Put stays on its item page (loka-mo0p)
  for (const l of [LABEL.close, /^Put a tallow candle/, LABEL.lookInside]) await tap(l);
  await take(/^(?:a )?tallow candle, open/i, /^Take a tallow candle/);
  await settle();
};

// Magic M2 (docs/showcase/magic-district.md steps 1 to 9), the Book e2e; ward is cast, not fought.
const loft = async (r: Walk, { tap, take, held, moves, speak, fixture }: Steps) => {
  const { screen } = r;
  const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));
  const wizard = async (choice: string) => {
    await tap(/^(?:the )?hedge-wizard, open$/i);
    await tap(/^Talk/);
    await tap(choice);
    await tap(LABEL.leaveConversation);
    await tap(LABEL.leave);
  };
  await moves('up');
  await expect(screen.getByRole('button', /ma 5\/5/).first()).toBeVisible();
  await wizard('Learn the word lux');
  await wizard('Fetch the second word');
  await fixture('hearth', 'Gather ash');
  await take(/^(?:the )?lantern, open$/i, /^Take the lantern/);
  await held(/^the lantern/);
  await tap(LABEL.castASpell); // the aimed spell's Pick list on the held lamp (loka-x6t.109)
  await tap(/^Lux, cast lux on/); // a pick returns to World
  await moves('north');
  await pause(4_000); // the 120 s hush at rate 50
  await take(/^(?:the )?grimoire, open$/i, /^Take the grimoire/);
  await held(/^the grimoire/);
  await tap(/^Read/);
  // The item leaves to Inventory (x6t.23), Inventory to Contents (loka-8lpm), then World.
  for (const l of [LABEL.leave, LABEL.backToContents, LABEL.backToWorld]) await tap(l);
  await moves('south');
  await tap(/opens Contents$/);
  await tap(/^Character/);
  // a section opened from Contents goes back to it (loka-8lpm)
  for (const l of ['Raise CHA', LABEL.backToContents, LABEL.backToWorld]) await tap(l);
  await speak('ward', LABEL.cast);
};

const magic = async (r: Walk, steps: Steps) => {
  const { screen } = r;
  const { tap, take, held, moves, speak } = steps;
  await loft(r, steps);
  await take(/^(?:the )?oilcan, open$/i, /^Take the oilcan/);
  await take(/^(?:the )?loft bucket, open$/i, /^Take the loft bucket/);
  await moves('east');
  await held(/^the oilcan/); // a use scripted action is offered on the held tool
  await tap(LABEL.useOn); // the oilcan's Pick list; a pick returns to World
  await tap(/, oil the winch$/);
  // the Map, a Contents section, draws no status line (loka-8lpm)
  for (const l of ['Map', /^Open/, LABEL.backToWorld]) await tap(l);
  await held(/^the lantern/);
  await tap(/^Drop/); // the lit lantern left on the stair: the crypt below is dark
  await tap(LABEL.backToContents); // a Drop returns to Inventory (loka-8lpm)
  await tap(LABEL.backToWorld);
  await moves('down');
  await r.note('The dark crypt');
  await moves('up');
  await take(/^(?:the )?lantern, open$/i, /^Take the lantern/);
  await moves('down');
  const flamma = async () => {
    await tap(/^(?:an? )?wight, open$/i);
    await tap(LABEL.castASpell); // the aimed spell's Pick list on the wight's page (loka-x6t.109)
    await tap(/^Flamma, cast flamma on/);
  };
  await flamma();
  await tap(/^Flee/);
  await tap(LABEL.backToWorld);
  await moves('down');
  await flamma(); // the second bolt kills the wight (magic 7)
  // No Douse: the bier burns 180 game s, about 3.6 s of wall time at rate 50, a race the walk
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
  const { tap, moves, speak } = steps(r);
  await moves('west', 'down', 'north', 'north'); // the passage plate bites on the way
  // Afraid lasts 600 game s (~12 s of wall time at rate 50): nothing slow between shout and Attack.
  await speak('begone', LABEL.shout);
  await tap(/^two cowering goblins, open$/i); // both afraid: one link, their mood words (W6)
  await tap(/Attack/);
  // A round is 150 game s, 3 s of wall time at rate 50.
  await expect(screen.getByText(/A goblin flees south/).first()).toBeVisible({ timeout: 10_000 });
  await r.note('The pack flees');
});
