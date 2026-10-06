import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

// Breaks: the actual swim lesson, either bottom route, detail countdown or free Surface is lost in the browser Book.
test('both water bottoms keep lit loot and a free Surface across browser reload', async ({
  app,
  screen,
}) => {
  const go = async (direction: string, room: string) => {
    await screen.getByRole('button', 'Map').tap();
    await screen.getByRole('button', `Go ${direction}`).tap();
    await expect(screen.getByRole('button', `Look, ${room}`)).toBeVisible();
  };
  await app.clearState();
  await screen.getByRole('button', 'Continue').tap();
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
  await screen.getByRole('button', 'Rope ferry').tap();
  await screen.getByRole('button', 'Board — 2p').doubleTap();
  await go('east', 'Isle Hut');
  await screen.getByRole('button', 'Mother Sedge, open').tap();
  await screen.getByRole('button', 'Learn swim — free Mother Sedge').tap();
  await screen.getByRole('button', 'Learn swim — free').tap();
  await expect(screen.getByText(/You have learned swim/)).toBeVisible();
  await screen.getByRole('button', 'Leave').tap();
  await go('west', 'Fen Isle Landing');
  await screen.getByRole('button', 'Rope ferry').tap();
  await screen.getByRole('button', 'Return — free').tap();
  await go('east', 'Ferry Landing');
  await go('north', 'Well Lane');
  await go('down', 'Well Shaft');
  await go('down', 'Well Bottom');
  await expect(screen.getByText(/seconds to surface/)).toBeVisible();
  await screen.getByRole('button', 'old coin, open').tap();
  await expect(screen.getByText(/A worn coin, green with age/)).toBeVisible();
  await expect(screen.getByText(/seconds to surface/)).toBeVisible();
  await app.restart();
  await screen.getByRole('button', 'Continue').tap();
  await expect(screen.getByRole('button', 'Look, Well Bottom')).toBeVisible();
  await expect(screen.getByText(/seconds to surface/)).toBeVisible();
  await screen.getByRole('button', 'Surface (free)').tap();
  await expect(screen.getByRole('button', 'Look, Well Shaft')).toBeVisible();
  await go('up', 'Well Lane');
  await go('south', 'Ferry Landing');
  await go('south', 'Reed Path');
  await go('south', 'Reed Bank');
  await go('west', 'Willow Shade');
  await go('south', 'Drowned Oak');
  await go('south', 'Black Pool');
  await go('down', 'Pool Bottom');
  await expect(screen.getByText(/seconds to surface/)).toBeVisible();
  await expect(screen.getByRole('button', 'sunken chest, open')).toBeVisible();
  await screen.getByRole('button', 'Surface (free)').tap();
  await expect(screen.getByRole('button', 'Look, Black Pool')).toBeVisible();
});

// Breaks: an elapsed browser reopen renews a dive or Chapel recovery loses the original carried item.
test('expired dive returns to Chapel and recovers original belongings once after reload', async ({
  app,
  screen,
  browser,
}) => {
  await browser.addInitScript(() => {
    const base = Date.now();
    Date.now = () => base + Number(localStorage.getItem('d6-clock-offset') ?? 0);
    Object.defineProperty(performance, 'now', {
      value: () => Number(localStorage.getItem('d6-clock-offset') ?? 0),
    });
  });
  const go = async (direction: string, room: string) => {
    await screen.getByRole('button', 'Map').tap();
    await screen.getByRole('button', `Go ${direction}`).tap();
    await expect(screen.getByRole('button', `Look, ${room}`)).toBeVisible();
  };
  await app.clearState();
  await browser.reload();
  await screen.getByRole('button', 'Continue').tap();
  await go('north', 'Well Lane');
  await go('west', 'Chandler');
  await screen.getByRole('button', /Peg Harrow, open/).tap();
  await screen.getByRole('button', 'Buy a torch — 3p').tap();
  await screen.getByRole('button', 'Leave').tap();
  await go('east', 'Well Lane');
  await go('south', 'Ferry Landing');
  await go('west', 'Boathouse');
  await screen.getByRole('button', 'Rope ferry').tap();
  await screen.getByRole('button', 'Board — 2p').doubleTap();
  await go('east', 'Isle Hut');
  await screen.getByRole('button', 'Mother Sedge, open').tap();
  await screen.getByRole('button', 'Learn swim — free Mother Sedge').tap();
  await screen.getByRole('button', 'Learn swim — free').tap();
  await screen.getByRole('button', 'Leave').tap();
  await go('west', 'Fen Isle Landing');
  await screen.getByRole('button', 'Rope ferry').tap();
  await screen.getByRole('button', 'Return — free').tap();
  await go('east', 'Ferry Landing');
  await go('north', 'Well Lane');
  await go('down', 'Well Shaft');
  await go('down', 'Well Bottom');
  await browser.evaluate(() => {
    localStorage.setItem('d6-clock-offset', String(121_000));
    return true;
  });
  await app.restart();
  await screen.getByRole('button', 'Continue').tap();
  await expect(screen.getByRole('button', 'Look, Chapel Nave')).toBeVisible();
  await expect(screen.getByRole('button', /Recover belongings from Well Bottom/)).toBeVisible();
  await screen.getByRole('button', /Recover belongings from Well Bottom/).tap();
  await app.restart();
  await screen.getByRole('button', 'Continue').tap();
  await screen.getByRole('button', /^Contents, Character/).tap();
  await screen.getByRole('button', 'Equipment & Inventory').tap();
  await expect(screen.getByRole('button', 'a torch, open')).toBeVisible();
});
