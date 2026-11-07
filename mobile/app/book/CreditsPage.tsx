// Each distinct credit, in the manifest's file order; the manifest is the only source of the words.
import { creditsOf } from './credits.ts';
import { LABEL } from './labels.ts';
import { Control, Page } from './pages.tsx';
import { usePalette, useType } from './palette.ts';
import sounds from './sounds/manifest.json' with { type: 'json' };
import { Text } from './Text.tsx';

/**
 * Credits: the bundled audio's attributions (book-ui.md, Settings), the Notice shape.
 * - Use: Settings only.
 * - Rules: one `type.log` `fg` line per distinct credit in sounds/manifest.json; no other words.
 * - Story: SectionPages.stories.tsx
 */
export function CreditsPage(p: { back: () => void }) {
  const c = usePalette();
  const t = useType();
  return (
    <Page title={LABEL.credits} foot={<Control label={LABEL.backToSettings} onPress={p.back} />}>
      {creditsOf(sounds).map((line) => (
        <Text key={line} style={{ ...t.log, color: c.fg }}>
          {line}
        </Text>
      ))}
    </Page>
  );
}
