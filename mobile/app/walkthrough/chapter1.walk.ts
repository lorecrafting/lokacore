// Chapter 1 routes for the polish contact sheet (`npm run walkthrough`, walkthrough.config.ts).
// Each route follows an E1 recorder recipe in kernel/ts/test, translated by hand from its action
// keys to the Book's button labels. A missing control ends the route with a "Dead end" page.
import { test, type Browser } from '@e2e-dev/web';
import { expect, type TestFixtures } from 'e2e';
// @ts-expect-error the app has no Node types; the e2e runner is Node
import { mkdirSync, writeFileSync } from 'node:fs';
import { begin, go } from '../tests/steps.ts';

type Fixtures = Pick<TestFixtures, 'app' | 'screen'> & { browser: Browser };
type Screen = Fixtures['screen'];

// In the page: the top page's title, in-game time and buttons. Pages below it stay in the DOM,
// so only visible, unhidden elements count, and the last header is the top page's.
const top = () => {
  const shown = (selector: string) =>
    [...document.querySelectorAll(selector)].filter(
      (e) => e.checkVisibility() && !e.closest('[aria-hidden="true"]'),
    );
  return {
    title:
      shown('[role="heading"]').at(-1)?.textContent ??
      shown('[aria-label^="Look, "]').at(-1)?.getAttribute('aria-label')?.slice(6) ??
      '',
    time: shown('[aria-label^="day "]').at(-1)?.getAttribute('aria-label') ?? '',
    buttons: shown('[role="button"]').map((b) => b.getAttribute('aria-label')),
  };
};

// A route's screen: before every tap it waits for the control, lets the reduced-motion fade
// (motion.fade, 160 ms) settle, screenshots the page and logs the step to .walkthrough/steps.
// A tap's page and its save land after the 160 ms fade; an instant read waits this long first.
const settle = () => new Promise((r) => setTimeout(r, 250));

function recorder(route: string, title: string, { app, screen, browser }: Fixtures) {
  const dir = new URL('../.walkthrough/steps/', import.meta.url);
  mkdirSync(dir, { recursive: true });
  const steps: object[] = [];
  const note = async (action: string) => {
    await settle();
    const label = `${route}-${String(steps.length + 1).padStart(3, '0')}`;
    const page = await browser.evaluate(top);
    steps.push({ action, title: page.title, time: page.time, shot: await app.screenshot(label) });
    writeFileSync(new URL(`${route}.json`, dir), JSON.stringify({ title, steps }, null, 1));
  };
  type Locator = ReturnType<Screen['getByRole']>;
  const wrap = (locator: Locator, name: unknown): Locator =>
    new Proxy(locator, {
      get(target, key) {
        const value = Reflect.get(target, key);
        if (typeof value !== 'function') return value;
        if (key === 'tap' || key === 'doubleTap')
          return async (...args: unknown[]) => {
            await expect(target)
              .toBeVisible()
              .catch(async () => {
                throw new Error(
                  `walk dead end: no "${String(name)}"; buttons: ${(await browser.evaluate(top)).buttons.join(' | ')}`,
                );
              });
            await note(`${key === 'tap' ? 'Tap' : 'Double-tap'} ${String(name)}`);
            return value.apply(target, args);
          };
        return (...args: unknown[]) => {
          const result = value.apply(target, args);
          return typeof result?.tap === 'function' ? wrap(result, name) : result;
        };
      },
    });
  const walked = new Proxy(screen, {
    get: (target, key) =>
      key === 'getByRole'
        ? (...args: Parameters<Screen['getByRole']>) => wrap(target.getByRole(...args), args[1])
        : Reflect.get(target, key),
  }) as Screen;
  // A riddle answer on the letter tiles ("Letter L, tile 5"), each tile used once, then Submit.
  const spell = async (word: string) => {
    await settle();
    const tiles = (await browser.evaluate(top)).buttons.filter((b) => b?.startsWith('Letter '));
    for (const letter of word) {
      const tile = tiles.find((t) => t?.startsWith(`Letter ${letter},`));
      if (!tile) throw new Error(`walk dead end: no tile for ${letter} in ${word}`);
      tiles.splice(tiles.indexOf(tile), 1);
      await walked.getByRole('button', tile).tap();
    }
    await walked.getByRole('button', 'Submit').tap();
  };
  return {
    app,
    spell,
    screen: walked,
    note,
  };
}

