import { View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { Blow } from './Blow.tsx';
import { Foot } from './Combat.tsx';
import { LABEL } from './labels.ts';
import { LogLines } from './lines.tsx';
import type { DetailLine } from './logs.ts';
import { Page } from './pages.tsx';
import { space } from './tokens.ts';
import { UnderInk } from './UnderInk.tsx';

type Props = {
  view: GameView;
  dead: { title: string; log: DetailLine[]; lines: DetailLine[] }; // the room died in: its title's text and kept log; the death's lines
  letGo: () => void;
};

/**
 * The dead page (book-ui.md, Dead page): a death outside a fight, on the World page of the room died
 * in, over any page, scene or treatment open.
 * - Use: Body, while the presenter's `dead` is set (until Let go, a fault or a reopen).
 * - Rules: the kept room title; that room's log then the death receipt's lines; one foot, Let go; no
 *   paragraphs, people, links or running head. The fatal hold and rim rise as it mounts (Blow `dead`).
 * - States: dead.
 * - Story: DeadPage.stories.tsx
 */
export function DeadPage(p: Props) {
  return (
    <Blow dead under={<UnderInk view={p.view} dead />}>
      <Page
        paperless
        title={p.dead.title}
        fixedTitle
        scrollToEnd
        foot={<Foot label={LABEL.letGo} onPress={p.letGo} />}
      >
        <View style={{ gap: space.sm }}>
          {/* Two logs, one pitch: LogLines' own line gap across the seam. */}
          <LogLines lines={p.dead.log} />
          <LogLines lines={p.dead.lines} />
        </View>
      </Page>
    </Blow>
  );
}
