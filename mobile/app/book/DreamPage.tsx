import type { GameView } from '../../packages/game-view/session.ts';
import type { Page as Route } from './model.ts';
// A resumable child of the actual bed, using the existing detail/control grammar.
import { Text } from './Text.tsx';
import type { Button, presenter } from './presenter.ts';
import { dreamAt, dreamOwner } from './dreams.ts';
import { ActionCard, Cards } from './actions.tsx';
import { LogLines } from './lines.tsx';
import { Control, Page } from './pages.tsx';
import { prose, usePalette, useType } from './palette.ts';
import { LABEL } from './labels.ts';

type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;
/**
 * A resumable bed dream as an anchored detail page of the bed (book-ui.md, Chapters, scenes and
 * recovery).
 * - Use: the dream route.
 * - Rules: Close returns to the bed; ordinary World access stays.
 * - Story: ChapterPages.stories.tsx
 */
export function DreamPage(p: {
  screen: Screen;
  id: string;
  press: (b: Button, detail?: string) => void;
  close: () => void;
}) {
  const c = usePalette();
  const t = useType();
  const dream = dreamAt(p.screen.view, p.id),
    owner = dreamOwner(p.id);
  if (!dream) return null;
  const buttons = p.screen.buttons.filter((b) => b.detail_id === owner);
  return (
    <Page
      title={p.screen.text(dream.title)}
      foot={<Control label={LABEL.close} onPress={p.close} />}
    >
      <Text style={prose(c, t)}>{p.screen.text(dream.description)}</Text>
      <LogLines lines={p.screen.detail(owner)} />
      <Text style={prose(c, t)}>{p.screen.text(dream.line)}</Text>
      <Cards>
        {buttons.map((b) => (
          <ActionCard
            key={b.action_key + JSON.stringify(b.input)}
            b={b}
            press={(b) => p.press(b, owner)}
          />
        ))}
      </Cards>
    </Page>
  );
}

/**
 * The bed notice's Resume dream Control; a finished dream's bed shows nothing extra (owner, 2026-10-30).
 * - Use: a bed notice's detail.
 * - States: dream available; dream finished (nothing).
 * - Story: NoticePage.stories.tsx
 */
export function DreamResume(p: {
  detail: NonNullable<GameView['notices']>[number];
  open: (page: Route) => void;
}) {
  const d = p.detail.dream;
  return d?.available ? (
    <Control label={LABEL.resumeDream} onPress={() => p.open({ kind: 'dream', id: p.detail.id })} />
  ) : null;
}