const talk = async (screen: Screen, npc: string, ...choices: string[]) => {
  await screen.getByRole('button', `${npc}, open`).tap();
  for (const choice of choices) {
    await screen.getByRole('button', `Talk to ${npc}`).last().tap();
    await screen.getByRole('button', choice).tap();
  }
  await screen.getByRole('button', 'Leave').tap();
};
const moves = async (screen: Screen, ...directions: string[]) => {
  for (const d of directions) await go(screen, d);
};
// A scene: Continue until its pages end (at most 20, so a stuck scene fails the route).
const scene = async (screen: Screen) => {
  for (
    let page = 0;
    await settle(), await screen.getByRole('button', 'Continue').isVisible();
    page++
  ) {
    if (page === 20) throw new Error('walk dead end: the scene never ends');
    await screen.getByRole('button', 'Continue').tap();
  }
};

type Walk = ReturnType<typeof recorder>;
// One route, one test, one contact-sheet section; `id` orders the sections.
const walk = (id: string, title: string, route: (r: Walk) => Promise<void>) =>
  test(title, async (f) => {
    // As page_turn.e2e.ts: a cold Metro builds the bundle on first request, past the default wait.
    await f.app.open();
    await expect(f.screen.getByRole('button', 'Fey-touched')).toBeVisible({ timeout: 60_000 });
    const r = recorder(id, title, f);
    try {
      await route(r);
    } catch (error) {
      // Any failure ends the section on a captioned dead-end page.
      await r.note(`Dead end: ${String(error).split('\n')[0]}`);
      throw error;
    }
    await r.note('End of route');
  });

// e1_paths.ts ending(child, allegiance) for each of its ENDINGS (copied: that module needs Node
// types this app's tsconfig lacks): search, childReturn (unless lost), bell, epilogue.
const ENDINGS = [
  ['rescued', 'prior'],
  ['rescued', 'fox'],
  ['stays', 'prior'],
  ['stays', 'fox'],
  ['lost', 'prior'],
] as const;
for (const [child, allegiance] of ENDINGS)
  walk(`1-main-${child}-${allegiance}`, `Main route: Wren ${child}, ${allegiance}`, async (r) => {
    const { screen } = r;
    await begin({ app: r.app, screen }, 'Fen-born');
    // search
    await talk(screen, 'Elspeth', 'Will you look around the Green for a sign of Wren?');
    await moves(screen, 'north', 'north');
    await screen.getByRole('button', 'a fox drawing, open').tap();
    await screen.getByRole('button', 'Take a fox drawing').tap();
    await moves(screen, 'south', 'south');
    await talk(screen, 'Elspeth', 'I found this drawing on the Green.');
    await moves(screen, 'south', 'south');
    await screen.getByRole('button', 'Tracks').tap();
    await screen.getByRole('button', 'Study tracks').tap();
    await screen.getByRole('button', 'Leave').tap();
    if (child !== 'lost') {
      // childReturn(child)
      await moves(screen, 'south', 'south');
      await talk(screen, 'Vesper', '“Wren, your mother is looking for you.”');
      await screen.getByRole('button', 'Vesper, open').tap();
      await screen.getByRole('button', 'Talk to Vesper').last().tap();
      await r.spell('LANTERN');
      await screen.getByRole('button', 'Leave').tap();
      if (child === 'stays')
        await talk(screen, 'Vesper', '“I’ll take your message to Elspeth. Wren can stay.”');
      else await talk(screen, 'Wren', '“Come with me. I’ll take you back to Elspeth.”');
      await moves(screen, 'north', 'north', 'north', 'north');
      await talk(
        screen,
        'Elspeth',
        child === 'stays' ? 'Give Elspeth Vesper’s message.' : 'Bring Wren to his mother.',
      );
    }
    // bell(allegiance, lost)
    await moves(screen, ...Array(child === 'lost' ? 7 : 5).fill('north'));
    await talk(screen, 'Prior Aldric', '“I’ll ring the bell.”');
    await moves(screen, 'up', 'up');
    await screen.getByRole('button', 'Chapel bell').tap();
    await screen
      .getByRole('button', allegiance === 'prior' ? 'Ring bell' : 'Leave the bell silent')
      .tap();
    await scene(screen);
    await moves(screen, 'down', 'down', 'south', 'south', 'south');
    // the epilogue at the market cross
    await screen.getByRole('button', 'Begin epilogue').tap();
    await scene(screen);
  });

