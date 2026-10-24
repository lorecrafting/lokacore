// The walkthrough's route recorder (`npm run walkthrough`, walkthrough.config.ts): every tap waits
// for its control, screenshots the page and logs the step for the contact sheet (sheet.cjs). A
// missing control ends the route with a "Dead end" page. Routes: <cartridge>.walk.ts.
import { test, type Browser } from '@e2e-dev/web';
import { expect, type JsonValue, type TestFixtures } from 'e2e';
// @ts-expect-error the app has no Node types; the e2e runner is Node
import { mkdirSync, writeFileSync } from 'node:fs';
import { go } from '../tests/steps.ts';
import { LABEL } from '../book/labels.ts';

type Fixtures = Pick<TestFixtures, 'app' | 'screen'> & { browser: Browser };
export type Screen = Fixtures['screen'];

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
      shown('[aria-label$=", look"]').at(-1)?.getAttribute('aria-label')?.slice(0, -6) ??
      '',
    time: shown('[aria-label^="day "]').at(-1)?.getAttribute('aria-label') ?? '',
    buttons: shown('[role="button"]').map((b) => b.getAttribute('aria-label')),
  };
};

type Offer = {
  action_key: string;
  command?: string;
  available: boolean;
  label: string;
  input: JsonValue[];
  target: { kind: string };
  target_ids?: string[];
  reason?: { code: string };
};
type View = {
  actions: Offer[];
  exits: { direction: string; door?: { state: string; actions: Offer[] } }[];
  scene?: JsonValue;
  combat?: JsonValue;
  choice?: JsonValue;
  storylet?: string;
  notices?: { id: string }[];
  notice_boards?: { notices: { id: string }[] }[];
};
type Live = {
  view: View;
  text: Record<string, string>;
  buttons: string[];
  lines: string[];
  notes: string[];
};

// In the page, in one turn: the live GameView the Book draws (App.tsx keeps the session on
// globalThis), its offer labels' texts, and the top page's visible button names and text lines;
// notes are the lines outside the event log (lines.tsx LogLines).
const live = (): Live => {
  const shown = (selector: string) =>
    [...document.querySelectorAll(selector)].filter(
      (e) => e.checkVisibility() && !e.closest('[aria-hidden="true"]'),
    );
  const game = (
    globalThis as unknown as {
      loka_session: { game(): { view(): { view: View }; text(key: string): string | undefined } };
    }
  ).loka_session.game();
  const { view } = game.view();
  const keys = [...view.actions, ...view.exits.flatMap((e) => e.door?.actions ?? [])];
  const lines = shown('*').filter((e) =>
    [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()),
  );
  return {
    view,
    text: Object.fromEntries(keys.map((a) => [a.label, game.text(a.label) ?? ''])),
    buttons: shown('[role="button"]').map((b) => b.getAttribute('aria-label') ?? ''),
    lines: lines.map((e) => e.textContent ?? ''),
    notes: lines
      .filter((e) => !e.closest('[data-testid="log-lines"]'))
      .map((e) => e.textContent ?? ''),
  };
};

// Drawn by its own control, not a World verb (book-ui.md): the say field, position, the title's
// Look, a scene's Continue, a choice, Flee, the Character page's Raise, Scan.
const OWN =
  'say whisper shout cast look flee choose close_choice continue stand sit rest sleep raise_attribute scan';
const KEY = /\b[a-z][a-z0-9_]+\.[a-z][a-z0-9_]+/;

// The place offers World once drew as cards and refused notes (owner 2026-10-23: no longer).
const placeOffers = (view: View) =>
  view.actions.filter(
    (a) =>
      !a.input.length &&
      (a.target.kind === 'none' || (a.target.kind === 'entity' && a.target_ids?.length)) &&
      !OWN.split(' ').includes(a.action_key),
  );

