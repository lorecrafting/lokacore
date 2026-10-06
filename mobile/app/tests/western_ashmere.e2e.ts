import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

// Break: a mill/cottage DOM route or standalone Read history cannot return safely or survive browser SQLite reload.
test('Western Ashmere documents and all dark stairs persist through browser reload', async ({
  app,
  screen,
}) => {
  const go = async (direction: string, room: string) => {
    await screen.getByRole('button', 'Map').tap();
    await screen.getByRole('button', `Go ${direction}`).tap();
    await expect(screen.getByRole('button', `Look, ${room}`)).toBeVisible();
  };
  const reload = async (room: string) => {
    await app.restart();
    await screen.getByRole('button', 'Continue').tap();
    await expect(screen.getByRole('button', `Look, ${room}`)).toBeVisible();
  };
  await app.clearState();
  await screen.getByRole('button', 'Fey-touched').tap();
  await screen.getByRole('button', 'Continue').tap();
  await go('west', 'Boathouse');
  await go('south', 'Old Mill');
  await screen.getByRole('button', "Hob's ledger").tap();
  await expect(
    screen.getByText(
      'Grain received, flour delivered. Hob has balanced every line; a note in the margin reads: Mind the loose board upstairs.',
    ),
  ).toBeVisible();
  await screen.getByRole('button', 'Leave').tap();
  await app.restart();
  await screen.getByRole('button', 'Continue').tap();
  await expect(
    screen.getByText(
      'Grain received, flour delivered. Hob has balanced every line; a note in the margin reads: Mind the loose board upstairs.',
    ),
  ).toBeVisible();
  await screen.getByRole('button', 'Leave').tap();
  await go('up', 'Mill Loft');
  await expect(screen.getByText('Darkness fills the loft. The stair leads down.')).toBeVisible();
  await reload('Mill Loft');
  await go('down', 'Old Mill');
  await go('down', 'Mill Cellar');
  await expect(screen.getByText('Darkness fills the cellar. The stair leads up.')).toBeVisible();
  await reload('Mill Cellar');
  await go('up', 'Old Mill');
  await go('south', 'Empty Cottage');
  await screen.getByRole('button', 'For-sale sign').tap();
  await expect(
    screen.getByText(
      'This cottage is for sale. Enquiries may be left with the miller. No terms have been agreed.',
    ),
  ).toBeVisible();
  await screen.getByRole('button', 'Leave').tap();
  await app.restart();
  await screen.getByRole('button', 'Continue').tap();
  await expect(
    screen.getByText(
      'This cottage is for sale. Enquiries may be left with the miller. No terms have been agreed.',
    ),
  ).toBeVisible();
  await screen.getByRole('button', 'Leave').tap();
  await go('up', 'Cottage Loft');
  await go('down', 'Empty Cottage');
  await go('north', 'Old Mill');
  await go('north', 'Boathouse');
  await go('east', 'Ferry Landing');
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
  const go = async (direction: string, room: string) => {
    await screen.getByRole('button', 'Map').tap();
    await screen.getByRole('button', `Go ${direction}`).tap();
    await expect(screen.getByRole('button', `Look, ${room}`)).toBeVisible();
  };
  await go('north', 'Well Lane');
  await go('west', 'Chandler');
  await screen.getByRole('button', /Peg Harrow, open/).tap();
  await screen.getByRole('button', 'Buy a torch — 3p').tap();
  await screen.getByRole('button', 'Leave').tap();
  await screen.getByRole('button', /^Contents, Character/).tap();
  await screen.getByRole('button', 'Equipment & Inventory').tap();
  await screen.getByRole('button', 'a torch, open').tap();
  await screen.getByRole('button', 'Ignite a torch').tap();
  await screen.getByRole('button', 'Leave').tap();
  await go('east', 'Well Lane');
  await go('south', 'Ferry Landing');
  await go('west', 'Boathouse');
  await go('south', 'Old Mill');
  await go('up', 'Mill Loft');
  await screen.getByRole('button', 'Hob, open').tap();
  await screen.getByRole('button', 'Talk to Hob').tap();
  await expect(
    screen
      .getByText('Hob says, “The wheel is quiet tonight. Mind your footing on the loft boards.”')
      .first(),
  ).toBeVisible();
  await screen.getByRole('button', 'Leave').first().tap();
  await screen.getByRole('button', 'Leave').tap();
  await go('down', 'Old Mill');
  await browser.evaluate(() => {
    localStorage.setItem('d3-clock-offset', String(864_000));
    return true;
  });
  await expect(screen.getByRole('button', 'Hob, open')).toBeVisible();
  await screen.getByRole('button', 'Hob, open').tap();
  await screen.getByRole('button', 'Talk to Hob').tap();
  await expect(
    screen
      .getByText('Hob says, “The wheel is quiet tonight. Mind your footing on the loft boards.”')
      .first(),
  ).toBeVisible();
  await app.restart();
  await screen.getByRole('button', 'Continue').tap();
  await screen.getByRole('button', 'Hob, open').tap();
  await expect(
    screen
      .getByText('Hob says, “The wheel is quiet tonight. Mind your footing on the loft boards.”')
      .first(),
  ).toBeVisible();
  await screen.getByRole('button', 'Leave').first().tap();
  await screen.getByRole('button', 'Leave').tap();
});
