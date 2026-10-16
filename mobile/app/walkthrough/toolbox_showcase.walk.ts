// Homestead H2 at 390 px (`LOKA_WALK=toolbox_showcase npm run walkthrough`): the guided loop
// (docs/showcase/homestead-district.md steps 2 to 12) in the Book; the farm step is kernel-only.
import { LABEL } from '../book/labels.ts';
import { moves, scene, settle, walk } from './walk.ts';

walk(
  '1-homestead',
  'Homestead: lessons, carve, build, rest, give, barter, fish, stew',
  async (r) => {
    const { screen } = r;
    const tap = async (label: string | RegExp) => {
      await settle();
      await screen.getByRole('button', label).first().tap();
    };
    await r.app.clearState();
    await settle();
    await scene(screen);
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
    const position = async (to: string) => {
      for (
        let i = 0;
        i < 4 && !(await screen.getByRole('button', new RegExp(`^${to}, change`)).isVisible());
        i++
      )
        await tap(/change position$/);
    };
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
  },
);
