// The scene page (book-ui.md, Chapters, scenes and recovery; Book treatments). Only drawing.
import { Pressable, View } from 'react-native';
import { Text } from './Text.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { plain } from './model.ts';
import type { Button } from './presenter.ts';
import { useArrival } from './card.ts';
import { UnderInk } from './UnderInk.tsx';
import type { Treatment } from './heldLayer.ts';
import { size } from './tokens.ts';
import { Reanimated } from './fade.ts';
import { prose, usePalette, useType } from './palette.ts';
import { ContinueButton } from './actions.tsx';
import { Page, useTitleFocus } from './pages.tsx';

type Say = (key: string) => string;

type Props = {
  view: GameView;
  text: Say;
  next?: Button;
  press: (b: Button) => void;
  treatment?: Treatment; // the screen's: none under a fault
};

/**
 * A modal scene: its text, then Continue (book-ui.md, Chapters, scenes and recovery). A treated
 * scene (book-ui.md, Book treatments) draws over its treatment's held layer: the line rises, a tap
 * completes it, and Continue shows once it is whole; only Continue sends.
 * - Use: while a scene holds the foreground.
 * - Story: ChapterPages.stories.tsx
 */
export function ScenePage(p: Props) {
  const s = p.view.scene!;
  return <Scene key={`${s.scene.key}:${s.index}`} {...p} />; // each line arrives afresh
}

/**
 * One line of it, unkeyed (the hook rig in effects_turn.test.ts draws this).
 * - Use: inside ScenePage only.
 * - Story: ChapterPages.stories.tsx
 */
export function Scene(p: Props) {
  const c = usePalette();
  const t = useType();
  const scene = p.view.scene!;
  const { full, complete, line, shown } = useArrival(!!p.treatment);
  const page = (
    <Page paperless={!!p.treatment}>
      <Reanimated.View style={line}>
        <Text {...useTitleFocus()} style={prose(c, t)}>
          {plain(p.text(scene.line))}
        </Text>
      </Reanimated.View>
      {p.next && full && (
        <Reanimated.View style={shown}>
          <ContinueButton label={p.next.label} onPress={() => p.press(p.next!)} />
        </Reanimated.View>
      )}
      {p.next && !full && <View style={{ minHeight: size.card }} />}
    </Page>
  );
  if (!p.treatment) return page;
  return (
    <View style={{ flex: 1 /* mutate-skip: layout */ }}>
      <UnderInk view={p.view} treatment={p.treatment} />
      <Pressable
        accessible={false}
        focusable={false}
        style={{ flex: 1 /* mutate-skip: layout */ }}
        onPress={full ? undefined : complete}
      >
        {page}
      </Pressable>
    </View>
  );
}
