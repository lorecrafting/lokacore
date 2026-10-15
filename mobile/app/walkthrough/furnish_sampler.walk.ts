import { walk, settle, moves } from './walk.ts';
walk('1-furnish', 'furnish', async (r) => {
  await r.app.clearState();
  await settle();
  for (const l of '/^Got it|/^A rug is here|/^Take|go:north|/opens Contents|/^Equipment|/rug|/^Drop'
    .split('|')
    .filter(Boolean)) {
    await settle();
    if (l.startsWith('go:')) await moves(r.screen, l.slice(3));
    else
      await r.screen
        .getByRole('button', l.startsWith('/') ? new RegExp(l.slice(1)) : l)
        .first()
        .tap();
  }
});
