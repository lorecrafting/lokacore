// A view's room tag and exposed flag, down to the bed heard and the sky drawn (book-ui.md, Beds; Storm).
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import type { GameView } from '../../../packages/game-view/session.ts';
import { validate } from '../../../authority/local-story/__tests__/validate.ts';

const stub = (source: string) => ({
  url: `data:text/javascript,${encodeURIComponent(source)}`,
  shortCircuit: true,
});
const g = globalThis as any;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === './Storm.tsx')
      return stub('export const Storm=(p)=>{globalThis.sky=p;return null}');
    if (specifier === './sound.ts')
      return stub(`const quiet=()=>{};export const ambience=(...a)=>{globalThis.bed=a},
        thunder=quiet,play=quiet,fight=quiet,setMuted=quiet,sources=quiet,explore=quiet,
        chapterDuck=quiet,playTurn=quiet,duck=quiet`);
    return next(specifier, context);
  },
});
// Effects run only inside useCueSounds below; the rig reads this at load, so it comes first.
let effects = false;
g[Symbol.for('combat-effect')] = (run: () => void) => void (effects && run());
const { BookView, color, game, nodes, view } = await import('./combat-book.test.ts');
const { presenter } = await import('../presenter.ts');
const { useCueSounds } = await import('../useCueSounds.ts');

// Breaks: Book reads another field for the bed or the sky, or drops one on the way down.
test('place.sound and place.exposed reach the bed and the sky', () => {
  const { combat: _, ...peace } = view();
  const current = {
    ...peace,
    actor_id: 'a7b8c9d0-e1f2-4a3b-9c4d-6e7f8a9b0c1d',
    entities: [{ ...peace.entities[0], id: 'd4e5f6a7-b8c9-4d0e-9f1a-3b4c5d6e7f8a' }],
    calendar_status: { day: 1, hour: 8, subdivision: 0, weather: 'storm' },
    place: {
      id: 'b4e5f6a7-b8c9-4d0e-9f1a-3b4c5d6e7f8a',
      title: { key: 'room.title' },
      description: { key: 'room.description' },
      sound: 'shore',
      exposed: true,
    },
  } as GameView;
  assert.deepEqual(validate('GameView', current), []);
  const screen = presenter(game(current)).screen();
  effects = true;
  useCueSounds(screen, 0);
  effects = false;
  assert.deepEqual(g.bed, ['shore', 'storm', true]);
  nodes(
    BookView({
      palette: color.light,
      screen,
      stack: [],
      flip: { turn: 0, dir: 1 },
      go: () => {},
      press: () => {},
      refused: () => {},
      startOver: () => {},
      shell: { confirm: (f: () => void) => f(), learned: { get: () => true } },
    } as never),
  );
  assert.equal(g.sky?.weather, 'storm');
  assert.equal(g.sky?.exposed, true);
  assert.equal(g.sky?.room, 'b4e5f6a7-b8c9-4d0e-9f1a-3b4c5d6e7f8a');
});