// e1_optional_quests.ts chandlersDebt: Peg's ledger delivered to Aldric on time.
walk('2-chandlers-debt', "Side quest: the Chandler's debt, on time", async (r) => {
  const { screen } = r;
  await begin({ app: r.app, screen }, 'Road-born');
  await moves(screen, 'north', 'west');
  await talk(
    screen,
    'Peg Harrow',
    'Take the ledger; promise to deliver it by the second day at six.',
  );
  await moves(screen, 'east', 'north', 'north', 'north', 'north');
  await talk(screen, 'Prior Aldric', 'Give Aldric Peg’s ledger before the deadline.');
});

// e1_optional_quests.ts lanternDream('follow_fox'); tests/book.e2e.ts plays the Wake branch.
walk('3-lantern-dream', 'Side quest: a room at the Lantern, follow the fox', async (r) => {
  const { screen } = r;
  await begin({ app: r.app, screen }, 'Road-born');
  await moves(screen, 'north', 'east');
  await screen.getByRole('button', 'Widow Maud, open').tap();
  await screen.getByRole('button', 'Rent room — 3p').tap();
  await screen.getByRole('button', 'Leave').tap();
  await moves(screen, 'up');
  await screen.getByRole('button', 'Bed').tap();
  await screen.getByRole('button', 'Rest').tap();
  await scene(screen);
  await screen.getByRole('button', 'Follow the fox').tap();
  await scene(screen);
  await screen.getByRole('button', 'Acknowledge').tap();
});

// e1_wisp_herbs.ts wispWard: three wrong anagrams close the sitting, TIDE answers it, Aldric's ward.
walk('4-wisp-ward', 'Side quest: the wisp ward', async (r) => {
  const { screen } = r;
  await begin({ app: r.app, screen }, 'Road-born');
  await moves(screen, 'south', 'south', 'south', 'east');
  await screen.getByRole('button', 'Marsh glow').tap(); // opening the glow seeks the wisp
  await screen.getByRole('button', 'Leave').tap();
  await screen.getByRole('button', 'Wisp, open').tap();
  await screen.getByRole('button', 'Speak to Wisp Wisp').tap();
  await screen.getByRole('button', 'Accept the riddle').tap();
  await screen.getByRole('button', 'Leave').tap();
  await screen.getByRole('button', 'Wisp, open').tap();
  await screen.getByRole('button', 'Ask Wisp again Wisp').tap();
  for (const wrong of ['EDIT', 'DIET', 'TIED']) await r.spell(wrong);
  await screen.getByRole('button', 'Ask Wisp again Wisp').tap();
  await r.spell('TIDE');
  await screen.getByRole('button', 'Leave').tap();
  await moves(screen, 'west', ...Array(8).fill('north'));
  await screen.getByRole('button', 'Prior Aldric, open').tap();
  await screen.getByRole('button', 'Ask about ward Prior Aldric').tap();
  await screen.getByRole('button', 'Discuss the ward').tap();
  await screen.getByRole('button', 'Leave').tap();
});
