// Book routes the browser tests share: a new game, a walk by the map, the lit torch and a reopen.
import { expect, type TestFixtures } from 'e2e';

export type Screen = TestFixtures['screen'];

// A cleared save, the ancestry picked and the opening continued, at the Ferry Landing.
export async function begin(
  { app, screen }: Pick<TestFixtures, 'app' | 'screen'>,
  ancestry: string,
) {
  await app.clearState();
  await screen.getByRole('button', ancestry).tap();
  await screen.getByRole('button', 'Continue').tap();
  await expect(screen.getByRole('button', 'Look, Ferry Landing')).toBeVisible();
}

// One step by the Map page; with a room, the step must arrive there.
export async function go(screen: Screen, direction: string, room?: string) {
  await screen.getByRole('button', 'Map').tap();
  await screen.getByRole('button', `Go ${direction}`).tap();
  if (room) await expect(screen.getByRole('button', `Look, ${room}`)).toBeVisible();
}

export async function inventory(screen: Screen) {
  await screen.getByRole('button', /^Contents, Character/).tap();
  await screen.getByRole('button', 'Equipment & Inventory').tap();
}

// At the Chandler: buy a torch from Peg for 3p and light it.
export async function litTorch(screen: Screen) {
  await screen.getByRole('button', /Peg Harrow, open/).tap();
  await screen.getByRole('button', 'Buy a torch — 3p').tap();
  await screen.getByRole('button', 'Leave').tap();
  await inventory(screen);
  await screen.getByRole('button', 'a torch, open').tap();
  await screen.getByRole('button', 'Ignite a torch').tap();
  await screen.getByRole('button', 'Leave').tap();
}

export async function reopen({ app, screen }: Pick<TestFixtures, 'app' | 'screen'>) {
  await app.restart();
  await screen.getByRole('button', 'Continue').tap();
}
