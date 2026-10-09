import { beforeEach, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import type { TestFixtures } from 'e2e';
import { go, litTorch, reopen, type Screen, reducedMotion } from './steps.ts';

// Long walks: the pages cross-fade (steps.ts reducedMotion).
beforeEach(({ browser }) => reducedMotion(browser));

const LEDGER =
  'Grain received, flour delivered. Hob has balanced every line; a note in the margin reads: Mind the loose board upstairs.';
const SIGN =
  'This cottage is for sale. Enquiries may be left with the miller. No terms have been agreed.';

// Break: a mill/cottage DOM route or standalone Read history cannot return safely or survive browser SQLite reload.
test('Western Ashmere documents and all dark stairs persist through browser reload', async ({
  app,
  screen,
}) => {
  const reload = async (room: string) => {
    await reopen({ app, screen });
    await expect(screen.getByRole('button', `Look, ${room}`)).toBeVisible();
  };
  await app.clearState();
  await screen.getByRole('button', 'Fey-touched').tap();
  await screen.getByRole('button', 'Continue').tap();
  await go(screen, 'west', 'Boathouse');
  await go(screen, 'south', 'Old Mill');
  await readTwice({ app, screen }, "Hob's ledger", LEDGER);
  await go(screen, 'up', 'Mill Loft');
  await expect(screen.getByText('Darkness fills the loft. The stair leads down.')).toBeVisible();
  await reload('Mill Loft');
  await go(screen, 'down', 'Old Mill');
  await go(screen, 'down', 'Mill Cellar');
  await expect(screen.getByText('Darkness fills the cellar. The stair leads up.')).toBeVisible();
  await reload('Mill Cellar');
  await go(screen, 'up', 'Old Mill');
  await go(screen, 'south', 'Empty Cottage');
  await readTwice({ app, screen }, 'For-sale sign', SIGN);
  await go(screen, 'up', 'Cottage Loft');
  await go(screen, 'down', 'Empty Cottage');
  await go(screen, 'north', 'Old Mill');
  await go(screen, 'north', 'Boathouse');
  await go(screen, 'east', 'Ferry Landing');
});

// Break: scheduled Hob is invisible while lit, remains offered after departure, or loses Conversation/Leave across browser reopen.
test('Hob can be met at both scheduled destinations using an isolated controlled browser clock', async ({
  app,
  screen,
  browser,
}) => {
  await browser.addInitScript(() => {
    const base = Date.now();
    Date.now = () => base + Number(localStorage.getItem('d3-clock-offset') ?? 0);
    Object.defineProperty(performance, 'now', {
      value: () => Number(localStorage.getItem('d3-clock-offset') ?? 0),
    });
  });
  await app.clearState();
  await browser.reload();
  await screen.getByRole('button', 'Fey-touched').tap();
  await screen.getByRole('button', 'Continue').tap();
  await go(screen, 'north', 'Well Lane');
  await go(screen, 'west', 'Chandler');
  await litTorch(screen);
  await go(screen, 'east', 'Well Lane');
  await go(screen, 'south', 'Ferry Landing');
  await go(screen, 'west', 'Boathouse');
  await go(screen, 'south', 'Old Mill');
  await go(screen, 'up', 'Mill Loft');
  await meetHob(screen);
  await screen.getByRole('button', 'Leave').first().tap();
  await screen.getByRole('button', 'Leave').tap();
  await go(screen, 'down', 'Old Mill');
  await browser.evaluate(() => {
    localStorage.setItem('d3-clock-offset', String(864_000));
    return true;
  });
  await expect(screen.getByRole('button', 'Hob, open')).toBeVisible();
  await meetHob(screen);
  await reopen({ app, screen });
  await screen.getByRole('button', 'Hob, open').tap();
  await heardHob(screen);
  await screen.getByRole('button', 'Leave').first().tap();
  await screen.getByRole('button', 'Leave').tap();
});

// A standalone Read shows its text, returns, and shows the same text after a reopen.
async function readTwice(
  { app, screen }: Pick<TestFixtures, 'app' | 'screen'>,
  label: string,
  text: string,
) {
  await screen.getByRole('button', label).tap();
  await expect(screen.getByText(text)).toBeVisible();
  await screen.getByRole('button', 'Leave').tap();
  await reopen({ app, screen });
  await expect(screen.getByText(text)).toBeVisible();
  await screen.getByRole('button', 'Leave').tap();
}

async function meetHob(screen: Screen) {
  await screen.getByRole('button', 'Hob, open').tap();
  await screen.getByRole('button', 'Talk to Hob').tap();
  await heardHob(screen);
}

const heardHob = (screen: Screen) =>
  expect(
    screen
      .getByText('Hob says, “The wheel is quiet tonight. Mind your footing on the loft boards.”')
      .first(),
  ).toBeVisible();
