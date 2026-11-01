// Web preview `?preview=page-turn` (App.web.tsx): PageTurn between two real Book pages, a Page with
// Continue (turns forward; no chapter card, which turns itself) and Settings (Start over here turns
// back). Not the live Book.
import { useState } from 'react';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import { fonts } from './App.tsx';
import { PageTurn } from './book/PageTurn.tsx';
import { ContinueButton } from './book/actions.tsx';
import { LABEL } from './book/labels.ts';
import { Page } from './book/pages.tsx';
import { SettingsPage } from './book/sections.tsx';
import { usePalette } from './book/palette.ts';

export default function PageTurnPreview() {
  const [loaded] = useFonts(fonts);
  const c = usePalette();
  const [at, setAt] = useState({ turn: 0, dir: 1 as 1 | -1 });
  const go = (dir: 1 | -1) => setAt((a) => ({ turn: a.turn + 1, dir }));
  if (!loaded) return null;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <PageTurn turn={at.turn} dir={at.dir} paper={c.bg}>
        {at.turn % 2 ? (
          <SettingsPage startOver={() => go(-1)} world={() => go(-1)} />
        ) : (
          <Page title="The Missing Child">
            <ContinueButton label={LABEL.continue} onPress={() => go(1)} />
          </Page>
        )}
      </PageTurn>
    </View>
  );
}
