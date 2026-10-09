// Page stories (storybook-plan-2026-10-08.md C): a generated view (stories/views, scenarios.ts) drawn
// by the real BookView, its buttons from the real buttonsOf and its words from Chapter 1's text table.
import type { StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { fn } from 'storybook/test';
import wasm from 'canvaskit-wasm/bin/full/canvaskit.wasm?url';
import chapter from '../../../protocol/fixtures/missing_child_v042_hash.json';
import type { Game, GameView } from '../../packages/game-view/session.ts';
import type { BookView as View_ } from '../book/Book.tsx';
import { buttonsOf, type Page } from '../book/model.ts';
import type { DetailLine, presenter } from '../book/presenter.ts';
import { color } from '../book/tokens.ts';
import { sayers } from '../book/words.ts';

type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;
export type Saved = {
  view: GameView;
  stack: Page[];
  log: DetailLine[];
  combatLog: string[];
  details: Record<string, DetailLine[]>;
};
const table: Record<string, string> = chapter.value.text;
const { text, label } = sayers({ text: (key: string) => table[key] } as Game);

/** The presenter's screen for a saved view; `shell` sets a shell state (pending, a fault). */
export const screenFrom = (saved: Saved, shell: Partial<Screen> = {}): Screen => ({
  view: saved.view,
  text,
  label,
  buttons: buttonsOf(saved.view, label, text),
  log: saved.log,
  combatLog: saved.combatLog,
  detail: (id: string) => saved.details[id] ?? [],
  pending: false,
  catchingUp: false,
  fault: undefined,
  returnWorld: undefined,
  returnDetail: undefined,
  confirmedRead: undefined,
  ...shell,
});

// PageTurn (inside BookView) builds its shader at import, so the Book loads after CanvasKit.
const loadBook = async () => {
  const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web/LoadSkiaWeb');
  await LoadSkiaWeb({ locateFile: () => wasm });
  return { BookView: (await import('../book/Book.tsx')).BookView };
};

/** A whole-page story: the saved view in a phone-high frame, every press a spy. The status clock
 * (e.g. "18:00 · dusk") is the saved view's; the toolbar palette repaints the page, not the hour. */
export const pageStory = (saved: unknown, shell?: Partial<Screen>): StoryObj => ({
  loaders: [loadBook],
  render: (_, { loaded, globals }) => {
    const { BookView } = loaded as { BookView: typeof View_ };
    const view = saved as Saved;
    return (
      <View style={{ height: '100vh' as never }}>
        <BookView
          palette={color[globals.palette as keyof typeof color] ?? color.light}
          screen={screenFrom(view, shell)}
          stack={view.stack}
          flip={{ turn: 0, dir: 1 }}
          go={fn()}
          press={fn()}
          refused={fn()}
          startOver={fn()}
          shell={{ confirm: (go) => go(), learned: { seen: () => true, see: () => {} } }}
        />
      </View>
    );
  },
});