// The room page against its GameView (pass-1 check 8; book-ui.md Room page anatomy): no place
// offer is a control or a `label: reason` note, no shut door's Open or Unlock is a card (owner
// 2026-10-23: the Map and the joystick open doors), and no text is a raw key.
function roomDrawn({ view, text, buttons, lines, notes }: Live) {
  if (view.scene || view.combat || view.choice) return { problems: [], seen: 'not World' };
  // An untexted label shows its key's last word (words.ts sayers).
  const label = (a: Offer) =>
    (text[a.label] || a.label.split('.').at(-1)!.replaceAll('_', ' ')).toLowerCase();
  const place = placeOffers(view);
  const doors = view.exits.flatMap(({ door, direction }) =>
    (door && door.state !== 'open' ? door.actions : [])
      .filter((a) => a.available && ['open', 'unlock'].includes(a.command ?? a.action_key))
      .map((a) => ({ a, dir: direction })),
  );
  const named = buttons.map((b) => b.toLowerCase());
  const problems = [
    ...place.filter((a) => named.includes(label(a))).map((a) => `World verb "${label(a)}"`),
    ...place
      .filter((a) => notes.some((l) => l.toLowerCase().startsWith(`${label(a)}: `)))
      .map((a) => `refused note "${label(a)}" on World`),
    // A door card would read `label door (direction)`; World draws none.
    ...doors
      .filter(({ a, dir }) =>
        named.some((n) => n.startsWith(`${label(a)} `) && n.endsWith(` (${dir})`)),
      )
      .map(({ a, dir }) => `door card "${label(a)} (${dir})" on World`),
    ...[...buttons, ...lines].filter((s) => KEY.test(s)).map((s) => `raw key in "${s}"`),
  ];
  return {
    problems,
    seen: `${place.length} place offers, ${doors.length} door`,
  };
}

// A route's screen: before every tap it waits for the control, lets the reduced-motion fade
// (motion.fade, 160 ms) settle, screenshots the page and logs the step to .walkthrough/steps.
// A tap's page and its save land after the 160 ms fade; an instant read waits this long first.
export const settle = () => new Promise((r) => setTimeout(r, 250));

// A riddle answer on the letter tiles ("L, tile 5"), each tile used once, then Submit.
const spellOn = (walked: Screen, browser: Browser) => async (word: string) => {
  await settle();
  const tiles = (await browser.evaluate(top)).buttons.filter((b) => /^., tile \d+$/.test(b ?? ''));
  for (const letter of word) {
    const tile = tiles.find((t) => t?.startsWith(`${letter},`));
    if (!tile) throw new Error(`walk dead end: no tile for ${letter} in ${word}`);
    tiles.splice(tiles.indexOf(tile), 1);
    await walked.getByRole('button', tile).tap();
  }
  await walked.getByRole('button', LABEL.submit).tap();
};

type Locator = ReturnType<Screen['getByRole']>;

// The screen whose taps first wait for the control, then log a step.
function narrated(screen: Screen, browser: Browser, note: (action: string) => Promise<void>) {
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
  return walked;
}

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
  const walked = narrated(screen, browser, note);
  const spell = spellOn(walked, browser);
  // After an arrival: the room page against the GameView it drew. A tick can move the view past
  // the drawn page, so a mismatch is re-read a few times (by count, no deadline) before it fails.
  const room = async () => {
    for (let read = 1; ; read++) {
      await settle();
      const { problems, seen } = roomDrawn(await browser.evaluate(live));
      if (!problems.length) return console.log(`walk room: ${seen}`);
      if (read === 4) throw new Error(`walk room page: ${problems.join('; ')}`);
    }
  };
  return {
    app,
    spell,
    screen: walked,
    note,
    room,
  };
}

export const talk = async (screen: Screen, npc: string, ...choices: string[]) => {
  await screen.getByRole('button', new RegExp(`^${npc}, open$`, 'i')).tap();
  for (const choice of choices) {
    await screen.getByRole('button', `Talk to ${npc}`).last().tap();
    await screen.getByRole('button', choice).tap();
    await screen.getByRole('button', LABEL.leaveConversation).tap();
  }
  await screen.getByRole('button', LABEL.leave).tap();
};
export const moves = async (screen: Screen, ...directions: string[]) => {
  for (const d of directions) await go(screen, d);
};
// A scene: Continue until its pages end (at most 20, so a stuck scene fails the route).
export const scene = async (screen: Screen) => {
  for (
    let page = 0;
    await settle(), await screen.getByRole('button', 'Continue').isVisible();
    page++
  ) {
    if (page === 20) throw new Error('walk dead end: the scene never ends');
    await screen.getByRole('button', 'Continue').tap();
  }
};

export type Walk = ReturnType<typeof recorder>;
// One route, one test, one contact-sheet section; `id` orders the sections.
export const walk = (id: string, title: string, route: (r: Walk) => Promise<void>) =>
  test(title, async (f) => {
    // As page_turn.e2e.ts: a cold Metro builds the bundle on first request, past the default wait;
    // the first page is the cartridge's (ancestry choices, or its entry room).
    await f.app.open();
    await expect(f.screen.getByRole('button', /./).first()).toBeVisible({ timeout: 60_000 });
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
